import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const region = url.searchParams.get("region")?.trim() || "";

    // Constituency filter is strictly tied to region
    if (!region) {
      return NextResponse.json({ constituencies: [] });
    }

    const rows = await withEcSql(async (sql) => {
      return await sql`
        SELECT DISTINCT UPPER(TRIM(constituency)) as name
        FROM executives_all
        WHERE constituency IS NOT NULL 
          AND constituency != ''
          AND region ILIKE ${region}
        ORDER BY name ASC
      `;
    });

    return NextResponse.json({
      region,
      constituencies: rows.map((r) => r.name),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load constituencies";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
