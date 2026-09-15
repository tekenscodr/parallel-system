import { NextResponse } from "next/server";
import { getAuthenticatedAdmin, isAdminNational } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Super user verification: Only ADMIN_NATIONAL or ADMIN can view deleted records
    if (!isAdminNational(session.user)) {
      return NextResponse.json(
        { error: "Forbidden: Super user privileges required to view deleted voters." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const region = (searchParams.get("region") || "").trim();
    const status = (searchParams.get("status") || "DELETED").trim().toUpperCase();
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    return await withEcSql(async (sql) => {
      // Build dynamic filters
      let baseQuery = sql`
        SELECT 
          deletion_id,
          original_id,
          executive_name,
          position,
          executive_level,
          region,
          constituency,
          electoral_area,
          polling_station,
          voter_id,
          phone,
          gender,
          age,
          status,
          image_url,
          deleted_at,
          deleted_by_id,
          deleted_by_name,
          deleted_by_email,
          deleted_by_role,
          revert_status,
          reverted_at,
          reverted_by_name
        FROM deleted_voters
        WHERE revert_status = ${status}
      `;

      if (region && region !== "all") {
        baseQuery = sql`${baseQuery} AND lower(region) = lower(${region})`;
      }

      if (search) {
        const searchPattern = `%${search}%`;
        baseQuery = sql`${baseQuery} AND (
          executive_name ILIKE ${searchPattern} OR
          voter_id ILIKE ${searchPattern} OR
          constituency ILIKE ${searchPattern} OR
          position ILIKE ${searchPattern} OR
          phone ILIKE ${searchPattern}
        )`;
      }

      // Count total matching
      const countRows = await sql`
        SELECT COUNT(*) as count FROM (${baseQuery}) as filtered
      `;
      const total = parseInt(countRows[0]?.count || "0", 10);

      // Fetch page
      const rows = await sql`
        ${baseQuery}
        ORDER BY deleted_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return NextResponse.json({
        success: true,
        records: rows,
        total,
        limit,
        offset,
      });
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error fetching deleted voters";
    console.error("Fetch deleted voters error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
