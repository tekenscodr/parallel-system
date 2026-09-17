
import { withEcSql } from "../lib/db-ec.ts";

await withEcSql(async (sql) => {
  const rows = await sql`
    SELECT
      id,
      executive_level,
      region,
      constituency,
      polling_station,
      position,
      executive_name,
      voter_id,
      gender,
      date_of_birth,
      age
    FROM executives_all
    WHERE (
      executive_level IN ('National', 'Regional', 'Region', 'External Branch', 'Constituency', 'TESCON')
      OR (
        (executive_level IS NULL OR trim(executive_level) = '')
        AND region ILIKE '%external%'
      )
    )
    AND status NOT ILIKE '%Deleted%'
  `;

  console.log("Fetched", rows.length, "rows");

  // Let's test contests:
  const contests = [
    { name: "National Chairperson & General Officers", expected: 6449 },
    { name: "Youth Organisers & Deputies", expected: 624 },
    { name: "Women Organisers & Deputies", expected: 863 },
    { name: "Nasara Coordinators & Deputies", expected: 852 },
    { name: "Youth Organiser", expected: 2722 },
    { name: "Women Organiser", expected: 1245 },
    { name: "Nasara Organiser", expected: 852 },
  ];

  for (const c of contests) {
    // filter
    const matched = rows.filter(r => {
      const lvl = String(r.executive_level || "").toLowerCase().trim();
      const pos = String(r.position || "").trim();
      const posLower = pos.toLowerCase();
      const g = String(r.gender || "").toLowerCase().trim();

      if (c.name === "Youth Organisers & Deputies") {
        return (
          (posLower.includes("youth organiser") ||
            posLower.includes("youth organizer") ||
            posLower === "youth" ||
            posLower.includes("deputy youth") ||
            posLower.includes("assistant youth")) &&
          !posLower.includes("former") &&
          !posLower.includes("patron")
        );
      }
      if (c.name === "Women Organisers & Deputies") {
        return (
          (posLower.includes("women organiser") ||
            posLower.includes("women organizer") ||
            posLower === "women" ||
            posLower.includes("deputy women") ||
            posLower.includes("assistant women") ||
            posLower.includes("wocom")) &&
          !posLower.includes("former") &&
          !posLower.includes("patron")
        );
      }
      if (c.name === "Nasara Coordinators & Deputies" || c.name === "Nasara Organiser") {
        return posLower.includes("nasara") && !posLower.includes("former") && !posLower.includes("patron");
      }
      if (c.name === "National Chairperson & General Officers") {
        if (["national", "region", "regional", "constituency"].includes(lvl)) return true;
        if (lvl === "tescon" && /president/i.test(pos)) return true;
        return false;
      }
      if (c.name === "Women Organiser") {
        if (["region", "regional", "constituency"].includes(lvl)) return g === "female";
        if (lvl === "tescon") {
          if (/wocom|women/i.test(posLower)) return true;
          if (/president/i.test(posLower) && g === "female") return true;
        }
        return false;
      }
      if (c.name === "Youth Organiser") {
        if (lvl === "tescon") return /president|wocom|women|nasara/i.test(pos);
        if (["national", "region", "regional", "constituency"].includes(lvl)) {
          if (/youth/i.test(posLower) && !posLower.includes("former")) return true;
          if (posLower.includes("former")) return false;
          const birthYear = String(r.date_of_birth || "").match(/^[0-9]{4}/);
          const age = birthYear ? (2026 - parseInt(birthYear[0])) : r.age;
          if (age !== null && age < 40) return true;
        }
        return false;
      }
      return false;
    });

    const rate = ((matched.length / c.expected) * 100).toFixed(1) + "%";
    console.log(`Contest: "${c.name}" -> Actual: ${matched.length}, Expected: ${c.expected}, Coverage: ${rate}`);
  }
});
