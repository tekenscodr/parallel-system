import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { normalizeConstituency, getConstituenciesForRegion } from "@/lib/constituency-normalizer";

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

    if (region.toLowerCase() === "external branch" || region.toLowerCase() === "external") {
      return NextResponse.json({
        region: "External Branch",
        constituencies: [...getConstituenciesForRegion("External Branch")].sort((a, b) => a.localeCompare(b)),
      });
    }

    const set = new Set<string>();

    // 1. Add all official canonical constituencies for this region
    const officialList = getConstituenciesForRegion(region);
    for (const c of officialList) {
      const norm = normalizeConstituency(c);
      if (norm) set.add(norm);
    }

    // 2. Also union with any distinct constituencies present in executives_all for this region
    try {
      const rows = await withEcSql(async (sql) => {
        return await sql`
          SELECT DISTINCT TRIM(constituency) as name
          FROM executives_all
          WHERE constituency IS NOT NULL 
            AND constituency != ''
            AND region ILIKE ${region}
          ORDER BY name ASC
        `;
      });

      for (const r of rows) {
        const norm = normalizeConstituency(r.name);
        if (norm) set.add(norm);
      }
    } catch {
      // If DB read fails, official list is preserved
    }

    const constituencies = Array.from(set).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      region,
      constituencies,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load constituencies";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
