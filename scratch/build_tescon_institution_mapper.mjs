import postgres from "postgres";
import fs from "fs";

const sqlV2 = postgres("postgresql://postgres:Jalabia123++@72.61.17.76:5432/executives_v2");
const sqlEc = postgres("postgresql://postgres:Jalabia123++@72.61.17.76:5432/ec-data");

function clean(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Canonicalize constituency names to match ec-data uppercase canonical forms
function getEcCanonicalConstituency(v2Name, v2Region, canonicalMap) {
  const c = clean(v2Name);
  if (canonicalMap.has(c)) return canonicalMap.get(c);

  // Manual overrides for known differences in naming
  const overrides = {
    "adenta": "ADENTAN",
    "nadowli kaleo": "NADOWLI KALEO",
    "komenda edina eguafo abirem": "KOMENDA-EDINA-EGUAFO-ABIREM",
    "essikado ketan": "ESSIKADU-KETAN",
    "sissala east": "SISSALA EAST",
    "sissala west": "SISSALA WEST",
    "ahafo ano south west": "AHAFO ANO SOUTH WEST",
    "ahafo ano south east": "AHAFO ANO SOUTH EAST",
    "asunafo north": "ASUNAFO NORTH",
    "asunafo south": "ASUNAFO SOUTH",
    "asutifi north": "ASUTIFI NORTH",
    "asutifi south": "ASUTIFI SOUTH",
    "tano north": "TANO NORTH",
    "tano south": "TANO SOUTH",
    "afigya sekyere east": "AFIGYA SEYERE EAST",
    "afigya kwabre north": "AFIGYA KWABRE NORTH",
    "afigya kwabre south": "AFIGYA KWABRE SOUTH",
    "bolgatanga central": "BOLGATANGA CENTRAL",
    "bolgatanga east": "BOLGA EAST",
    "bortianor ngleshie amanfro": "BORTIANOR-NGLESHIE-AMANFRO",
    "dade kotopon": "LA DADEKOTOPON",
    "la dadekotopon": "LA DADEKOTOPON",
    "anyaa sowutuom": "ANYAA-SOWUTUOM",
    "ayawaso west wuogon": "AYAWASO WEST WUOGON",
    "dome kwabenya": "DOME-KWABENYA",
    "korle klottey": "KORLE KLOTTEY",
    "weija gbawe": "WEIJA GBAWE",
    "okaikwei central": "OKAIKWEI CENTRAL",
    "tamale central": "TAMALE CENTRAL",
    "tamale south": "TAMALE SOUTH",
    "tamale north": "TAMALE NORTH",
    "nalerigu gambaga": "NALERIGU/GAMBAGA",
    "yagaba kubori": "YAGABA/KUBORI",
    "daboya mankarigu": "DABOYA/MANKARIGU",
    "salaga south": "SALAGA SOUTH",
    "salaga north": "SALAGA NORTH",
    "bole bamboi": "BOLE BAMBOI",
    "kintampo north": "KINTAMPO NORTH",
    "kintampo south": "KINTAMPO SOUTH",
    "atebubu amantin": "ATEBUBU-AMANTIN",
    "pru east": "PRU EAST",
    "pru west": "PRU WEST",
    "techiman north": "TECHIMAN NORTH",
    "techiman south": "TECHIMAN SOUTH",
    "nkoranza south": "NKORANZA SOUTH",
    "nkoranza north": "NKORANZA NORTH",
    "berekum east": "BEREKUM EAST",
    "berekum west": "BEREKUM WEST",
    "dormaa central": "DORMAA CENTRAL",
    "dormaa east": "DORMAA EAST",
    "dormaa west": "DORMAA WEST",
    "sunyani east": "SUNYANI EAST",
    "sunyani west": "SUNYANI WEST",
    "effia": "EFFIA",
    "sekondi": "SEKONDI",
    "takoradi": "TAKORADI",
    "tarkwa nsuaem": "TARKWA NSUAEM",
    "ellembelle": "ELLEMBELE",
    "amenfi west": "AMENFI WEST",
    "amenfi central": "AMENFI CENTRAL",
    "amenfi east": "AMENFI EAST",
    "sefwi wiawso": "SEFWI WIAWSO",
    "bibiani anhwiaso bekwai": "BIBIANI-ANHWIASO-BEKWAI",
    "aowin": "AOWIN",
    "bia west": "BIA WEST",
    "bia east": "BIA EAST",
    "suaman": "SUAMAN",
    "juaboso": "JUABOSO",
    "bodi": "BODI",
    "cape coast north": "CAPE COAST NORTH",
    "cape coast south": "CAPE COAST SOUTH",
    "ajumako enyan essiam": "AJUMAKO ENYAN ESIAM",
    "assin central": "ASSIN CENTRAL",
    "assin south": "ASSIN SOUTH",
    "assin north": "ASSIN NORTH",
    "gomoa central": "GOMOA CENTRAL",
    "gomoa east": "GOMOA EAST",
    "gomoa west": "GOMOA WEST",
    "effutu": "EFFUTU",
    "awutu senya east": "AWUTU SENYA EAST",
    "awutu senya west": "AWUTU SENYA WEST",
    "twifo atti morkwa": "TWIFO ATTI MORKWA",
    "upper denkyira east": "UPPER DENKYIRA EAST",
    "upper denkyira west": "UPPER DENKYIRA WEST",
    "new juaben south": "NEW JUABEN SOUTH",
    "new juaben north": "NEW JUABEN NORTH",
    "asene akroso manso": "ASENE/AKROSO/MANSO",
    "lower manya krobo": "LOWER MANYA KROBO",
    "upper manya krobo": "UPPER MANYA KROBO",
    "yilo krobo": "YILO KROBO",
    "nsawam adoagyiri": "NSAWAM/ADOAGYIRI",
    "akuapem south": "AKUAPEM SOUTH",
    "akropong": "AKROPONG",
    "aburi": "AKUAPEM SOUTH",
    "abuakwa north": "ABUAKWA NORTH",
    "abuakwa south": "ABUAKWA SOUTH",
    "akim oda": "AKIM ODA",
    "akim swedru": "AKIM SWEDRU",
    "achiase": "ACHIASE",
    "kwahu east": "KWAHU EAST",
    "kwahu south": "KWAHU SOUTH",
    "kwahu west": "KWAHU WEST",
    "mpraeso": "MPRAESO",
    "nkawkaw": "NKAWKAW",
    "abetifi": "ABETIFI"
  };

  if (overrides[c]) return overrides[c];
  return v2Name.toUpperCase();
}

async function main() {
  try {
    // 1. Load ec-data canonical constituencies
    const ecConstRows = await sqlEc`
      SELECT c.name, r.name as region_name
      FROM constituencies c
      JOIN regions r ON c.region_id = r.id;
    `;
    const canonicalMap = new Map();
    for (const row of ecConstRows) {
      canonicalMap.set(clean(row.name), row.name.toUpperCase());
    }
    // Also include existing uppercase names from executives_all
    const existing = await sqlEc`SELECT DISTINCT constituency FROM executives_all WHERE executive_level = 'Constituency';`;
    for (const e of existing) {
      if (e.constituency) canonicalMap.set(clean(e.constituency), e.constituency.toUpperCase());
    }

    // 2. Load all 280 institutions from executives_v2
    const v2Insts = await sqlV2`
      SELECT ti.id, ti.institution, c.region as v2_region, c.constituency as v2_constituency
      FROM "TesconInst" ti
      JOIN "Constituency" c ON ti."constituencyId" = c.id
      ORDER BY c.region, c.constituency, ti.institution;
    `;
    console.log(`Loaded ${v2Insts.length} institutions from executives_v2.`);

    // 3. Load all 941 TESCON / Patron records from ec-data
    const ecRows = await sqlEc`
      SELECT id, executive_level, position, region, constituency, electoral_area, polling_station, executive_name, phone, voter_id
      FROM executives_all
      WHERE executive_level IN ('TESCON', 'Patron')
         OR position ILIKE '%tescon%'
         OR record_entered_by ILIKE '%tescon%'
      ORDER BY id;
    `;
    console.log(`Loaded ${ecRows.length} TESCON/Patron records from ec-data.`);

    // Also load all v2 Tescon person records for exact voter_id / phone resolution
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

    // Build institution lookup list with normalized forms and aliases
    const v2List = v2Insts.map(v => {
      const canonicalConst = getEcCanonicalConstituency(v.v2_constituency, v.v2_region, canonicalMap);
      return {
        ...v,
        cleanInst: clean(v.institution),
        canonical_constituency: canonicalConst
      };
    });

    // Helper to match an ec row to a v2 institution
    function matchRowToV2(row) {
      // 1. Try exact person voter_id match
      if (row.voter_id) {
        const p = v2PersonByVoterId.get(clean(row.voter_id));
        if (p) {
          const matched = v2List.find(v => v.id === p.institutionId || clean(v.institution) === clean(p.institution));
          if (matched) return { match: matched, method: "person_voter_id" };
        }
      }

      // 2. Try exact person phone match
      if (row.phone) {
        const p = v2PersonByPhone.get(clean(row.phone));
        if (p) {
          const matched = v2List.find(v => v.id === p.institutionId || clean(v.institution) === clean(p.institution));
          if (matched) return { match: matched, method: "person_phone" };
        }
      }

      const ecPs = clean(row.polling_station);
      if (!ecPs) return null;

      // Scope to same region if possible
      const ecReg = clean(row.region);
      const regionalV2 = v2List.filter(v => clean(v.v2_region) === ecReg);
      const searchPool = regionalV2.length > 0 ? regionalV2 : v2List;

      // 3. Exact clean match in regional pool
      let found = searchPool.find(v => v.cleanInst === ecPs);
      if (found) return { match: found, method: "exact_name_regional" };

      // 4. Known aliases & acronyms
      // e.g. "nmtc" <-> "nursing and midwifery training college"
      // "coe" <-> "college of education"
      // "knust idl" <-> "knust"
      // "umat srid" <-> "university of mines and technology srid"
      const expandAcronyms = (s) => {
        return s
          .replace(/\bnmtc\b/g, "nursing and midwifery training college")
          .replace(/\bntc\b/g, "nursing training college")
          .replace(/\bpntc\b/g, "presbyterian nursing training college")
          .replace(/\bcntc\b/g, "community nursing training college")
          .replace(/\bcoe\b/g, "college of education")
          .replace(/\buds\b/g, "university for development studies")
          .replace(/\buenr\b/g, "university of energy and natural resources")
          .replace(/\buew\b/g, "university of education winneba")
          .replace(/\bgctu\b/g, "ghana telecom university college")
          .replace(/\bubids\b/g, "s d dombo ubids")
          .replace(/\bktu\b/g, "koforidua technical university")
          .replace(/\bttu\b/g, "takoradi technical university")
          .replace(/\bkstu\b/g, "kumasi technical university")
          .replace(/\bhtu\b/g, "ho technical university")
          .replace(/\btatu\b/g, "tamale technical university")
          .replace(/\bstu\b/g, "sunyani technical university")
          .replace(/\batu\b/g, "accra technical university");
      };

      const expandedEcPs = expandAcronyms(ecPs);

      // Search with expanded acronyms
      for (const v of searchPool) {
        const expV = expandAcronyms(v.cleanInst);
        if (expV === expandedEcPs) return { match: v, method: "expanded_acronym_exact" };
        if (expV.length > 10 && (expV.includes(expandedEcPs) || expandedEcPs.includes(expV))) {
          return { match: v, method: "expanded_acronym_substring" };
        }
      }

      // 5. Token overlap within regional pool
      const ecTokens = new Set(expandedEcPs.split(" ").filter(t => t.length > 2));
      let best = null;
      let maxScore = 0;
      for (const v of searchPool) {
        const expV = expandAcronyms(v.cleanInst);
        const vTokens = expV.split(" ").filter(t => t.length > 2);
        let common = 0;
        for (const t of vTokens) {
          if (ecTokens.has(t)) common++;
        }
        const score = common / Math.max(vTokens.length, ecTokens.size);
        if (score >= 0.5 && score > maxScore) {
          maxScore = score;
          best = v;
        }
      }
      if (best) return { match: best, method: `token_similarity_${maxScore.toFixed(2)}` };

      // 6. Global pool fallback if not found in region
      let globalExact = v2List.find(v => v.cleanInst === ecPs);
      if (globalExact) return { match: globalExact, method: "global_exact" };

      return null;
    }

    // Now map all rows and detect discrepancies
    let matchedTotal = 0;
    let unmatchedTotal = 0;
    let discrepancies = [];
    let agreements = 0;

    for (const row of ecRows) {
      const res = matchRowToV2(row);
      if (res) {
        matchedTotal++;
        const targetConst = res.match.canonical_constituency;
        const currentConstClean = clean(row.constituency);
        const targetConstClean = clean(targetConst);

        const isMatch = currentConstClean === targetConstClean;

        if (isMatch) {
          agreements++;
        } else {
          discrepancies.push({
            id: row.id,
            executive_name: row.executive_name,
            executive_level: row.executive_level,
            position: row.position,
            region: row.region,
            current_constituency: row.constituency,
            target_constituency: targetConst,
            target_region: res.match.v2_region,
            ec_polling_station: row.polling_station,
            v2_institution: res.match.institution,
            method: res.method
          });
        }
      } else {
        unmatchedTotal++;
      }
    }

    console.log(`\n=== MATCHING SUMMARY ===`);
    console.log(`Total EC Rows: ${ecRows.length}`);
    console.log(`Matched to v2: ${matchedTotal} (${(matchedTotal/ecRows.length*100).toFixed(1)}%)`);
    console.log(`- Exact Agreement (no change needed): ${agreements}`);
    console.log(`- Constituency Discrepancies (CHANGES NEEDED): ${discrepancies.length}`);
    console.log(`Unmatched Rows: ${unmatchedTotal}`);

    // Group discrepancies by institution
    const grouped = new Map();
    for (const d of discrepancies) {
      const key = `${d.region} | ${d.ec_polling_station} | ${d.current_constituency} -> ${d.target_constituency}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          region: d.region,
          polling_station: d.ec_polling_station,
          v2_institution: d.v2_institution,
          current_constituency: d.current_constituency,
          target_constituency: d.target_constituency,
          count: 0,
          ids: [],
          sampleNames: []
        });
      }
      const g = grouped.get(key);
      g.count++;
      g.ids.push(d.id);
      if (g.sampleNames.length < 3) g.sampleNames.push(d.executive_name);
    }

    console.log(`\nUnique discrepancy groups: ${grouped.size}`);
    fs.writeFileSync(
      "/Users/THINKPAD/Documents/parallel/scratch/tescon_constituency_changes.json",
      JSON.stringify(Array.from(grouped.values()), null, 2)
    );

    console.log("\nAll Discrepancy Groups:");
    for (const g of Array.from(grouped.values()).sort((a, b) => a.region.localeCompare(b.region))) {
      console.log(`[${g.count} rows] (${g.region}) "${g.polling_station}" => FROM "${g.current_constituency}" TO "${g.target_constituency}"`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sqlV2.end();
    await sqlEc.end();
  }
}

main();
