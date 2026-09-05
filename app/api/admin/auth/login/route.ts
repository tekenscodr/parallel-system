import { NextResponse } from "next/server";
import { withEcSql } from "@/lib/db-ec";
import {
  verifyPassword,
  createSession,
  buildSessionCookie,
} from "@/lib/admin-auth";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query user in ec-data using request-scoped client
    const user = await withEcSql(async (sql) => {
      const users = await sql`
        SELECT id, email, name, "passwordHash", role, status
        FROM "User"
        WHERE LOWER(email) = ${cleanEmail}
        LIMIT 1
      `;
      return users[0] || null;
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Check account status
    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is suspended or inactive." },
        { status: 403 }
      );
    }

    // Verify role is admin_national, ADMIN, or NATIONAL
    const roleUpper = String(user.role).toUpperCase();
    if (roleUpper !== "ADMIN_NATIONAL" && roleUpper !== "ADMIN" && roleUpper !== "NATIONAL") {
      return NextResponse.json(
        { error: "Access restricted: This dashboard requires national administrator or officer privileges." },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Create session in ec-data
    const { token, expiresAt } = await createSession(user.id, req);
    const cookieHeader = buildSessionCookie(token, expiresAt);

    // Audit log successful login with IP sync
    const clientIp = getClientIp(req);
    await logAuditEvent({
      req,
      actorId: user.id,
      action: "LOGIN",
      resource: "User",
      resourceId: user.id,
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        email: user.email,
        name: user.name,
        role: user.role,
        authMethod: "PASSWORD_PBKDF2",
      },
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.headers.set("Set-Cookie", cookieHeader);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal authentication error";
    console.error("Admin login error:", msg);
    return NextResponse.json(
      { error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
