import { withEcSql } from './lib/db-ec.ts';

const result = await withEcSql(async (sql) => {
  const rawRows = await sql`
    SELECT
      id,
      executive_level,
      region,
      constituency,
      polling_station,
      position,
      executive_name,
      voter_id,
      phone,
      gender,
      date_of_birth,
      age,
      image_url
    FROM executives_all
    WHERE lower(trim(executive_level)) IN ('national', 'region', 'regional', 'constituency', 'tescon', 'external branch')
    ORDER BY id
  `;

  // Test standard valid rows filter
  const validRows = rawRows.filter((r) => {
    const name = String(r.executive_name || "").trim();
    return (
      name &&
      !/^(vacant|vacancy|unknown|not available|representative)\b/i.test(name) &&
      !/^n\/?a$/i.test(name)
    );
  });

  // Test 1: Women Organiser contest logic
  const womenOrganiserContest = validRows.filter((r) => {
    const lvl = String(r.executive_level || "").toLowerCase().trim();
    const g = String(r.gender || "").toLowerCase().trim();
    const pos = String(r.position || "").trim();
    const posLower = pos.toLowerCase();

    if (g !== "female") return false;
    if (["national", "region", "regional", "constituency"].includes(lvl)) return true;
    if (lvl === "tescon") {
      if (posLower.includes("patron")) return false;
      return /wocom|women|president/i.test(posLower);
    }
    return false;
  });

  // Test 2: Women Organisers & Deputies wing portfolio logic
  const womenWingPortfolio = validRows.filter((r) => {
    const lvl = String(r.executive_level || "").toLowerCase().trim();
    const g = String(r.gender || "").toLowerCase().trim();
    const pos = String(r.position || "").trim();
    const posLower = pos.toLowerCase();

    if (g !== "female") return false;
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
  });

  const levelBreakdown1 = {};
  for (const r of womenOrganiserContest) {
    const l = String(r.executive_level || "").toLowerCase().trim();
    levelBreakdown1[l] = (levelBreakdown1[l] || 0) + 1;
  }

  const levelBreakdown2 = {};
  for (const r of womenWingPortfolio) {
    const l = String(r.executive_level || "").toLowerCase().trim();
    levelBreakdown2[l] = (levelBreakdown2[l] || 0) + 1;
  }

  return {
    totalRaw: rawRows.length,
    validRaw: validRows.length,
    womenOrganiserContestTotal: womenOrganiserContest.length,
    levelBreakdown1,
    womenWingPortfolioTotal: womenWingPortfolio.length,
    levelBreakdown2,
  };
});

console.log(JSON.stringify(result, null, 2));
process.exit(0);
