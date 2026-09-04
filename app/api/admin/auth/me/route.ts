import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json(
        { authenticated: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
      expiresAt: session.expiresAt,
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
