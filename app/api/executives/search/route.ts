import { NextRequest, NextResponse } from "next/server";
import { withEcSql } from "@/lib/db-ec";
import {
  getConstituencyFilterVariants,
  normalizeConstituency,
  normalizeRegionName,
} from "@/lib/constituency-normalizer";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const region = searchParams.get("region")?.trim() || "";
    const constituency = searchParams.get("constituency")?.trim() || "";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    if (!q && !region && !constituency) {
      return NextResponse.json(
        { success: false, message: "Please provide a search term or region/constituency." },
        { status: 400 }
      );
    }

    const results = await withEcSql(async (sql) => {
      const searchPattern = q ? `%${q.toLowerCase()}%` : null;
      const regionFilter = region && region !== "ALL" ? region : null;
      const constFilter = constituency && constituency !== "ALL" ? constituency : null;
      const constVariants = constFilter ? getConstituencyFilterVariants(constFilter) : [];

      return await sql`
        SELECT 
          id,
          executive_name,
          executive_level,
          region,
          constituency,
          electoral_area,
          polling_station,
          position,
          phone,
          email,
          ghana_card,
          voter_id,
          gender,
          date_of_birth,
          age,
          image_url,
          status
        FROM executives_all
        WHERE (${regionFilter}::text IS NULL OR UPPER(TRIM(region)) = UPPER(TRIM(${regionFilter})))
          AND (${constFilter}::text IS NULL OR UPPER(TRIM(constituency)) = ANY(${constVariants}))
          AND (${searchPattern}::text IS NULL OR (
            LOWER(executive_name) LIKE ${searchPattern}
            OR phone LIKE ${q + "%"}
            OR voter_id LIKE ${q + "%"}
            OR ghana_card ILIKE ${searchPattern}
            OR LOWER(position) LIKE ${searchPattern}
          ))
        ORDER BY executive_name ASC
        LIMIT ${limit};
      `;
    });

    const normalizedResults = results.map((r: any) => {
      const normReg = r.region ? normalizeRegionName(r.region) : r.region;
      const normConst =
        normReg === "External Branch"
          ? String(r.constituency || "").trim()
          : r.constituency
          ? normalizeConstituency(r.constituency)
          : r.constituency;
      return {
        ...r,
        region: normReg,
        constituency: normConst,
      };
    });

    return NextResponse.json({
      success: true,
      count: normalizedResults.length,
      executives: normalizedResults,
    });
  } catch (error: any) {
    console.error("[EXECUTIVES SEARCH API] Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to search executives." },
      { status: 500 }
    );
  }
}
