import fs from "node:fs";
import path from "node:path";
import { withEcSql } from "../lib/db-ec.ts";

const backupFile = path.join(process.cwd(), "scratch/backup_adama_issanhaku_duplicate.json");

console.log("Starting removal of duplicate for ADAMA ISSANHAKU / ADAMA ISSAHAKU (Voter ID: 5445012649)...");

await withEcSql(async (sql) => {
  // 1. Fetch matching records
  const rows = await sql`
    SELECT *
    FROM executives_all
    WHERE voter_id = '5445012649'
    ORDER BY id ASC
  `;

  console.log(`Found ${rows.length} record(s) with Voter ID 5445012649:`);
  for (const r of rows) {
    console.log(`- ID: ${r.id}, Name: ${r.executive_name}, Level: ${r.executive_level}, Region: ${r.region}, Constituency: ${r.constituency}, Position: ${r.position}, Membership ID: ${r.membership_id}, Status: ${r.status}`);
  }

  if (rows.length <= 1) {
    console.log("No duplicates found to remove.");
    return;
  }

  // 2. Backup to file
  fs.writeFileSync(backupFile, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Saved backup to ${backupFile}`);

  // We will keep ID 1362 (which has the official membership_id "SAV-DAM-1669031944" and executive_name "ADAMA ISSANHAKU")
  // and remove the newer duplicate ID 264092
  const toKeep = rows.find(r => r.id === 1362) || rows[0];
  const toDelete = rows.filter(r => r.id !== toKeep.id);

  console.log(`Keeping record ID ${toKeep.id} (${toKeep.executive_name})`);
  console.log(`Deleting duplicate record(s): ${toDelete.map(r => r.id).join(", ")}`);

  await sql.begin(async (tx) => {
    // 3. Try to archive to deleted_voters if table exists
    const [tableExists] = await tx`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'deleted_voters'
      ) as exists
    `;

    if (tableExists?.exists) {
      for (const delRow of toDelete) {
        try {
          await tx`
            INSERT INTO deleted_voters (
              original_id,
              executive_level,
              slot_status,
              region,
              constituency,
              electoral_area,
              polling_station,
              position,
              executive_name,
              membership_id,
              phone,
              email,
              ghana_card,
              voter_id,
              gender,
              date_of_birth,
              age,
              is_youth_organiser,
              is_age_adjusted,
              record_entered_by,
              status,
              image_url,
              deleted_at,
              deleted_by_name,
              revert_status
            ) VALUES (
              ${delRow.id},
              ${delRow.executive_level},
              ${delRow.slot_status},
              ${delRow.region},
              ${delRow.constituency},
              ${delRow.electoral_area},
              ${delRow.polling_station},
              ${delRow.position},
              ${delRow.executive_name},
              ${delRow.membership_id},
              ${delRow.phone},
              ${delRow.email},
              ${delRow.ghana_card},
              ${delRow.voter_id},
              ${delRow.gender},
              ${delRow.date_of_birth},
              ${delRow.age},
              ${delRow.is_youth_organiser},
              ${delRow.is_age_adjusted},
              ${delRow.record_entered_by},
              ${delRow.status},
              ${delRow.image_url},
              NOW(),
              'Admin Antigravity (Duplicate Removal)',
              'DELETED'
            )
          `;
          console.log(`Archived record ID ${delRow.id} into deleted_voters.`);
        } catch (err) {
          console.warn(`Could not archive into deleted_voters (ignoring):`, err.message);
        }
      }
    }

    // 4. Delete the duplicate(s) from executives_all
    const delIds = toDelete.map(r => r.id);
    const deleteResult = await tx`
      DELETE FROM executives_all
      WHERE id = ANY(${delIds})
      RETURNING id
    `;
    console.log(`Successfully deleted ${deleteResult.length} duplicate row(s) from executives_all:`, deleteResult.map(r => r.id));

    // 5. Ensure the kept record has Elected slot status and Active status
    await tx`
      UPDATE executives_all
      SET
        slot_status = 'Elected',
        status = 'Active'
      WHERE id = ${toKeep.id}
    `;
    console.log(`Updated kept record ID ${toKeep.id} to slot_status='Elected', status='Active'.`);
  });

  // 6. Verify remaining records
  const remaining = await sql`
    SELECT id, executive_name, executive_level, region, constituency, position, voter_id, membership_id, status, slot_status
    FROM executives_all
    WHERE voter_id = '5445012649'
  `;
  console.log(`Verification: now ${remaining.length} record(s) exist for Voter ID 5445012649:`);
  console.log(JSON.stringify(remaining, null, 2));
});
