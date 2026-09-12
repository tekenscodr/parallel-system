import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { normalizePosition } from "@/lib/position-matcher";

// In-memory cache with 10-minute TTL
let cachedPositionsByLevel: Record<string, string[]> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const level = url.searchParams.get("level")?.trim() || "";
    const now = Date.now();

    if (!cachedPositionsByLevel || now - cacheTimestamp > CACHE_TTL_MS) {
      const rows = await withEcSql(async (sql) => {
        return await sql`
          SELECT DISTINCT executive_level, TRIM(position) as position
          FROM executives_all
          WHERE position IS NOT NULL AND TRIM(position) != ''
          ORDER BY executive_level, position ASC
        `;
      });

      const grouped: Record<string, Set<string>> = {
        ALL: new Set<string>(),
      };

      for (const r of rows) {
        const lvl = r.executive_level || "Other";
        if (!grouped[lvl]) {
          grouped[lvl] = new Set<string>();
        }
        const canonical = normalizePosition(r.position, lvl);
        if (canonical) {
          grouped[lvl].add(canonical);
          grouped.ALL.add(canonical);
        }
      }

      const result: Record<string, string[]> = {};
      for (const key of Object.keys(grouped)) {
        result[key] = Array.from(grouped[key]).sort((a, b) => a.localeCompare(b));
      }

      cachedPositionsByLevel = result;
      cacheTimestamp = now;
    }

    const positions = level
      ? cachedPositionsByLevel[level] || []
      : cachedPositionsByLevel.ALL || [];

    return NextResponse.json({
      level: level || null,
      positions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load positions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
