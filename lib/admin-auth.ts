import crypto from "node:crypto";
import { withEcSql } from "./db-ec";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export type AdminSession = {
  sessionId: string;
  expiresAt: Date;
  user: AdminUser;
};

export const SESSION_COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 100000;
  const hash = crypto
    .pbkdf2Sync(password, Buffer.from(salt, "hex"), iterations, 32, "sha256")
    .toString("hex");
  return `pbkdf2:sha256:${iterations}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length === 5 && parts[0] === "pbkdf2" && parts[1] === "sha256") {
    const iterations = parseInt(parts[2], 10);
    const salt = Buffer.from(parts[3], "hex");
    const expected = Buffer.from(parts[4], "hex");
    const actual = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  }
  return false;
}

export async function createSession(
  userId: string,
  req?: Request
): Promise<{ token: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const sessionId = "sess_" + crypto.randomBytes(12).toString("hex");

  let ipAddress = "127.0.0.1";
  let userAgent = "Unknown";
  let deviceId = "browser_" + crypto.randomBytes(8).toString("hex");

  if (req) {
    ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "127.0.0.1";
    userAgent = req.headers.get("user-agent") || "Unknown";
  }

  await withEcSql(async (sql) => {
    await sql`
      INSERT INTO "Session" (
        id, "tokenHash", "userId", "deviceId", "ipAddress", "userAgent", "expiresAt", "createdAt", "lastSeenAt"
      ) VALUES (
        ${sessionId}, ${tokenHash}, ${userId}, ${deviceId}, ${ipAddress}, ${userAgent}, ${expiresAt}, NOW(), NOW()
      )
    `;
  });

  return { token: rawToken, expiresAt };
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) {
      cookies[key.trim()] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export async function getAuthenticatedAdmin(
  req: Request
): Promise<AdminSession | null> {
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  const authHeader = req.headers.get("authorization");

  let rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken && authHeader?.startsWith("Bearer ")) {
    rawToken = authHeader.substring(7).trim();
  }

  if (!rawToken) {
    return null;
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  return await withEcSql(async (sql) => {
    const rows = await sql`
      SELECT 
        s.id as "sessionId",
        s."expiresAt",
        s."revokedAt",
        u.id as "userId",
        u.email,
        u.name,
        u.role,
        u.status
      FROM "Session" s
      INNER JOIN "User" u ON u.id = s."userId"
      WHERE s."tokenHash" = ${tokenHash}
        AND s."expiresAt" > NOW()
        AND s."revokedAt" IS NULL
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    if (row.status !== "ACTIVE") {
      return null;
    }

    const roleUpper = String(row.role).toUpperCase();
    if (roleUpper !== "ADMIN_NATIONAL" && roleUpper !== "ADMIN" && roleUpper !== "NATIONAL") {
      return null;
    }

    // Extract real IP and update lastSeenAt + ipAddress cleanly in the same connection context
    let currentIp = "127.0.0.1";
    if (req) {
      currentIp =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip")?.trim() ||
        req.headers.get("cf-connecting-ip")?.trim() ||
        "127.0.0.1";
      await sql`UPDATE "Session" SET "lastSeenAt" = NOW(), "ipAddress" = ${currentIp} WHERE id = ${row.sessionId}`;
    } else {
      await sql`UPDATE "Session" SET "lastSeenAt" = NOW() WHERE id = ${row.sessionId}`;
    }

    return {
      sessionId: row.sessionId,
      expiresAt: new Date(row.expiresAt),
      user: {
        id: row.userId,
        email: row.email,
        name: row.name,
        role: row.role,
        status: row.status,
      },
    };
  });
}

export function isAdminNational(user: AdminUser | { role: string } | null | undefined): boolean {
  if (!user || !user.role) return false;
  const r = String(user.role).toUpperCase();
  return r === "ADMIN_NATIONAL" || r === "ADMIN";
}

export function isNationalUser(user: AdminUser | { role: string } | null | undefined): boolean {
  if (!user || !user.role) return false;
  const r = String(user.role).toUpperCase();
  return r === "NATIONAL";
}

export async function revokeSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await withEcSql(async (sql) => {
    await sql`
      UPDATE "Session" 
      SET "revokedAt" = NOW() 
      WHERE "tokenHash" = ${tokenHash}
    `;
  });
}

export function buildSessionCookie(token: string, expiresAt: Date): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Expires=${expiresAt.toUTCString()}; HttpOnly; SameSite=Lax${secureFlag}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
}
