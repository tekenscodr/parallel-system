import { NextResponse } from "next/server";
import {
  parseCookies,
  revokeSession,
  clearSessionCookie,
  getAuthenticatedAdmin,
  SESSION_COOKIE_NAME,
} from "@/lib/admin-auth";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    const clientIp = getClientIp(req);

    if (session) {
      await logAuditEvent({
        req,
        actorId: session.user.id,
        action: "LOGOUT",
        resource: "User",
        resourceId: session.user.id,
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent"),
        metadata: {
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
        },
      });
    }

    const cookies = parseCookies(req.headers.get("cookie"));
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) {
      await revokeSession(token);
    }
    const res = NextResponse.json({ success: true, message: "Logged out successfully." });
    res.headers.set("Set-Cookie", clearSessionCookie());
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Logout error";
    console.error("Logout error:", msg);
    const res = NextResponse.json({ success: true });
    res.headers.set("Set-Cookie", clearSessionCookie());
    return res;
  }
}
