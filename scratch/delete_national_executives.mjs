import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { withEcSql } from "../lib/db-ec.ts";

const backupDir = "/Users/THINKPAD/.gemini/antigravity/brain/f3d03715-27f9-4395-a427-73f3eb8105c3/scratch";
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log("Starting deletion of National Level Executives...");

const result = await withEcSql(async (sql) => {
  // 1. Fetch current national records
  const nationalRows = await sql`
    SELECT * FROM executives_all 
    WHERE executive_level = 'National'
    ORDER BY id ASC
  `;

  console.log(`Found ${nationalRows.length} national records to delete.`);
  if (nationalRows.length === 0) {
    return { count: 0, message: "No national records found to delete." };
  }

  // 2. Save JSON backup locally
  const backupJsonPath = path.join(backupDir, "national_executives_backup_20260913.json");
  fs.writeFileSync(backupJsonPath, JSON.stringify(nationalRows, null, 2), "utf8");
  console.log(`Saved local JSON backup with ${nationalRows.length} records to ${backupJsonPath}`);

  // 3. Perform database operations in transaction
  return await sql.begin(async (tx) => {
    // Create postgres backup table
    await tx`
      DROP TABLE IF EXISTS executives_national_backup_20260913;
    `;
    await tx`
      CREATE TABLE executives_national_backup_20260913 AS
      SELECT * FROM executives_all 
      WHERE executive_level = 'National';
    `;

    const [backupCountRow] = await tx`
      SELECT COUNT(*)::int as count FROM executives_national_backup_20260913;
    `;
    console.log(`PostgreSQL backup table executives_national_backup_20260913 created with ${backupCountRow.count} records.`);

    if (backupCountRow.count !== nationalRows.length) {
      throw new Error(`Backup count mismatch: expected ${nationalRows.length}, got ${backupCountRow.count}`);
    }

    // Delete records
    const deleteResult = await tx`
      DELETE FROM executives_all 
      WHERE executive_level = 'National'
      RETURNING id;
    `;

    console.log(`Deleted ${deleteResult.length} rows from executives_all.`);

    // Log Audit Event
    try {
      const eventId = `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const metaJson = JSON.stringify({
        deletedCount: deleteResult.length,
        executiveLevel: 'National',
        reason: 'User requested removal of all national level executives from database',
        backupTable: 'executives_national_backup_20260913',
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
          'national_executives',
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
    const [remainingNational] = await tx`
      SELECT COUNT(*)::int as count FROM executives_all WHERE executive_level = 'National';
    `;
    const [totalRemaining] = await tx`
      SELECT COUNT(*)::int as count FROM executives_all;
    `;
    const levelsRemaining = await tx`
      SELECT executive_level, COUNT(*)::int as count 
      FROM executives_all 
      GROUP BY executive_level 
      ORDER BY count DESC;
    `;

    return {
      deletedCount: deleteResult.length,
      remainingNational: remainingNational.count,
      totalRemaining: totalRemaining.count,
      levelsRemaining
    };
  });
});

console.log("\n--- RESULT ---");
console.log(JSON.stringify(result, null, 2));
