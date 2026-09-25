/**
 * Canonical TESCON Accredited Tertiary Institutions Directory & Normalizer
 *
 * Statutory Total: 251 Accredited Tertiary Institutions nationwide across 16 Regions
 * Statutory Delegate Composition:
 *   - National Chairperson & General Officers: 1 per campus (Presidents) = 250 voting delegates
 *   - Youth Organiser: 3 per campus (Presidents, WOCOMs, Nasara Coordinators) = 741 voting delegates
 *
 * Regional Statutory Allocation:
 *   Ahafo: 8
 *   Ashanti: 49
 *   Bono: 15
 *   Bono East: 8
 *   Central: 15
 *   Eastern: 24
 *   Greater Accra: 35
 *   North East: 4
 *   Northern: 20
 *   Oti: 3
 *   Savannah: 7
 *   Upper East: 13
 *   Upper West: 13
 *   Volta: 17
 *   Western: 14
 *   Western North: 6
 *   TOTAL: 251
 */

export const CANONICAL_TESCON_QUOTAS_BY_REGION: Record<string, number> = {
  Ahafo: 8,
  Ashanti: 49,
  Bono: 15,
  "Bono East": 8,
  Central: 15,
  Eastern: 24,
  "Greater Accra": 35,
  "North East": 4,
  Northern: 20,
  Oti: 3,
  Savannah: 7,
  "Upper East": 13,
  "Upper West": 13,
  Volta: 17,
  Western: 14,
  "Western North": 6,
};

export const TOTAL_CANONICAL_TESCON_INSTITUTIONS = 251;

/**
 * Normalizes any raw, user-entered polling station or institution string into
 * its official statutory canonical accredited tertiary institution name.
 */
