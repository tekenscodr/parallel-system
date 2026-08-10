import fs from "node:fs/promises";
import crypto from "node:crypto";
import postgres from "postgres";

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

const inputPath = process.argv.find((arg) => arg.endsWith(".csv"));
const commit = process.argv.includes("--commit");
if (!inputPath) throw new Error("Usage: import-campaign-contacts.mjs <contacts.csv> [--commit]");

const text = await fs.readFile(inputPath, "utf8");
const lines = text.split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines[0]);
const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ""])));

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 4,
});

const current = await sql`
  SELECT COUNT(*)::int AS contacts,
    COUNT(*) FILTER (WHERE source = 'platform')::int AS platform_contacts
  FROM contacts
`;
const existingRows = await sql`SELECT phone_number, voter_id FROM contacts`;
const existingPhones = new Set(existingRows.map((row) => row.phone_number));
const existingVoterIds = new Set(existingRows.map((row) => row.voter_id).filter(Boolean));
const candidates = rows.filter((row) => !existingPhones.has(row.phone_number) && !existingVoterIds.has(row.voter_id));

if (!commit) {
  console.log(JSON.stringify({ mode: "dry-run", databaseContacts: current[0], inputRows: rows.length, candidates: candidates.length, skippedExisting: rows.length - candidates.length }));
  await sql.end();
  process.exit(0);
}

const batchId = crypto.randomUUID();
let inserted = 0;
let skipped = 0;
let mappedPollingStations = 0;

await sql.begin(async (transaction) => {
  for (const row of candidates) {
    const result = await transaction`
      INSERT INTO contacts (
        id, polling_station_id, first_name, last_name, phone_number,
        date_of_birth, voter_id, source, upload_batch_id,
        consent_status, consent_source, is_active, notes
      )
      SELECT ${crypto.randomUUID()}, ps.id, ${row.first_name}, ${row.last_name},
        ${row.phone_number}, ${row.date_of_birth || null}, ${row.voter_id || null},
        'platform', ${batchId}, 'pending', 'campaign_data_import', 1,
        ${`Campaign contact import; source constituency: ${row.constituency}; source region: ${row.region}`}
      FROM (SELECT 1) seed
      LEFT JOIN polling_stations ps ON ps.code = ${row.polling_station_code || null}
      WHERE NOT EXISTS (
        SELECT 1 FROM contacts existing
        WHERE existing.phone_number = ${row.phone_number}
          OR (CAST(${row.voter_id || null} AS text) IS NOT NULL AND existing.voter_id = CAST(${row.voter_id || null} AS text))
      )
      RETURNING polling_station_id
    `;
    if (result.count > 0) {
      inserted += 1;
      if (result[0]?.polling_station_id) mappedPollingStations += 1;
    } else skipped += 1;
  }
});

const after = await sql`
  SELECT COUNT(*)::int AS contacts,
    COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL)::int AS with_dob,
    COUNT(*) FILTER (WHERE polling_station_id IS NOT NULL)::int AS mapped_stations,
    COUNT(*) FILTER (WHERE consent_status = 'pending')::int AS pending_consent
  FROM contacts
`;
console.log(JSON.stringify({ mode: "commit", batchId, inputRows: rows.length, candidates: candidates.length, inserted, skipped, mappedPollingStations, totals: after[0] }));
await sql.end();
