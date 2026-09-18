import { withEcSql } from "../lib/db-ec.ts";

await withEcSql(async (sql) => {
  const tableCheck = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'deleted_voters'
  `;
  console.log("deleted_voters columns:", tableCheck);
});
