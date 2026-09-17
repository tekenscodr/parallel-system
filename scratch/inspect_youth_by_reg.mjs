
import { withEcSql } from "../lib/db-ec.ts";

await withEcSql(async (sql) => {
  const youthRows = await sql`
    SELECT
      id,
      executive_level,
      region,
      constituency,
      position,
      executive_name
    FROM executives_all
    WHERE (
      executive_level = 'Constituency'
      OR (
        (executive_level IS NULL OR trim(executive_level) = '')
        AND region ILIKE '%external%'
      )
    )
    AND status NOT ILIKE '%Deleted%'
    AND (
      position ILIKE '%youth organiser%'
      OR position ILIKE '%youth organizer%'
      OR position = 'Youth'
      OR position ILIKE '%deputy youth%'
      OR position ILIKE '%assistant youth%'
    )
    AND position NOT ILIKE '%former%'
    AND position NOT ILIKE '%patron%'
  `;

  console.log("Total Constituency Youth Rows:", youthRows.length);

  const byReg = {};
  for (const r of youthRows) {
    byReg[r.region] = (byReg[r.region] || 0) + 1;
  }
  console.log("By Region:", byReg);
});
