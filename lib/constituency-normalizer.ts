/**
 * Centralized Constituency Normalizer for Ghana 275 Electoral Commission Standard
 * 
 * Harmonizes constituency names across the platform:
 * - Standardizes uppercase
 * - Collapses consecutive whitespace
 * - Standardizes slashes with NO surrounding whitespace (e.g. ANYAA/SOWUTUOM, DABOYA/MANKARIGU)
 * - Standardizes official hyphens (e.g. WEIJA-GBAWE, BIBIANI-ANHWIASO-BEKWAI)
 * - Maps all historical, administrative, and spelling variants to canonical 275 constituencies
 */

export const CANONICAL_CONSTITUENCIES: readonly string[] = [
  "ABIREM",
  "ABLEKUMA CENTRAL",
  "ABLEKUMA NORTH",
  "ABLEKUMA SOUTH",
  "ABLEKUMA WEST",
  "ABUAKWA NORTH",
  "ABUAKWA SOUTH",
  "ABURA ASEBU KWAMANKESE",
  "ACHIASE",
  "ADA",
  "ADAKLU",
  "ADANSI ASOKWA",
  "ADENTAN",
  "AFADJATO SOUTH",
  "AFIGYA KWABRE NORTH",
  "AFIGYA KWABRE SOUTH",
  "AFIGYA SEYERE EAST",
  "AFRAM PLAINS SOUTH",
  "AGONA EAST",
  "AGONA WEST",
  "AGOTIME ZIOPE",
  "AHAFO ANO NORTH",
  "AHAFO ANO SOUTH WEST",
  "AHAFO ANO SOUTH-EAST",
  "AHANTA WEST",
  "AJUMAKO ENYAN ESIAM",
  "AKAN",
  "AKATSI NORTH",
  "AKATSI SOUTH",
  "AKIM ODA",
  "AKIM SWEDRU",
  "AKROFUOM",
  "AKROPONG",
  "AKUAPEM SOUTH",
  "AKWATIA",
  "AMASAMAN",
  "AMENFI CENTRAL",
  "AMENFI EAST",
  "AMENFI WEST",
  "ANLO",
  "ANYAA/SOWUTUOM",
  "AOWIN",
  "ASANTE AKIM CENTRAL",
  "ASANTE AKIM NORTH",
  "ASANTE AKIM SOUTH",
  "ASAWASE",
  "ASENE/AKROSO/MANSO",
  "ASHAIMAN",
  "ASIKUMA/ODOBEN/BRAKWA",
  "ASOKWA",
  "ASSIN CENTRAL",
  "ASSIN NORTH",
  "ASSIN SOUTH",
  "ASUNAFO NORTH",
  "ASUNAFO SOUTH",
  "ASUOGYAMAN",
  "ASUTIFI NORTH",
  "ASUTIFI SOUTH",
  "ATEBUBU/AMANTIN",
  "ATIWA EAST",
  "ATIWA WEST",
  "ATWIMA KWANWOMA",
  "ATWIMA MPONUA",
  "ATWIMA NWABIAGYA NORTH",
  "ATWIMA NWABIAGYA SOUTH",
  "AWUTU SENYA EAST",
  "AWUTU SENYA WEST",
  "AYAWASO CENTRAL",
  "AYAWASO EAST",
  "AYAWASO NORTH",
  "AYAWASO WEST WUOGON",
  "AYENSUANO",
  "BANDA",
  "BANTAMA",
  "BAWKU CENTRAL",
  "BEKWAI",
  "BEREKUM EAST",
  "BEREKUM WEST",
  "BIA EAST",
  "BIA WEST",
  "BIAKOYE",
  "BIBIANI-ANHWIASO-BEKWAI",
  "BIMBILLA",
  "BINDURI",
  "BODI",
  "BOLE-BAMBOI",
  "BOLGA EAST",
  "BOLGATANGA CENTRAL",
  "BONGO",
  "BORTIANOR-NGLESHIE AMANFRO",
  "BOSOME FREHO",
  "BOSOMTWE",
  "BUEM",
  "BUILSA NORTH",
  "BUILSA SOUTH",
  "BUNKPURUGU",
  "CAPE COAST NORTH",
  "CAPE COAST SOUTH",
  "CENTRAL TONGU",
  "CHEREPONI",
  "CHIANA-PAGA",
  "DABOYA/MANKARIGU",
  "DADEKOTOPON",
  "DAFFIAMA/BUSSIE/ISSA",
  "DAMONGO",
  "DOME/KWABENYA",
  "DOMEABRA-OBOM",
  "DORMAA CENTRAL",
  "DORMAA EAST",
  "DORMAA WEST",
  "EFFIA",
  "EFFIDUASE/ASOKORE",
  "EFFUTU",
  "EJISU",
  "EJURA SEKYEDUMASE",
  "EKUMFI",
  "ELLEMBELE",
  "ESSIKADU-KETAN",
  "EVALUE AJOMORO GWIRA",
  "FANTEAKWA NORTH",
  "FANTEAKWA SOUTH",
  "FOMENA",
  "GARU",
  "GOMOA CENTRAL",
  "GOMOA EAST",
  "GOMOA WEST",
  "GUAN",
  "GUSHEGU",
  "HEMANG LOWER DENKYIRA",
  "HO CENTRAL",
  "HO WEST",
  "HOHOE",
  "JAMAN NORTH",
  "JAMAN SOUTH",
  "JIRAPA",
  "JOMORO",
  "JUABEN",
  "JUABOSO",
  "KADE",
  "KARAGA",
  "KETA",
  "KETU NORTH",
  "KETU SOUTH",
  "KINTAMPO NORTH",
  "KINTAMPO SOUTH",
  "KOMENDA EDINA EGUAFO ABREM",
  "KORLE KLOTTEY",
  "KPANDAI",
  "KPANDO",
  "KPONE-KATAMANSO",
  "KRACHI EAST",
  "KRACHI NCHUMURU",
  "KRACHI WEST",
  "KROWOR",
  "KUMAWU",
  "KUMBUNGU",
  "KWABRE EAST",
  "KWADASO MUNICIPAL",
  "KWAHU AFRAM PLAINS NORTH",
  "KWAHU EAST",
  "KWESIMINTSIM",
  "LAMBUSSIE",
  "LAWRA",
  "LEDZOKUKU",
  "LOWER MANYA KROBO",
  "LOWER WEST AKIM",
  "MADINA",
  "MAMPONG",
  "MANHYIA NORTH",
  "MANHYIA SOUTH",
  "MANSO ADUBIA",
  "MANSO NKWANTA",
  "MFANTSEMAN",
  "MION",
  "MPOHOR",
  "MPRAESO",
  "NABDAM",
  "NADOWLI/KALEO",
  "NALERIGU/GAMBAGA",
  "NANDOM",
  "NANTON",
  "NAVRONGO CENTRAL",
  "NEW EDUBIASE",
  "NEW JUABEN NORTH",
  "NEW JUABEN SOUTH",
  "NHYIAESO",
  "NINGO PRAMPRAM",
  "NKAWKAW",
  "NKORANZA NORTH",
  "NKORANZA SOUTH",
  "NKWANTA NORTH",
  "NKWANTA SOUTH",
  "NORTH DAYI",
  "NORTH TONGU",
  "NSAWAM/ADOAGYIRI",
  "NSUTA/KWAMANG/BEPOSO",
  "OBUASI EAST",
  "OBUASI WEST",
  "ODODODIODIOO",
  "ODOTOBRI",
  "OFFINSO NORTH",
  "OFFINSO SOUTH",
  "OFOASE/AYIREBI",
  "OFORIKROM",
  "OKAIKWEI CENTRAL",
  "OKAIKWEI NORTH",
  "OKAIKWEI SOUTH",
  "OKERE",
  "OLD TAFO",
  "PRESTEA HUNI-VALLEY",
  "PRU EAST",
  "PRU WEST",
  "PUSIGA",
  "SABOBA",
  "SAGNARIGU",
  "SALAGA NORTH",
  "SALAGA SOUTH",
  "SAVELUGU",
  "SAWLA-TUNA-KALBA",
  "SEFWI AKONTOMBRA",
  "SEFWI WIAWSO",
  "SEGE",
  "SEKONDI",
  "SEKYERE AFRAM PLAINS",
  "SENE EAST",
  "SENE WEST",
  "SHAI-OSUDOKU",
  "SHAMA",
  "SISSALA EAST",
  "SISSALA WEST",
  "SOUTH DAYI",
  "SOUTH TONGU",
  "SUAMAN",
  "SUAME",
  "SUBIN",
  "SUHUM",
  "SUNYANI EAST",
  "SUNYANI WEST",
  "TAIN",
  "TAKORADI",
  "TALENSI",
  "TAMALE CENTRAL",
  "TAMALE NORTH",
  "TAMALE SOUTH",
  "TANO NORTH",
  "TANO SOUTH",
  "TARKWA NSUAEM",
  "TATALE/SANGULI",
  "TECHIMAN NORTH",
  "TECHIMAN SOUTH",
  "TEMA CENTRAL",
  "TEMA EAST",
  "TEMA WEST",
  "TEMPANE",
  "TOLON",
  "TROBU",
  "TWIFO ATTI MORKWA",
  "UPPER DENKYIRA EAST",
  "UPPER DENKYIRA WEST",
  "UPPER MANYA KROBO",
  "UPPER WEST AKIM",
  "WA CENTRAL",
  "WA EAST",
  "WA WEST",
  "WALEWALE",
  "WASSA EAST",
  "WEIJA-GBAWE",
  "WENCHI",
  "WULESNSI",
  "YAGABA/ KUBORI",
  "YAPEI/KUSAWGU",
  "YENDI",
  "YILO KROBO",
  "YUNYOO",
  "ZABZUGU",
  "ZEBILLA",
];


