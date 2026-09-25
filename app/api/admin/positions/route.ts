import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { normalizePosition, getPositionRank } from "@/lib/position-matcher";

function normalizeLevelKey(lvl?: string | null): string {
  if (!lvl) return "Constituency";
  const trimmed = lvl.trim();
  if (/^region/i.test(trimmed)) return "Region";
  if (/^national/i.test(trimmed)) return "National";
  if (/^constituency/i.test(trimmed)) return "Constituency";
  if (/^external/i.test(trimmed)) return "External Branch";
  if (/^tescon/i.test(trimmed)) return "TESCON";
  if (/^electoral/i.test(trimmed)) return "Electoral Area";
  if (/^polling/i.test(trimmed)) return "Polling Station";
  return trimmed;
}

const BASELINE_POSITIONS: Record<string, string[]> = {
  National: [
    "President",
    "Former President",
    "Current Flagbearer / Former Vice President",
    "Flagbearer",
    "Presidential Candidate",
    "Running Mate",
    "Former Running Mate",
    "Vice-Presidential Candidate",
    "Speaker of Parliament",
    "Former Speaker of Parliament",
    "Member of Parliament",
    "National Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "3rd Vice-Chairperson",
    "General Secretary",
    "Deputy General Secretary",
    "National Treasurer",
    "Deputy National Treasurer",
    "National Organiser",
    "Deputy National Organiser",
    "National Women Organiser",
    "Deputy National Women Organiser",
    "National Youth Organiser",
    "Deputy National Youth Organiser",
    "National Nasara Coordinator",
    "Deputy National Nasara Coordinator",
    "National Nasara Organiser",
    "Deputy National Nasara Organiser",
    "Director of Finance and Administration",
    "Director of Elections",
    "Director of Research",
    "Director of Research and Elections",
    "Research Officer",
    "National Communication Director",
    "Deputy Communication Director",
    "External Relations Officer",
    "Deputy External Relations Officer",
    "Director of IT",
    "Deputy Director of IT",
    "Director of Protocol",
    "Deputy Director of Protocol",
    "Chairman of The Legal Committee",
    "Director of Legal Affairs",
    "National Council Representative",
    "Former National Chairman",
    "Past National Chairman",
    "Former General Secretary",
    "Past General Secretary",
    "Council of Elders",
    "National Council of Elders",
    "Chairman, National Council of Elders",
    "Chairman, Council of Elders",
    "Council of Elders / Past National Officer",
    "Past National Officer / Elder",
    "Council of Patrons",
    "National Council of Patrons",
    "Chairman, National Council of Patrons",
    "Chairman, Council of Patrons",
    "Foundation Member",
  ],
  Region: [
    "Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "Secretary",
    "Deputy Secretary",
    "Treasurer",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Nasara Coordinator",
    "Financial Secretary",
    "Electoral Affairs Officer",
    "Communication Officer",
    "Research Officer",
    "PWD Coordinator",
    "Deputy Organiser",
    "Deputy Women Organiser",
    "Deputy Youth Organiser",
    "Deputy Nasara Coordinator",
    "Special Duties Officer",
    "Legal Representative Officer",
  ],
  Constituency: [
    "Member of Parliament",
    "Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "Secretary",
    "Deputy Secretary",
    "Treasurer",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Nasara Organiser",
    "Financial Secretary",
    "Electoral Affairs Officer",
    "Communication Officer",
    "Research Officer",
    "PWD Coordinator",
    "Deputy Organiser",
    "Deputy Women Organiser",
    "Deputy Youth Organiser",
    "Deputy Nasara Organiser",
    "Special Duties Officer",
    "Legal Representative Officer",
  ],
  "External Branch": [
    "Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "Secretary",
    "Deputy Secretary",
    "Treasurer",
    "Financial Secretary",
    "Organiser",
    "Deputy Organiser",
    "Women Organiser",
    "Deputy Women Organiser",
    "Youth Organiser",
    "Deputy Youth Organiser",
    "Nasara Organiser",
    "Deputy Nasara Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Research Officer",
    "PWD Coordinator",
    "Special Duties Officer",
    "Legal Representative Officer",
  ],
  TESCON: [
    "President",
    "TESCON President",
    "WOCOM",
    "TESCON WOCOM",
    "Nasara Coordinator",
    "TESCON Nasara Coordinator",
    "Secretary",
    "Organiser",
    "Treasurer",
    "Financial Secretary",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Patron",
    "TESCON Patron",
  ],
  "Electoral Area": [
    "Chairperson",
    "Coordinator",
    "Secretary",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Nasara Coordinator",
    "Treasurer",
    "Financial Secretary",
  ],
  "Polling Station": [
    "Chairperson",
    "Secretary",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Nasara Coordinator",
    "Treasurer",
    "Financial Secretary",
  ],
};

BASELINE_POSITIONS["Regional"] = BASELINE_POSITIONS["Region"];

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
    const rawLevel = url.searchParams.get("level")?.trim() || "";
    const normLevel = rawLevel ? normalizeLevelKey(rawLevel) : "";
    const now = Date.now();

    if (!cachedPositionsByLevel || now - cacheTimestamp > CACHE_TTL_MS) {
      const grouped: Record<string, Set<string>> = {
        ALL: new Set<string>(),
      };

      for (const [lvlKey, positions] of Object.entries(BASELINE_POSITIONS)) {
        if (!grouped[lvlKey]) grouped[lvlKey] = new Set<string>();
        for (const p of positions) {
          grouped[lvlKey].add(p);
          grouped.ALL.add(p);
        }
      }

      try {
        const rows = await withEcSql(async (sql) => {
          return await sql`
            SELECT DISTINCT executive_level, TRIM(position) as position
            FROM executives_all
            WHERE position IS NOT NULL AND TRIM(position) != ''
            ORDER BY executive_level, position ASC
          `;
        });

        for (const r of rows) {
          const lvl = normalizeLevelKey(r.executive_level);
          if (!grouped[lvl]) {
            grouped[lvl] = new Set<string>();
          }
          const canonical = normalizePosition(r.position, lvl);
          if (canonical) {
            grouped[lvl].add(canonical);
            grouped.ALL.add(canonical);
          }
        }
      } catch (dbErr) {
        console.warn("[POSITIONS_API] Database query failed, using baseline positions:", dbErr);
      }

      const result: Record<string, string[]> = {};
      for (const key of Object.keys(grouped)) {
        result[key] = Array.from(grouped[key]).sort((a, b) => {
          const rankA = getPositionRank(a, key);
          const rankB = getPositionRank(b, key);
          if (rankA !== rankB) return rankA - rankB;
          return a.localeCompare(b);
        });
      }

      cachedPositionsByLevel = result;
      cacheTimestamp = now;
    }

    const positions = normLevel
      ? cachedPositionsByLevel[normLevel] ||
        cachedPositionsByLevel[rawLevel] ||
        BASELINE_POSITIONS[normLevel] ||
        []
      : cachedPositionsByLevel.ALL || [];

    return NextResponse.json({
      level: normLevel || rawLevel || null,
      positions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load positions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
