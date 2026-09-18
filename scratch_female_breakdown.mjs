import { withEcSql } from './lib/db-ec.ts';

await withEcSql(async (sql) => {
  const allFemales = await sql`
    SELECT
      id,
      executive_level,
      region,
      constituency,
      position,
      executive_name,
      gender
    FROM executives_all
    WHERE LOWER(TRIM(gender)) = 'female'
  `;

  console.log("Total female rows in DB:", allFemales.length);

  const byLevel = {};
  for (const r of allFemales) {
    const lvl = String(r.executive_level || "").toLowerCase().trim();
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
  }
  console.log("All females by executive_level:", byLevel);

  // Exclude vacant
  const nonVacant = allFemales.filter(r => {
    const name = String(r.executive_name || "").trim();
    return (
      name &&
      !/^(vacant|vacancy|unknown|not available|representative)\b/i.test(name) &&
      !/^n\/?a$/i.test(name)
    );
  });
  console.log("Non-vacant females total:", nonVacant.length);
  const byLevelNonVacant = {};
  for (const r of nonVacant) {
    const lvl = String(r.executive_level || "").toLowerCase().trim();
    byLevelNonVacant[lvl] = (byLevelNonVacant[lvl] || 0) + 1;
  }
  console.log("Non-vacant females by executive_level:", byLevelNonVacant);

  // In national:
  const nat = nonVacant.filter(r => String(r.executive_level || "").toLowerCase().trim() === "national");
  console.log("National non-vacant females count:", nat.length);
  for (const n of nat) {
    console.log(`  - ${n.executive_name}: ${n.position}`);
  }

  // In region:
  const reg = nonVacant.filter(r => ["region", "regional"].includes(String(r.executive_level || "").toLowerCase().trim()));
  console.log("Regional non-vacant females count:", reg.length);

  // In constituency:
  const con = nonVacant.filter(r => String(r.executive_level || "").toLowerCase().trim() === "constituency");
  console.log("Constituency non-vacant females count:", con.length);

  // In TESCON:
  const tes = nonVacant.filter(r => String(r.executive_level || "").toLowerCase().trim() === "tescon");
  console.log("TESCON non-vacant females count:", tes.length);
  const tesPatron = tes.filter(r => String(r.position || "").toLowerCase().includes("patron"));
  console.log("TESCON patrons:", tesPatron.length);
  const tesPresidentOrWocom = tes.filter(r => {
    const p = String(r.position || "").toLowerCase();
    return !p.includes("patron") && (p.includes("president") || p.includes("wocom") || p.includes("women"));
  });
  console.log("TESCON Presidents & WOCOMs:", tesPresidentOrWocom.length);
  const tesOther = tes.filter(r => {
    const p = String(r.position || "").toLowerCase();
    return !p.includes("patron") && !p.includes("president") && !p.includes("wocom") && !p.includes("women");
  });
  console.log("TESCON other female positions (secretary, etc.):", tesOther.length);
  for (const o of tesOther.slice(0, 10)) {
    console.log(`  - TESCON other: ${o.executive_name}: ${o.position} (${o.constituency})`);
  }
});

process.exit(0);
