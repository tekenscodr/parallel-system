import { withEcSql } from "../lib/db-ec.ts";

async function run() {
  console.log("=== Starting Kwadaso Municipal Cleanup ===");

  await withEcSql(async (sql) => {
    // 1. Create backup table
    console.log("1. Creating backup table executives_all_backup_kwadaso_municipal_20260920...");
    await sql`
      DROP TABLE IF EXISTS executives_all_backup_kwadaso_municipal_20260920;
    `;
    const backupRes = await sql`
      CREATE TABLE executives_all_backup_kwadaso_municipal_20260920 AS
      SELECT * FROM executives_all
      WHERE constituency ILIKE '%kwadaso municipal%';
    `;
    const backupCount = await sql`
      SELECT COUNT(*)::int as count FROM executives_all_backup_kwadaso_municipal_20260920;
    `;
    console.log(`   Backup created successfully with ${backupCount[0].count} rows.`);

    // 2. Delete the 11 Constituency-level duplicate executives
    console.log("2. Deleting Constituency level duplicate rows in Kwadaso Municipal...");
    const deletedRows = await sql`
      DELETE FROM executives_all
      WHERE constituency = 'Kwadaso Municipal'
        AND executive_level = 'Constituency'
      RETURNING id, executive_name, position, executive_level;
    `;
    console.log(`   Deleted ${deletedRows.length} Constituency level rows:`);
    console.table(deletedRows);

    // 3. Move remaining TESCON and Patron rows to KWADASO
    console.log("3. Updating remaining TESCON & Patron records from Kwadaso Municipal to KWADASO...");
    const updatedRows = await sql`
      UPDATE executives_all
      SET constituency = 'KWADASO'
      WHERE constituency = 'Kwadaso Municipal'
      RETURNING id, executive_name, position, executive_level, polling_station;
    `;
    console.log(`   Updated ${updatedRows.length} institutional rows to KWADASO:`);
    console.table(updatedRows);

    // 4. Update the constituencies reference table
    console.log("4. Updating constituencies table from 'Kwadaso Municipal' to 'Kwadaso'...");
    const updatedConst = await sql`
      UPDATE constituencies
      SET name = 'Kwadaso'
      WHERE name = 'Kwadaso Municipal'
      RETURNING id, name;
    `;
    console.log(`   Updated constituency row:`, updatedConst);

    // 5. Verification checks
    console.log("5. Verifying database state...");
    const remainingMun = await sql`
      SELECT COUNT(*)::int as count FROM executives_all WHERE constituency ILIKE '%kwadaso municipal%';
    `;
    console.log(`   Rows remaining with 'Kwadaso Municipal': ${remainingMun[0].count}`);

    const kwadasoSummary = await sql`
      SELECT executive_level, COUNT(*)::int as count
      FROM executives_all
      WHERE constituency = 'KWADASO'
      GROUP BY executive_level
      ORDER BY executive_level;
    `;
    console.log("   KWADASO executive summary by level:");
    console.table(kwadasoSummary);

    const constSummary = await sql`
      SELECT id, name FROM constituencies WHERE name ILIKE '%kwadaso%';
    `;
    console.log("   Constituencies table Kwadaso row:", constSummary);
  });

  console.log("=== Kwadaso Municipal Cleanup Completed Successfully ===");
}

run().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