// Official External Branch Countries (Diaspora Constituencies)
export const EXTERNAL_BRANCH_COUNTRIES: readonly string[] = [
  "Senegal",
  "Russia",
  "United Kingdom",
  "Middle East",
  "Togo",
  "Nigeria",
  "South Africa",
  "United States of America",
  "Austria",
  "Spain",
  "Sweden",
  "Australia",
  "Hong Kong",
  "Qatar",
  "Norway",
  "South Korea",
  "Ireland",
  "Italy",
  "Ivory Coast",
  "Japan",
  "Netherland",
  "China",
  "Czech",
  "Denmark",
  "Equitorial Guinea",
  "Germany",
  "France",
  "Finland",
  "Belgium",
  "Canada",
];

const EXTERNAL_BRANCH_LOOKUP = new Map<string, string>();
for (const country of EXTERNAL_BRANCH_COUNTRIES) {
  EXTERNAL_BRANCH_LOOKUP.set(country.toUpperCase(), country);
  EXTERNAL_BRANCH_LOOKUP.set(country.toUpperCase().replace(/[^A-Z0-9]/g, ""), country);
}

// Aliases and spelling variants for External Branch countries
EXTERNAL_BRANCH_LOOKUP.set("UK", "United Kingdom");
EXTERNAL_BRANCH_LOOKUP.set("GREAT BRITAIN", "United Kingdom");
EXTERNAL_BRANCH_LOOKUP.set("USA", "United States of America");
EXTERNAL_BRANCH_LOOKUP.set("UNITED STATES", "United States of America");
EXTERNAL_BRANCH_LOOKUP.set("U.S.A.", "United States of America");
EXTERNAL_BRANCH_LOOKUP.set("AMERICA", "United States of America");
EXTERNAL_BRANCH_LOOKUP.set("NETHERLANDS", "Netherland");
EXTERNAL_BRANCH_LOOKUP.set("THE NETHERLANDS", "Netherland");
EXTERNAL_BRANCH_LOOKUP.set("HOLLAND", "Netherland");
EXTERNAL_BRANCH_LOOKUP.set("CZECH REPUBLIC", "Czech");
EXTERNAL_BRANCH_LOOKUP.set("EQUATORIAL GUINEA", "Equitorial Guinea");
EXTERNAL_BRANCH_LOOKUP.set("COTE D'IVOIRE", "Ivory Coast");
EXTERNAL_BRANCH_LOOKUP.set("CÔTE D'IVOIRE", "Ivory Coast");
EXTERNAL_BRANCH_LOOKUP.set("IVORY COAST (CÔTE D'IVOIRE)", "Ivory Coast");
EXTERNAL_BRANCH_LOOKUP.set("IVORY COAST (COTE D'IVOIRE)", "Ivory Coast");
EXTERNAL_BRANCH_LOOKUP.set("KOREA", "South Korea");
EXTERNAL_BRANCH_LOOKUP.set("REPUBLIC OF KOREA", "South Korea");

