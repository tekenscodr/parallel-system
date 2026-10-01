import { normalizeConstituency } from "./constituency-normalizer.ts";

export interface PollingStationGrouping {
  id: string;
  code: string;
  label: string;
  shortLabel: string;
  category: "split_region" | "merged_region" | "single_region" | "youth_wing" | "wocom_wing" | "nasara_wing";
  description: string;
  regions: string[];
  /**
   * When present, restricts constituency-level rows in `splitRegion` to these constituencies.
   * If `isCatchAllSplit` is true, it matches all constituencies in `splitRegion` NOT in `excludeConstituencies`.
   */
  splitRegion?: string;
  constituencies?: string[];
  excludeConstituencies?: string[];
  isCatchAllSplit?: boolean;
  /**
   * Whether Regional Executives, Foundation Members, and National Council Representatives
   * for `splitRegion` (or `regions`) are included in this polling station.
   */
  includeRegionalLeadership: boolean;
  /**
   * Whether National Headquarters officers (Presidential leadership, National Execs, Directors,
   * Elders, Patrons, National TESCON, etc.) are included in this polling station.
   */
  includeNationalOfficers?: boolean;
  /**
   * Whether External Branch (Diaspora) executives are included in this polling station.
   */
  includeExternalBranches?: boolean;
  /**
   * Optional recommended contest when this polling station is selected in the UI.
   */
  recommendedContest?: string;
}

const ASHANTI_A_CONSTITUENCIES = [
  "KWABRE EAST",
  "ATWIMA KWANWOMA",
  "OFORIKROM",
  "SUAME",
  "EJISU",
  "ATWIMA MPONUA",
  "KWADASO",
  "ATWIMA NWABIAGYA SOUTH",
  "BEKWAI",
  "ASOKWA",
  "SUBIN",
  "NHYIAESO",
];

const ASHANTI_B_CONSTITUENCIES = [
  "OFFINSO SOUTH",
  "BANTAMA",
  "EJURA SEKYEDUMASE",
  "EJURA-SEKYEDUMASE",
  "EJURA SEKYEREDUMASE",
  "ASANTE AKIM SOUTH",
  "ATWIMA NWABIAGYA NORTH",
  "AFIGYA SEKYERE EAST",
  "AFIGYA SEYERE EAST",
  "MANSO ADUBIA",
  "OLD TAFO",
  "ODOTOBRI",
  "ODOTOBIRI",
  "MAMPONG",
  "JUABEN",
  "MANHYIA NORTH",
  "OBUASI WEST",
  "OBUASE WEST",
  "AHAFO ANO NORTH",
  "MANSO NKWANTA",
  "MAANSO NKWANTA",
];

const ASHANTI_C_CONSTITUENCIES = [
  "OFFINSO NORTH",
  "NEW EDUBIASE",
  "ASANTE AKIM CENTRAL",
  "NSUTA/KWAMANG/BEPOSO",
  "ASANTE AKIM NORTH",
  "OBUASI EAST",
  "MANHYIA SOUTH",
  "EFFIDUASE/ASOKORE",
  "AHAFO ANO SOUTH WEST",
  "ADANSI ASOKWA",
  "BOSOME FREHO",
  "AFIGYA KWABRE NORTH",
  "AHAFO ANO SOUTH-EAST",
  "KUMAWU",
  "FOMENA",
  "AKROFUOM",
  "SEKYERE AFRAM PLAINS",
  "ASAWASE",
  "AFIGYA KWABRE SOUTH",
  "BOSOMTWE",
];

const CENTRAL_A_CONSTITUENCIES = [
  "AWUTU SENYA EAST",
  "MFANTSEMAN",
  "GOMOA EAST",
  "AWUTU SENYA WEST",
  "KOMENDA EDINA EGUAFO ABREM",
  "AGONA WEST",
  "GOMOA WEST",
  "AJUMAKO ENYAN ESIAM",
  "ABURA ASEBU KWAMANKESE",
  "UPPER DENKYIRA EAST",
  "ASIKUMA/ODOBEN/BRAKWA",
  "EFFUTU",
  "AGONA EAST",
];

