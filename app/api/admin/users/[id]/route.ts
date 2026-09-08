import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAuthenticatedAdmin, isAdminNational, hashPassword } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminNational(session.user)) {
      return NextResponse.json(
        { error: "Access denied. Only Admin_national can modify user accounts." },
        { status: 403 }
      );
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required." }, { status: 400 });
    }

    const body = await req.json();
    const { status, name, password, resetPassword } = body;

    // Guard: Prevent self-suspension
    if (session.user.id === targetUserId && status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Action prohibited: You cannot suspend your own administrative account." },
        { status: 400 }
      );
    }

    let temporaryPasswordGenerated: string | null = null;
    let newPasswordHash: string | null = null;
    if (password || resetPassword) {
      const pwToUse =
        typeof password === "string" && password.trim().length >= 8
          ? password.trim()
          : "Temp#" + crypto.randomBytes(4).toString("hex") + "!";

      temporaryPasswordGenerated = pwToUse;
      newPasswordHash = hashPassword(pwToUse);
    }

    const updatedUser = await withEcSql(async (sql) => {
      // Check user exists
      const existing = await sql`
        SELECT id, email, name, role, status FROM "User" WHERE id = ${targetUserId} LIMIT 1
      `;
      if (existing.length === 0) {
        throw new Error("Target user not found.");
      }

      const sets = [sql`"updatedAt" = NOW()`];
      if (status) {
        sets.push(sql`status = ${status}::"UserStatus"`);
      }
      if (name && typeof name === "string" && name.trim()) {
        sets.push(sql`name = ${name.trim()}`);
      }
      if (newPasswordHash) {
        sets.push(sql`"passwordHash" = ${newPasswordHash}`);
        sets.push(sql`"passwordChanged" = false`);
        sets.push(sql`"passwordChangedAt" = NULL`);
      }

      const updated = await sql`
        UPDATE "User"
        SET ${sets.reduce((prev, curr) => sql`${prev}, ${curr}`)}
        WHERE id = ${targetUserId}
        RETURNING id, email, name, role, status, "passwordChanged", "passwordChangedAt", "updatedAt"
      `;

      // If suspended, revoke all active sessions for this user
      if (status === "SUSPENDED") {
        await sql`
          UPDATE "Session"
          SET "revokedAt" = NOW()
          WHERE "userId" = ${targetUserId} AND "revokedAt" IS NULL
        `;
      }

      return { prev: existing[0], curr: updated[0] };
    });

    const clientIp = getClientIp(req);

    // Audit log user modification with IP sync
    await logAuditEvent({
      req,
      actorId: session.user.id,
      action: "USER_UPDATE",
      resource: "User",
      resourceId: targetUserId,
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        targetUserId,
        targetEmail: updatedUser.curr.email,
        targetName: updatedUser.curr.name,
        previousStatus: updatedUser.prev.status,
        newStatus: updatedUser.curr.status,
        passwordReset: !!(password || resetPassword),
        performedBy: session.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${updatedUser.curr.name} updated successfully.`,
      user: updatedUser.curr,
      temporaryPassword: temporaryPasswordGenerated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error updating user";
    console.error("User update error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
