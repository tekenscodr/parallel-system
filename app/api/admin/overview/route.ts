import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    // Run parallel queries on ec-data in scoped connection
    const result = await withEcSql(async (sql) => {
      const [totalsRes, tiersRes, demographicsRes, regionsRes] = await Promise.all([
        sql`
          SELECT 
            COUNT(*)::int as total,
            COUNT(CASE WHEN date_of_birth IS NOT NULL AND date_of_birth != '' THEN 1 END)::int as with_dob,
            COUNT(CASE WHEN age < 40 THEN 1 END)::int as under_40,
            COUNT(CASE WHEN age = 40 THEN 1 END)::int as equal_40,
            COUNT(CASE WHEN is_age_adjusted = TRUE THEN 1 END)::int as youth_adjusted,
            COUNT(CASE WHEN gender = 'Female' THEN 1 END)::int as women,
            COUNT(CASE WHEN position ILIKE '%nasara%' THEN 1 END)::int as nasara,
            COUNT(CASE WHEN slot_status ILIKE '%Appointed%' OR status ILIKE '%Appointed%' THEN 1 END)::int as appointed,
            COUNT(CASE WHEN slot_status NOT ILIKE '%Appointed%' AND status NOT ILIKE '%Appointed%' THEN 1 END)::int as elected
          FROM executives_all
        `,
        sql`
          SELECT 
            executive_level as level,
            COUNT(*)::int as count,
            COUNT(CASE WHEN age < 40 THEN 1 END)::int as under_40,
            COUNT(CASE WHEN gender = 'Female' THEN 1 END)::int as women
          FROM executives_all
          GROUP BY executive_level
          ORDER BY count DESC
        `,
        sql`
          SELECT 
            COALESCE(NULLIF(gender, ''), 'Unspecified') as label,
            COUNT(*)::int as count
          FROM executives_all
          GROUP BY gender
          ORDER BY count DESC
        `,
        sql`
          SELECT 
            COALESCE(NULLIF(region, ''), 'National/Unassigned') as region,
            COUNT(*)::int as count,
            COUNT(CASE WHEN age < 40 THEN 1 END)::int as under_40
          FROM executives_all
          GROUP BY region
          ORDER BY count DESC
        `
      ]);

      return {
        totals: totalsRes[0] || {
          total: 0, with_dob: 0, under_40: 0, equal_40: 0, youth_adjusted: 0,
          women: 0, nasara: 0, appointed: 0, elected: 0
        },
        tiers: tiersRes,
        genderDistribution: demographicsRes,
        regionalDistribution: regionsRes,
      };
    });

    return NextResponse.json({
      ...result,
      user: session.user
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Overview query failed";
    console.error("Overview API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
