import { withEcSql } from "../lib/db-ec.ts";

export function isRegionalTescon(r) {
  const pos = String(r.position || "").trim().toLowerCase();
  const ps = String(r.polling_station || "").trim().toLowerCase();
  const lvl = String(r.executive_level || "").trim().toLowerCase();

  // Regional level never has TESCON officers in the electoral college
  if ((lvl === "region" || lvl === "regional") && /tescon/i.test(pos)) {
    return true;
  }

  // Position is Regional TESCON Coordinator or variant
  if (
    pos.includes("regional tescon") ||
    pos.includes("tescon regional") ||
    pos.includes("tescon coordinator") ||
    pos.includes("tescon cordinator") ||
    /regional.*tescon/i.test(pos) ||
    /tescon.*coord/i.test(pos)
  ) {
    return true;
  }

  // Polling station / Institution is "REGIONAL TESCON COORDINATOR", "Western Regional TESCON", etc.
  // Note: Regional Maritime University is an accredited tertiary institution, not Regional TESCON
  const isBonaFideInstitution =
    /university|college|polytechnic|institute|school|academy/i.test(ps) &&
    !/regional.*tescon|tescon.*regional/i.test(ps);

  if (!isBonaFideInstitution) {
    if (
      ps.includes("regional tescon") ||
      ps.includes("tescon regional") ||
      ps.includes("western regional tescon") ||
      ps.includes("tescon coordinator") ||
      ps.includes("tescon cordinator") ||
      /regional.*tescon/i.test(ps) ||
      /tescon.*coord/i.test(ps) ||
      (lvl === "tescon" &&
        (/^regional tescon/i.test(ps) ||
          /tescon.*regional/i.test(ps) ||
          /tescon cordinator/i.test(ps)))
    ) {
      return true;
    }
  }

  return false;
}

await withEcSql(async (sql) => {
  const rows = await sql`
    SELECT id, executive_level, region, constituency, polling_station, position, executive_name, voter_id
    FROM executives_all
    WHERE
      position ILIKE '%tescon%'
      OR polling_station ILIKE '%tescon%'
      OR executive_level ILIKE '%tescon%'
    ORDER BY region, id
  `;

  console.log(`Total tescon-related rows: ${rows.length}`);

  const detected = rows.filter(isRegionalTescon);
  console.log(`Detected as Regional TESCON to exclude: ${detected.length}`);
  for (const d of detected) {
    console.log(`[EXCLUDED] id=${d.id} lvl=${d.executive_level} reg=${d.region} pos="${d.position}" ps="${d.polling_station}" name="${d.executive_name}"`);
  }

  const bonaFide = rows.filter((r) => !isRegionalTescon(r) && /regional/i.test(r.polling_station || ""));
  console.log(`\nPreserved bona fide institutions with 'Regional' in name (e.g. RMU): ${bonaFide.length}`);
  for (const b of bonaFide) {
    console.log(`[KEPT] id=${b.id} ps="${b.polling_station}" pos="${b.position}" name="${b.executive_name}"`);
  }
});
