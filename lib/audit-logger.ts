import crypto from "node:crypto";
import { withEcSql } from "./db-ec";

export interface AuditEventInput {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress: string;
  userAgent?: string | null;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Extract real client IP address from incoming HTTP request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const fastlyIp = req.headers.get("fastly-client-ip");
  if (fastlyIp && fastlyIp.trim()) return fastlyIp.trim();

  return "127.0.0.1";
}

/**
 * Record an immutable audit log entry in the PostgreSQL AuditEvent table.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const eventId = "audit_" + crypto.randomBytes(12).toString("hex");
  const requestId = crypto.randomUUID();
  const metaJson = input.metadata ? JSON.stringify(input.metadata) : "{}";
  const userAgent = input.userAgent || "Unknown";
  const deviceId = input.deviceId || "web";

  try {
    await withEcSql(async (sql) => {
      await sql`
        INSERT INTO "AuditEvent" (
          id,
          "actorId",
          action,
          resource,
          "resourceId",
          "requestId",
          "ipAddress",
          "deviceId",
          metadata,
          "occurredAt",
          "userAgent"
        ) VALUES (
          ${eventId},
          ${input.actorId ?? null},
          ${input.action},
          ${input.resource},
          ${input.resourceId ?? null},
          ${requestId},
          ${input.ipAddress},
          ${deviceId},
          ${metaJson}::jsonb,
          NOW(),
          ${userAgent}
        )
      `;
    });
  } catch (err: unknown) {
    // Non-blocking catch to prevent audit failure from aborting primary operation, but log to stderr
    console.error("Failed to write audit event:", err instanceof Error ? err.message : err);
  }
}

/**
 * Compute the field-level diff between original and updated executive records.
 */
export function diffExecutiveRecords(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const auditedFields = [
    "executiveName",
    "position",
    "executiveLevel",
    "slotStatus",
    "region",
    "constituency",
    "electoralArea",
    "pollingStation",
    "gender",
    "phone",
    "email",
    "ghanaCard",
    "voterId",
    "membershipId",
    "dateOfBirth",
    "status",
  ];

  for (const field of auditedFields) {
    const prevVal = prev[field] !== undefined ? prev[field] : null;
    const nextVal = next[field] !== undefined ? next[field] : null;

    // Compare stringified representations or direct equality
    const pStr = prevVal === null || prevVal === undefined ? "" : String(prevVal).trim();
    const nStr = nextVal === null || nextVal === undefined ? "" : String(nextVal).trim();

    if (pStr !== nStr) {
      diff[field] = { from: prevVal, to: nextVal };
    }
  }

  return diff;
}