const CENTRAL_B_CONSTITUENCIES = [
  "CAPE COAST NORTH",
  "ASSIN SOUTH",
  "TWIFO ATTI MORKWA",
  "GOMOA CENTRAL",
  "CAPE COAST SOUTH",
  "UPPER DENKYIRA WEST",
  "ASSIN NORTH",
  "EKUMFI",
  "ASSIN CENTRAL",
  "HEMANG LOWER DENKYIRA",
];

const EASTERN_A_CONSTITUENCIES = [
  "NSAWAM/ADOAGYIRI",
  "NEW JUABEN SOUTH",
  "NKAWKAW",
  "SUHUM",
  "YILO KROBO",
  "LOWER MANYA KROBO",
  "KADE",
  "AKROPONG",
  "ASUOGYAMAN",
  "ABETIFI",
  "KWAHU EAST",
  "LOWER WEST AKIM",
  "FANTEAKWA NORTH",
  "AFRAM PLAINS NORTH",
  "KWAHU AFRAM PLAINS NORTH",
  "AYENSUANO",
  "MPRAESO",
  "AFRAM PLAINS SOUTH",
  "KWAHU AFRAM PLAINS SOUTH",
  "AKWATIA",
  "UPPER MANYA KROBO",
];

const EASTERN_B_CONSTITUENCIES = [
  "UPPER WEST AKIM",
  "ABUAKWA SOUTH",
  "OFOASE/AYIREBI",
  "AKUAPEM SOUTH",
  "ABIREM",
  "OKERE",
  "ASENE/MANSO/AKROSO",
  "ASENE/AKROSO/MANSO",
  "ABUAKWA NORTH",
  "NEW JUABEN NORTH",
  "AKIM ODA",
  "FANTEAKWA SOUTH",
  "ATIWA EAST",
  "ACHIASE",
  "ATIWA WEST",
  "AKIM SWEDRU",
  "BIRIM SOUTH",
];

const GREATER_ACCRA_A_CONSTITUENCIES = [
  "DOME/KWABENYA",
  "ASHAIMAN",
  "LEDZOKUKU",
  "MADINA",
  "ABLEKUMA CENTRAL",
  "ADENTAN",
  "AMASAMAN",
  "ANYAA/SOWUTUOM",
  "ABLEKUMA NORTH",
  "TROBU",
  "ODODODIODIOO",
  "DADEKOTOPON",
  "LA DADEKOTOPON",
  "KPONE-KATAMANSO",
  "WEIJA-GBAWE",
  "TEMA EAST",
  "TEMA WEST",
  "KROWOR",
  "BORTIANOR-NGLESHIE AMANFRO",
];

const GREATER_ACCRA_B_CONSTITUENCIES = [
  "KORLE KLOTTEY",
  "ABLEKUMA WEST",
  "AYAWASO WEST WUOGON",
  "OKAIKWEI SOUTH",
  "ABLEKUMA SOUTH",
  "NINGO PRAMPRAM",
  "AYAWASO CENTRAL",
  "OKAIKWEI NORTH",
  "TEMA CENTRAL",
  "SHAI-OSUDOKU",
  "OKAIKWEI CENTRAL",
  "AYAWASO NORTH",
  "AYAWASO EAST",
  "DOMEABRA-OBOM",
  "ADA",
  "SEGE",
];

const NORTHERN_A_CONSTITUENCIES = [
  "TAMALE SOUTH",
  "BIMBILLA",
  "TAMALE CENTRAL",
  "YENDI",
  "SAGNARIGU",
  "KPANDAI",
  "GUSHEGU",
  "TOLON",
];

const NORTHERN_B_CONSTITUENCIES = [
  "SAVELUGU",
  "KARAGA",
  "KUMBUNGU",
  "TAMALE NORTH",
  "WULENSI",
  "WULESNSI",
  "MION",
  "ZABZUGU",
  "SABOBA",
  "NANTON",
  "TATALE/SANGULI",
];

const EXTERNAL_A_CHAPTERS = [
  "Australia",
  "Austria",
  "Belgium",
  "Canada",
  "Czech_Republic",
  "Czech Republic",
  "Czech",
  "Denmark",
  "Finland",
  "France",
  "Germany",
  "Ireland",
  "Italy",
  "Ivory Coast",
  "Ivory Coast (Côte d'Ivoire)",
  "Cote d'Ivoire",
  "Japan",
  "Middle_East",
  "Middle East",
  "Netherlands",
  "Netherland",
];

