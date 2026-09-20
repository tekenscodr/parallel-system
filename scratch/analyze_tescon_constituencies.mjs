import postgres from "postgres";

const sqlV2 = postgres("postgresql://postgres:Jalabia123++@72.61.17.76:5432/executives_v2");
const sqlEc = postgres("postgresql://postgres:Jalabia123++@72.61.17.76:5432/ec-data");

function normalize(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  try {
    // 1. Fetch all 280 institutions from executives_v2
    const v2Institutions = await sqlV2`
      SELECT ti.id, ti.institution, c.region as region, c.constituency as constituency
      FROM "TesconInst" ti
      JOIN "Constituency" c ON ti."constituencyId" = c.id
      ORDER BY ti.institution;
    `;
    console.log(`Loaded ${v2Institutions.length} institutions from executives_v2.`);

    // 2. Fetch all TESCON/Patron rows from ec-data.executives_all
    const ecRows = await sqlEc`
      SELECT id, executive_level, position, region, constituency, electoral_area, polling_station, executive_name, phone, voter_id, record_entered_by
      FROM executives_all
      WHERE executive_level IN ('TESCON', 'Patron')
         OR position ILIKE '%tescon%'
         OR record_entered_by ILIKE '%tescon%'
      ORDER BY id;
    `;
    console.log(`Loaded ${ecRows.length} TESCON/Patron rows from ec-data.`);

    // 3. Build lookup maps for v2 institutions
    // Map normalized institution name -> v2 institution object
    const v2ByNorm = new Map();
    for (const item of v2Institutions) {
      const norm = normalize(item.institution);
      if (!v2ByNorm.has(norm)) {
        v2ByNorm.set(norm, []);
      }
      v2ByNorm.get(norm).push(item);
    }

    // Also let's check exact match and fuzzy/containment match
    let exactMatches = 0;
    let mismatches = [];
    let unmapped = [];

    // Also check v2 Tescon persons (by voter_id or phone or name) to see their institution and constituency
    const v2TesconPersons = await sqlV2`
      SELECT t.id, t."fullName", t."phoneNumber", t.position, t."voterId", ti.institution, c.region, c.constituency
      FROM "Tescon" t
      JOIN "TesconInst" ti ON t."institutionId" = ti.id
      JOIN "Constituency" c ON ti."constituencyId" = c.id;
    `;
    console.log(`Loaded ${v2TesconPersons.length} TESCON individual records from executives_v2.`);

    const v2PersonByVoterId = new Map();
    const v2PersonByPhone = new Map();
    for (const p of v2TesconPersons) {
      if (p.voterId) v2PersonByVoterId.set(normalize(p.voterId), p);
      if (p.phoneNumber) v2PersonByPhone.set(normalize(p.phoneNumber), p);
    }

    // Check ecRows
    let countPersonVoterMatched = 0;
    let countPersonPhoneMatched = 0;
    let constituencyDifferencesPerson = [];

    for (const row of ecRows) {
      let matchedV2Person = null;
      if (row.voter_id && v2PersonByVoterId.has(normalize(row.voter_id))) {
        matchedV2Person = v2PersonByVoterId.get(normalize(row.voter_id));
        countPersonVoterMatched++;
      } else if (row.phone && v2PersonByPhone.has(normalize(row.phone))) {
        matchedV2Person = v2PersonByPhone.get(normalize(row.phone));
        countPersonPhoneMatched++;
      }

      if (matchedV2Person) {
        const normEcConst = normalize(row.constituency);
        const normV2Const = normalize(matchedV2Person.constituency);
        if (normEcConst !== normV2Const) {
          constituencyDifferencesPerson.push({
            id: row.id,
            name: row.executive_name,
            position: row.position,
            ec_institution: row.polling_station,
            v2_institution: matchedV2Person.institution,
            ec_constituency: row.constituency,
            v2_constituency: matchedV2Person.constituency,
            ec_region: row.region,
            v2_region: matchedV2Person.region,
            matchType: row.voter_id && v2PersonByVoterId.has(normalize(row.voter_id)) ? "voter_id" : "phone"
          });
        }
      }
    }

    console.log(`Person matches: ${countPersonVoterMatched} by voter_id, ${countPersonPhoneMatched} by phone.`);
    console.log(`Differences in constituency among person matches: ${constituencyDifferencesPerson.length}`);

    // Now analyze by institution name in polling_station
    let instDifferences = [];
    let instAgreements = [];
    let instNotFound = [];

    for (const row of ecRows) {
      const psNorm = normalize(row.polling_station);
      if (!psNorm) {
        instNotFound.push({ row, reason: "empty polling_station" });
        continue;
      }

      // Check direct normalized match
      let v2Match = v2ByNorm.get(psNorm);

      // If no direct match, check contains / partial match
      if (!v2Match) {
        for (const [normKey, items] of v2ByNorm.entries()) {
          if (normKey === psNorm || normKey.includes(psNorm) || psNorm.includes(normKey)) {
            v2Match = items;
            break;
          }
        }
      }

      if (v2Match && v2Match.length > 0) {
        const target = v2Match[0];
        const normEcConst = normalize(row.constituency);
        const normV2Const = normalize(target.constituency);
        if (normEcConst !== normV2Const) {
          instDifferences.push({
            id: row.id,
            name: row.executive_name,
            position: row.position,
            ec_institution: row.polling_station,
            v2_institution: target.institution,
            ec_constituency: row.constituency,
            v2_constituency: target.constituency,
            ec_region: row.region,
            v2_region: target.region
          });
        } else {
          instAgreements.push(row.id);
        }
      } else {
        instNotFound.push({ id: row.id, name: row.executive_name, ps: row.polling_station, constituency: row.constituency, region: row.region });
      }
    }

    console.log(`Institution Matching Results:`);
    console.log(`- Exact / Partial Matches with matching constituency: ${instAgreements.length}`);
    console.log(`- Matches with DIFFERENT constituency: ${instDifferences.length}`);
    console.log(`- Institutions not found in v2: ${instNotFound.length}`);

    // Sample mismatches
    console.log("\nSample constituency differences by institution (first 20):");
    console.log(JSON.stringify(instDifferences.slice(0, 20), null, 2));

    // Sample differences by person
    console.log("\nSample constituency differences by person (first 20):");
    console.log(JSON.stringify(constituencyDifferencesPerson.slice(0, 20), null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await sqlV2.end();
    await sqlEc.end();
  }
}

main();
