
import { withEcSql } from "../lib/db-ec.ts";

await withEcSql(async (sql) => {
  const rows = await sql`
    SELECT
      id,
      executive_level,
      region,
      constituency,
      position,
      executive_name
    FROM executives_all
    WHERE (
      executive_level IN ('National', 'Regional', 'Region', 'External Branch', 'Constituency', 'TESCON')
      OR (
        (executive_level IS NULL OR trim(executive_level) = '')
        AND region ILIKE '%external%'
      )
    )
    AND status NOT ILIKE '%Deleted%'
  `;

  const youthRows = rows.filter(r => {
    const posLower = String(r.position || "").toLowerCase().trim();
    return (
      (posLower.includes("youth organiser") ||
        posLower.includes("youth organizer") ||
        posLower === "youth" ||
        posLower.includes("deputy youth") ||
        posLower.includes("assistant youth")) &&
      !posLower.includes("former") &&
      !posLower.includes("patron")
    );
  });

  console.log("Total Youth Rows:", youthRows.length);

  const byLvl = {};
  for (const r of youthRows) {
    const lvl = String(r.executive_level || "Unknown").trim();
    byLvl[lvl] = (byLvl[lvl] || 0) + 1;
  }
  console.log("By Level:", byLvl);

  // Check constituencies with more than 2 youth organisers (Youth Organiser + Deputy)
  const byCon = {};
  for (const r of youthRows.filter(r => r.executive_level === "Constituency")) {
    const key = (r.region || "") + "|" + (r.constituency || "");
    byCon[key] = (byCon[key] || 0) + 1;
  }
  
  const over2 = Object.entries(byCon).filter(([k, v]) => v > 2);
  console.log("Constituencies with > 2 youth officers:", over2.length);
  for (const [k, v] of over2.slice(0, 10)) {
    console.log(`  ${k}: ${v} officers`);
  }
});