const CANONICAL_SET = new Set([...CANONICAL_CONSTITUENCIES, ...EXTERNAL_BRANCH_COUNTRIES]);

// Lookup table stripping all punctuation and spaces for fuzzy/flexible matching
const ALPHANUMERIC_LOOKUP = new Map<string, string>();
for (const c of CANONICAL_CONSTITUENCIES) {
  ALPHANUMERIC_LOOKUP.set(c.replace(/[^A-Z0-9]/g, ""), c);
}

// Explicit aliases for administrative seats, historical names, and spelling variants
const EXPLICIT_ALIASES: Record<string, string> = {
  "AFRAM PLAINS NORTH": "KWAHU AFRAM PLAINS NORTH",
  "AKIM SWEDRU": "BIRIM SOUTH",
  "ABETIFI": "KWAHU EAST",
  "KWADASO MUNICIPAL": "KWADASO",
  "ADENTA": "ADENTAN",
  "AFIGYA SEKYERE EAST": "AFIGYA SEYERE EAST",
  "AJUMAKO ENYAN ESSIAM": "AJUMAKO ENYAN ESIAM",
  "ASENE AKROSO MANSO": "ASENE/MANSO/AKROSO",
  "BOLGATANGA EAST": "BOLGA EAST",
  "ELLEMBELLE": "ELLEMBELE",
  "ESSIKADO KETAN": "ESSIKADU-KETAN",
  "KOMENDA EDINA EGUAFO ABIREM": "KOMENDA EDINA EGUAFO ABREM",
  // Common double spaces / separator variants
  "OKAIKWEI  CENTRAL": "OKAIKWEI CENTRAL",
  "OKAIKWEI  NORTH": "OKAIKWEI NORTH",
  "KRACHI  NCHUMURU": "KRACHI NCHUMURU",
  "DABOYA / MANKARIGU": "DABOYA/MANKARIGU",
  "DABOYA-MANKARIGU": "DABOYA/MANKARIGU",
  "NALERIGU / GAMBAGA": "NALERIGU/GAMBAGA",
  "NALERIGU GAMBAGA": "NALERIGU/GAMBAGA",
  "YAGABA/ KUBORI": "YAGABA/KUBORI",
  "YAGABA KUBORI": "YAGABA/KUBORI",
  "ATEBUBU-AMANTIN": "ATEBUBU/AMANTIN",
  "NADOWLI-KALEO": "NADOWLI/KALEO",
  "NSAWAM ADOAGYIRI": "NSAWAM/ADOAGYIRI",
  "ANYAA SOWUTUOM": "ANYAA/SOWUTUOM",
  "WEIJA GBAWE": "WEIJA-GBAWE",
  "KPONE KATAMANSO": "KPONE-KATAMANSO",
  "BIBIANI ANHWIASO BEKWAI": "BIBIANI-ANHWIASO-BEKWAI",
  "BORTIANOR NGLESHIE AMANFRO": "BORTIANOR-NGLESHIE AMANFRO",
  "BOLE BAMBOI": "BOLE-BAMBOI"
};