const EXTERNAL_B_CHAPTERS = [
  "Nigeria",
  "Norway",
  "Qatar",
  "South Korea",
  "South_Korea",
  "South_Africa",
  "South Africa",
  "Spain",
  "Sweden",
  "United_Kingdom",
  "United Kingdom",
  "UK",
  "United_States",
  "United States",
  "USA",
  "China",
  "Togo",
  "Senegal",
  "Hong Kong",
  "Hong_Kong",
  "Equatorial guinea",
  "Equatorial Guinea",
  "Equitorial Guinea",
  "Russia",
];

export const POLLING_STATION_GROUPINGS: PollingStationGrouping[] = [
  // 1. Split Regions (Ashanti A/B/C, Central A/B, Eastern A/B, Greater Accra A/B, Northern A/B, External A/B)
  {
    id: "ashanti_a",
    code: "asa",
    label: "Ashanti Polling Station A (12 Constituencies)",
    shortLabel: "Ashanti A",
    category: "split_region",
    description:
      "Kwabre East, Atwima Kwanwoma, Oforikrom, Suame, Ejisu, Atwima Mponua, Kwadaso, Atwima Nwabiagya South, Bekwai, Asokwa, Subin, Nhyiaeso + TESCON & Proxies",
    regions: ["Ashanti"],
    splitRegion: "Ashanti",
    constituencies: ASHANTI_A_CONSTITUENCIES,
    includeRegionalLeadership: false,
  },
  {
    id: "ashanti_b",
    code: "asb",
    label: "Ashanti Polling Station B (15 Constituencies)",
    shortLabel: "Ashanti B",
    category: "split_region",
    description:
      "Offinso South, Bantama, Ejura Sekyedumase, Asante Akim South, Atwima Nwabiagya North, Afigya Sekyere East, Manso Adubia, Old Tafo, Odotobri, Mampong, Juaben, Manhyia North, Obuasi West, Ahafo Ano North, Manso Nkwanta + TESCON & Proxies",
    regions: ["Ashanti"],
    splitRegion: "Ashanti",
    constituencies: ASHANTI_B_CONSTITUENCIES,
    includeRegionalLeadership: false,
  },
  {
    id: "ashanti_c",
    code: "asc",
    label: "Ashanti Polling Station C (20 Constituencies + Regional Executives)",
    shortLabel: "Ashanti C",
    category: "split_region",
    description:
      "Remaining 20 Ashanti Constituencies + Ashanti Regional Executives, Foundation Members, National Council Reps, TESCON & Proxies",
    regions: ["Ashanti"],
    splitRegion: "Ashanti",
    constituencies: ASHANTI_C_CONSTITUENCIES,
    excludeConstituencies: [...ASHANTI_A_CONSTITUENCIES, ...ASHANTI_B_CONSTITUENCIES],
    isCatchAllSplit: true,
    includeRegionalLeadership: true,
  },
  {
    id: "central_a",
    code: "cea",
    label: "Central Polling Station A (13 Constituencies)",
    shortLabel: "Central A",
    category: "split_region",
    description:
      "Awutu Senya East, Mfantseman, Gomoa East, Awutu Senya West, KEEA, Agona West, Gomoa West, Ajumako Enyan Esiam, Abura Asebu Kwamankese, Upper Denkyira East, Asikuma/Odoben/Brakwa, Effutu, Agona East + TESCON & Proxies",
    regions: ["Central"],
    splitRegion: "Central",
    constituencies: CENTRAL_A_CONSTITUENCIES,
    includeRegionalLeadership: false,
  },
  {
    id: "central_b",
    code: "ceb",
    label: "Central Polling Station B (10 Constituencies + Regional Executives)",
    shortLabel: "Central B",
    category: "split_region",
    description:
      "Cape Coast North, Assin South, Twifo Atti Morkwa, Gomoa Central, Cape Coast South, Upper Denkyira West, Assin North, Ekumfi, Assin Central, Hemang Lower Denkyira + Central Regional Executives, Foundation Members, Council Reps, TESCON & Proxies",
    regions: ["Central"],
    splitRegion: "Central",
    constituencies: CENTRAL_B_CONSTITUENCIES,
    excludeConstituencies: CENTRAL_A_CONSTITUENCIES,
    isCatchAllSplit: true,
    includeRegionalLeadership: true,
  },
  {
    id: "eastern_a",
    code: "eaa",
    label: "Eastern Polling Station A (18 Constituencies)",
    shortLabel: "Eastern A",
    category: "split_region",
    description:
      "Nsawam/Adoagyiri, New Juaben South, Nkawkaw, Suhum, Yilo Krobo, Lower Manya Krobo, Kade, Akropong, Asuogyaman, Abetifi, Lower West Akim, Fanteakwa North, Afram Plains North, Ayensuano, Mpraeso, Afram Plains South, Akwatia, Upper Manya Krobo + TESCON & Proxies",
    regions: ["Eastern"],
    splitRegion: "Eastern",
    constituencies: EASTERN_A_CONSTITUENCIES,
    includeRegionalLeadership: false,
  },
  {
    id: "eastern_b",
    code: "eab",
    label: "Eastern Polling Station B (15 Constituencies + Regional Executives)",
    shortLabel: "Eastern B",
    category: "split_region",
    description:
      "Upper West Akim, Abuakwa South, Ofoase/Ayirebi, Akuapem South, Abirem, Okere, Asene/Manso/Akroso, Abuakwa North, New Juaben North, Akim Oda, Fanteakwa South, Atiwa East, Achiase, Atiwa West, Akim Swedru + Eastern Regional Executives, Foundation Members, Council Reps, TESCON & Proxies",
    regions: ["Eastern"],
    splitRegion: "Eastern",
    constituencies: EASTERN_B_CONSTITUENCIES,
    excludeConstituencies: EASTERN_A_CONSTITUENCIES,
    isCatchAllSplit: true,
    includeRegionalLeadership: true,
  },
  {
    id: "greater_accra_a",
    code: "gaa",
    label: "Greater Accra Polling Station A (18 Constituencies)",
    shortLabel: "Greater Accra A",
    category: "split_region",
    description:
      "Dome/Kwabenya, Ashaiman, Ledzokuku, Madina, Ablekuma Central, Adentan, Amasaman, Anyaa/Sowutuom, Ablekuma North, Trobu, Odododiodioo, Dadekotopon, Kpone-Katamanso, Weija-Gbawe, Tema East, Tema West, Krowor, Bortianor-Ngleshie Amanfro + TESCON & Proxies",
    regions: ["Greater Accra"],
    splitRegion: "Greater Accra",
    constituencies: GREATER_ACCRA_A_CONSTITUENCIES,
    includeRegionalLeadership: false,
  },
  {
    id: "greater_accra_b",
    code: "gab",
    label: "Greater Accra Polling Station B (16 Constituencies + Regional Executives)",
    shortLabel: "Greater Accra B",
    category: "split_region",
    description:
      "Korle Klottey, Ablekuma West, Ayawaso West Wuogon, Okaikwei South, Ablekuma South, Ningo Prampram, Ayawaso Central, Okaikwei North, Tema Central, Shai-Osudoku, Okaikwei Central, Ayawaso North, Ayawaso East, Domeabra-Obom, Ada, Sege + Greater Accra Regional Executives, Foundation Members, Council Reps, TESCON & Proxies",
    regions: ["Greater Accra"],
    splitRegion: "Greater Accra",
    constituencies: GREATER_ACCRA_B_CONSTITUENCIES,
    excludeConstituencies: GREATER_ACCRA_A_CONSTITUENCIES,
    isCatchAllSplit: true,
    includeRegionalLeadership: true,
  },
  {
    id: "northern_a",
    code: "nra",
    label: "Northern Polling Station A (8 Constituencies)",
    shortLabel: "Northern A",
    category: "split_region",
    description:
      "Tamale South, Bimbilla, Tamale Central, Yendi, Sagnarigu, Kpandai, Gushegu, Tolon + TESCON & Proxies",
    regions: ["Northern"],
    splitRegion: "Northern",
    constituencies: NORTHERN_A_CONSTITUENCIES,
    includeRegionalLeadership: false,
  },
  {
    id: "northern_b",
    code: "nrb",
    label: "Northern Polling Station B (10 Constituencies + Regional Executives)",
    shortLabel: "Northern B",
    category: "split_region",
    description:
      "Savelugu, Karaga, Kumbungu, Tamale North, Wulensi, Mion, Zabzugu, Saboba, Nanton, Tatale/Sanguli + Northern Regional Executives, Foundation Members, Council Reps, TESCON & Proxies",
    regions: ["Northern"],
    splitRegion: "Northern",
    constituencies: NORTHERN_B_CONSTITUENCIES,
    excludeConstituencies: NORTHERN_A_CONSTITUENCIES,
    isCatchAllSplit: true,
    includeRegionalLeadership: true,
  },
  {
    id: "external_a",
    code: "exa",
    label: "External (Diaspora) Polling Station A (15 Countries)",
    shortLabel: "External A",
    category: "split_region",
    description:
      "Australia, Austria, Belgium, Canada, Czech Republic, Denmark, Finland, France, Germany, Ireland, Italy, Ivory Coast, Japan, Middle East, Netherlands + Proxies",
    regions: ["External Branch"],
    splitRegion: "External Branch",
    constituencies: EXTERNAL_A_CHAPTERS,
    includeRegionalLeadership: false,
    includeExternalBranches: true,
  },
  {
    id: "external_b",
    code: "exb",
    label: "External (Diaspora) Polling Station B (15 Countries)",
    shortLabel: "External B",
    category: "split_region",
    description:
      "Nigeria, Norway, Qatar, South Korea, South Africa, Spain, Sweden, United Kingdom, United States, China, Togo, Senegal, Hong Kong, Equatorial Guinea, Russia + Proxies",
    regions: ["External Branch"],
    splitRegion: "External Branch",
    constituencies: EXTERNAL_B_CHAPTERS,
    excludeConstituencies: EXTERNAL_A_CHAPTERS,
    isCatchAllSplit: true,
    includeRegionalLeadership: false,
    includeExternalBranches: true,
  },

  // 2. Merged Regions (Rule 2: a, b, c, d)
  {
    id: "western_savannah",
    code: "mws",
    label: "Merged: Western & Savannah Regions",
    shortLabel: "Western & Savannah",
    category: "merged_region",
    description:
      "Western Region + Savannah Region (Regional Executives, Foundation Members, National Council Reps, Constituency Executives, TESCON Presidents & Proxies)",
    regions: ["Western", "Savannah"],
    includeRegionalLeadership: true,
  },
  {
    id: "oti_ahafo",
    code: "moa",
    label: "Merged: Oti & Ahafo Regions",
    shortLabel: "Oti & Ahafo",
    category: "merged_region",
    description:
      "Oti Region + Ahafo Region (Regional Executives, Foundation Members, National Council Reps, Constituency Executives, TESCON Presidents & Proxies)",
    regions: ["Oti", "Ahafo"],
    includeRegionalLeadership: true,
  },
  {
    id: "upper_west_north_east",
    code: "muwne",
    label: "Merged: Upper West & North East Regions",
    shortLabel: "Upper West & North East",
    category: "merged_region",
    description:
      "Upper West Region + North East Region (Regional Executives, Foundation Members, National Council Reps, Constituency Executives, TESCON Presidents & Proxies)",
    regions: ["Upper West", "North East"],
    includeRegionalLeadership: true,
  },
  {
    id: "bono_east_national",
    code: "mben",
    label: "Merged: Bono East & All National Officers",
    shortLabel: "Bono East & National Officers",
    category: "merged_region",
    description:
      "Bono East Region + All National Officers (National Executives, National TESCON, National Council Reps, Former President, Former Running Mates, National Council of Elders, National Patrons & National Directors) + Proxies",
    regions: ["Bono East", "National Headquarters"],
    includeRegionalLeadership: true,
    includeNationalOfficers: true,
  },

  // 3. Standalone Unmerged Regions
  {
    id: "bono_full",
    code: "sbo",
    label: "Bono Region Polling Station",
    shortLabel: "Bono Region",
    category: "single_region",
    description:
      "Bono Regional Executives, Foundation Members, National Council Reps, Constituency Executives, TESCON Presidents & Proxies",
    regions: ["Bono"],
    includeRegionalLeadership: true,
  },
  {
    id: "volta_full",
    code: "svo",
    label: "Volta Region Polling Station",
    shortLabel: "Volta Region",
    category: "single_region",
    description:
      "Volta Regional Executives, Foundation Members, National Council Reps, Constituency Executives, TESCON Presidents & Proxies",
    regions: ["Volta"],
    includeRegionalLeadership: true,
  },
  {
    id: "western_north_full",
    code: "swn",
    label: "Western North Region Polling Station",
    shortLabel: "Western North Region",
    category: "single_region",
    description:
      "Western North Regional Executives, Foundation Members, National Council Reps, Constituency Executives, TESCON Presidents & Proxies",
    regions: ["Western North"],
    includeRegionalLeadership: true,
  },
  {
    id: "upper_east_full",
    code: "sue",
    label: "Upper East Region Polling Station",
    shortLabel: "Upper East Region",
    category: "single_region",
    description:
      "Upper East Regional Executives, Foundation Members, National Council Reps, Constituency Executives, TESCON Presidents & Proxies",
    regions: ["Upper East"],
    includeRegionalLeadership: true,
  },

  // 4. Youth Wing Polling Stations (C.pdf: Polling Stations 1 to 5)
  {
    id: "youth_ps_1",
    code: "yps1",
    label: "Youth Wing — Polling Station 1 (Greater Accra, Eastern, Oti)",
    shortLabel: "Youth PS 1 (GA, Eastern, Oti)",
    category: "youth_wing",
    description: "Youth Wing Electorate & Proxies for Greater Accra, Eastern, and Oti Regions",
    regions: ["Greater Accra", "Eastern", "Oti"],
    includeRegionalLeadership: true,
    recommendedContest: "Youth Organisers & Deputies",
  },
  {
    id: "youth_ps_2",
    code: "yps2",
    label: "Youth Wing — Polling Station 2 (Bono, Bono East, Savannah, Volta)",
    shortLabel: "Youth PS 2 (Bono, Bono East, Savannah, Volta)",
    category: "youth_wing",
    description: "Youth Wing Electorate & Proxies for Bono, Bono East, Savannah, and Volta Regions",
    regions: ["Bono", "Bono East", "Savannah", "Volta"],
    includeRegionalLeadership: true,
    recommendedContest: "Youth Organisers & Deputies",
  },
  {
    id: "youth_ps_3",
    code: "yps3",
    label: "Youth Wing — Polling Station 3 (Western, Western North, Central)",
    shortLabel: "Youth PS 3 (Western, Western North, Central)",
    category: "youth_wing",
    description: "Youth Wing Electorate & Proxies for Western, Western North, and Central Regions",
    regions: ["Western", "Western North", "Central"],
    includeRegionalLeadership: true,
    recommendedContest: "Youth Organisers & Deputies",
  },
  {
    id: "youth_ps_4",
    code: "yps4",
    label: "Youth Wing — Polling Station 4 (Ashanti, Ahafo, North East)",
    shortLabel: "Youth PS 4 (Ashanti, Ahafo, North East)",
    category: "youth_wing",
    description: "Youth Wing Electorate & Proxies for Ashanti, Ahafo, and North East Regions",
    regions: ["Ashanti", "Ahafo", "North East"],
    includeRegionalLeadership: true,
    recommendedContest: "Youth Organisers & Deputies",
  },
  {
    id: "youth_ps_5",
    code: "yps5",
    label: "Youth Wing — Polling Station 5 (Upper East, Upper West, Northern + National & Diaspora)",
    shortLabel: "Youth PS 5 (UE, UW, Northern + Nat/Ext)",
    category: "youth_wing",
    description:
      "Youth Wing Electorate & Proxies for Upper East, Upper West, Northern + National Youth Officers (incl. National TESCON) & External Branches",
    regions: ["Upper East", "Upper West", "Northern", "National Headquarters", "External Branch"],
    includeRegionalLeadership: true,
    includeNationalOfficers: true,
    includeExternalBranches: true,
    recommendedContest: "Youth Organisers & Deputies",
  },

  // 5. Women Organiser (Women's Wing) Polling Stations (C.pdf: Polling Stations 1 to 3)
  {
    id: "wocom_ps_1",
    code: "wps1",
    label: "Women Organiser — Polling Station 1 (Greater Accra, Eastern, Oti, Bono, Bono East + National)",
    shortLabel: "Women Organiser PS 1 (GA, Eastern, Oti, Bono, BE + Nat)",
    category: "wocom_wing",
    description:
      "Women Organiser Election Electorate & Proxies for Greater Accra, Eastern, Oti, Bono, Bono East Regions + National Officers",
    regions: ["Greater Accra", "Eastern", "Oti", "Bono", "Bono East", "National Headquarters"],
    includeRegionalLeadership: true,
    includeNationalOfficers: true,
    recommendedContest: "Women Organisers & Deputies",
  },
  {
    id: "wocom_ps_2",
    code: "wps2",
    label: "Women Organiser — Polling Station 2 (Ashanti, Ahafo, North East, Volta, Northern + External Branch)",
    shortLabel: "Women Organiser PS 2 (Ashanti, Ahafo, NE, Volta, Northern + Ext)",
    category: "wocom_wing",
    description:
      "Women Organiser Election Electorate & Proxies for Ashanti, Ahafo, North East, Volta, Northern Regions + External Branches (Diaspora)",
    regions: ["Ashanti", "Ahafo", "North East", "Volta", "Northern", "External Branch"],
    includeRegionalLeadership: true,
    includeExternalBranches: true,
    recommendedContest: "Women Organisers & Deputies",
  },
  {
    id: "wocom_ps_3",
    code: "wps3",
    label: "Women Organiser — Polling Station 3 (Upper East, Upper West, Savannah, Western, Western North, Central)",
    shortLabel: "Women Organiser PS 3 (UE, UW, Sav, West, WN, Central)",
    category: "wocom_wing",
    description:
      "Women Organiser Election Electorate & Proxies for Upper East, Upper West, Savannah, Western, Western North, and Central Regions",
    regions: [
      "Upper East",
      "Upper West",
      "Savannah",
      "Western",
      "Western North",
      "Central",
    ],
    includeRegionalLeadership: true,
    recommendedContest: "Women Organisers & Deputies",
  },

  // 6. Nasara Wing Polling Stations (C.pdf: Polling Stations 1 to 2)
  {
    id: "nasara_ps_1",
    code: "nps1",
    label: "Nasara — Polling Station 1 (GA, Eastern, Oti, Bono, Bono East, Western, WN, Central)",
    shortLabel: "Nasara PS 1 (8 Southern/Middle Belt Regions)",
    category: "nasara_wing",
    description:
      "Nasara Wing Electorate & Proxies for Greater Accra, Eastern, Oti, Bono, Bono East, Western, Western North, and Central Regions",
    regions: [
      "Greater Accra",
      "Eastern",
      "Oti",
      "Bono",
      "Bono East",
      "Western",
      "Western North",
      "Central",
    ],
    includeRegionalLeadership: true,
    recommendedContest: "Nasara Coordinators & Deputies",
  },
  {
    id: "nasara_ps_2",
    code: "nps2",
    label: "Nasara — Polling Station 2 (Ashanti, Ahafo, NE, Volta, Northern, UE, UW, Savannah + Nat/Ext)",
    shortLabel: "Nasara PS 2 (8 Northern/Ashanti/Volta Regions + Nat/Ext)",
    category: "nasara_wing",
    description:
      "Nasara Wing Electorate & Proxies for Ashanti, Ahafo, North East, Volta, Northern, Upper East, Upper West, Savannah + National Nasara Officers & External Branches",
    regions: [
      "Ashanti",
      "Ahafo",
      "North East",
      "Volta",
      "Northern",
      "Upper East",
      "Upper West",
      "Savannah",
      "National Headquarters",
      "External Branch",
    ],
    includeRegionalLeadership: true,
    includeNationalOfficers: true,
    includeExternalBranches: true,
    recommendedContest: "Nasara Coordinators & Deputies",
  },
];

