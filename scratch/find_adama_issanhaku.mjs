import { withEcSql } from "../lib/db-ec.ts";

await withEcSql(async (sql) => {
  const rows = await sql`
    SELECT *
    FROM executives_all
    WHERE executive_name ILIKE '%ADAMA%ISSANHAKU%'
       OR executive_name ILIKE '%ISSANHAKU%ADAMA%'
       OR executive_name ILIKE '%ADAMA%ISSAHAKU%'
       OR executive_name ILIKE '%ISSAHAKU%ADAMA%'
  `;

  console.log(`Found ${rows.length} record(s):`);
  console.log(JSON.stringify(rows, null, 2));
});
