import { NextResponse } from "next/server";
import { getAuthenticatedAdmin, isAdminNational } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Super user verification: Only ADMIN_NATIONAL or ADMIN can revert deleted records
    if (!isAdminNational(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super user privileges required to revert deleted voters." },
        { status: 403 }
      );
    }

    const { id: deletionIdStr } = await params;
    const deletionId = parseInt(deletionIdStr, 10);
    if (isNaN(deletionId)) {
      return NextResponse.json({ error: "Invalid deletion record ID" }, { status: 400 });
    }

    const clientIp = getClientIp(req);

    return await withEcSql(async (sql) => {
      // 1. Fetch the deleted record snapshot
      const records = await sql`
        SELECT *
        FROM deleted_voters
        WHERE deletion_id = ${deletionId}
        LIMIT 1
      `;

      const rec = records[0];
      if (!rec) {
        return NextResponse.json({ error: "Deleted voter record not found in archive" }, { status: 404 });
      }

      if (rec.revert_status === "RESTORED") {
        return NextResponse.json(
          { error: `This record was already reverted on ${new Date(rec.reverted_at).toLocaleString()}` },
          { status: 400 }
        );
      }

      // 2. Check if original_id is currently available in executives_all
      const existingActive = await sql`
        SELECT id FROM executives_all WHERE id = ${rec.original_id} LIMIT 1
      `;

      let targetId = rec.original_id;
      if (existingActive.length > 0) {
        // ID occupied; generate next available ID
        const maxRow = await sql`SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM executives_all`;
        targetId = parseInt(maxRow[0].next_id, 10);
      }

      // 3. Re-insert the executive into executives_all
      await sql`
        INSERT INTO executives_all (
          id,
          executive_level,
          slot_status,
          region,
          constituency,
          electoral_area,
          polling_station,
          position,
          executive_name,
          membership_id,
          phone,
          email,
          ghana_card,
          voter_id,
          gender,
          date_of_birth,
          age,
          is_youth_organiser,
          is_age_adjusted,
          record_entered_by,
          status,
          image_url
        ) VALUES (
          ${targetId},
          ${rec.executive_level},
          ${rec.slot_status},
          ${rec.region},
          ${rec.constituency},
          ${rec.electoral_area},
          ${rec.polling_station},
          ${rec.position},
          ${rec.executive_name},
          ${rec.membership_id},
          ${rec.phone},
          ${rec.email},
          ${rec.ghana_card},
          ${rec.voter_id},
          ${rec.gender},
          ${rec.date_of_birth},
          ${rec.age},
          ${rec.is_youth_organiser},
          ${rec.is_age_adjusted},
          ${rec.record_entered_by},
          ${rec.status},
          ${rec.image_url}
        )
      `;

      // 4. Mark record as RESTORED in deleted_voters
      await sql`
        UPDATE deleted_voters
        SET 
          revert_status = 'RESTORED',
          reverted_at = NOW(),
          reverted_by_id = ${session.user.id},
          reverted_by_name = ${session.user.name}
        WHERE deletion_id = ${deletionId}
      `;

      // 5. Log AuditEvent
      await logAuditEvent({
        req,
        actorId: session.user.id,
        action: "EXECUTIVE_RESTORE",
        resource: "executives_all",
        resourceId: String(targetId),
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent"),
        metadata: {
          deletionId,
          restoredExecutiveName: rec.executive_name,
          originalId: rec.original_id,
          restoredId: targetId,
          position: rec.position,
          region: rec.region,
          constituency: rec.constituency,
          userEmail: session.user.email,
          userName: session.user.name,
          userRole: session.user.role,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Executive "${rec.executive_name}" has been successfully restored to the active register.`,
        restoredId: targetId,
      });
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error restoring deleted executive";
    console.error("Executive revert error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
