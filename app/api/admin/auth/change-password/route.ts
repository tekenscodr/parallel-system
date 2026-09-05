import { NextResponse } from "next/server";
import { withEcSql } from "@/lib/db-ec";
import {
  verifyPassword,
  hashPassword,
  createSession,
  buildSessionCookie,
  getAuthenticatedAdmin,
} from "@/lib/admin-auth";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, currentPassword, newPassword, confirmPassword } = body;

    // Validate password inputs
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Current password is required." },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent");

    // Check if called with an active authenticated session
    const activeSession = await getAuthenticatedAdmin(req);

    let targetUserId: string;
    let targetEmail: string;
    let targetName: string;
    let targetRole: string;
    let targetStatus: string;
    let currentStoredHash: string;

    if (activeSession) {
      // Authenticated user changing their own password
      targetUserId = activeSession.user.id;
      targetEmail = activeSession.user.email;
      targetName = activeSession.user.name;
      targetRole = activeSession.user.role;
      targetStatus = activeSession.user.status;

      // Fetch stored hash for verification
      const dbUser = await withEcSql(async (sql) => {
        const rows = await sql`
          SELECT id, email, name, "passwordHash", role, status
          FROM "User"
          WHERE id = ${targetUserId}
          LIMIT 1
        `;
        return rows[0] || null;
      });

      if (!dbUser) {
        return NextResponse.json({ error: "User account not found." }, { status: 404 });
      }
      currentStoredHash = dbUser.passwordHash;
    } else {
      // Unauthenticated / Login-time password resubmit
      if (!email || typeof email !== "string") {
        return NextResponse.json(
          { error: "Account email is required to resubmit password." },
          { status: 400 }
        );
      }

      const cleanEmail = email.trim().toLowerCase();
      const dbUser = await withEcSql(async (sql) => {
        const rows = await sql`
          SELECT id, email, name, "passwordHash", role, status
          FROM "User"
          WHERE LOWER(email) = ${cleanEmail}
          LIMIT 1
        `;
        return rows[0] || null;
      });

      if (!dbUser) {
        return NextResponse.json(
          { error: "Invalid email or current password." },
          { status: 401 }
        );
      }

      targetUserId = dbUser.id;
      targetEmail = dbUser.email;
      targetName = dbUser.name;
      targetRole = dbUser.role;
      targetStatus = dbUser.status;
      currentStoredHash = dbUser.passwordHash;
    }

    // Verify current password
    const isCurrentValid = verifyPassword(currentPassword, currentStoredHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "Invalid email or current password." },
        { status: 401 }
      );
    }

    // Check account status
    if (targetStatus !== "ACTIVE") {
      return NextResponse.json(
        { error: "This account is currently suspended or inactive." },
        { status: 403 }
      );
    }

    // Compute new PBKDF2 hash
    const newHash = hashPassword(newPassword);

    // Update passwordHash in ec-data database
    await withEcSql(async (sql) => {
      await sql`
        UPDATE "User"
        SET 
          "passwordHash" = ${newHash},
          "updatedAt" = NOW()
        WHERE id = ${targetUserId}
      `;
    });

    // Record audit event with verified IP sync
    await logAuditEvent({
      actorId: targetUserId,
      action: "PASSWORD_CHANGE",
      resource: "User",
      resourceId: targetUserId,
      ipAddress: clientIp,
      userAgent,
      metadata: {
        email: targetEmail,
        name: targetName,
        role: targetRole,
        mode: activeSession ? "AUTHENTICATED_SESSION" : "LOGIN_RESUBMIT",
        authMethod: "PASSWORD_PBKDF2",
      },
    });

    // If submitted from login screen, establish session and log user in immediately
    let token: string | undefined;
    let cookieHeader: string | undefined;

    if (!activeSession) {
      const session = await createSession(targetUserId, req);
      token = session.token;
      cookieHeader = buildSessionCookie(session.token, session.expiresAt);
    }

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully.",
      token,
      user: {
        id: targetUserId,
        email: targetEmail,
        name: targetName,
        role: targetRole,
      },
    });

    if (cookieHeader) {
      response.headers.set("Set-Cookie", cookieHeader);
    }

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("Password change error:", msg);
    return NextResponse.json(
      { error: "An unexpected error occurred while updating the password." },
      { status: 500 }
    );
  }
}