/**
 * Normalizes any raw constituency name to its canonical Ghana EC standard
 * or diaspora External Branch country.
 */
export function normalizeConstituency(raw: string | null | undefined): string {
  if (!raw) return "";

  const trimmed = raw.trim().replace(/\s+/g, " ");

  // 1. Check External Branch country matches & aliases
  const upper = trimmed.toUpperCase();
  if (EXTERNAL_BRANCH_LOOKUP.has(upper)) {
    return EXTERNAL_BRANCH_LOOKUP.get(upper)!;
  }
  const strippedExt = upper.replace(/[^A-Z0-9]/g, "");
  if (EXTERNAL_BRANCH_LOOKUP.has(strippedExt)) {
    return EXTERNAL_BRANCH_LOOKUP.get(strippedExt)!;
  }

  // 2. Clean whitespace and uppercase for Ghana constituencies
  let cleaned = upper;

  // 3. Check explicit alias dictionary
  if (EXPLICIT_ALIASES[cleaned]) {
    return EXPLICIT_ALIASES[cleaned];
  }

  // 4. Normalize slashes and hyphens spacing
  cleaned = cleaned.replace(/\s*\/\s*/g, "/").replace(/\s*-\s*/g, "-");

  if (EXPLICIT_ALIASES[cleaned]) {
    return EXPLICIT_ALIASES[cleaned];
  }

  // 5. Check if exact canonical match
  if (CANONICAL_SET.has(cleaned)) {
    return cleaned;
  }

  // 6. Check alphanumeric stripped match
  const stripped = cleaned.replace(/[^A-Z0-9]/g, "");
  if (ALPHANUMERIC_LOOKUP.has(stripped)) {
    return ALPHANUMERIC_LOOKUP.get(stripped)!;
  }

  return cleaned;
}