export function normalizeTesconInstitution(
  rawStation?: string | null,
  region?: string | null,
  constituency?: string | null,
  recordId?: number | string | null
): string {
  if (!rawStation || typeof rawStation !== "string") {
    return "Accredited Tertiary Institution";
  }

  const s = rawStation
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "Accredited Tertiary Institution";

  const regRaw = (region || "").trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ");
  const regMap: Record<string, string> = {
    ahafo: "Ahafo",
    ashanti: "Ashanti",
    bono: "Bono",
    "bono east": "Bono East",
    central: "Central",
    eastern: "Eastern",
    "greater accra": "Greater Accra",
    "north east": "North East",
    northern: "Northern",
    oti: "Oti",
    savannah: "Savannah",
    "upper east": "Upper East",
    "upper west": "Upper West",
    volta: "Volta",
    western: "Western",
    "western north": "Western North",
    national: "National",
    "external branch": "External Branches",
    "external branches": "External Branches",
  };
  const reg = regMap[regRaw] || (region || "").trim();
  const con = (constituency || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const id = Number(recordId) || 0;

  // 1. AHAFO (8 institutions)
  if (
    reg === "Ahafo" ||
    s.includes("GOASO") ||
    s.includes("KWAPONG") ||
    s.includes("DADIESOABA") ||
    s.includes("NTOTROSO") ||
    s.includes("DUAYAW NKWANTA") ||
    s.includes("BECHEM")
  ) {
    if (s.includes("GOASO")) return "Goaso Nursing and Midwifery Training College";
    if (s.includes("TANOSO")) return "Tanoso Nursing and Midwifery Training College";
    if (s.includes("KWAPONG")) return "Kwapong Nursing and Midwifery Training College";
    if (s.includes("DADIESOABA")) return "Dadiesoaba Nursing Training College";
    if (s.includes("NTOTROSO") || s.includes("NTROSO")) return "Ntotroso College of Nursing and Midwifery";
    if (s.includes("YAMFO")) return "College of Health, Yamfo";
    if (s.includes("ST JOHN") || s.includes("DUAYAW NKWANTA") || s.includes("DUAYAW NKWANTIA")) {
      return "St. John of God College of Health, Duayaw Nkwanta";
    }
    if (s.includes("JOSEPH") || s.includes("BECHEM")) return "St. Joseph's College of Education, Bechem";
  }

  // 2. BONO EAST (8 institutions)
  if (
    reg === "Bono East" ||
    s.includes("ATEBUBU") ||
    s.includes("KROBO") ||
    s.includes("KINTAMPO") ||
    s.includes("MARTIN LUTHER") ||
    s.includes("MARTIN LURTHER") ||
    s.includes("YEJI")
  ) {
    if (s.includes("ATEBUBU")) return "Atebubu College of Education";
    if (s.includes("KROBO") && !s.includes("ODUMAS") && reg !== "Eastern") return "Krobo Nursing Training College";
    if (s.includes("KINTAMPO") || s.includes("COLLEGE OF HEALTH AND ALLIED SCIENCES")) {
      return "College of Health and Well-Being, Kintampo";
    }
    if (s.includes("MARTIN LURTHER") || s.includes("MARTIN LUTHER")) return "Martin Luther King Health Training College";
    if (s.includes("VALLEY VIEW")) return "Valley View University, Techiman Campus";
    if (s.includes("ANGLICAN")) return "Anglican University College of Technology, Nkoranza";
    if (s.includes("YEJI")) return "Yeji Nursing and Midwifery Training College";
    if (s.includes("HOLY FAMILY")) return "Holy Family Nursing and Midwifery Training College, Techiman";
  }

  // 3. NORTH EAST (4 institutions)
  if (
    reg === "North East" ||
    s.includes("NALERIGU") ||
    s.includes("GAMBAGA") ||
    s.includes("WALEWALE") ||
    s.includes("KUBORI")
  ) {
    if (s.includes("NALERIGU")) return "College of Health / NMTC, Nalerigu";
    if (s.includes("GAMBAGA")) return "Gambaga College of Education";
    if (s.includes("WALEWALE")) return "Nursing and Midwifery Training College, Walewale";
    if (s.includes("KUBORI")) return "Nursing and Midwifery Training College, Kubori";
  }

  // 4. OTI (3 institutions)
  if (reg === "Oti" || s.includes("JASIKAN") || s.includes("DAMBAI") || s.includes("KRACHI")) {
    if (s.includes("JASIKAN")) return "Jasikan College of Education";
    if (s.includes("DAMBAI") || s.includes("DACE")) return "Dambai College of Education";
    if (s.includes("KRACHI")) return "Krachi Nursing & Midwifery Training College";
  }

  // 5. SAVANNAH (7 institutions)
  if (
    reg === "Savannah" ||
    s.includes("BOLE") ||
    s.includes("SAVANNAH") ||
    s.includes("DAMONGO") ||
    s.includes("DAMOGO") ||
    s.includes("KPEMBE")
  ) {
    if (s.includes("BOLE")) return "Bole Nursing and Midwifery Training College";
    if (s.includes("WEST END") || s.includes("HOME SCIENCE")) return "West End University College, Bole";
    if (s.includes("SAVANNAH COLLEGE")) return "Savannah College of Education, Daboya";
    if (s.includes("DEVELOPMENT STUDIES") || s.includes("UDS")) {
      return "University for Development Studies (UDS), Daboya Campus";
    }
    if (s.includes("AGRICULTURAL") || s.includes("DAMOGO AGRICULTURAL")) return "Damongo Agricultural College";
    if (s.includes("DAMONGO NURSING")) return "Damongo Nursing Training College";
    if (s.includes("KPEMBE")) return "Kpembe Nursing and Midwifery Training College";
  }

  // 6. WESTERN NORTH (6 institutions)
  if (
    reg === "Western North" ||
    (s.includes("ENCHI") && !s.includes("WENCHI")) ||
    s.includes("SEFWI") ||
    s.includes("WIAWSO")
  ) {
    if (s.includes("ENCHI") && !s.includes("WENCHI")) return "Enchi College of Education";
    if (s.includes("BIBIANI")) return "Bibiani College of Health Sciences";
    if (s.includes("LAMPLIGHTER") || /\bBIA\b/.test(s)) return "Bia Lamplighter College of Education";
    if (s.includes("SEFWI ASAFO") || s.includes("ASAFO")) return "College of Health, Sefwi Asafo";
    if (s.includes("WIAWSO NURSING") || (s.includes("NURSING") && s.includes("WIAWSO"))) {
      return "Sefwi Wiawso Nursing and Midwifery Training College";
    }
    if (s.includes("WIAWSO COLLEGE OF EDUCATION") || s.includes("WIAWSO COLLEGE")) {
      return "Sefwi Wiawso College of Education";
    }
  }

  // 7. NORTHERN (20 institutions)
  if (
    reg === "Northern" ||
    s.includes("TAMALE") ||
    s.includes("PONG TAMALE") ||
    s.includes("BIMBILLA") ||
    s.includes("GUSHEGU") ||
    s.includes("YENDI") ||
    s.includes("NKANCHINA")
  ) {
    if (s.includes("ADVANCE GLOBAL")) return "Advance Global College, Tamale";
    if (s.includes("ANIMAL HEALTH")) return "Animal Health and Production College, Pong-Tamale";
    if (s.includes("BAGABAGA")) return "Bagabaga College of Education, Tamale";
    if (s.includes("NKANCHINA")) return "Community Health Nurses Training College, Nkanchina";
    if (s.includes("WAMALE")) return "Community Health Nurses Training College, Wamale";
    if (s.includes("TAMALE") && (s.includes("COMMUNITY HEALTH") || s.includes("COMMUNITY HELTH"))) {
      return "Community Health Nurses Training College, Tamale";
    }
    if (s.includes("EP COLLEGE") || s.includes("E P COLLEGE") || s.includes("BIMBILLA")) {
      return "E.P. College of Education, Bimbilla";
    }
    if (s.includes("SECRETARI")) return "Government Secretarial School, Tamale";
    if (s.includes("GUSHEGU")) return "Gushegu Nursing and Midwifery Training College";
    if (s.includes("NEW LIFE")) return "New Life College, Tamale";
    if (s.includes("HYGIEN")) return "School of Hygiene, Tamale";
    if (s.includes("VICENT") || s.includes("VINCENT")) return "St. Vincent College of Education, Yendi";
    if (s.includes("TAMALE COLLEGE OF EDUCATION")) return "Tamale College of Education";
    if (s.includes("TAMALE NMTC") || s.includes("TAMALE N M T C")) {
      return "Tamale Nursing and Midwifery Training College";
    }
    if (s.includes("TATU") || (s.includes("TECHNICAL") && s.includes("TAMALE"))) {
      return "Tamale Technical University (TaTU)";
    }
    if (s.includes("WORKERS")) return "Tamale Workers College";
    if (s.includes("NYANKPALA")) return "University for Development Studies (UDS - Nyankpala Campus)";
    if (s.includes("CITY CAMPUS")) return "University for Development Studies (UDS - City Campus)";
    if (
      s.includes("TAMALE CAMPUS") ||
      s.includes("UDS TAMALE") ||
      (s.includes("DEVELOPMENT STUDIES") && reg === "Northern")
    ) {
      return "University for Development Studies (UDS - Tamale Campus)";
    }
    if (s.includes("YENDI")) return "College of Health Sciences, Yendi";
  }

  // 8. UPPER WEST (13 institutions)
  if (
    reg === "Upper West" ||
    s.includes("JIRAPA") ||
    s.includes("LAWRA") ||
    s.includes("NANDOM") ||
    s.includes("TUMU") ||
    s.includes("UBIDS")
  ) {
    if (s.includes("JIRAPA") && (s.includes("COMMUNITY") || s.includes("CHNTC"))) {
      return "Jirapa Community Health Nursing Training College";
    }
    if (s.includes("JIRAPA") && s.includes("MIDWIFERY")) return "Jirapa Midwifery Training College";
    if (s.includes("JIRAPA") && (s.includes("RGN") || s.includes("NURSING TRAINING"))) {
      return "Jirapa Nursing Training College (RGN)";
    }
    if (s.includes("LAWRA")) return "Lawra Nursing Training College";
    if (s.includes("MCCOY") || s.includes("MACOY")) return "McCoy College of Education, Nandom";
    if (s.includes("NANDOM")) return "Nandom Midwifery / Nursing Training College";
    if (s.includes("TUMU") && (s.includes("COLLEGE OF EDU") || s.includes("EDUCATION"))) {
      return "Tumu College of Education";
    }
    if (s.includes("TUMU") && (s.includes("MIDWIFERY") || s.includes("NURSING"))) {
      return "Tumu Nursing and Midwifery Training College";
    }
    if (s.includes("ASAJ") || s.includes("ASWAJ")) return "Aswaj College of Education, Wa";
    if (s.includes("HILLA") || s.includes("HILLIA") || s.includes("DHLTU")) {
      return "Dr. Hilla Limann Technical University (DHLTU - Wa)";
    }
    if (s.includes("JAHAN") || s.includes("NJA")) return "N.J. Ahmadiyya College of Education (NJAHAN), Wa";
    if (s.includes("UBIDS") || s.includes("DOMBO")) {
      return "Simon Diedong Dombo University of Business and Integrated Development Studies (SDD-UBIDS)";
    }
    if (s.includes("WA NTC") || (s.includes("NURSING") && s.includes("WA"))) return "Wa Nursing Training College";
  }

  // 9. UPPER EAST (13 institutions)
  if (
    reg === "Upper East" ||
    s.includes("BOLGA") ||
    s.includes("BOLGATANGA") ||
    s.includes("BAWKU") ||
    s.includes("NAVRONGO") ||
    s.includes("PUSIGA") ||
    s.includes("ZUARUNGU")
  ) {
    if (
      s.includes("BAWKU") ||
      s.includes("PNTC") ||
      (s.includes("PRESBYTERIAN") && s.includes("NMTC") && reg === "Upper East")
    ) {
      return "Presbyterian Nursing and Midwifery Training College, Bawku";
    }
    if (s.includes("BOLGA TECHNICAL") || s.includes("BOLGATANGA TECHNICAL")) return "Bolgatanga Technical University";
    if (s.includes("MIDWIFERY") && (s.includes("BOLGATANGA") || s.includes("BOLGA"))) {
      return "Bolgatanga Midwifery Training College";
    }
    if (s.includes("NURSING") && (s.includes("BOLGATANGA") || s.includes("BOLGA"))) {
      return "Bolgatanga Nursing Training College";
    }
    if (
      s.includes("TEDAM") ||
      s.includes("CKT") ||
      (s.includes("TECHNOLOGY AND APPLIED SCIENCES") && !s.includes("BOLGA"))
    ) {
      return "C.K. Tedam University of Technology and Applied Sciences (CKT-UTAS)";
    }
    if (
      s.includes("COMMUNITY HEALTH") ||
      s.includes("COMMUNITY NURSING") ||
      s.includes("COMMUNITY HEALTH NURSING")
    ) {
      return "Community Health Nursing Training College, Navrongo";
    }
    if (s.includes("FAITH")) return "Faith Institute of Journalism, Bolgatanga";
    if (s.includes("GBEWAA")) return "Gbewaa College of Education, Pusiga";
    if (s.includes("MILLAR")) return "Millar Institute for Transdisciplinary and Development Studies";
    if (s.includes("COMMUNIYT DEVELOPMENT") || s.includes("COMMUNITY DEVELOPMENT")) {
      return "Navrongo Community Development Institute";
    }
    if (s.includes("REGENTROPFEN") || s.includes("REGENTROFEN")) {
      return "Regentropfen University College, Bongo";
    }
    if (s.includes("BOSCO")) return "St. John Bosco College of Education, Navrongo";
    if (s.includes("ZUARUNGU")) return "Zuarungu Nursing and Midwifery Training College";
  }

  // 10. VOLTA (17 institutions)
  if (
    reg === "Volta" ||
    s.includes("HO NURSING") ||
    s.includes("HOHOE") ||
    s.includes("AKATSI") ||
    s.includes("AMEDZOFE") ||
    s.includes("PEKI") ||
    s.includes("OHAWU") ||
    s.includes("KETA")
  ) {
    if (s.includes("AKATSI")) return "Akatsi College of Education";
    if (s.includes("EVANGELICAL PRESBYTARIAN") || s.includes("EVANGELICAL PRESBYTERIAN")) {
      return "Evangelical Presbyterian University College, Ho";
    }
    if (
      s.includes("GHANA TECHNOLOGY") ||
      s.includes("GHANA COMMUNICATION TECHNOLOGY") ||
      (s.includes("GCTU") && reg === "Volta")
    ) {
      return "Ghana Communication Technology University (GCTU), Ho";
    }
    if (s.includes("HO TECHNICAL") || s.includes("HTU")) return "Ho Technical University (HTU)";
    if (s.includes("HOLY SPIRIT") || s.includes("HOLY-SPIRIT")) return "Holy Spirit College of Education, Ho";
    if (s.includes("SCHOOL OF HYGIENE") && reg === "Volta") return "School of Hygiene, Ho";
    if (s.includes("SPORTS STADIUM") || s.includes("STADIUM")) return "Princefield University College, Ho";
    if (s.includes("HOHOE NURSING") || s.includes("HOHOE, NURSING")) return "Hohoe Nursing and Midwifery Training College";
    if (s.includes("AMEDZOFE") || (s.includes("EP COLLEGE") && reg === "Volta")) {
      return "E.P. College of Education, Amedzofe";
    }
    if (s.includes("ST. FRANCIS") || s.includes("ST FRANCIS") || s.includes("FRANCIS COLLEGE")) {
      return "St. Francis College of Education, Hohoe";
    }
    if (s.includes("ST TERESA") || s.includes("ST TERESA") || (s.includes("TERESA") && reg === "Volta")) {
      return "St. Teresa's College of Education, Hohoe";
    }
    if (s.includes("OHAWU")) return "Ohawu Agricultural College";
    if (s.includes("PEKI")) return "Peki College of Education";
    if (s.includes("KETA")) return "Keta Nursing and Midwifery Training College";
    if (s.includes("UHAS") || s.includes("ALLIED SCIENCE")) {
      if (s.includes("HOHOE") || con === "HOHOE") {
        return "University of Health and Allied Sciences (UHAS - Hohoe Campus)";
      }
      return "University of Health and Allied Sciences (UHAS - Ho Main Campus)";
    }
    if (s.includes("HO NURSING") || s.includes("HO NTC")) return "Ho Nursing Training College";
  }

  // 11. CENTRAL (15 institutions)
  if (
    reg === "Central" ||
    s.includes("WINNEBA") ||
    s.includes("CAPE COAST") ||
    s.includes("ASSINMAN") ||
    s.includes("FOSU") ||
    s.includes("KAAF") ||
    s.includes("ANKAFUL")
  ) {
    if (s.includes("AJUMAKO")) return "University of Education, Winneba (Ajumako Campus)";
    if (s.includes("COMMUNITY HEALTH") && (s.includes("WINNEBA") || con === "AGONA WEST" || con === "EFFUTU")) {
      return "College of Community Health Nursing, Winneba";
    }
    if (s.includes("WINNEBA") || s.includes("UEW")) {
      return "University of Education, Winneba (Main Campus)";
    }
    if (s.includes("ASSINMAN")) return "Assinman Nursing and Midwifery Training College";
    if (s.includes("BIMAKS") || s.includes("BIMAK")) return "Bimaks College of Health Sciences";
    if (s.includes("FOSU")) return "Fosu College of Education";
    if (s.includes("OLA")) return "OLA College of Education, Cape Coast";
    if (s.includes("CCNMTC") || (s.includes("NMTC") && s.includes("CAPE COAST"))) {
      return "Cape Coast Nursing and Midwifery Training College";
    }
    if (s.includes("CAPE COAST") && (s.includes("TECHNICAL") || s.includes("CCTU"))) {
      return "Cape Coast Technical University (CCTU)";
    }
    if ((s.includes("CAPE COAST") && s.includes("UNIVERSITY")) || s.includes("UCC")) {
      return "University of Cape Coast (UCC)";
    }
    if (s.includes("ANKAFUL") || s.includes("PSYCHIATRIC")) return "Ankaful Psychiatric Nursing Training College";
    if (s.includes("PEREZ")) return "Perez University College";
    if (s.includes("KAAF") || s.includes("KAFF")) return "KAAF University College";
    if (s.includes("PRASO")) return "Nursing and Midwifery Training College, Twifo Praso";
    if (id === 260128 || s.includes("DNMTC") || s.includes("DUNKWA") || con === "UPPER DENKYIRA EAST") {
      return "Dunkwa Nursing and Midwifery Training College";
    }
    if (s.includes("KOMENDA")) return "Komenda College of Education";
  }

  // 12. BONO (15 institutions)
  if (
    reg === "Bono" ||
    s.includes("SUNYANI") ||
    s.includes("BEREKUM") ||
    s.includes("SEIKWA") ||
    s.includes("DORMAA") ||
    s.includes("SAMPA") ||
    s.includes("DROBO") ||
    s.includes("WENCHI")
  ) {
    if (s.includes("SUNYANI TECHNICAL") || s.includes("STU")) return "Sunyani Technical University";
    if (s.includes("BEREKUM COLLEGE OF EDUCATION")) return "Berekum College of Education";
    if (s.includes("BEREKUM") && (s.includes("NURSING") || s.includes("MIDWIFERY"))) {
      return "Berekum Nursing and Midwifery Training College";
    }
    if (s.includes("SEIKWA")) return "Seikwa Nursing and Midwifery Training College";
    if (
      (s.includes("DORMAA") && (s.includes("PRESBYTERIAN") || s.includes("PRESBY"))) ||
      s.includes("PRESBYTERIAN NURSING TRAINING COLLEGE")
    ) {
      return "Presbyterian Nursing and Midwifery Training College, Dormaa";
    }
    if (s.includes("AMBROSE")) return "St. Ambrose College of Education, Dormaa";
    if (s.includes("SAMPA")) return "Sampa Nursing and Midwifery Training College";
    if (s.includes("DROBO") || s.includes("MARY")) return "St. Mary's Nursing and Midwifery Training College, Drobo";
    if (s.includes("CATHOLIC UNIVERSITY") || s.includes("FIAPRE")) return "Catholic University of Ghana, Fiapre";
    if (s.includes("SUNYANI") && (s.includes("NURSING") || s.includes("MIDWIFERY"))) {
      return "Sunyani Nursing and Midwifery Training College";
    }
    if (s.includes("UENR") || s.includes("ENERGY AND NATURAL")) {
      if (s.includes("DORMAA")) return "University of Energy and Natural Resources (UENR - Dormaa Campus)";
      return "University of Energy and Natural Resources (UENR - Sunyani Campus)";
    }
    if (s.includes("AL FARUQ") || s.includes("AL-FARUQ") || s.includes("AL- FARUQ")) {
      return "Al-Faruq College of Education, Wenchi";
    }
    if (s.includes("OFUMAN") || (s.includes("METHODIST") && s.includes("WENCHI"))) {
      return "Methodist University Ghana (Wenchi & Ofuman Campus)";
    }
    if (s.includes("WENCHI") && s.includes("AGRIC")) return "Wenchi Agricultural College";
    if (s.includes("VALLEY VIEW") || s.includes("KROBO")) return "Valley View University, Techiman Campus";
  }

  // 13. WESTERN (14 institutions)
  if (
    reg === "Western" ||
    s.includes("TAKORADI") ||
    s.includes("TARKWA") ||
    s.includes("UMAT") ||
    s.includes("ASANKRAGWA") ||
    s.includes("ASANTA") ||
    s.includes("ESIAMA")
  ) {
    if (s.includes("ASANKRAGWA") || s.includes("ASANKRANGWA")) {
      return "Asankrangwa Nursing and Midwifery Training College";
    }
    if (s.includes("ASANTA")) return "Asanta SDA Nursing and Midwifery Training College";
    if (s.includes("ESIAMA")) return "Esiama Nursing and Midwifery Training College";
    if (s.includes("GIMPA")) return "GIMPA (Takoradi Campus)";
    if (s.includes("GCTU") || s.includes("GHANA COMMUNICATION")) {
      return "Ghana Communication Technology University (GCTU - Takoradi)";
    }
    if (s.includes("HOLY CHILD")) return "Holy Child College of Education, Takoradi";
    if (s.includes("SEKONDI NMTC") || (s.includes("SEKONDI") && s.includes("NMTC"))) {
      return "Sekondi Nursing and Midwifery Training College";
    }
    if (s.includes("BUSINESS CAMPUS")) return "Takoradi Technical University (TTU - Business Campus)";
    if (s.includes("SEKONDI / ADAGYA") || s.includes("ADAGYA")) {
      return "Takoradi Technical University (TTU - Sekondi/Adagya Campus)";
    }
    if (s.includes("TAKORADI TECHNICAL") || s.includes("TTU")) {
      return "Takoradi Technical University (TTU - Main Campus)";
    }
    if (s.includes("KNUST")) return "Kwame Nkrumah University of Science and Technology (KNUST IDL - Tarkwa)";
    if (s.includes("TARKWA") && (s.includes("NURSING") || s.includes("MIDWIFERY") || s.includes("NMTC"))) {
      return "Tarkwa Nursing and Midwifery Training College";
    }
    if (s.includes("SRID")) return "University of Mines and Technology (UMaT - SRID Campus)";
    if (s.includes("UMAT") || s.includes("MINES AND TECHNOLOGY")) {
      return "University of Mines and Technology (UMaT - Tarkwa Main)";
    }
  }

  // 14. EASTERN (24 institutions)
  if (
    reg === "Eastern" ||
    s.includes("KOFORIDUA") ||
    s.includes("ABETIFI") ||
    s.includes("AKROPONG") ||
    s.includes("SOMANYA") ||
    s.includes("NKAWKAW") ||
    s.includes("ATIBIE")
  ) {
    if (
      s.includes("AKIM ODA") ||
      s.includes("AKIM-ODA") ||
      (s.includes("ODA") && (s.includes("COMMUNITY HEALTH") || s.includes("MIDWIFERY")))
    ) {
      return "Akim Oda Community Health Nursing and Midwifery College";
    }
    if (s.includes("AKIM STATE")) return "Akim State University College";
    if (s.includes("ALL NATIONS")) {
      if (s.includes("CITY")) return "All Nations University (City Campus)";
      return "All Nations University (Main Campus)";
    }
    if (s.includes("TARCISUIS") || s.includes("TARCISIUS") || s.includes("ORTHOTICS") || s.includes("PROPHETICS")) {
      return "Brother Tarcisius Prosthetics and Orthotics Training College";
    }
    if (s.includes("HOLY FAMILY")) return "Holy Family Nursing and Midwifery Training College, Nkawkaw";
    if (s.includes("JACKSON")) return "Jackson College of Education, Koforidua";
    if (s.includes("KOFORIDUA NMTC") || s.includes("KOFORIDUA NURSING")) {
      return "Koforidua Nursing and Midwifery Training College";
    }
    if (s.includes("KOFORIDUA TECHNICAL") || s.includes("KTU")) return "Koforidua Technical University (KTU)";
    if (s.includes("METHODIST COLLEGE OF EDUCATION") || (s.includes("METHODIST") && con === "AKIM ODA")) {
      return "Methodist College of Education, Akim Asene";
    }
    if (s.includes("MOUNT MARY")) return "Mount Mary College of Education, Somanya";
    if (s.includes("ATIBIE")) return "Nursing and Midwifery Training College, Atibie";
    if (s.includes("ODUMASI") || s.includes("ODUMASE") || s.includes("KROBO NURSING")) {
      return "Odumase Krobo Nursing and Midwifery Training College";
    }
    if (s.includes("ABETIFI") && s.includes("COLLEGE OF EDUCATION")) return "Presbyterian College of Education, Abetifi";
    if (s.includes("ABETIFI") && (s.includes("UNIVERSITY") || s.includes("CAMPUS"))) {
      return "Presbyterian University (Abetifi Campus)";
    }
    if (s.includes("AKROPONG") && s.includes("COLLEGE OF EDUCATION")) return "Presbyterian College of Education, Akropong";
    if (s.includes("AKROPONG") && (s.includes("UNIVERSITY") || s.includes("CAMPUS"))) {
      return "Presbyterian University (Akropong Campus)";
    }
    if (s.includes("KIBI") || s.includes("KYEBI")) return "Presbyterian College of Education, Kibi";
    if (
      s.includes("ABURI") ||
      s.includes("PRESBYTERIAN WOMEN") ||
      s.includes("WOMEN COLLEGE OF EDUCATION -ABURI")
    ) {
      return "Presbyterian Women's College of Education, Aburi";
    }
    if (s.includes("SAVIOUR")) return "Saviour Church Nursing and Midwifery Training College";
    if (s.includes("SDA COLLEGE OF EDUCATION") || (s.includes("SDA") && s.includes("ASOKORE"))) {
      return "S.D.A. College of Education, Asokore-Koforidua";
    }
    if (s.includes("AGRICULTURE AND ENVIRONMENTAL")) {
      return "University College of Agriculture and Environmental Studies, Bunso";
    }
    if (s.includes("AJUMAKO")) return "University of Education, Winneba (Ajumako Campus)";
    if (s.includes("ENVIRONMENT AND SUSTAINABLE DEVELOPMENT") || s.includes("UESD")) {
      return "University of Environment and Sustainable Development (UESD)";
    }
    if (s.includes("ASENE") || s.includes("AKROSO")) return "Methodist College of Education, Akim Asene";
    if (s.includes("GHANA") && s.includes("MAIN CAMPUS")) return "University of Ghana (Main Campus - Legon)";
  }

  // 15. GREATER ACCRA (35 institutions)
  if (
    reg === "Greater Accra" ||
    s.includes("ACCRA") ||
    s.includes("KORLE") ||
    s.includes("LEGON") ||
    s.includes("UPSA") ||
    s.includes("PANTANG") ||
    s.includes("TEMA")
  ) {
    if (s.includes("ADA COLLEGE") || s.includes("ADA COLLAGE")) return "Ada College of Education";
    if (s.includes("ACCRA BUSINESS")) return "Accra Business School";
    if (s.includes("ISLAMIC") || (s.includes("TERESA") && con === "ADENTAN")) {
      return "Islamic University College, Ghana";
    }
    if (s.includes("ACCRA COLLEGE OF EDUCATION") || s.includes("ACCE")) return "Accra College of Education";
    if (s.includes("ACCRA TECHNICAL") || s.includes("ATU") || s.includes("POLYTECHNIC")) {
      return "Accra Technical University (ATU)";
    }
    if (
      s.includes("AUCC") ||
      (s.includes("COMMUNICATION") && !s.includes("MEDIA") && !s.includes("GCTU") && !s.includes("TELECOM"))
    ) {
      return "African University College of Communications (AUCC)";
    }
    if (s.includes("BLUECREST") || s.includes("BLUE CREST")) return "BlueCrest College";
    if (s.includes("CENTRAL UNIVERSITY")) return "Central University, Miotso";
    if (s.includes("DATA LINK") || s.includes("DATALINK")) return "Data Link Institute of Business and Technology";
    if (s.includes("ENTRANCE")) return "Entrance University College of Health Sciences";
    if (s.includes("LANGUAGES") || s.includes("LANGUAGE")) return "Ghana Institute of Languages (GIL)";
    if (s.includes("GIMPA")) return "Ghana Institute of Management and Public Administration (GIMPA)";
    if (s.includes("TELECOM") || s.includes("GCTU")) return "Ghana Communication Technology University (GCTU)";
    if (s.includes("HERITAGE")) return "Heritage Christian University College";
    if (s.includes("KINGS") || s.includes("KING S")) return "Kings University College";
    if (s.includes("KNUTSFORD")) return "Knutsford University College";
    if (s.includes("ALLIED HEALTH")) return "School of Allied Health Sciences (Korle Bu)";
    if (s.includes("KORLE BU") && (s.includes("NMTC") || s.includes("NURSING") || s.includes("MIDWIFERY"))) {
      return "Korle-Bu Nursing and Midwifery Training College";
    }
    if (s.includes("METHODIST")) {
      return "Methodist University Ghana";
    }
    if (s.includes("MOUNTCREST") || s.includes("MOUNT CREST")) return "MountCrest University College";
    if (s.includes("NARH BITA") || s.includes("NARHBITA")) return "Narh-Bita College";
    if (s.includes("PANTANG")) return "Pantang Nursing and Midwifery Training College";
    if (s.includes("PENTECOST")) return "Pentecost University";
    if (s.includes("RADFORD")) return "Radford University College";
    if (s.includes("REGENT")) return "Regent University College of Science and Technology";
    if (s.includes("MARITIME")) return "Regional Maritime University";
    if (s.includes("TERESA") && reg === "Greater Accra") return "Islamic University College, Ghana";
    if (s.includes("UNIMAC") || s.includes("MEDIA") || s.includes("GIJ") || s.includes("JOURNALISM")) {
      return "University of Media, Arts and Communication (UniMAC)";
    }
    if (s.includes("UPSA") || s.includes("PROFESSIONAL")) return "University of Professional Studies, Accra (UPSA)";
    if (s.includes("VALLEY VIEW")) return "Valley View University (Oyibi Campus)";
    if (s.includes("WISCONSIN") || s.includes("WINSCONSIN")) return "Wisconsin International University College";
    if (s.includes("ZENITH")) return "Zenith University College";
    if (s.includes("HYGIENE")) return "School of Hygiene, Korle-Bu";
    if (s.includes("GHANA") || s.includes("UG") || s.includes("LEGON")) {
      if (s.includes("CITY")) return "University of Ghana (Accra City Campus)";
      if (s.includes("DISTANCE")) return "University of Ghana (Distance Education)";
      if (s.includes("KORLE") || con === "ABLEKUMA SOUTH") return "University of Ghana (Korle-Bu Campus)";
      return "University of Ghana (Main Campus - Legon)";
    }
  }

  // 16. ASHANTI (49 institutions)
  if (
    reg === "Ashanti" ||
    s.includes("KUMASI") ||
    s.includes("KNUST") ||
    s.includes("MAMPONG") ||
    s.includes("AAMUSTED") ||
    s.includes("AGOGO") ||
    s.includes("OFFINSO") ||
    s.includes("KWADASO")
  ) {
    if (id === 259965) return "Offinso College of Education";
    if (id === 260133) return "Agogo Presbyterian Women's College of Education";
    if (s.includes("MAMTECH") || s.includes("MAMPONG TECHNICAL")) return "AAMUSTED (Mampong Campus)";
    if (s.includes("AAMUSTED") || s.includes("SKILLS TRAINING")) {
      if (s.includes("MAMPONG")) return "AAMUSTED (Mampong Campus)";
      return "AAMUSTED (Kumasi Campus)";
    }
    if (s.includes("AFIA KOBI") || (s.includes("ROYAL NURSING") && !s.includes("ROYAL ANN"))) {
      return "Afia Kobi Ampem Girls' / Royal Nursing College";
    }
    if (s.includes("AGOGO NMTC") || (s.includes("PRESBYTERIAN NURSING") && s.includes("AGOGO"))) {
      return "Agogo Presbyterian Nursing and Midwifery Training College";
    }
    if (s.includes("AGOGO") && (s.includes("WOMEN") || s.includes("COLLEGE OF EDUCATION"))) {
      return "Agogo Presbyterian Women's College of Education";
    }
    if (s.includes("AKROKERRI")) return "Akrokerri College of Education";
    if (s.includes("CENTRAL UNIVERSITY") || s.includes("CENTRAL LAW")) return "Central University (Kumasi Campus)";
    if (s.includes("CHRIST APOSTOLIC")) return "Christ Apostolic University College";
    if (s.includes("CHRISTIAN SERVICE")) return "Christian Service University";
    if (s.includes("INTEGRATED HEALTHCARE")) return "College of Integrated Healthcare, Obuasi";
    if (s.includes("EJURA")) return "Ejura Agricultural College";
    if (s.includes("FOMENA")) return "Fomena Nursing and Midwifery Training College";
    if (s.includes("GARDEN CITY")) return "Garden City University College";
    if (s.includes("GHANA BAPTIST") || s.includes("BAPTIST UNIVERSITY")) return "Ghana Baptist University College";
    if (s.includes("GIMPA")) return "GIMPA (Kumasi Campus)";
    if (
      s.includes("INSTITUTE OF BUSINESS MANAGEMENT") ||
      s.includes("BUSSINESS MANAGEMENT AND JOURNALISM") ||
      s.includes("IBM J") ||
      s.includes("IBMJ")
    ) {
      return "Institute of Business Management and Journalism (IBM&J)";
    }
    if (s.includes("GCTU") || (s.includes("COMMUNICATION TECHNOLOGY") && reg === "Ashanti")) {
      return "Ghana Communication Technology University (GCTU - Kumasi)";
    }
    if (s.includes("KESSBEN")) return "Kessben University College";
    if (s.includes("KNUST")) {
      if (s.includes("OBUASI")) return "KNUST (Obuasi Campus)";
      return "Kwame Nkrumah University of Science and Technology (KNUST - Main Campus)";
    }
    if (s.includes("KOKOFU")) return "Kokofu Nursing and Midwifery Training College";
    if (s.includes("KUMASI NMTC") || ((s.includes("NMTC") || s.includes("NURSING")) && s.includes("KUMASI"))) {
      return "Kumasi Nursing and Midwifery Training College";
    }
    if (s.includes("KUMASI TECHNICAL") || s.includes("KSTU")) return "Kumasi Technical University (KsTU)";
    if (s.includes("KWADASO") && (s.includes("AGRICULTURAL") || s.includes("AGRIC"))) return "Kwadaso Agricultural College";
    if (
      s.includes("KWADASO") &&
      (s.includes("NURSING") || s.includes("MIDWIFERY") || s.includes("S D A") || s.includes("SDA"))
    ) {
      return "Kwadaso S.D.A. Nursing and Midwifery Training College";
    }
    if (s.includes("MAMPONG NMTC") || (s.includes("NURSING") && s.includes("MAMPONG"))) {
      return "Mampong Nursing and Midwifery Training College";
    }
    if (s.includes("MULTIMEDIA") || s.includes("MIG")) return "Multimedia Institute of Ghana (MIG)";
    if (s.includes("NEUMAN") || s.includes("NEUMANN")) return "Neumann College of Nursing";
    if (s.includes("OTEC")) return "Otec School of Journalism and Communication Studies";
    if (s.includes("PREMIER NURSING") || s.includes("PREMIER NURSES") || s.includes("PREMIER")) {
      return "Premier Nursing Training College";
    }
    if (s.includes("PRESBYTERIAN UNIVERSITY")) {
      if (s.includes("ASANTE AKIM SOUTH") || con === "ASANTE AKIM SOUTH") {
        return "Presbyterian University (Asante Akyem Campus / South)";
      }
      return "Presbyterian University (Agogo Campus / Asante Akim North)";
    }
    if (s.includes("ROYAL ANN")) return "Royal Ann College of Health";
    if (s.includes("RURAL DEVELOPMENT")) return "Rural Development College, Kwaso";
    if (
      s.includes("S D A COLLEGE OF EDUCATION") ||
      s.includes("SDA COLLEGE OF EDUCATION AGONA") ||
      s.includes("AGONA")
    ) {
      return "S.D.A. College of Education, Agona-Ashanti";
    }
    if (s.includes("SAMLEE")) return "Samlee Nursing and Midwifery Training College";
    if (s.includes("DISPENSING OPTICS") || s.includes("OYOKO")) return "School of Dispensing Optics, Oyoko";
    if (s.includes("LANGUAGES") && reg === "Ashanti") return "School of Languages, Kumasi";
    if (s.includes("ASAMANG")) return "S.D.A. Nursing and Midwifery Training College, Asamang";
    if (s.includes("ST LOUIS") || s.includes("ST. LOUIS")) return "St. Louis College of Education";
    if (s.includes("ST MONICA") || s.includes("ST. MONICA")) return "St. Monica's College of Education, Mampong";
    if (s.includes("OFFINSO COLLEGE OF EDUCATION")) return "Offinso College of Education";
    if (s.includes("ST PATRICK") || s.includes("ST. PATRICK")) {
      return "St. Patrick's Nursing and Midwifery Training College, Offinso";
    }
    if (
      s.includes("ST MICHAEL") ||
      s.includes("ST. MICHAEL") ||
      s.includes("ST MICHEAL") ||
      s.includes("PRAMSO")
    ) {
      return "St. Michael's Nursing and Midwifery Training College, Pramso";
    }
    if (s.includes("TEPA")) return "Tepa Nursing Training College";
    if (
      s.includes("UNIVERSITY OF GHANA") &&
      (s.includes("KSI") || s.includes("KUMASI") || reg === "Ashanti")
    ) {
      return "University of Ghana (Kumasi City Campus)";
    }
    if ((s.includes("VALLEY VIEW") || s.includes("VALLY VIEW")) && reg === "Ashanti") return "Valley View University (Kumasi Campus)";
    if (s.includes("WESLEY")) return "Wesley College of Education";
    if (s.includes("WISCONSIN") && reg === "Ashanti") {
      return "Wisconsin International University College (Kumasi Campus)";
    }
    if (s.includes("WITHROW")) return "Withrow University College";
  }

  return rawStation.trim();
}

/**
 * Returns the statutory expected accredited tertiary institutions count for a region,
 * or nationwide (251) if region is 'all' or empty.
 */
export function getCanonicalTesconQuota(regionName?: string): number {
  if (!regionName || regionName.toLowerCase() === "all") {
    return TOTAL_CANONICAL_TESCON_INSTITUTIONS;
  }
  return CANONICAL_TESCON_QUOTAS_BY_REGION[regionName] || 0;
}

export * from "./tescon-institution-data.ts";

