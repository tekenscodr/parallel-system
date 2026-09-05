import crypto from "node:crypto";
import { withEcSql } from "./db-ec";

export interface AuditEventInput {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string;
  userAgent?: string | null;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Checks whether an IP address is a private, loopback, or link-local address.
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, "").trim().toLowerCase();
  if (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "localhost" ||
    clean === "0.0.0.0" ||
    clean === "unknown"
  ) {
    return true;
  }
  // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
  if (clean.startsWith("10.")) return true;
  if (clean.startsWith("192.168.")) return true;
  if (clean.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  // IPv6 private & link-local ranges: fc00::/7, fe80::/10
  if (clean.startsWith("fc") || clean.startsWith("fd") || clean.startsWith("fe80")) return true;
  return false;
}

/**
 * Normalizes an IP address (stripping IPv6 mapped IPv4 prefix and port numbers).
 */
export function normalizeIp(ip: string): string {
  if (!ip) return "127.0.0.1";
  let cleaned = ip.trim();
  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:154.162.58.130 -> 154.162.58.130)
  if (cleaned.startsWith("::ffff:")) {
    cleaned = cleaned.substring(7);
  }
  // Remove port if present (e.g. 154.162.58.130:44321)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(cleaned)) {
    cleaned = cleaned.split(":")[0];
  }
  return cleaned;
}

/**
 * Extract genuine client IP address from incoming HTTP request headers.
 * Prioritizes direct CDN/proxy authoritative visitor headers, then smart
 * non-private IP parsing of X-Forwarded-For chains, and client-verified headers.
 */
export function getClientIp(req: Request): string {
  // 1. Cloudflare connecting IP (tamper-proof from Cloudflare edge)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && !isPrivateOrLoopbackIp(cfIp)) {
    return normalizeIp(cfIp);
  }

  // 2. Cloudflare Enterprise / Akamai True-Client-IP
  const trueClientIp = req.headers.get("true-client-ip");
  if (trueClientIp && !isPrivateOrLoopbackIp(trueClientIp)) {
    return normalizeIp(trueClientIp);
  }

  // 3. Nginx / Apache / Reverse proxy Real IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp && !isPrivateOrLoopbackIp(realIp)) {
    return normalizeIp(realIp);
  }

  // 4. Client-reported public IP header (verified from browser external lookup)
  const clientPublicIp =
    req.headers.get("x-client-public-ip") ||
    req.headers.get("x-client-ip") ||
    req.headers.get("x-genuine-client-ip");
  if (clientPublicIp && !isPrivateOrLoopbackIp(clientPublicIp)) {
    return normalizeIp(clientPublicIp);
  }

  // 5. Smart X-Forwarded-For parsing: find the first non-private public IP in proxy chain
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => normalizeIp(p));
    // Find the first genuine public IP in the forwarding chain
    const firstPublic = parts.find((ip) => ip && !isPrivateOrLoopbackIp(ip));
    if (firstPublic) {
      return firstPublic;
    }
    if (parts[0]) {
      return parts[0];
    }
  }

  // 6. RFC 7239 Forwarded header (e.g. for=192.0.2.60;proto=http;by=203.0.113.43)
  const rfcForwarded = req.headers.get("forwarded");
  if (rfcForwarded) {
    const match = rfcForwarded.match(/for=(?:\[?)([a-zA-Z0-9.:_-]+)(?:\]?)/i);
    if (match && match[1] && !isPrivateOrLoopbackIp(match[1])) {
      return normalizeIp(match[1]);
    }
  }

  // 7. Fastly & Other CDNs
  const fastlyIp = req.headers.get("fastly-client-ip");
  if (fastlyIp && !isPrivateOrLoopbackIp(fastlyIp)) {
    return normalizeIp(fastlyIp);
  }

  const clusterIp = req.headers.get("x-cluster-client-ip");
  if (clusterIp && !isPrivateOrLoopbackIp(clusterIp)) {
    return normalizeIp(clusterIp);
  }

  // 8. Fallback to raw cfIp, realIp, clientPublicIp, or forwarded if in private LAN/dev
  if (cfIp) return normalizeIp(cfIp);
  if (realIp) return normalizeIp(realIp);
  if (clientPublicIp) return normalizeIp(clientPublicIp);
  if (forwarded) return normalizeIp(forwarded.split(",")[0]);

  return "127.0.0.1";
}

/**
 * Record an immutable audit log entry in the PostgreSQL AuditEvent table.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const eventId = "audit_" + crypto.randomBytes(12).toString("hex");
  const requestId = crypto.randomUUID();
  const metaJson = input.metadata ? JSON.stringify(input.metadata) : "{}";

  let ip = input.ipAddress;
  let userAgent = input.userAgent;
  let deviceId = input.deviceId;

  if (input.req) {
    if (!ip || isPrivateOrLoopbackIp(ip)) {
      const extracted = getClientIp(input.req);
      if (!isPrivateOrLoopbackIp(extracted) || !ip) {
        ip = extracted;
      }
    }
    if (!userAgent) {
      userAgent = input.req.headers.get("user-agent") || "Unknown";
    }
    if (!deviceId || deviceId === "web") {
      const headerDevId = input.req.headers.get("x-device-id");
      if (headerDevId) {
        deviceId = headerDevId.slice(0, 64);
      }
    }
  }

  if (!ip) {
    ip = "127.0.0.1";
  }
  if (!userAgent) {
    userAgent = "Unknown";
  }
  if (!deviceId) {
    deviceId = "web";
  }

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
          ${ip},
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
