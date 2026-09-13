import { withEcSql } from "../lib/db-ec.ts";

console.log("Auditing WOCOM records in Western region...");

await withEcSql(async (sql) => {
  // 1. Check all records matching wocom across all regions
  const allWocom = await sql`
    SELECT id, executive_name, executive_level, region, constituency, position, phone
    FROM executives_all
    WHERE position ILIKE '%wocom%' OR position ILIKE '%women%commis%'
    ORDER BY region, constituency, executive_name;
  `;
  console.log(`Total WOCOM across all regions: ${allWocom.length}`);

  // 2. Breakdown of WOCOM by region
  const byRegion = {};
  for (const r of allWocom) {
    const reg = r.region || 'Unknown';
    byRegion[reg] = (byRegion[reg] || 0) + 1;
  }
  console.log("WOCOM by region:", JSON.stringify(byRegion, null, 2));

  // 3. Inspect specifically Western region
  const westernExact = await sql`
    SELECT id, executive_name, executive_level, region, constituency, position, phone, voter_id
    FROM executives_all
    WHERE (position ILIKE '%wocom%' OR position ILIKE '%women%commis%')
      AND region = 'Western'
    ORDER BY constituency, executive_name;
  `;
  console.log(`\n--- EXACT MATCH: region = 'Western' (${westernExact.length} records) ---`);
  console.log(JSON.stringify(westernExact, null, 2));

  // 4. Check if any in Western North
  const westernNorth = await sql`
    SELECT id, executive_name, executive_level, region, constituency, position
    FROM executives_all
    WHERE (position ILIKE '%wocom%' OR position ILIKE '%women%commis%')
      AND region ILIKE '%western north%'
    ORDER BY constituency, executive_name;
  `;
  console.log(`\n--- Western North check: ${westernNorth.length} records ---`);
  if (westernNorth.length > 0) {
    console.log(JSON.stringify(westernNorth, null, 2));
  }
});
