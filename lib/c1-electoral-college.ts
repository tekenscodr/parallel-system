import type postgres from "postgres";

/**
 * Returns a postgres.js SQL condition that strictly restricts queries on `executives_all`
 * to all females in the Electoral College:
 * 1. Electoral College Tiers: National, Regional, Constituency, External Branch, TESCON.
 *    (Polling Station and Electoral Area are strictly excluded).
 * 2. Non-TESCON tiers: Must be Female (LOWER(TRIM(gender)) = 'female').
 * 3. TESCON tier:
 *    - Must NOT be a patron (position NOT ILIKE '%patron%').
 *    - Must be either:
 *      a) A female President (position ILIKE '%president%' AND LOWER(TRIM(gender)) = 'female'), OR
 *      b) A Women's Commissioner (WOCOM) (position ILIKE '%wocom%' OR position ILIKE '%women%').
 */
export function getC1SqlCondition(sql: postgres.Sql) {
  return sql`(
    LOWER(TRIM(COALESCE(gender, ''))) = 'female'
    AND (
      LOWER(TRIM(executive_level)) IN ('national', 'region', 'regional', 'constituency', 'external branch')
      OR (
        LOWER(TRIM(executive_level)) = 'tescon'
        AND position NOT ILIKE '%patron%'
        AND (
          position ILIKE '%president%'
          OR position ILIKE '%wocom%'
          OR position ILIKE '%women%'
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

  // TESCON patrons NEVER qualify
  if (level === "tescon" && pos.includes("patron")) {
    return false;
  }

  // TESCON level: only female Presidents and WOCOMs
  if (level === "tescon") {
    return pos.includes("president") || pos.includes("wocom") || pos.includes("women");
  }

  // Core Electoral College tiers (National, Region, Constituency, External Branch)
  return true;
}
