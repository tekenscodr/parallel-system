console.error("⚠️ Operation aborted: Local DB setup is disabled. There is no local database; all systems use the remote database configured via environment variables.");
process.exit(1);

import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
const root = process.cwd();

function statements(file) {
  return file.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)
    .map((statement) => statement.replace(/`/g, '"')
      .replace(/integer DEFAULT true/gi, "integer DEFAULT 1")
      .replace(/integer DEFAULT false/gi, "integer DEFAULT 0"));
}

const base = statements(await fs.readFile(path.join(root, "drizzle/0000_wooden_king_cobra.sql"), "utf8"));
const tables = base.filter((statement) => /^CREATE TABLE/i.test(statement));
const indexes = base.filter((statement) => /^CREATE (UNIQUE )?INDEX/i.test(statement));
const pending = [...tables];
const ordered = [];
const created = new Set();
while (pending.length) {
  const index = pending.findIndex((statement) => {
    const dependencies = [...statement.matchAll(/REFERENCES\s+"([^"]+)"/gi)].map((match) => match[1]);
    return dependencies.every((dependency) => created.has(dependency));
  });
  if (index < 0) throw new Error("Could not resolve PostgreSQL table dependency order.");
  const [statement] = pending.splice(index, 1);
  const name = statement.match(/^CREATE TABLE\s+"([^"]+)"/i)?.[1];
  if (!name) throw new Error("Could not read table name.");
  ordered.push(statement); created.add(name);
}

await sql.unsafe("DROP SCHEMA public CASCADE");
await sql.unsafe("CREATE SCHEMA public");
for (const statement of [...ordered, ...indexes]) await sql.unsafe(statement);
await sql.unsafe('ALTER TABLE "polling_stations" ADD COLUMN "constituency_id" text REFERENCES "constituencies"("id") ON DELETE restrict');
await sql.unsafe('ALTER TABLE "polling_stations" ALTER COLUMN "electoral_area_id" DROP NOT NULL');
await sql.unsafe('CREATE INDEX "polling_stations_constituency_idx" ON "polling_stations" ("constituency_id")');

for (const migration of [
  "drizzle/0001_absurd_rockslide.sql",
  "drizzle/0003_ghana_2024_electoral_geography.sql",
  "drizzle/0004_magical_living_tribunal.sql",
  "drizzle/0005_clammy_cargill.sql",
]) {
  const contents = await fs.readFile(path.join(root, migration), "utf8");
  for (const statement of statements(contents)) {
    const cleaned = statement.replace(/^--[^\n]*\n/gm, "").trim();
    if (cleaned) await sql.unsafe(cleaned);
  }
}

const counts = await sql`SELECT
  (SELECT COUNT(*) FROM regions)::int AS regions,
  (SELECT COUNT(*) FROM constituencies)::int AS constituencies,
  (SELECT COUNT(*) FROM polling_stations)::int AS polling_stations`;
console.log(counts[0]);
await sql.end();
