import { NextResponse } from "next/server";
import {
  parseCookies,
  revokeSession,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
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
