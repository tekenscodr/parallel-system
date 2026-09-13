import { NextResponse } from "next/server";
import { validateAdminSession, clearSessionCookie } from "@/lib/admin-auth";

export async function GET(req: Request) {
  try {
    const result = await validateAdminSession(req);
    if (!result.authenticated) {
      const response = NextResponse.json(
        {
          authenticated: false,
          error: result.error,
          reason: result.reason,
          code: result.reason === "expired" ? "SESSION_EXPIRED" : "UNAUTHORIZED",
          expired: result.reason === "expired",
        },
        { status: 401 }
      );
      if (result.reason === "expired" || result.reason === "revoked") {
        response.headers.set("Set-Cookie", clearSessionCookie());
      }
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: result.session.user,
      expiresAt: result.session.expiresAt.toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    console.error("Auth check error in /api/admin/auth/me:", msg);
    return NextResponse.json(
      { authenticated: false, error: msg },
      { status: 500 }
    );
  }
}
