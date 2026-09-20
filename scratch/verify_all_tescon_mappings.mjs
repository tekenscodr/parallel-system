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

async function main() {
  try {
    // 1. Load canonical constituencies from ec-data
    const ecConstRows = await sqlEc`
      SELECT c.id, c.name, r.name as region_name
      FROM constituencies c
      JOIN regions r ON c.region_id = r.id;
    `;
    const canonicalByClean = new Map();
    for (const row of ecConstRows) {
      canonicalByClean.set(clean(row.name), {
        id: row.id,
        name: row.name.toUpperCase(),
        region: row.region_name
      });
    }

    // 2. Load 280 institutions from executives_v2
    const v2Insts = await sqlV2`
      SELECT ti.id as v2_id, ti.institution, c.region as v2_region, c.constituency as v2_constituency
      FROM "TesconInst" ti
      JOIN "Constituency" c ON ti."constituencyId" = c.id
      ORDER BY c.region, c.constituency, ti.institution;
    `;

    // Overrides for constituency names in ec-data
    const constOverrides = {
      "adenta": "ADENTAN",
      "nadowli kaleo": "NADOWLI KALEO",
      "komenda edina eguafo abirem": "KOMENDA-EDINA-EGUAFO-ABIREM",
      "essikado ketan": "ESSIKADU-KETAN",
      "afigya sekyere east": "AFIGYA SEYERE EAST",
      "bolgatanga east": "BOLGA EAST",
      "bortianor ngleshie amanfro": "BORTIANOR-NGLESHIE-AMANFRO",
      "dade kotopon": "LA DADEKOTOPON",
      "anyaa sowutuom": "ANYAA-SOWUTUOM",
      "dome kwabenya": "DOME-KWABENYA",
      "nalerigu gambaga": "NALERIGU/GAMBAGA",
      "yagaba kubori": "YAGABA/KUBORI",
      "daboya mankarigu": "DABOYA/MANKARIGU",
      "atebubu amantin": "ATEBUBU-AMANTIN",
      "bibiani anhwiaso bekwai": "BIBIANI-ANHWIASO-BEKWAI",
      "asene akroso manso": "ASENE/AKROSO/MANSO",
      "nsawam adoagyiri": "NSAWAM/ADOAGYIRI",
      "ajumako enyan essiam": "AJUMAKO ENYAN ESIAM"
    };

    const v2List = v2Insts.map(v => {
      const cClean = clean(v.v2_constituency);
      let canonical = constOverrides[cClean];
      if (!canonical) {
        const found = canonicalByClean.get(cClean);
        canonical = found ? found.name : v.v2_constituency.toUpperCase();
      }
      return {
        ...v,
        cleanInst: clean(v.institution),
        canonical_constituency: canonical
      };
    });

    // 3. Load all TESCON/Patron rows in ec-data
    const ecRows = await sqlEc`
      SELECT id, executive_level, position, region, constituency, electoral_area, polling_station, executive_name, phone, voter_id
      FROM executives_all
      WHERE (executive_level IN ('TESCON', 'Patron') OR position ILIKE '%tescon%')
      ORDER BY id;
    `;
    console.log(`Loaded ${ecRows.length} total rows from ec-data.`);

    // 4. Load v2 individual Tescon rows
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

    // Now write a robust matcher per region
    function findBestV2Match(ecRow) {
      // If position is Regional Coordinator, skip institutional mapping
      if (/regional.*tescon/i.test(ecRow.position) || /tescon.*coordinator/i.test(ecRow.position) && ecRow.executive_level === 'Region') {
        return { isRegionalCoordinator: true };
      }

      // Check person voter_id / phone
      if (ecRow.voter_id && v2PersonByVoterId.has(clean(ecRow.voter_id))) {
        const p = v2PersonByVoterId.get(clean(ecRow.voter_id));
        const matched = v2List.find(v => clean(v.institution) === clean(p.institution));
        if (matched) return { match: matched, method: "person_voter_id" };
      }
      if (ecRow.phone && v2PersonByPhone.has(clean(ecRow.phone))) {
        const p = v2PersonByPhone.get(clean(ecRow.phone));
        const matched = v2List.find(v => clean(v.institution) === clean(p.institution));
        if (matched) return { match: matched, method: "person_phone" };
      }

      const ecPs = clean(ecRow.polling_station);
      if (!ecPs) return null;

      const ecReg = clean(ecRow.region);
      const regionalPool = v2List.filter(v => clean(v.v2_region) === ecReg);

      // Exact match in regional pool
      let exact = regionalPool.find(v => v.cleanInst === ecPs);
      if (exact) return { match: exact, method: "exact_name_regional" };

      // Acronym expansions and known institution name mappings
      const aliasMap = {
        "kwapong nmtc": "KWAPONG NURSING TRAINING COLLEGE",
        "college of nursing and midwifery kwapong": "KWAPONG NURSING TRAINING COLLEGE",
        "goaso nmtc": "GOASO NURSING AND MIDWIFERY",
        "nmtc goaso": "GOASO NURSING AND MIDWIFERY",
        "tanoso nmtc": "TANOSO NURSING AND MIDWIFERY",
        "college of nursing and midwifery tanoso": "TANOSO NURSING AND MIDWIFERY",
        "st john of god college of health duayaw nkwantia": "ST JOHN OF GOD COLLEGE OF HEALTH",
        "college of health duayaw nkwanta": "ST JOHN OF GOD COLLEGE OF HEALTH",
        "dadiesoaba nmtc": "DADIESOABA NMTC",
        "nursing training college dadiesoaba": "DADIESOABA NMTC",
        "ntroso college nursing and midwifery": "NTOTROSO NURSING AND MIDWIFERY",
        "st joseph college of education bechem": "ST JOSEPH COLLEGE OF EDUCATION",
        "bechem college of education": "ST JOSEPH COLLEGE OF EDUCATION",
        "st joseph college of education": "ST JOSEPH COLLEGE OF EDUCATION",
        
        // Ashanti
        "gctu": "GHANA TELECOM UNIVERSITY COLLEGE",
        "ghana communication technology university": "GHANA TELECOM UNIVERSITY COLLEGE",
        "ghana telecom university college": "GHANA TELECOM UNIVERSITY COLLEGE",
        "gimpa": "GIMPA-KUMASI CAMPUS",
        "gimpa kumasi campus": "GIMPA-KUMASI CAMPUS",
        "christian service university": "CHRISTIAN SERVICE UNIVERSITY COLLEGE",
        "christian service university college": "CHRISTIAN SERVICE UNIVERSITY COLLEGE",
        "baptist university": "GHANA BAPTIST UNIVERSITY COLLEGE",
        "ghana baptist university college": "GHANA BAPTIST UNIVERSITY COLLEGE",
        "kessben university college": "KESSBEN UNIVERSITY COLLEGE",
        "central university kumasi campus": "CENTRAL UNIVERSITY- KUMASI CAMPUS",
        "nmtc kumasi": "KUMASI NMTC",
        "kumasi nmtc": "KUMASI NMTC",
        "knust": "KNUST",
        "knust main campus": "KNUST",
        "knust kumasi": "KNUST",
        "aamusted kumasi": "AAMUSTED, KUMASI",
        "aamusted mampong": "AAMUSTED, MAMPONG",
        "kwadaso agricultural college": "KWADASO AGRICULTURAL COLLEGE",
        "kwadaso s d a nursing and midwifery": "KWADASO S.D.A NURSING AND MIDWIFERY",
        "mampong nmtc": "MAMPONG NMTC",
        "college of nursing and midwifery mampong": "MAMPONG NMTC",
        "fomena nmtc": "FOMENA NURSING AND MIDWIFERY",
        "nursing and midwifery training college fomena adansi": "FOMENA NURSING AND MIDWIFERY",
        "st monica s college of education": "ST MONICA'S COLLEGE OF EDUCATION",
        "st monicas college of education": "ST MONICA'S COLLEGE OF EDUCATION",
        "st patrick s nursing and midwifery": "ST PATRICK'S NURSING AND MIDWIFERY",
        "st patricks nursing and midwifery": "ST PATRICK'S NURSING AND MIDWIFERY",
        "offinso college of education": "OFFINSO COLLEGE OF EDUCATION",
        "wesley college of education": "WESLEY COLLEGE OF EDUCATION",
        "st louis college of education": "ST LOUIS COLLEGE OF EDUCATION",
        "agogo nmtc": "AGOGO NMTC",
        "presbyterian nursing and midwifery training college agogo": "AGOGO NMTC",
        "agogo presby women college of education": "AGOGO PRESBY WOMEN COLLEGE OF EDUCATION",
        "akrokerri college of education": "AKROKERRI COLLEGE OF EDUCATION",
        "ejura agricultural college": "EJURA AGRICULTURAL COLLEGE",
        "ejura college of agriculture and mechanization center": "EJURA AGRICULTURAL COLLEGE",
        "garden city university college": "GARDEN CITY UNIVERSITY COLLEGE",
        "multimedia institute of ghana mig": "MULTIMEDIA INSTITUTE OF JOURNALISM",
        "multimedia institute of journalism": "MULTIMEDIA INSTITUTE OF JOURNALISM",
        "institute of business management and journalism": "INSTITUTE OF BUSINESS MGT AND JOURNALISM",
        "institute of business mgt and journalism": "INSTITUTE OF BUSINESS MGT AND JOURNALISM",
        "neumann college department of nursing": "NEUMAN COLLEGE OF NURSING",
        "neuman college of nursing": "NEUMAN COLLEGE OF NURSING",
        "afia kobi nursing training college": "AFIA KOBI NURSING TRAINING COLLEGE",
        "afia kobi serwaa ampem nursing training college": "AFIA KOBI NURSING TRAINING COLLEGE",
        "kokofu nmtc": "KOKOFU NURSING AND MIDWIFERY",
        "kokofu nursing and midwifery": "KOKOFU NURSING AND MIDWIFERY",
        "royal ann health college": "ROYAL ANN HEALTH COLLEGE",
        "royal ann college of health": "ROYAL ANN HEALTH COLLEGE",
        "s d a college of education agona": "S.D.A COLLEGE OF EDUCATION- AGONA",
        "s d a midwifery training school asamang": "S.D.A MIDWIFERY TRAINING SCHOOL- ASAMANG",
        "withrow university": "WITHROW UNIVERSITY COLLEGE",
        "withrow university college": "WITHROW UNIVERSITY COLLEGE",
        "tepa nursing training college": "TEPA NURSING TRAINING COLLEGE",
        "tepa nmtc": "TEPA NURSING TRAINING COLLEGE",
        "otec school of journalism": "OTEC SCHOOL OF JOURNALISM",
        "university of ghana kumasi campus": "UNIVERSITY OF GHANA- KUMASI CAMPUS",
        "ug kumasi campus": "UNIVERSITY OF GHANA- KUMASI CAMPUS",
        "kumasi technical university": "KUMASI TECHNICAL UNIVERSITY",
        "kstu": "KUMASI TECHNICAL UNIVERSITY",
        "school of languages": "SCHOOL OF LANGUAGES",
        "ghana institute of languages": "SCHOOL OF LANGUAGES",
        "valley view university college kumasi": "VALLEY VIEW UNIVERSITY COLLEGE-KUMASI",
        "valley view university kumasi": "VALLEY VIEW UNIVERSITY COLLEGE-KUMASI",
        "college of integrated healthcare obuasi": "INTEGRATED SCHOOL OF HEALTH, OBUASI",
        "integrated school of health obuasi": "INTEGRATED SCHOOL OF HEALTH, OBUASI",
        "knust obuasi campus": "KNUST OBUASI CAMPUS",

        // Central
        "ucc": "UNIVERSITY OF CAPE COAST",
        "university of cape coast": "UNIVERSITY OF CAPE COAST",
        "cctu": "CAPE  COAST TECHNICAL UNIVERSITY",
        "cape coast technical university": "CAPE  COAST TECHNICAL UNIVERSITY",
        "cape coast nmtc": "CAPE COAST NURSING AND MIDWIFERY TRAINING COLLEGE",
        "cape coast nursing and midwifery training college": "CAPE COAST NURSING AND MIDWIFERY TRAINING COLLEGE",
        "ola college of education": "OLA TRAINING COLLEGE",
        "ola training college": "OLA TRAINING COLLEGE",
        "uew": "UNIVERSITY OF EDUCATION, WINNEBA",
        "uew winneba main": "UNIVERSITY OF EDUCATION, WINNEBA",
        "university of education winneba": "UNIVERSITY OF EDUCATION, WINNEBA",
        "university of education ajumako": "UNIVERSITY OF EDUCATION, AJUMAKO",
        "uew ajumako campus": "UNIVERSITY OF EDUCATION, AJUMAKO",
        "perez university": "PEREZ UNIVERSITY",
        "perez university college": "PEREZ UNIVERSITY",
        "kaaf university": "KAFF UNIVERISTY",
        "kaff univeristy": "KAFF UNIVERISTY",
        "assinman nursing college": "ASSINMAN NURSING COLLEGE",
        "assinman nurses training college": "ASSINMAN NURSING COLLEGE",
        "fosu training college": "FOSU TRAINING COLLEGE",
        "fosu college of education": "FOSU TRAINING COLLEGE",
        "komenda training college": "KOMENDA TRAINING COLLEGE",
        "komenda college of education": "KOMENDA TRAINING COLLEGE",
        "psychiatric nursing training college": "PSYCHIATRIC NURSING TRAINING COLLEGE",
        "pntc ankaful": "PSYCHIATRIC NURSING TRAINING COLLEGE",
        "ankaful psychiatric nursing training college": "PSYCHIATRIC NURSING TRAINING COLLEGE",
        "college of community health nursing": "COLLEGE OF COMMUNITY HEALTH NURSING",
        "community health nursing winneba": "COLLEGE OF COMMUNITY HEALTH NURSING",
        "nursing training college praso": "NURSING TRAINING COLLEGE-PRASO",
        "ntc twifo praso": "NURSING TRAINING COLLEGE-PRASO",
        "dunkwa nursing training college": "DUNKWA NURSING TRAINING COLLEGE",
        "dunkwa nmtc": "DUNKWA NURSING TRAINING COLLEGE",
        "bimaks college": "BIMAKS COLLEGE",

        // Western
        "ttu": "Takoradi Technical University",
        "takoradi technical university": "Takoradi Technical University",
        "takoradi technical university main": "Takoradi Technical University",
        "takoradi technical university bu": "Takoradi Technical University (BUSINESS CAMPUS)",
        "takoradi technical university business campus": "Takoradi Technical University (BUSINESS CAMPUS)",
        "gimpa takoradi campus": "GIMPA, Takoradi Campus",
        "gimpa takoradi": "GIMPA, Takoradi Campus",
        "ghana communication technology university takoradi": "Ghana Communication Technology University, Takoradi",
        "gctu takoradi": "Ghana Communication Technology University, Takoradi",
        "asanta sda nursing and midwifery training college": "Asanta SDA Nursing and Midwifery Training College",
        "asanta nmtc": "Asanta SDA Nursing and Midwifery Training College",
        "asanta": "Asanta SDA Nursing and Midwifery Training College",
        "essiama nursing and midwifery training college": "Essiama Nursing and Midwifery Training College",
        "esiama nmtc": "Essiama Nursing and Midwifery Training College",
        "essiama nmtc": "Essiama Nursing and Midwifery Training College",
        "knust takoradi campus": "KNUST, Takoradi Campus",
        "knust idl": "KNUST, Takoradi Campus",
        "university of mines and technology srid": "⁠UNIVERSITY OF MINES AND TECHNOLOGY-SRID",
        "umat srid": "⁠UNIVERSITY OF MINES AND TECHNOLOGY-SRID",
        "holy child college of education": "Holy Child College of Education",
        "holy child": "Holy Child College of Education",
        "sekondi nursing and midwifery training college": "⁠Sekondi Nursing and Midwifery Training College",
        "sekondi nmtc": "⁠Sekondi Nursing and Midwifery Training College",
        "tarkwa nursing and midwifery training college": "Tarkwa Nursing and Midwifery Training College",
        "ntmc tarkwa": "Tarkwa Nursing and Midwifery Training College",
        "tarkwa nmtc": "Tarkwa Nursing and Midwifery Training College",
        "university of mines and technology": "⁠University of Mines and Technology",
        "umat main campus": "⁠University of Mines and Technology",
        "asankrangwa nursing and midwifery training college": "Asankrangwa Nursing and Midwifery Training College",
        "asankragwa nmtc": "Asankrangwa Nursing and Midwifery Training College",
        "asanco nmtc": "Asankrangwa Nursing and Midwifery Training College",

        // Western North
        "enchi college of education": "ENCHI COLLEGE OF EDUCATION",
        "bia lamplighter college of education": "BIA LAMPLIGHTER COLLEGE OF EDUCATION",
        "bibiani college of health sciences": "BIBIANI COLLEGE OF HEALTH SCIENCES",
        "asafo college of health": "ASAFO COLLEGE OF HEALTH",
        "college of health sefwi asafo": "ASAFO COLLEGE OF HEALTH",
        "wiawso college of education": "WIAWSO COLLEGE OF EDUCATION",
        "wiawso nursing and midwifery college": "WIAWSO NURSING AND MIDWIFERY COLLEGE",
        "sefwi wiawso nursing and midwifery college": "WIAWSO NURSING AND MIDWIFERY COLLEGE",

        // Northern
        "uds tamale campus": "University for Development Studies- Tamale Campus",
        "university for development studies tamale campus": "University for Development Studies- Tamale Campus",
        "uds nyankpala campus": "University for Development Studies- Nyankpala Campus",
        "university for development studies nyankpala campus": "University for Development Studies- Nyankpala Campus",
        "uds city campus": "University for Development Studies- City Campus",
        "university for development studies city campus": "University for Development Studies- City Campus",
        "tamale college of education": "Tamale College of Education",
        "tace": "Tamale College of Education",
        "bagabaga college of education": "Bagabaga College of Education",
        "bace": "Bagabaga College of Education",
        "tamale technical university": "Tamale Technical University",
        "tatu": "Tamale Technical University",
        "tamale technical institute": "Tamale Technical University",
        "school of hygiene tamale": "School of Hygiene- Tamale",
        "school of hygience tamale": "School of Hygiene- Tamale",
        "school of hygiene": "School of Hygiene- Tamale",
        "tamale nurses training college": "Tamale Nurses Training College",
        "tamale nmtc": "Tamale Nurses Training College",
        "tamale ntc": "Tamale Nurses Training College",
        "advance global college": "Advance Global College",
        "animal health and production college": "Animal Health and Production College",
        "animal health and production college pong tamale": "Animal Health and Production College",
        "community health nurses college tamale": "Community Health Nurses College- Tamale",
        "community helth nurses training college tamale": "Community Health Nurses College- Tamale",
        "community health nurses college wamali": "Community Health Nurses College- Wamali",
        "community health nurses training college wamale": "Community Health Nurses College- Wamali",
        "community health nurses college nkachina": "Community Health Nurses College- Nkachina",
        "community health nurses training college nkanchina": "Community Health Nurses College- Nkachina",
        "government secretariate school": "Government Secretariate School",
        "tamale workers college": "Tamale Workers College",
        "new life college": "New Life College",
        "ep college of education": "EP College of Education",
        "e p college of education": "EP College of Education",
        "gushegu nurses and midwifery": "Gushegu Nurses and Midwifery",
        "gushegu nmtc": "Gushegu Nurses and Midwifery",
        "st vicent college of education": "St Vicent College of Education",
        "st vincent college of education": "St Vicent College of Education",
        "yendi college of health sciences": "Yendi College of Health Sciences",
        "yendi chs": "Yendi College of Health Sciences",

        // Upper East
        "bolga technical university": "BOLGA TECHNICAL UNIVERSITY",
        "bolgatanga technical university": "BOLGATANGA TECHNICAL UNIVERSITY",
        "bolgatanga midwifery": "BOLGATANGA MIDWIFERY",
        "bolgatanga nursing training college": "BOLGATANGA NURSING TRAINING COLLEGE",
        "bolga ntc": "BOLGATANGA NURSING TRAINING COLLEGE",
        "zuarungu ntc": "ZUARUNGU NTC",
        "zuarungu nursing and midwifery training college": "ZUARUNGU Nursing & Midwifery Training College",
        "c k tedam university of technology and applied sciences": "C. K. Tedam University of Technology and Applied Sciences",
        "ckt utas": "CKT UTAS",
        "st john bosco college of education": "ST. JOHN BOSCO COLLEGE OF EDUCATION",
        "gbewaa college": "GBEWAA COLLEGE",
        "gbewaa college of education": "GBEWAA COLLEGE",
        "regentropfen university": "Regentropfen  UNIVERSITY",
        "regentropfen university college": "Regentropfen  UNIVERSITY",
        "regentrofen university college": "Regentropfen  UNIVERSITY",
        "bawku pntc": "BAWKU PNTC",
        "presbyterian nursing and midwifery training college bawku": "Presbyterian Nursing and Midwifery Training College",
        "faith institute of journalism": "FAITH INSTITUTE OF JOURNALISM",
        "millar institute": "MILLAR INSTITUTE",

        // Upper West
        "sd dombo ubids": "S.D DOMBO UBIDS",
        "s d dombo ubids": "S.D DOMBO UBIDS",
        "ubids": "S.D DOMBO UBIDS",
        "dr hillia liman tech unv": "DR HILLIA LIMAN TECH UNV.",
        "dr hilla limann technical university": "DR HILLIA LIMAN TECH UNV.",
        "wa ntc": "WA NTC",
        "wa nursing training college": "WA NTC",
        "macoy college of education": "MACOY COLLEGE OF EDUCATION",
        "n j a college of education": "N.J.A COLLEGE OF EDUCATION",
        "nja college of education": "N.J.A COLLEGE OF EDUCATION",
        "jahan college of education wa": "N.J.A COLLEGE OF EDUCATION",
        "aswaj college of education": "ASWAJ COLLEGE OF EDUCATION",
        "asaj college of education": "ASWAJ COLLEGE OF EDUCATION",
        "jirapa midwifery and nursing training college": "JIRAPA MIDWIFERY AND NURSING TRAINING COLLEGE",
        "jirapa community nursing training college": "JIRAPA COMMUNITY NURSING TRAINING COLLEGE",
        "jirapa nursing training college rgn": "JIRAPA NURSING TRAINING COLLEGE (RGN)",
        "nandom midwifery and nursing training college": "NANDOM MIDWIFERY AND NURSING TRAINING COLLEGE",
        "lawra nursing training college": "LAWRA NURSING TRAINING COLLEGE",
        "tumu college of edu": "TUMU COLLEGE OF EDU.",
        "tumu midwifery": "TUMU MIDWIFERY",
        "nursing and midwifery training college tumu": "TUMU MIDWIFERY",

        // North East
        "walewale n m t c": "WALEWALE N.M.T.C",
        "walewale nmtc": "WALEWALE N.M.T.C",
        "college of nursing and midwifery walewale": "WALEWALE N.M.T.C",
        "nalerigu n m t c": "NALERIGU N.M.T.C",
        "nalerigu nmtc": "NALERIGU N.M.T.C",
        "gambaga college of education": "GAMBAGA COLLEGE OF EDUCATION",
        "college of nursing and midwifery kubori": "COLLEGE OF NURSING AND MIDWIFERY - KUBORI",
        "kubori n m t c": "KUBORI N.M.T,C",
        "kubori nmtc": "KUBORI N.M.T,C",

        // Savannah
        "bole nursing and midwifery training college": "BOLE NURSING AND MIDWIFERY TRAINING COLLEGE",
        "west end university college": "WEST END UNIVERSITY COLLEGE",
        "damongo agricultural college": "DAMONGO AGRICULTURAL COLLEGE",
        "damongo nursing training college": "DAMONGO NURSING TRAINING COLLEGE",
        "damongo ntc": "DAMONGO NURSING TRAINING COLLEGE",
        "savannah college of education": "SAVANNAH COLLEGE OF EDUCATION",
        "university for development studies daboya": "UNIVERSITY FOR DEVELOPMENT STUDIES- DABOYA",
        "uds daboya": "UNIVERSITY FOR DEVELOPMENT STUDIES- DABOYA",
        "kpembe nursing and midwifery training college": "KPEMBE NURSING AND MIDWIFERY TRAINING COLLEGE",
        "kpembe nmtc": "KPEMBE NURSING AND MIDWIFERY TRAINING COLLEGE",

        // Oti
        "jasikan collage of education": "JASIKAN COLLAGE OF EDUCATION",
        "jasikan college of education": "JASIKAN COLLAGE OF EDUCATION",
        "dambai collage of education": "DAMBAI COLLAGE OF EDUCATION.",
        "dambai college of education": "DAMBAI COLLAGE OF EDUCATION.",
        "dace": "DAMBAI COLLAGE OF EDUCATION.",
        "krachi nursing and midwifery training collage": "KRACHI NURSING AND MIDWIFERY TRAINING COLLAGE",
        "krachi nmtc": "KRACHI NURSING AND MIDWIFERY TRAINING COLLAGE",
        "krachi midwifrey": "KRACHI NURSING AND MIDWIFERY TRAINING COLLAGE",

        // Bono
        "berekum college of education": "Berekum College of Education",
        "berekum nursing and midwifery training college": "Berekum Nursing and Midwifery Training College",
        "berekum nmtc": "Berekum Nursing and Midwifery Training College",
        "presbyterian nursing training dormaa": "Presbyterian Nursing training Dormaa",
        "dormaa presbyterian nmtc": "Presbyterian Nursing training Dormaa",
        "university of energy and natural resource dormaa campus": "University of Energy and Natural Resource (Dormaa campus)",
        "uenr dormaa campus": "University of Energy and Natural Resource (Dormaa campus)",
        "st ambrose college of education": "St. Ambrose college of education",
        "sampa nursing training": "Sampa Nursing Training",
        "sampa nmtc": "Sampa Nursing Training",
        "sunyani nursing and midwifery training college": "Sunyani Nursing and Midwifery Training college",
        "sunyani nmtc": "Sunyani Nursing and Midwifery Training college",
        "sunyani technical university": "Sunyani Technical University",
        "stu": "Sunyani Technical University",
        "catholic university of ghana": "Catholic University of Ghana",
        "cug fiapre": "Catholic University of Ghana",
        "university of energy and natural resource uenr syi": "University of Energy and Natural Resource (UENR SYI)",
        "uenr main campus sunyani": "University of Energy and Natural Resource (UENR SYI)",
        "uenr sunyani": "University of Energy and Natural Resource (UENR SYI)",
        "seikwa nursing training": "Seikwa Nursing Training",
        "al faruq college of education": "AL FARUQ COLLEGE OF EDUCATION",
        "alfaruk teacher training college": "Alfaruk Teacher training College",

        // Bono East
        "atebubu college of education": "Atebubu College of Education",
        "college of health and well being kintampo": "COLLEGE OF HEALTH AND WELL-BEING, KINTAMPO",
        "cohk": "COLLEGE OF HEALTH AND WELL-BEING, KINTAMPO",
        "college of health and allied sciences": "College of Health and Allied Sciences",
        "martin lurther health training school": "Martin Lurther Health Training School",
        "anglican university college of technology": "Anglican University College of Technology",
        "angutech": "Anglican University College of Technology",
        "yeji nursing and midwifery training college": "Yeji Nursing and Midwifery Training College",
        "yeji nmtc": "Yeji Nursing and Midwifery Training College",
        "krobo nursing training college": "Krobo Nursing Training College",
        "krobo nmtc": "Krobo Nursing Training College",
        "holy family nursing and midwifery training college": "Holy Family Nursing and Midwifery Training College",
        "holy family nmtc techiman": "Holy Family Nursing and Midwifery Training College",
        "valley view university": "Valley View University",
        "vvu techiman campus": "Valley View University",

        // Eastern
        "presbyterian college of education abetifi": "PRESBYTERIAN COLLEGE OF EDUCATION- ABETIFI",
        "abetifi presbyterian college of education": "PRESBYTERIAN COLLEGE OF EDUCATION- ABETIFI",
        "presbyterian university ghana kwahu abetifi campus": "PRESBYTERIAN UNIVERSITY GHANA, KWAHU ABETIFI CAMPUS",
        "presbyterian university college abetifi campus": "PRESBYTERIAN UNIVERSITY GHANA, KWAHU ABETIFI CAMPUS",
        "saviour nursing and midwifery training college": "SAVIOUR NURSING AND MIDWIFERY TRAINING COLLEGE",
        "saviour nmtc": "SAVIOUR NURSING AND MIDWIFERY TRAINING COLLEGE",
        "presbyterian college of education kibi": "PRESBYTERIAN COLLEGE OF EDUCATION-KIBI",
        "kibi presbyterian college of education": "PRESBYTERIAN COLLEGE OF EDUCATION-KIBI",
        "university college of agriculture and environmental studies": "UNIVERSITY COLLEGE OF AGRICULTURE AND ENVIRONMENTAL STUDIES",
        "ucaes bunso": "UNIVERSITY COLLEGE OF AGRICULTURE AND ENVIRONMENTAL STUDIES",
        "akim oda community health nursing and midwifery college": "AKIM ODA COMMUNITY HEALTH NURSING AND MIDWIFERY COLLEGE",
        "community health nursing training college akim oda": "AKIM ODA COMMUNITY HEALTH NURSING AND MIDWIFERY COLLEGE",
        "methodist college of education": "METHODIST COLLEGE OF EDUCATION",
        "methodist college of education oda": "METHODIST COLLEGE OF EDUCATION",
        "presbyterian college of education akropong": "PRESBYTERIAN COLLEGE OF EDUCATION- AKROPONG",
        "presbyterian university ghana akropong campus": "PRESBYTERIAN UNIVERSITY GHANA AKROPONG CAMPUS",
        "presbyterian women college of education aburi": "PRESBYTERIAN WOMEN COLLEGE OF EDUCATION -ABURI",
        "akim state university college": "AKIM STATE UNIVERSITY COLLEGE",
        "odumasi krobo nursing and midwifery training college": "ODUMASI KROBO NURSING AND MIDWIFERY TRAINING COLLEGE",
        "nursing and midwifery training college atibie": "NURSING AND MIDWIFERY TRAINING COLLEGE-ATIBIE",
        "atibie nmtc": "NURSING AND MIDWIFERY TRAINING COLLEGE-ATIBIE",
        "all nations university main campus": "ALL NATIONS UNIVERSITY - MAIN CAMPUS",
        "all nations university city campus": "ALL NATIONS UNIVERSITY - CITY CAMPUS",
        "all nations university": "ALL NATIONS UNIVERSITY - MAIN CAMPUS",
        "jackson college of education": "JACKSON COLLEGE OF EDUCATION",
        "sda college of education koforidua": "SDA COLLEGE OF EDUCATION-KOFORIDUA",
        "ghana telecommunication university koforidua": "GHANA TELECOMMUNICATION UNIVERSITY-KOFORIDUA",
        "koforidua technical university": "KOFORIDUA TECHNICAL UNIVERSITY",
        "ktu": "KOFORIDUA TECHNICAL UNIVERSITY",
        "nursing and midwifery training college koforidua": "NURSING AND MIDWIFERY TRAINING COLLEGE-KOFORIDUA",
        "koforidua nmtc": "NURSING AND MIDWIFERY TRAINING COLLEGE-KOFORIDUA",
        "holy family nursing and midwifery training college nkawkaw": "HOLY FAMILY NURSING AND MIDWIFERY TRAINING COLLEGE",
        "brother tarcisius prosthetic qnd orthotic training college": "BROTHER TARCISIUS PROSTHETIC QND ORTHOTIC TRAINING COLLEGE",
        "mount mary college of education": "MOUNT MARY COLLEGE OF EDUCATION",
        "university of environment and sustainable development": "UNIVERSITY OF ENVIRONMENT AND SUSTAINABLE DEVELOPMENT",
        "uesd somanya": "UNIVERSITY OF ENVIRONMENT AND SUSTAINABLE DEVELOPMENT",

        // Volta
        "akatsi college of education": "AKATSI COLLEGE OF EDUCATION",
        "evangelican presbitarian university": "EVANGELICAN PRESBITARIAN UNIVERSITY",
        "ep university ho": "EVANGELICAN PRESBITARIAN UNIVERSITY",
        "ghana technology university college ho": "GHANA TECHNOLOGY UNIVERSITY COLLEGE, HO",
        "ho nursing training": "HO NURSING TRAINING",
        "ho ntc": "HO NURSING TRAINING",
        "ho technical university": "HO TECHNICAL UNIVERSITY",
        "htu": "HO TECHNICAL UNIVERSITY",
        "holy spirit college of education": "HOLY-SPIRIT COLLEGE OF EDUCATION",
        "school of hygiene ho": "SCHOOL OF HYGIENE",
        "school of hygiene": "SCHOOL OF HYGIENE",
        "university of health and allied science ho": "UNIVERSITY OF HEALTH & ALLIED SCIENCE,HO",
        "uhas ho": "UNIVERSITY OF HEALTH & ALLIED SCIENCE,HO",
        "university of health and allied sciences": "UNIVERSITY OF HEALTH & ALLIED SCIENCE,HO",
        "e p college of education ho west": "E.P COLLEGE OF EDUCATION",
        "ep college of education amedzofe": "E.P COLLEGE OF EDUCATION",
        "e p college of education amendzofe": "E.P COLLEGE OF EDUCATION",
        "hohoe nursing and midwifery": "HOHOE NURSING AND MIDWIFERY",
        "hohoe nmtc": "HOHOE NURSING AND MIDWIFERY",
        "st francis college of education": "ST. FRANCIS COLLEGE OF EDUCATION",
        "franco": "ST. FRANCIS COLLEGE OF EDUCATION",
        "st teresa s college of education": "ST.TERESA'S COLLEGE OF EDUCATION",
        "st teresa college of education": "ST.TERESA'S COLLEGE OF EDUCATION",
        "university of health and allied science hohoe": "UNIVERSITY OF HEALTH & ALLIED SCIENCE-HOHOE",
        "keta nursing and midwifery college": "KETA NURSING AND MIDWIFERY COLLEGE",
        "keta nursing and widwifery college": "KETA NURSING AND MIDWIFERY COLLEGE",
        "keta nmtc": "KETA NURSING AND MIDWIFERY COLLEGE",
        "ohawu agric college": "OHAWU AGRIC COLLEGE",
        "peki college of education": "PEKI COLLEGE OF EDUCATHION",
        "peki college of educathion": "PEKI COLLEGE OF EDUCATHION",

        // Greater Accra
        "methodist university accra": "METHODIST UNIVERSITY (ACCRA)",
        "methodist university ghana": "METHODIST UNIVERSITY (ACCRA)",
        "school of allied health": "SCHOOL OF ALLIED HEALTH",
        "university of ghana korle bu": "UNIVERSITY OF GHANA -KORLE BU",
        "university of ghana medical school": "UNIVERSITY OF GHANA -KORLE BU",
        "university ghana allied health science korle bu": "SCHOOL OF ALLIED HEALTH",
        "ada college of education": "ADA COLLEGE OF EDUCATION",
        "ada collage of education": "ADA COLLEGE OF EDUCATION",
        "islamic university": "ISLAMIC UNIVERSITY",
        "islamic university college ghana": "ISLAMIC UNIVERSITY",
        "lakeside university": "Lakeside University",
        "mahaveer institute of science and technology m i s t": "MAHAVEER INSTITUTE OF SCIENCE AND TECHNOLOGY (M.I.S.T)",
        "heritage university": "HERITAGE UNIVERSITY",
        "heritage christian university": "HERITAGE UNIVERSITY",
        "maranatha university": "MARANATHA UNIVERSITY",
        "pentecost university": "PENTECOST UNIVERSITY",
        "bluecrest university": "BLUECREST UNIVERSITY",
        "bluecrest university college": "BLUECREST UNIVERSITY",
        "mountcrest university": "MOUNTCREST UNIVERSITY",
        "accra college of education": "ACCRA COLLEGE OF EDUCATION",
        "dominion university": "DOMINION UNIVERSITY",
        "ghana institute of journalism gij": "GHANA INSTITUTE OF JOURNALISM (GIJ)",
        "ghana institute of management and public administration": "GHANA INSTITUTE OF MANAGEMENT AND PUBLIC ADMINISTRATION",
        "gimpa main campus": "GHANA INSTITUTE OF MANAGEMENT AND PUBLIC ADMINISTRATION",
        "knutsford university": "KNUTSFORD UNIVERSITY",
        "knutsford university college": "KNUTSFORD UNIVERSITY",
        "radford university": "RADFORD UNIVERSITY",
        "radford university college": "RADFORD UNIVERSITY",
        "ug main campus": "UG MAIN CAMPUS",
        "university of ghana main campus": "UG MAIN CAMPUS",
        "kings university college": "KINGS UNIVERSITY COLLEGE",
        "university of management studies": "UNIVERSITY OF MANAGEMENT STUDIES",
        "west end university": "WEST END UNIVERSITY",
        "accra institute of technology ait": "ACCRA INSTITUTE OF TECHNOLOGY (AIT)",
        "ghana school of survey and mapping gssm": "GHANA SCHOOL OF SURVEY AND MAPPING (GSSM)",
        "zenith college": "ZENITH COLLEGE",
        "zenith university college": "ZENITH COLLEGE",
        "academic city university": "ACADEMIC CITY UNIVERSITY",
        "winsconsin university": "WINSCONSIN UNIVERSITY",
        "wisconsin international university college": "WINSCONSIN UNIVERSITY",
        "accra technical university": "ACCRA TECHNICAL UNIVERSITY",
        "atu": "ACCRA TECHNICAL UNIVERSITY",
        "african university college of communications aucc": "AFRICAN UNIVERSITY COLLEGE OF COMMUNICATIONS (AUCC)",
        "baldwin university": "BALDWIN UNIVERSITY",
        "national film and television institute nafti": "NATIONAL FILM AND TELEVISION INSTITUTE (NAFTI)",
        "ug accra city campus": "UG ACCRA CITY CAMPUS",
        "ug city campus": "UG CITY CAMPUS",
        "university of ghana distance education ugde": "UNIVERSITY OF GHANA DISTANCE EDUCATION (UGDE)",
        "laweh open university": "LAWEH OPEN UNIVERSITY",
        "regional maritime university": "REGIONAL MARITIME UNIVERSITY",
        "rmu": "REGIONAL MARITIME UNIVERSITY",
        "united montessori college umc": "UNITED MONTESSORI COLLEGE (UMC)",
        "accra business school": "ACCRA BUSINESS SCHOOL",
        "accra business sschool": "ACCRA BUSINESS SCHOOL",
        "entrance university": "Entrance University",
        "pantang nursing": "PANTANG NURSING",
        "pantang nmtc": "PANTANG NURSING",
        "university of professional studies accra upsa": "UNIVERSITY OF PROFESSIONAL STUDIES, ACCRA (UPSA)",
        "upsa": "UNIVERSITY OF PROFESSIONAL STUDIES, ACCRA (UPSA)",
        "central university": "CENTRAL UNIVERSITY",
        "central university mitiotso": "CENTRAL UNIVERSITY",
        "ghana telecom": "GHANA TELECOM",
        "datalink university": "DATALINK UNIVERSITY",
        "data link institute of business and technology": "DATALINK UNIVERSITY",
        "methodist university tema": "METHODIST UNIVERSITY, TEMA",
        "western school nursing": "WESTERN SCHOOL NURSING",
        "jayee university": "JAYEE UNIVERSITY",
        "regent university": "REGENT UNIVERSITY"
      };

      if (aliasMap[ecPs]) {
        const targetInstName = clean(aliasMap[ecPs]);
        const matched = regionalPool.find(v => v.cleanInst === targetInstName) ||
                        v2List.find(v => v.cleanInst === targetInstName);
        if (matched) return { match: matched, method: "alias_exact" };
      }

      // Check substring in regional pool
      for (const v of regionalPool) {
        if (v.cleanInst.length > 5 && ecPs.includes(v.cleanInst)) {
          return { match: v, method: "substring_in_ec" };
        }
        if (ecPs.length > 5 && v.cleanInst.includes(ecPs)) {
          return { match: v, method: "substring_in_v2" };
        }
      }

      return null;
    }

    // Run matching on all rows
    let matchedCount = 0;
    let unmatchedCount = 0;
    let skippedRegional = 0;
    let changes = [];
    let alreadyCorrect = [];

    for (const row of ecRows) {
      const res = findBestV2Match(row);
      if (!res) {
        unmatchedCount++;
        continue;
      }
      if (res.isRegionalCoordinator) {
        skippedRegional++;
        continue;
      }

      matchedCount++;
      const targetConst = res.match.canonical_constituency;
      const targetReg = res.match.v2_region;

      const curConstClean = clean(row.constituency);
      const tarConstClean = clean(targetConst);

      if (curConstClean === tarConstClean && clean(row.region) === clean(targetReg)) {
        alreadyCorrect.push(row.id);
      } else {
        changes.push({
          id: row.id,
          executive_name: row.executive_name,
          position: row.position,
          executive_level: row.executive_level,
          current_region: row.region,
          target_region: targetReg,
          current_constituency: row.constituency,
          target_constituency: targetConst,
          polling_station: row.polling_station,
          v2_institution: res.match.institution,
          method: res.method
        });
      }
    }

    console.log(`\n========================================`);
    console.log(`MATCHING RESULTS WITH ALIAS MAP:`);
    console.log(`========================================`);
    console.log(`Total EC Rows: ${ecRows.length}`);
    console.log(`Skipped Regional Coordinators: ${skippedRegional}`);
    console.log(`Successfully Matched Institutions: ${matchedCount} (${(matchedCount/(ecRows.length - skippedRegional)*100).toFixed(1)}%)`);
    console.log(`- Already Correct in ec-data: ${alreadyCorrect.length}`);
    console.log(`- NEED CONSTITUENCY UPDATE: ${changes.length}`);
    console.log(`- Unmatched rows: ${unmatchedCount}`);

    // Group changes by (polling_station, current_constituency, target_constituency)
    const groupedChanges = new Map();
    for (const c of changes) {
      const key = `${c.polling_station} [FROM: ${c.current_constituency} -> TO: ${c.target_constituency}]`;
      if (!groupedChanges.has(key)) {
        groupedChanges.set(key, {
          institution: c.polling_station,
          v2_institution: c.v2_institution,
          from_region: c.current_region,
          to_region: c.target_region,
          from_constituency: c.current_constituency,
          to_constituency: c.target_constituency,
          count: 0,
          ids: [],
          samples: []
        });
      }
      const g = groupedChanges.get(key);
      g.count++;
      g.ids.push(c.id);
      if (g.samples.length < 2) g.samples.push(c.executive_name);
    }

    console.log(`\nUnique Institution Constituency Updates: ${groupedChanges.size}`);
    fs.writeFileSync(
      "/Users/THINKPAD/Documents/parallel/scratch/tescon_institution_updates_verified.json",
      JSON.stringify(Array.from(groupedChanges.values()), null, 2)
    );

    // Print all grouped updates
    for (const g of Array.from(groupedChanges.values()).sort((a, b) => a.to_region.localeCompare(b.to_region))) {
      console.log(`[${g.count} rows] (${g.to_region}) "${g.institution}" => Current: "${g.from_constituency}" -> Correct: "${g.to_constituency}"`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sqlV2.end();
    await sqlEc.end();
  }
}

main();
