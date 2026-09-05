import { NextResponse } from "next/server";
import { getAuthenticatedAdmin, isAdminNational } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminNational(session.user)) {
      return NextResponse.json(
        { error: "Access denied. Only Admin_national can view the system audit trail." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get("actorId") || "";
    const action = searchParams.get("action") || "";
    const ipAddress = searchParams.get("ipAddress") || "";
    const q = searchParams.get("q") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    const data = await withEcSql(async (sql) => {
      // Dynamic conditions using postgres library syntax
      const rows = await sql`
        SELECT 
          a.id,
          a."actorId",
          a.action,
          a.resource,
          a."resourceId",
          a."requestId",
          a."ipAddress",
          a."deviceId",
          a.metadata,
          a."occurredAt",
          a."userAgent",
          COALESCE(u.email, 'system') as "actorEmail",
          COALESCE(u.name, 'System Process') as "actorName",
          COALESCE(u.role::text, 'SYSTEM') as "actorRole"
        FROM "AuditEvent" a
        LEFT JOIN "User" u ON u.id = a."actorId"
        WHERE 
          (${actorId} = '' OR a."actorId" = ${actorId})
          AND (${action} = '' OR a.action = ${action})
          AND (${ipAddress} = '' OR a."ipAddress" = ${ipAddress})
          AND (${q} = '' OR a.metadata::text ILIKE ${'%' + q + '%'} OR a."resourceId" ILIKE ${'%' + q + '%'} OR u.email ILIKE ${'%' + q + '%'} OR u.name ILIKE ${'%' + q + '%'})
        ORDER BY a."occurredAt" DESC
        LIMIT ${limit}
        OFFSET ${offset};
      `;

      const countRes = await sql`
        SELECT COUNT(*)::int as total
        FROM "AuditEvent" a
        LEFT JOIN "User" u ON u.id = a."actorId"
        WHERE 
          (${actorId} = '' OR a."actorId" = ${actorId})
          AND (${action} = '' OR a.action = ${action})
          AND (${ipAddress} = '' OR a."ipAddress" = ${ipAddress})
          AND (${q} = '' OR a.metadata::text ILIKE ${'%' + q + '%'} OR a."resourceId" ILIKE ${'%' + q + '%'} OR u.email ILIKE ${'%' + q + '%'} OR u.name ILIKE ${'%' + q + '%'});
      `;

      // Unique distinct actions & distinct IPs for filter dropdowns
      const actionsRes = await sql`
        SELECT DISTINCT action FROM "AuditEvent" ORDER BY action ASC;
      `;

      const ipsRes = await sql`
        SELECT DISTINCT "ipAddress" FROM "AuditEvent" WHERE "ipAddress" IS NOT NULL ORDER BY "ipAddress" ASC LIMIT 30;
      `;

      return {
        events: rows,
        total: countRes[0]?.total || 0,
        availableActions: actionsRes.map((r: any) => String(r.action)),
        availableIps: ipsRes.map((r: any) => String(r.ipAddress)),
      };
    });

    return NextResponse.json({
      events: data.events,
      pagination: {
        page,
        limit,
        total: data.total,
        totalPages: Math.ceil(data.total / limit),
      },
      availableActions: data.availableActions,
      availableIps: data.availableIps,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error loading audit trail";
    console.error("Audit log error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
