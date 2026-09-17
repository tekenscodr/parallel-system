
import { withEcSql } from "../lib/db-ec.ts";

await withEcSql(async (sql) => {
  const rows = await sql`
    SELECT
      id,
      executive_level,
      region,
      constituency,
      position,
      executive_name,
      voter_id
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

  console.log("Total rows fetched:", rows.length);

  // Check which counts give 101.9%
  // E.g. what is expected vs actual in route.ts?
  // Let's simulate the exact route.ts logic:
  // 1. Constituency only:
  const conOnly = rows.filter(r => String(r.executive_level || "").toLowerCase().trim() === "constituency");
  console.log("Total Constituency executives:", conOnly.length);
  console.log("Total Constituency expected: 276 * 19 = 5244");
  console.log("Constituency rate:", ((conOnly.length / 5244) * 100).toFixed(1) + "%");

  // By region:
  const counts = {
    "Ahafo": 6, "Ashanti": 47, "Bono": 12, "Bono East": 11, "Central": 23,
    "Eastern": 33, "Greater Accra": 34, "North East": 6, "Northern": 18,
    "Oti": 9, "Savannah": 7, "Upper East": 15, "Upper West": 11,
    "Volta": 18, "Western": 17, "Western North": 9
  };

  for (const [reg, numC] of Object.entries(counts)) {
    const regConRows = conOnly.filter(r => (r.region || "").toLowerCase().trim() === reg.toLowerCase().trim());
    const regRows = rows.filter(r => 
      (r.region || "").toLowerCase().trim() === reg.toLowerCase().trim() && 
      (String(r.executive_level || "").toLowerCase().trim() === "regional" || String(r.executive_level || "").toLowerCase().trim() === "region")
    );
    const conTarget = numC * 19;
    const fullTarget = 21 + conTarget;
    const totalActual = regRows.length + regConRows.length;

    const conRate = ((regConRows.length / conTarget) * 100).toFixed(1) + "%";
    const fullRate = ((totalActual / fullTarget) * 100).toFixed(1) + "%";

    if (conRate === "101.9%" || fullRate === "101.9%") {
      console.log(`MATCH! Region: ${reg}, ConRate: ${conRate} (${regConRows.length}/${conTarget}), FullRate: ${fullRate} (${totalActual}/${fullTarget})`);
    } else {
      console.log(`Region: ${reg}: Reg=${regRows.length}/21, Con=${regConRows.length}/${conTarget} (${conRate}), Full=${totalActual}/${fullTarget} (${fullRate})`);
    }
  }
});
