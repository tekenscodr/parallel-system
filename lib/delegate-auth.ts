import crypto from "node:crypto";
import { withEcSql } from "./db-ec";
import { normalizePhoneNumber, maskPhoneNumber } from "./sms";
import { getDelegateEntitledPositions, isTesconPatron, type DelegateRecord, type EntitledPosition } from "./voting-entitlement";

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || "npp-voting-delegate-secret-2026";
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

// In-memory fallback / cache for fast lookups and resilient operation
interface InMemoryOtp {
  identifier: string;
  phone: string;
  voterId: string;
  code: string;
  attempts: number;
  expiresAt: number;
  verified: boolean;
}
const memoryOtpStore = new Map<string, InMemoryOtp>();

export interface DelegateSessionData {
  delegateId: number | string;
  name: string;
  voterId: string;
  phone: string;
  level: string;
  region: string;
  constituency: string;
  position: string;
  gender: string;
  age: number | null;
  dateOfBirth: string | null;
  entitledPositions: EntitledPosition[];
  verifiedAt: string;
  expiresAt: number;
}

/**
 * Initialize the delegate_otps table in PostgreSQL if it doesn't already exist.
 */
let tableInitialized = false;
export async function ensureOtpTableExists(): Promise<void> {
  if (tableInitialized) return;
  try {
    await withEcSql(async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS delegate_otps (
          id SERIAL PRIMARY KEY,
          identifier VARCHAR(100) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          voter_id VARCHAR(50),
          otp_code VARCHAR(10) NOT NULL,
          attempts INT DEFAULT 0,
          verified BOOLEAN DEFAULT FALSE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_delegate_otps_lookup ON delegate_otps(identifier, verified, expires_at)
      `;
    });
    tableInitialized = true;
  } catch (err: any) {
    // If DB is offline or table already exists, continue with memory store fallback
    console.warn("[DELEGATE AUTH] Using resilient OTP store:", err.message);
  }
}

/**
 * Find an eligible delegate from executives_all by Voter ID or Phone number.
 */
export async function findDelegate(identifier: string): Promise<{
  delegate: DelegateRecord | null;
  error?: string;
}> {
  const raw = identifier.trim();
  if (!raw) {
    return { delegate: null, error: "Please enter a valid Voter ID or Phone number." };
  }

  const phoneDigits = normalizePhoneNumber(raw);
  const isDigitsOnly = /^\d+$/.test(raw.replace(/\s+/g, ""));
  const cleanId = raw.toUpperCase().replace(/\s+/g, "");

  try {
    const rows = await withEcSql(async (sql) => {
      // Search by voter_id or normalized phone
      return await sql<DelegateRecord[]>`
        SELECT 
          id, 
          executive_name, 
          executive_level, 
          position, 
          region, 
          constituency, 
          polling_station, 
          voter_id, 
          membership_id, 
          gender, 
          date_of_birth, 
          age, 
          phone, 
          image_url
        FROM executives_all
        WHERE (
          UPPER(TRIM(voter_id)) = ${cleanId}
          OR (TRIM(voter_id) != '' AND TRIM(voter_id) = ${raw})
          OR (${phoneDigits.length >= 8} AND (
            REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = ${phoneDigits}
            OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + phoneDigits.slice(-9)}
          ))
        )
        ORDER BY id ASC
        LIMIT 5
      `;
    });

    if (!rows || rows.length === 0) {
      return {
        delegate: null,
        error: "Verification failed. No delegate record found matching the provided Voter ID or Phone number.",
      };
    }

    // Filter for legitimate executive levels
    const validRows = rows.filter((r) => {
      const lvl = String(r.executive_level || "").toLowerCase().trim();
      return ["constituency", "region", "regional", "national", "tescon", "external branch"].includes(lvl);
    });

    if (validRows.length === 0) {
      return {
        delegate: null,
        error: "Found voter record, but the account is not registered under an active electoral college executive level.",
      };
    }

    const candidate = validRows[0];

    // Check if TESCON Patron (constitutionally barred from voting)
    if (isTesconPatron(candidate)) {
      return {
        delegate: null,
        error: "TESCON Patrons are advisory members and are not entitled to vote in party executive elections.",
      };
    }

    return { delegate: candidate };
  } catch (err: any) {
    console.error("[DELEGATE AUTH] DB lookup error:", err.message);
    return {
      delegate: null,
      error: "Unable to verify delegate record at this time. Please try again shortly.",
    };
  }
}

/**
 * Generate a cryptographically secure 6-digit OTP and store it.
 */
export async function createOtp(
  identifier: string,
  phone: string,
  voterId: string
): Promise<string> {
  const normKey = identifier.toLowerCase().trim();
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  // Always save in memory
  memoryOtpStore.set(normKey, {
    identifier: normKey,
    phone,
    voterId,
    code,
    attempts: 0,
    expiresAt,
    verified: false,
  });

  // Also save to DB if available
  try {
    await ensureOtpTableExists();
    await withEcSql(async (sql) => {
      await sql`
        INSERT INTO delegate_otps (identifier, phone, voter_id, otp_code, expires_at)
        VALUES (${normKey}, ${phone}, ${voterId}, ${code}, ${new Date(expiresAt)})
      `;
    });
  } catch (err: any) {
    console.warn("[DELEGATE AUTH] Falling back to memory OTP store:", err.message);
  }

  return code;
}

/**
 * Verify OTP entered by delegate.
 */
export async function verifyOtp(
  identifier: string,
  inputOtp: string
): Promise<{ success: boolean; error?: string }> {
  const normKey = identifier.toLowerCase().trim();
  const cleanInput = inputOtp.trim();

  if (!cleanInput || cleanInput.length < 4) {
    return { success: false, error: "Please enter a valid verification code." };
  }

  // 1. Check memory store first
  const memRecord = memoryOtpStore.get(normKey);
  if (memRecord) {
    if (memRecord.verified) {
      return { success: false, error: "This OTP has already been used. Please request a new one." };
    }
    if (Date.now() > memRecord.expiresAt) {
      memoryOtpStore.delete(normKey);
      return { success: false, error: "The verification code has expired. Please request a new one." };
    }
    if (memRecord.attempts >= MAX_OTP_ATTEMPTS) {
      memoryOtpStore.delete(normKey);
      return { success: false, error: "Too many incorrect attempts. Please request a new OTP." };
    }

    if (memRecord.code !== cleanInput) {
      memRecord.attempts++;
      return { success: false, error: `Incorrect code. ${MAX_OTP_ATTEMPTS - memRecord.attempts} attempts remaining.` };
    }

    // Match successful!
    memRecord.verified = true;
    return { success: true };
  }

  // 2. Fallback to database check
  try {
    const rows = await withEcSql(async (sql) => {
      return await sql<Array<{ id: number; otp_code: string; attempts: number; expires_at: Date; verified: boolean }>>`
        SELECT id, otp_code, attempts, expires_at, verified
        FROM delegate_otps
        WHERE identifier = ${normKey}
        ORDER BY created_at DESC
        LIMIT 1
      `;
    });

    if (!rows || rows.length === 0) {
      return { success: false, error: "No active verification code found for this identifier. Please request an OTP." };
    }

    const dbRecord = rows[0];
    if (dbRecord.verified) {
      return { success: false, error: "This OTP has already been verified." };
    }
    if (new Date(dbRecord.expires_at).getTime() < Date.now()) {
      return { success: false, error: "The verification code has expired. Please request a new one." };
    }
    if (dbRecord.attempts >= MAX_OTP_ATTEMPTS) {
      return { success: false, error: "Too many incorrect attempts. Please request a new code." };
    }

    if (dbRecord.otp_code !== cleanInput) {
      await withEcSql(async (sql) => {
        await sql`UPDATE delegate_otps SET attempts = attempts + 1 WHERE id = ${dbRecord.id}`;
      });
      return { success: false, error: "Incorrect verification code. Please try again." };
    }

    await withEcSql(async (sql) => {
      await sql`UPDATE delegate_otps SET verified = TRUE WHERE id = ${dbRecord.id}`;
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: "Verification failed. Please retry." };
  }
}

/**
 * Sign session payload into token string.
 */
export function signDelegateSession(data: DelegateSessionData): string {
  const json = JSON.stringify(data);
  const b64 = Buffer.from(json).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
  return `${b64}.${signature}`;
}

/**
 * Verify and unpack session token.
 */
export function verifyDelegateSession(token: string | null | undefined): DelegateSessionData | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [b64, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
  if (signature !== expectedSig) return null;

  try {
    const json = Buffer.from(b64, "base64url").toString("utf8");
    const data: DelegateSessionData = JSON.parse(json);
    if (Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Extract delegate session from incoming request (Cookie or Authorization header).
 */
export function getDelegateSession(req: Request): DelegateSessionData | null {
  // Check Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const session = verifyDelegateSession(token);
    if (session) return session;
  }

  // Check Cookie header
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/delegate_voting_session=([^;]+)/);
  if (match) {
    const token = decodeURIComponent(match[1]);
    const session = verifyDelegateSession(token);
    if (session) return session;
  }

  return null;
}
