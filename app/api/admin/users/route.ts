import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAuthenticatedAdmin, isAdminNational, hashPassword } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminNational(session.user)) {
      return NextResponse.json(
        { error: "Access denied. Only Admin_national can view user accounts." },
        { status: 403 }
      );
    }

    const users = await withEcSql(async (sql) => {
      return await sql`
        SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.status,
          u."createdAt",
          u."updatedAt",
          (
            SELECT s."lastSeenAt"
            FROM "Session" s
            WHERE s."userId" = u.id
            ORDER BY s."lastSeenAt" DESC
            LIMIT 1
          ) as "lastSeenAt",
          (
            SELECT s."ipAddress"
            FROM "Session" s
            WHERE s."userId" = u.id
            ORDER BY s."lastSeenAt" DESC
            LIMIT 1
          ) as "lastIpAddress",
          (
            SELECT COUNT(*)::int
            FROM "Session" s
            WHERE s."userId" = u.id 
              AND s."expiresAt" > NOW() 
              AND s."revokedAt" IS NULL
          ) as "activeSessionsCount"
        FROM "User" u
        ORDER BY 
          CASE WHEN u.role = 'ADMIN_NATIONAL' THEN 1 ELSE 2 END,
          u."createdAt" DESC;
      `;
    });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error loading users";
    console.error("Users list error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminNational(session.user)) {
      return NextResponse.json(
        { error: "Access denied. Only Admin_national can create users." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, name, password, role } = body;

    // Validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "A valid name is required." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const targetRole = role === "ADMIN_NATIONAL" ? "ADMIN_NATIONAL" : "NATIONAL";

    const clientIp = getClientIp(req);

    const newUser = await withEcSql(async (sql) => {
      // Check existing email
      const existing = await sql`
        SELECT id FROM "User" WHERE LOWER(email) = ${cleanEmail} LIMIT 1
      `;
      if (existing.length > 0) {
        throw new Error("A user with this email address already exists.");
      }

      const userId = "usr_" + crypto.randomBytes(10).toString("hex");
      const passwordHash = hashPassword(password);

      const inserted = await sql`
        INSERT INTO "User" (
          id, email, name, "passwordHash", role, status, "createdAt", "updatedAt"
        ) VALUES (
          ${userId}, ${cleanEmail}, ${cleanName}, ${passwordHash}, ${targetRole}, 'ACTIVE', NOW(), NOW()
        )
        RETURNING id, email, name, role, status, "createdAt"
      `;

      return inserted[0];
    });

    // Audit log user creation with IP sync
    await logAuditEvent({
      req,
      actorId: session.user.id,
      action: "USER_CREATE",
      resource: "User",
      resourceId: newUser.id,
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        createdUserId: newUser.id,
        createdUserEmail: newUser.email,
        createdUserName: newUser.name,
        createdUserRole: newUser.role,
        createdByAdmin: session.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${newUser.name} (${newUser.role}) created successfully.`,
      user: newUser,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error creating user";
    console.error("User creation error:", msg);
    const status = msg.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