const GROUPING_BY_ID = new Map<string, PollingStationGrouping>();
const GROUPING_BY_CODE = new Map<string, PollingStationGrouping>();
for (const g of POLLING_STATION_GROUPINGS) {
  GROUPING_BY_ID.set(g.id.toLowerCase(), g);
  GROUPING_BY_CODE.set(g.code.toLowerCase(), g);
}

// Aliases for Women Organiser polling stations
const wocomAliases: Record<string, string> = {
  women_ps_1: "wocom_ps_1",
  women_ps_2: "wocom_ps_2",
  women_ps_3: "wocom_ps_3",
  women_organiser_ps_1: "wocom_ps_1",
  women_organiser_ps_2: "wocom_ps_2",
  women_organiser_ps_3: "wocom_ps_3",
};
for (const [alias, targetId] of Object.entries(wocomAliases)) {
  const target = GROUPING_BY_ID.get(targetId);
  if (target) {
    GROUPING_BY_ID.set(alias.toLowerCase(), target);
  }
}

export function getPollingStationGrouping(idOrCode: string | null | undefined): PollingStationGrouping | null {
  if (!idOrCode) return null;
  const clean = idOrCode.trim().toLowerCase();
  if (!clean || clean === "none" || clean === "all") return null;
  return GROUPING_BY_ID.get(clean) || GROUPING_BY_CODE.get(clean) || null;
}

