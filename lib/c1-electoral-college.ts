import type postgres from "postgres";

/**
 * Returns a postgres.js SQL condition that strictly restricts queries on `executives_all`
 * to all females in the Electoral College:
 * 1. Electoral College Tiers: National, Regional, Constituency, External Branch, TESCON.
 *    (Polling Station, Electoral Area, and Regional TESCON are strictly excluded).
 * 2. Non-TESCON tiers: Must be Female (LOWER(TRIM(gender)) = 'female') and not TESCON.
 * 3. TESCON tier:
 *    - Must NOT be a patron (position NOT ILIKE '%patron%').
 *    - Must NOT be Regional TESCON.
 *    - Must be either:
 *      a) A female President (position ILIKE '%president%' AND LOWER(TRIM(gender)) = 'female'), OR
 *      b) A Women's Commissioner (WOCOM) (position ILIKE '%wocom%' OR position ILIKE '%women%').
 */
export function getC1SqlCondition(sql: postgres.Sql) {
  return sql`(
    LOWER(TRIM(COALESCE(gender, ''))) = 'female'
    AND (
      (
        LOWER(TRIM(executive_level)) IN ('national', 'region', 'regional', 'constituency', 'external branch')
        AND position NOT ILIKE '%tescon%'
      )
      OR (
        LOWER(TRIM(executive_level)) = 'tescon'
        AND position NOT ILIKE '%patron%'
        AND position NOT ILIKE '%regional%'
        AND position NOT ILIKE '%coord%'
        AND polling_station NOT ILIKE '%regional%tescon%'
        AND polling_station NOT ILIKE '%tescon%regional%'
        AND polling_station NOT ILIKE '%tescon%coord%'
        AND (
          position ILIKE '%president%'
          OR position ILIKE '%wocom%'
          OR position ILIKE '%women%'
          OR position ILIKE '%nasara%'
        )
      )
    )
  )`;
}

export type CandidateDelegate = {
  id?: number | string | null;
  executive_level?: string | null;
  position?: string | null;
  gender?: string | null;
  region?: string | null;
  constituency?: string | null;
  [key: string]: unknown;
};

function isRegionalTescon(r: CandidateDelegate | null | undefined): boolean {
  if (!r) return false;
  const pos = String(r.position || "").trim().toLowerCase();
  const ps = String((r as any).polling_station || "").trim().toLowerCase();
  const lvl = String(r.executive_level || "").trim().toLowerCase();

  if ((lvl === "region" || lvl === "regional") && /tescon/i.test(pos)) return true;
  if (
    !pos.includes("nasara") &&
    (pos.includes("regional tescon") ||
      pos.includes("tescon regional") ||
      pos.includes("tescon coordinator") ||
      pos.includes("tescon cordinator") ||
      /regional.*tescon/i.test(pos) ||
      /tescon.*coord/i.test(pos))
  ) return true;

  const isBonaFideInstitution =
    /university|college|polytechnic|institute|school|academy/i.test(ps) &&
    !/regional.*tescon|tescon.*regional/i.test(ps);

  if (!isBonaFideInstitution) {
    if (
      ps.includes("regional tescon") ||
      ps.includes("tescon regional") ||
      ps.includes("western regional tescon") ||
      ps.includes("tescon coordinator") ||
      ps.includes("tescon cordinator") ||
      /regional.*tescon/i.test(ps) ||
      /tescon.*coord/i.test(ps) ||
      (lvl === "tescon" &&
        (/^regional tescon/i.test(ps) ||
          /tescon.*regional/i.test(ps) ||
          /tescon cordinator/i.test(ps)))
    ) return true;
  }
  return false;
}

/**
 * In-memory validator for candidate records to determine if they qualify
 * under the C1 female electoral college mandate.
 */
export function isC1FemaleElectoralDelegate(record: CandidateDelegate | null | undefined): boolean {
  if (!record) return false;

  const rawLevel = String(record.executive_level || "").toLowerCase().trim();
  const level = rawLevel === "external branch" ? "constituency" : rawLevel;
  const rawRegion = String(record.region || "").toLowerCase().trim();
  const isExtBranch = rawLevel === "external branch" || rawRegion === "external branch";
  const pos = String(record.position || "").toLowerCase().trim();
  const gender = String(record.gender || "").toLowerCase().trim();

  // All qualifying records must be verified female
  if (gender !== "female") {
    return false;
  }

  // Exclude Polling Station, Electoral Area, or unknown tiers
  const isElectoralCollegeLevel = [
    "national",
    "region",
    "regional",
    "constituency",
    "tescon",
  ].includes(level) || isExtBranch;

  if (!isElectoralCollegeLevel) {
    return false;
  }

  // Regional TESCON is strictly NOT part of the Electoral College
  if (isRegionalTescon(record as any)) {
    return false;
  }

  // TESCON patrons NEVER qualify
  if (level === "tescon" && pos.includes("patron")) {
    return false;
  }

  // TESCON level: female Presidents, WOCOMs, and Nasara Coordinators
  if (level === "tescon") {
    return (
      pos.includes("president") ||
      pos.includes("wocom") ||
      pos.includes("women") ||
      pos.includes("nasara")
    );
  }

  // Core Electoral College tiers (National, Region, Constituency, External Branch)
  return true;
}
