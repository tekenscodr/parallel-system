import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment.");
}

const backupDir = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch";
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log("Starting deletion of WOCOM executives in Western region with resilient connection...");

async function executeWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Connection attempt ${attempt}/${maxAttempts}...`);
    const sql = postgres(connectionString, {
      ssl: "prefer",
      max: 1,
      connect_timeout: 45,
      idle_timeout: 30,
    });

    try {
      // 1. Fetch current Western WOCOM records
      const targetRows = await sql`
        SELECT * FROM executives_all 
        WHERE region = 'Western' AND (position ILIKE '%wocom%' OR position ILIKE '%women%commis%')
        ORDER BY id ASC;
      `;

      console.log(`Found ${targetRows.length} Western WOCOM records to delete.`);
      if (targetRows.length === 0) {
        await sql.end();
        return { count: 0, message: "No Western WOCOM records found to delete." };
      }

      // 2. Save JSON backup locally
      const backupJsonPath = path.join(backupDir, "western_wocom_backup_20260913.json");
      fs.writeFileSync(backupJsonPath, JSON.stringify(targetRows, null, 2), "utf8");
      console.log(`Saved local JSON backup with ${targetRows.length} records to ${backupJsonPath}`);

      // 3. Perform database operations in transaction
      const txResult = await sql.begin(async (tx) => {
        // Create postgres backup table
        await tx`
          DROP TABLE IF EXISTS executives_western_wocom_backup_20260913;
        `;
        await tx`
          CREATE TABLE executives_western_wocom_backup_20260913 AS
          SELECT * FROM executives_all 
          WHERE region = 'Western' AND (position ILIKE '%wocom%' OR position ILIKE '%women%commis%');
        `;

        const [backupCountRow] = await tx`
          SELECT COUNT(*)::int as count FROM executives_western_wocom_backup_20260913;
        `;
        console.log(`PostgreSQL backup table executives_western_wocom_backup_20260913 created with ${backupCountRow.count} records.`);

        if (backupCountRow.count !== targetRows.length) {
          throw new Error(`Backup count mismatch: expected ${targetRows.length}, got ${backupCountRow.count}`);
        }

        // Delete records
        const deleteResult = await tx`
          DELETE FROM executives_all 
          WHERE region = 'Western' AND (position ILIKE '%wocom%' OR position ILIKE '%women%commis%')
          RETURNING id, executive_name, constituency, position;
        `;

        console.log(`Deleted ${deleteResult.length} rows from executives_all.`);

        // Log Audit Event
        try {
          const eventId = `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
          const metaJson = JSON.stringify({
            deletedCount: deleteResult.length,
            region: 'Western',
            position: 'WOCOM',
            reason: 'User requested removal of all WOCOM in Western region from database',
            backupTable: 'executives_western_wocom_backup_20260913',
            deletedExecutives: deleteResult,
            timestamp: new Date().toISOString()
          });

          await tx`
            INSERT INTO "AuditEvent" (
              id,
              "actorId",
              action,
              resource,
              "resourceId",
              "requestId",
              "ipAddress",
              "deviceId",
              metadata,
              "occurredAt",
              "userAgent"
            ) VALUES (
              ${eventId},
              'system_admin',
              'BULK_EXECUTIVE_DELETE',
              'executives_all',
              'western_wocom',
              'script_delete',
              '127.0.0.1',
              'cli',
              ${metaJson}::jsonb,
              NOW(),
              'Node Script'
            );
          `;
          console.log("Logged AuditEvent in database.");
        } catch (auditErr) {
          console.warn("Notice: Non-fatal AuditEvent insert warning:", auditErr.message);
        }

        // Verify after deletion
        const [remainingWesternWocom] = await tx`
          SELECT COUNT(*)::int as count FROM executives_all 
          WHERE region = 'Western' AND (position ILIKE '%wocom%' OR position ILIKE '%women%commis%');
        `;
        const [totalRemaining] = await tx`
          SELECT COUNT(*)::int as count FROM executives_all;
        `;
        const [remainingWesternNorth] = await tx`
          SELECT COUNT(*)::int as count FROM executives_all 
          WHERE region ILIKE '%western north%' AND (position ILIKE '%wocom%' OR position ILIKE '%women%commis%');
        `;

        return {
          deletedCount: deleteResult.length,
          remainingWesternWocom: remainingWesternWocom.count,
          remainingWesternNorthWocom: remainingWesternNorth.count,
          totalRemaining: totalRemaining.count,
          deletedList: deleteResult
        };
      });

      await sql.end();
      return txResult;
    } catch (err) {
      await sql.end({ timeout: 5 }).catch(() => {});
      console.warn(`Attempt ${attempt} encountered error: ${err.message}`);
      if (attempt === maxAttempts) throw err;
      console.log("Waiting 3 seconds before retry...");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

const result = await executeWithRetry(3);
console.log("\n--- RESULT ---");
console.log(JSON.stringify(result, null, 2));