export function isValidConstituency(name: string): boolean {
  const norm = normalizeConstituency(name);
  return CANONICAL_SET.has(norm) || EXTERNAL_BRANCH_LOOKUP.has(norm.toUpperCase());
}

export const OFFICIAL_CONSTITUENCIES_BY_REGION: Record<string, string[]> = {
  "Ahafo": [
    "ASUNAFO NORTH",
    "ASUNAFO SOUTH",
    "ASUTIFI NORTH",
    "ASUTIFI SOUTH",
    "TANO NORTH",
    "TANO SOUTH"
  ],
  "Ashanti": [
    "ADANSI ASOKWA",
    "AFIGYA KWABRE NORTH",
    "AFIGYA KWABRE SOUTH",
    "AFIGYA SEYERE EAST",
    "AHAFO ANO NORTH",
    "AHAFO ANO SOUTH WEST",
    "AHAFO ANO SOUTH-EAST",
    "AKROFUOM",
    "ASANTE AKIM CENTRAL",
    "ASANTE AKIM NORTH",
    "ASANTE AKIM SOUTH",
    "ASAWASE",
    "ASOKWA",
    "ATWIMA KWANWOMA",
    "ATWIMA MPONUA",
    "ATWIMA NWABIAGYA NORTH",
    "ATWIMA NWABIAGYA SOUTH",
    "BANTAMA",
    "BEKWAI",
    "BOSOME FREHO",
    "BOSOMTWE",
    "EFFIDUASE/ASOKORE",
    "EJISU",
    "EJURA SEKYEDUMASE",
    "FOMENA",
    "JUABEN",
    "KUMAWU",
    "KWABRE EAST",
    "KWADASO",
    "MAMPONG",
    "MANHYIA NORTH",
    "MANHYIA SOUTH",
    "MANSO ADUBIA",
    "MANSO NKWANTA",
    "NEW EDUBIASE",
    "NHYIAESO",
    "NSUTA/KWAMANG/BEPOSO",
    "OBUASI EAST",
    "OBUASI WEST",
    "ODOTOBRI",
    "OFFINSO NORTH",
    "OFFINSO SOUTH",
    "OFORIKROM",
    "OLD TAFO",
    "SEKYERE AFRAM PLAINS",
    "SUAME",
    "SUBIN"
  ],
  "Bono": [
    "BANDA",
    "BEREKUM EAST",
    "BEREKUM WEST",
    "DORMAA CENTRAL",
    "DORMAA EAST",
    "DORMAA WEST",
    "JAMAN NORTH",
    "JAMAN SOUTH",
    "SUNYANI EAST",
    "SUNYANI WEST",
    "TAIN",
    "WENCHI"
  ],
  "Bono East": [
    "ATEBUBU/AMANTIN",
    "KINTAMPO NORTH",
    "KINTAMPO SOUTH",
    "NKORANZA NORTH",
    "NKORANZA SOUTH",
    "PRU EAST",
    "PRU WEST",
    "SENE EAST",
    "SENE WEST",
    "TECHIMAN NORTH",
    "TECHIMAN SOUTH"
  ],
  "Central": [
    "ABURA ASEBU KWAMANKESE",
    "AGONA EAST",
    "AGONA WEST",
    "AJUMAKO ENYAN ESIAM",
    "ASIKUMA/ODOBEN/BRAKWA",
    "ASSIN CENTRAL",
    "ASSIN NORTH",
    "ASSIN SOUTH",
    "AWUTU SENYA EAST",
    "AWUTU SENYA WEST",
    "CAPE COAST NORTH",
    "CAPE COAST SOUTH",
    "EFFUTU",
    "EKUMFI",
    "GOMOA CENTRAL",
    "GOMOA EAST",
    "GOMOA WEST",
    "HEMANG LOWER DENKYIRA",
    "KOMENDA EDINA EGUAFO ABREM",
    "MFANTSEMAN",
    "TWIFO ATTI MORKWA",
    "UPPER DENKYIRA EAST",
    "UPPER DENKYIRA WEST"
  ],
  "Eastern": [
    "ABIREM",
    "ABUAKWA NORTH",
    "ABUAKWA SOUTH",
    "ACHIASE",
    "AFRAM PLAINS SOUTH",
    "AKIM ODA",
    "AKROPONG",
    "AKUAPEM SOUTH",
    "AKWATIA",
    "ASENE/AKROSO/MANSO",
    "ASUOGYAMAN",
    "ATIWA EAST",
    "ATIWA WEST",
    "AYENSUANO",
    "BIRIM SOUTH",
    "FANTEAKWA NORTH",
    "FANTEAKWA SOUTH",
    "KADE",
    "KWAHU AFRAM PLAINS NORTH",
    "KWAHU EAST",
    "LOWER MANYA KROBO",
    "LOWER WEST AKIM",
    "MPRAESO",
    "NEW JUABEN NORTH",
    "NEW JUABEN SOUTH",
    "NKAWKAW",
    "NSAWAM/ADOAGYIRI",
    "OFOASE/AYIREBI",
    "OKERE",
    "SUHUM",
    "UPPER MANYA KROBO",
    "UPPER WEST AKIM",
    "YILO KROBO"
  ],
  "Greater Accra": [
    "ABLEKUMA CENTRAL",
    "ABLEKUMA NORTH",
    "ABLEKUMA SOUTH",
    "ABLEKUMA WEST",
    "ADA",
    "ADENTAN",
    "AMASAMAN",
    "ANYAA/SOWUTUOM",
    "ASHAIMAN",
    "AYAWASO CENTRAL",
    "AYAWASO EAST",
    "AYAWASO NORTH",
    "AYAWASO WEST WUOGON",
    "BORTIANOR-NGLESHIE AMANFRO",
    "DADEKOTOPON",
    "DOME/KWABENYA",
    "DOMEABRA-OBOM",
    "KORLE KLOTTEY",
    "KPONE-KATAMANSO",
    "KROWOR",
    "LEDZOKUKU",
    "MADINA",
    "NINGO PRAMPRAM",
    "ODODODIODIOO",
    "OKAIKWEI CENTRAL",
    "OKAIKWEI NORTH",
    "OKAIKWEI SOUTH",
    "SEGE",
    "SHAI-OSUDOKU",
    "TEMA CENTRAL",
    "TEMA EAST",
    "TEMA WEST",
    "TROBU",
    "WEIJA-GBAWE"
  ],
  "North East": [
    "BUNKPURUGU",
    "CHEREPONI",
    "NALERIGU/GAMBAGA",
    "WALEWALE",
    "YAGABA/KUBORI",
    "YUNYOO"
  ],
  "Northern": [
    "BIMBILLA",
    "GUSHEGU",
    "KARAGA",
    "KPANDAI",
    "KUMBUNGU",
    "MION",
    "NANTON",
    "SABOBA",
    "SAGNARIGU",
    "SAVELUGU",
    "TAMALE CENTRAL",
    "TAMALE NORTH",
    "TAMALE SOUTH",
    "TATALE/SANGULI",
    "TOLON",
    "WULESNSI",
    "YENDI",
    "ZABZUGU"
  ],
  "Oti": [
    "AKAN",
    "BIAKOYE",
    "BUEM",
    "GUAN",
    "KRACHI EAST",
    "KRACHI NCHUMURU",
    "KRACHI WEST",
    "NKWANTA NORTH",
    "NKWANTA SOUTH"
  ],
  "Savannah": [
    "BOLE-BAMBOI",
    "DABOYA/MANKARIGU",
    "DAMONGO",
    "SALAGA NORTH",
    "SALAGA SOUTH",
    "SAWLA-TUNA-KALBA",
    "YAPEI/KUSAWGU"
  ],
  "Upper East": [
    "BAWKU CENTRAL",
    "BINDURI",
    "BOLGA EAST",
    "BOLGATANGA CENTRAL",
    "BONGO",
    "BUILSA NORTH",
    "BUILSA SOUTH",
    "CHIANA-PAGA",
    "GARU",
    "NABDAM",
    "NAVRONGO CENTRAL",
    "PUSIGA",
    "TALENSI",
    "TEMPANE",
    "ZEBILLA"
  ],
  "Upper West": [
    "DAFFIAMA/BUSSIE/ISSA",
    "JIRAPA",
    "LAMBUSSIE",
    "LAWRA",
    "NADOWLI/KALEO",
    "NANDOM",
    "SISSALA EAST",
    "SISSALA WEST",
    "WA CENTRAL",
    "WA EAST",
    "WA WEST"
  ],
  "Volta": [
    "ADAKLU",
    "AFADJATO SOUTH",
    "AGOTIME ZIOPE",
    "AKATSI NORTH",
    "AKATSI SOUTH",
    "ANLO",
    "CENTRAL TONGU",
    "HO CENTRAL",
    "HO WEST",
    "HOHOE",
    "KETA",
    "KETU NORTH",
    "KETU SOUTH",
    "KPANDO",
    "NORTH DAYI",
    "NORTH TONGU",
    "SOUTH DAYI",
    "SOUTH TONGU"
  ],
  "Western": [
    "AHANTA WEST",
    "AMENFI CENTRAL",
    "AMENFI EAST",
    "AMENFI WEST",
    "EFFIA",
    "ELLEMBELE",
    "ESSIKADU-KETAN",
    "EVALUE AJOMORO GWIRA",
    "JOMORO",
    "KWESIMINTSIM",
    "MPOHOR",
    "PRESTEA HUNI-VALLEY",
    "SEKONDI",
    "SHAMA",
    "TAKORADI",
    "TARKWA NSUAEM",
    "WASSA EAST"
  ],
  "Western North": [
    "AOWIN",
    "BIA EAST",
    "BIA WEST",
    "BIBIANI-ANHWIASO-BEKWAI",
    "BODI",
    "JUABOSO",
    "SEFWI AKONTOMBRA",
    "SEFWI WIAWSO",
    "SUAMAN"
  ],
  "External Branch": [
    "Senegal",
    "Russia",
    "United Kingdom",
    "Middle East",
    "Togo",
    "Nigeria",
    "South Africa",
    "United States of America",
    "Austria",
    "Spain",
    "Sweden",
    "Australia",
    "Hong Kong",
    "Qatar",
    "Norway",
    "South Korea",
    "Ireland",
    "Italy",
    "Ivory Coast",
    "Japan",
    "Netherland",
    "China",
    "Czech",
    "Denmark",
    "Equitorial Guinea",
    "Germany",
    "France",
    "Finland",
    "Belgium",
    "Canada"
  ]
};

export function getConstituenciesForRegion(region: string | null | undefined): string[] {
  if (!region) return [];
  const normalizedRegion = region.trim();
  
  // Find case-insensitive match
  for (const [rName, list] of Object.entries(OFFICIAL_CONSTITUENCIES_BY_REGION)) {
    if (rName.toLowerCase() === normalizedRegion.toLowerCase()) {
      return [...list];
    }
  }

  if (/^external(\s*branch(es)?)?$/i.test(normalizedRegion)) {
    return [...OFFICIAL_CONSTITUENCIES_BY_REGION["External Branch"]];
  }

  return [];
}

