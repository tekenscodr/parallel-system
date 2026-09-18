import { withEcSql } from './lib/db-ec.ts';
import { isC1FemaleElectoralDelegate } from './lib/c1-electoral-college.ts';

await withEcSql(async (sql) => {
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

  const validRows = rawRows.filter((r) => {
    const name = String(r.executive_name || "").trim();
    return (
      name &&
      !/^(vacant|vacancy|unknown|not available|representative)\b/i.test(name) &&
      !/^n\/?a$/i.test(name)
    );
  });

  const c1Eligible = validRows.filter(r => isC1FemaleElectoralDelegate(r));

  // Current route.ts filter:
  const routeEligible = validRows.filter((r) => {
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

  console.log("c1Eligible total:", c1Eligible.length);
  console.log("routeEligible total:", routeEligible.length);

  // What is in c1Eligible but not in routeEligible?
  const diff1 = c1Eligible.filter(r => !routeEligible.some(x => x.id === r.id));
  console.log("In C1 but not in route:", diff1.length);
  for (const d of diff1) {
    console.log(`- ID ${d.id}: lvl=${d.executive_level}, reg=${d.region}, const=${d.constituency}, pos=${d.position}, gender=${d.gender}`);
  }

  // What is in routeEligible but not in c1Eligible?
  const diff2 = routeEligible.filter(r => !c1Eligible.some(x => x.id === r.id));
  console.log("In route but not in C1:", diff2.length);
});

process.exit(0);
