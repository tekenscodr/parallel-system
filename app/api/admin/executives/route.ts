import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const url = new URL(req.url);
    const level = url.searchParams.get("level")?.trim() || "";
    const region = url.searchParams.get("region")?.trim() || "";
    const constituency = url.searchParams.get("constituency")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const cohort = url.searchParams.get("cohort")?.trim() || "";
    const slot = url.searchParams.get("slot")?.trim() || "";

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

    const result = await withEcSql(async (sql) => {
      const conditions = [];

      if (level) {
        conditions.push(sql`executive_level = ${level}`);
      }
      if (region) {
        conditions.push(sql`region ILIKE ${region}`);
      }
      if (constituency) {
        conditions.push(sql`constituency ILIKE ${constituency}`);
      }
      if (search) {
        const s = `%${search}%`;
        conditions.push(
          sql`(executive_name ILIKE ${s} OR voter_id ILIKE ${s} OR position ILIKE ${s} OR constituency ILIKE ${s})`
        );
      }
      if (slot === "elected") {
        conditions.push(sql`slot_status NOT ILIKE '%Appointed%' AND status NOT ILIKE '%Appointed%'`);
      } else if (slot === "appointed") {
        conditions.push(sql`(slot_status ILIKE '%Appointed%' OR status ILIKE '%Appointed%')`);
      }

      if (cohort === "women") {
        conditions.push(sql`gender = 'Female'`);
      } else if (cohort === "nasara") {
        conditions.push(sql`position ILIKE '%nasara%'`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

      const [countRes, rowsRes] = await Promise.all([
        sql`SELECT COUNT(*)::int as total FROM executives_all ${whereClause}`,
        sql`
          SELECT 
            id,
            executive_level as "executiveLevel",
            slot_status as "slotStatus",
            region,
            constituency,
            electoral_area as "electoralArea",
            polling_station as "pollingStation",
            position,
            executive_name as "executiveName",
            membership_id as "membershipId",
            email,
            ghana_card as "ghanaCard",
            voter_id as "voterId",
            gender,
            status
          FROM executives_all
          ${whereClause}
          ORDER BY id ASC
          LIMIT ${limit} OFFSET ${offset}
        `
      ]);

      const total = countRes[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: rowsRes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages
        }
      };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Executives query failed";
    console.error("Executives API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