function normalizeNameForMatch(val: string): string {
  return String(val || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function matchesConstituencyList(
  rowConstituency: string,
  targetList: string[],
  isExternal: boolean = false
): boolean {
  const raw = String(rowConstituency || "").trim();
  if (!raw) return false;
  const rawNorm = normalizeNameForMatch(raw);
  const canon = isExternal ? raw : normalizeConstituency(raw);
  const canonNorm = normalizeNameForMatch(canon);

  for (const item of targetList) {
    const itemRawNorm = normalizeNameForMatch(item);
    if (rawNorm === itemRawNorm || canonNorm === itemRawNorm) return true;
    if (!isExternal) {
      const itemCanonNorm = normalizeNameForMatch(normalizeConstituency(item));
      if (rawNorm === itemCanonNorm || canonNorm === itemCanonNorm) return true;
    }
  }
  return false;
}

/**
 * Returns the 0-based order index of a constituency within a split station's constituency list,
 * or 999 if not found.
 */
export function getPollingStationConstituencyOrder(
  grouping: PollingStationGrouping,
  constituencyName: string
): number {
  if (!grouping.constituencies || grouping.constituencies.length === 0) return 999;
  const isExternal = grouping.splitRegion?.toLowerCase().includes("external") || false;
  const raw = String(constituencyName || "").trim();
  const rawNorm = normalizeNameForMatch(raw);
  const canonNorm = normalizeNameForMatch(isExternal ? raw : normalizeConstituency(raw));

  for (let i = 0; i < grouping.constituencies.length; i++) {
    const item = grouping.constituencies[i];
    const itemNorm = normalizeNameForMatch(item);
    if (rawNorm === itemNorm || canonNorm === itemNorm) return i;
    if (!isExternal) {
      const itemCanonNorm = normalizeNameForMatch(normalizeConstituency(item));
      if (rawNorm === itemCanonNorm || canonNorm === itemCanonNorm) return i;
    }
  }
  return 999;
}

/**
 * Determines whether a constituency/chapter belongs to a split polling station.
 */
export function doesConstituencyMatchSplitGrouping(
  grouping: PollingStationGrouping,
  rowConstituency: string
): boolean {
  const isExternal = grouping.splitRegion?.toLowerCase().includes("external") || false;
  if (grouping.isCatchAllSplit && grouping.excludeConstituencies) {
    if (!rowConstituency || !String(rowConstituency).trim()) {
      return true;
    }
    return !matchesConstituencyList(rowConstituency, grouping.excludeConstituencies, isExternal);
  }
  if (grouping.constituencies && grouping.constituencies.length > 0) {
    return matchesConstituencyList(rowConstituency, grouping.constituencies, isExternal);
  }
  return true;
}
