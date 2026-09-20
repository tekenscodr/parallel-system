import postgres from "postgres";
import fs from "fs";

const sqlV2 = postgres("postgresql://postgres:Jalabia123++@72.61.17.76:5432/executives_v2");
const sqlEc = postgres("postgresql://postgres:Jalabia123++@72.61.17.76:5432/ec-data");

function clean(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  try {
    // 1. All constituencies in ec-data (canonical list)
    const ecConstituencies = await sqlEc`
      SELECT c.name, r.name as region_name
      FROM constituencies c
      JOIN regions r ON c.region_id = r.id;
    `;
    const ecConstMap = new Map(); // clean name -> uppercase canonical name
    for (const c of ecConstituencies) {
      ecConstMap.set(clean(c.name), c.name.toUpperCase());
    }

    // Also get all distinct constituencies from executives_all (Constituency level)
    const existingConsts = await sqlEc`
      SELECT DISTINCT constituency FROM executives_all WHERE executive_level = 'Constituency';
    `;
    for (const row of existingConsts) {
      if (row.constituency) {
        ecConstMap.set(clean(row.constituency), row.constituency.toUpperCase());
      }
    }

    // 2. Load all 280 institutions from executives_v2
    const v2Insts = await sqlV2`
      SELECT ti.id as v2_id, ti.institution, c.region as v2_region, c.constituency as v2_constituency
      FROM "TesconInst" ti
      JOIN "Constituency" c ON ti."constituencyId" = c.id
      ORDER BY ti.institution;
    `;
    console.log(`Loaded ${v2Insts.length} institutions from executives_v2.`);

    // Map v2 constituency to canonical ec-data constituency
    for (const inst of v2Insts) {
      const cleanV2Const = clean(inst.v2_constituency);
      let canonical = ecConstMap.get(cleanV2Const);
      if (!canonical) {
        // Try common variations
        if (cleanV2Const === "adenta") canonical = "ADENTAN";
        else if (cleanV2Const === "nadowli kaleo") canonical = "NADOWLI KALEO";
        else if (cleanV2Const === "komenda edina eguafo abirem") canonical = "KOMENDA-EDINA-EGUAFO-ABIREM";
        else if (cleanV2Const === "essikado ketan") canonical = "ESSIKADU-KETAN";
        else if (cleanV2Const === "sissala east") canonical = "SISSALA EAST";
        else if (cleanV2Const === "sissala west") canonical = "SISSALA WEST";
        else if (cleanV2Const === "ahafo ano south west") canonical = "AHAFO ANO SOUTH WEST";
        else canonical = inst.v2_constituency.toUpperCase();
      }
      inst.canonical_constituency = canonical;
    }

    // 3. Load all TESCON / Patron records in executives_all
    const ecRows = await sqlEc`
      SELECT id, executive_level, position, region, constituency, electoral_area, polling_station, executive_name, phone, voter_id, record_entered_by
      FROM executives_all
      WHERE executive_level IN ('TESCON', 'Patron')
         OR position ILIKE '%tescon%'
         OR record_entered_by ILIKE '%tescon%'
      ORDER BY id;
    `;
    console.log(`Loaded ${ecRows.length} TESCON/Patron rows from ec-data.`);

    // Also get all v2 Tescon person records
    const v2Persons = await sqlV2`
      SELECT t.id, t."fullName", t."phoneNumber", t.position, t."voterId", ti.institution, c.region, c.constituency
      FROM "Tescon" t
      JOIN "TesconInst" ti ON t."institutionId" = ti.id
      JOIN "Constituency" c ON ti."constituencyId" = c.id;
    `;
    const v2PersonByVoterId = new Map();
    const v2PersonByPhone = new Map();
    for (const p of v2Persons) {
      if (p.voterId) v2PersonByVoterId.set(clean(p.voterId), p);
      if (p.phoneNumber) v2PersonByPhone.set(clean(p.phoneNumber), p);
    }

    // Build lookup for v2 institutions
    // Let's create an alias dictionary for institutions
    const v2List = v2Insts.map(i => ({
      ...i,
      cleanInst: clean(i.institution)
    }));

    function findV2Inst(psName) {
      if (!psName) return null;
      const cPs = clean(psName);
      if (!cPs) return null;

      // 1. Exact clean match
      let found = v2List.find(i => i.cleanInst === cPs);
      if (found) return found;

      // 2. Check acronym or alias expansions
      // e.g. "nmtc", "college of education", "university"
      // Check if one contains the other completely
      const subMatches = v2List.filter(i => {
        if (i.cleanInst.length > 5 && cPs.includes(i.cleanInst)) return true;
        if (cPs.length > 5 && i.cleanInst.includes(cPs)) return true;
        return false;
      });
      if (subMatches.length === 1) return subMatches[0];

      // 3. Token-based similarity / Jaccard
      const psTokens = new Set(cPs.split(" "));
      let bestMatch = null;
      let maxOverlap = 0;
      for (const i of v2List) {
        const iTokens = i.cleanInst.split(" ");
        let common = 0;
        for (const t of iTokens) {
          if (t.length > 2 && psTokens.has(t)) common++;
        }
        const score = common / Math.max(iTokens.length, psTokens.size);
        if (score > 0.6 && score > maxOverlap) {
          maxOverlap = score;
          bestMatch = i;
        }
      }
      return bestMatch;
    }

    // Analyze each row
    const auditResults = [];
    let matchedCount = 0;
    let mismatchedConstituencyCount = 0;
    let identicalConstituencyCount = 0;
    let unmatchedInstCount = 0;

    for (const row of ecRows) {
      // Find matching institution from v2
      // Try by person voterId/phone first if institution string is tricky, else by polling_station
      let v2Inst = null;
      let matchSource = "";

      const matchedPerson = (row.voter_id && v2PersonByVoterId.get(clean(row.voter_id))) ||
                            (row.phone && v2PersonByPhone.get(clean(row.phone)));

      const instFromPs = findV2Inst(row.polling_station);

      if (instFromPs) {
        v2Inst = instFromPs;
        matchSource = "polling_station_match";
      } else if (matchedPerson) {
        v2Inst = v2List.find(i => clean(i.institution) === clean(matchedPerson.institution));
        matchSource = "person_voter_phone_match";
      }

      if (v2Inst) {
        matchedCount++;
        const currentConstClean = clean(row.constituency);
        const targetConstClean = clean(v2Inst.canonical_constituency || v2Inst.v2_constituency);

        const isSame = (currentConstClean === targetConstClean) ||
                       (currentConstClean.includes(targetConstClean)) ||
                       (targetConstClean.includes(currentConstClean));

        if (isSame) {
          identicalConstituencyCount++;
        } else {
          mismatchedConstituencyCount++;
          auditResults.push({
            id: row.id,
            executive_name: row.executive_name,
            position: row.position,
            executive_level: row.executive_level,
            region: row.region,
            current_constituency: row.constituency,
            target_constituency: v2Inst.canonical_constituency || v2Inst.v2_constituency.toUpperCase(),
            target_region: v2Inst.v2_region,
            ec_polling_station: row.polling_station,
            v2_institution: v2Inst.institution,
            matchSource
          });
        }
      } else {
        unmatchedInstCount++;
      }
    }

    console.log(`\n=== AUDIT SUMMARY ===`);
    console.log(`Total EC TESCON/Patron rows: ${ecRows.length}`);
    console.log(`Matched to v2 Institutions: ${matchedCount}`);
    console.log(`- Identical constituency: ${identicalConstituencyCount}`);
    console.log(`- DIFFERENT constituency (needs update): ${mismatchedConstituencyCount}`);
    console.log(`Unmatched institutions in v2: ${unmatchedInstCount}`);

    fs.writeFileSync(
      "/Users/THINKPAD/Documents/parallel/scratch/tescon_constituency_mismatches.json",
      JSON.stringify(auditResults, null, 2)
    );
    console.log(`Wrote mismatches to scratch/tescon_constituency_mismatches.json`);

    // Group differences by (ec_polling_station / v2_institution)
    const grouped = new Map();
    for (const r of auditResults) {
      const key = `${r.ec_polling_station} || ${r.v2_institution}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          ec_institution: r.ec_polling_station,
          v2_institution: r.v2_institution,
          current_constituency: r.current_constituency,
          target_constituency: r.target_constituency,
          current_region: r.region,
          target_region: r.target_region,
          count: 0,
          ids: []
        });
      }
      const entry = grouped.get(key);
      entry.count++;
      entry.ids.push(r.id);
    }

    console.log(`\nDistinct Institutions with constituency discrepancies: ${grouped.size}`);
    const groupedArray = Array.from(grouped.values()).sort((a, b) => b.count - a.count);
    console.log("Top 25 discrepancy groups:");
    for (const g of groupedArray.slice(0, 25)) {
      console.log(`- [${g.count} rows] "${g.ec_institution}" -> Current: ${g.current_constituency} (${g.current_region}) => Target: ${g.target_constituency} (${g.target_region})`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sqlV2.end();
    await sqlEc.end();
  }
}

main();
