export const WING_PORTFOLIOS = [
  "Youth Organisers & Deputies",
  "Women Organisers & Deputies",
  "Nasara Coordinators & Deputies",
] as const;

export const GENERAL_CONTEST_LIST = [
  "National Chairperson & General Officers",
  "Chairperson",
  "Vice Chairperson",
  "General Secretary",
  "Treasurer",
  "Communication Officer",
  "Organiser",
  "Youth Organiser",
  "Women Organiser",
  "Nasara Organiser",
  "All Men",
  "All Women",
] as const;

export const CUSTOM_CONTEST = "Custom" as const;

export const CONTEST_LIST = [
  ...WING_PORTFOLIOS,
  ...GENERAL_CONTEST_LIST,
  CUSTOM_CONTEST,
] as const;

export type ContestType = (typeof CONTEST_LIST)[number];

export interface CustomizablePosition {
  id: string;
  label: string;
  canonicalName: string;
  synonyms: string[];
}

export interface PositionCategoryGroup {
  category: string;
  positions: CustomizablePosition[];
}

export const CUSTOM_POSITION_CATEGORIES: PositionCategoryGroup[] = [
  {
    category: "Executive Leadership",
    positions: [
      { id: "chairperson", label: "Chairperson / Chairman", canonicalName: "Chairperson", synonyms: ["chairperson", "chairman", "national chairperson"] },
      { id: "1st_vice", label: "1st Vice Chairperson", canonicalName: "1st Vice Chairperson", synonyms: ["1st vice chairperson", "1st vice-chairperson", "1st vice chairman", "1st vice-chairman", "first vice chairperson"] },
      { id: "2nd_vice", label: "2nd Vice Chairperson", canonicalName: "2nd Vice Chairperson", synonyms: ["2nd vice chairperson", "2nd vice-chairperson", "2nd vice chairman", "2nd vice-chairman", "second vice chairperson"] },
    ],
  },
  {
    category: "Secretariat & Finance",
    positions: [
      { id: "secretary", label: "Secretary / General Secretary", canonicalName: "Secretary", synonyms: ["secretary", "general secretary", "constituency secretary", "regional secretary"] },
      { id: "deputy_secretary", label: "Deputy Secretary", canonicalName: "Deputy Secretary", synonyms: ["deputy secretary", "assistant secretary", "deputy general secretary"] },
      { id: "treasurer", label: "Treasurer", canonicalName: "Treasurer", synonyms: ["treasurer", "constituency treasurer", "regional treasurer", "national treasurer"] },
      { id: "financial_secretary", label: "Financial Secretary", canonicalName: "Financial Secretary", synonyms: ["financial secretary"] },
    ],
  },
  {
    category: "Operations & Field",
    positions: [
      { id: "organiser", label: "Organiser", canonicalName: "Organiser", synonyms: ["organiser", "organizer", "constituency organiser", "regional organiser", "national organiser"] },
      { id: "deputy_organiser", label: "Deputy Organiser", canonicalName: "Deputy Organiser", synonyms: ["deputy organiser", "deputy organizer", "assistant organiser"] },
    ],
  },
  {
    category: "Wings (Youth, Women & Nasara)",
    positions: [
      { id: "women_organiser", label: "Women Organiser", canonicalName: "Women Organiser", synonyms: ["women organiser", "women organizer", "women's organiser", "women's organizer", "national women organiser"] },
      { id: "deputy_women_organiser", label: "Deputy Women Organiser", canonicalName: "Deputy Women Organiser", synonyms: ["deputy women organiser", "deputy women organizer", "deputy women", "assistant women organiser"] },
      { id: "youth_organiser", label: "Youth Organiser", canonicalName: "Youth Organiser", synonyms: ["youth organiser", "youth organizer", "national youth organiser"] },
      { id: "deputy_youth_organiser", label: "Deputy Youth Organiser", canonicalName: "Deputy Youth Organiser", synonyms: ["deputy youth organiser", "deputy youth organizer", "deputy youth", "assistant youth organiser"] },
      { id: "nasara_coordinator", label: "Nasara Coordinator / Organiser", canonicalName: "Nasara Coordinator", synonyms: ["nasara coordinator", "nasara organiser", "nasara organizer", "national nasara organiser"] },
      { id: "deputy_nasara_coordinator", label: "Deputy Nasara Coordinator", canonicalName: "Deputy Nasara Coordinator", synonyms: ["deputy nasara coordinator", "deputy nasara organiser", "deputy nasara organizer", "deputy nasara", "assistant nasara coordinator"] },
    ],
  },
  {
    category: "Communications & Strategy",
    positions: [
      { id: "communication_officer", label: "Communication Officer", canonicalName: "Communication Officer", synonyms: ["communication officer", "communications officer", "communication director"] },
      { id: "electoral_affairs", label: "Electoral Affairs Officer", canonicalName: "Electoral Affairs Officer", synonyms: ["electoral affairs officer", "electoral affairs", "elections officer", "director of research and elections", "director of elections"] },
      { id: "research_officer", label: "Research Officer", canonicalName: "Research Officer", synonyms: ["research officer", "director of research"] },
    ],
  },
  {
    category: "Inclusion & Representation",
    positions: [
      { id: "pwd_officer", label: "PWD Officer / Coordinator", canonicalName: "PWD Officer", synonyms: ["pwd officer", "pwd coordinator", "pwd", "disability officer"] },
      { id: "special_duties", label: "Special Duties Officer", canonicalName: "Special Duties Officer", synonyms: ["special duties officer", "special duties"] },
      { id: "legal_officer", label: "Legal Representative Officer", canonicalName: "Legal Representative Officer", synonyms: ["legal representative officer", "legal affairs officer", "legal officer"] },
    ],
  },
  {
    category: "Campus Institutions (TESCON)",
    positions: [
      { id: "tescon_president", label: "TESCON President", canonicalName: "TESCON President", synonyms: ["tescon president", "president"] },
      { id: "tescon_wocom", label: "TESCON WOCOM", canonicalName: "TESCON WOCOM", synonyms: ["tescon wocom", "wocom", "women commissioner"] },
      { id: "tescon_nasara", label: "TESCON Nasara Coordinator", canonicalName: "TESCON Nasara Coordinator", synonyms: ["tescon nasara coordinator", "tescon nasara"] },
    ],
  },
  {
    category: "Parliamentary Group",
    positions: [
      { id: "member_of_parliament", label: "Member of Parliament (MP)", canonicalName: "Member of Parliament", synonyms: ["member of parliament", "mp", "sitting mp", "parliamentarian"] },
    ],
  },
  {
    category: "Party Councils & Founders",
    positions: [
      { id: "national_council_rep", label: "National Council Representative", canonicalName: "National Council Representative", synonyms: ["national council representative", "national council rep", "national council"] },
      { id: "foundation_member", label: "Foundation Member", canonicalName: "Foundation Member", synonyms: ["foundation member"] },
      { id: "council_of_elders", label: "National Council of Elders", canonicalName: "National Council of Elders", synonyms: ["council of elders", "national council of elders", "elder", "past national officer"] },
      { id: "council_of_patrons", label: "National Council of Patrons", canonicalName: "National Council of Patrons", synonyms: ["council of patrons", "national council of patrons", "patron"] },
    ],
  },
];

export const ALL_CUSTOMIZABLE_POSITIONS: CustomizablePosition[] =
  CUSTOM_POSITION_CATEGORIES.flatMap((c) => c.positions);

export const POSITION_PRESETS = {
  core_slate: {
    label: "Core Slate (Top 5)",
    ids: ["chairperson", "1st_vice", "secretary", "treasurer", "organiser"],
  },
  key_officers: {
    label: "Key Officers (Top 10)",
    ids: [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "organiser",
      "women_organiser",
      "youth_organiser",
      "nasara_coordinator",
    ],
  },
  wings_only: {
    label: "Wing Executives",
    ids: [
      "women_organiser",
      "deputy_women_organiser",
      "youth_organiser",
      "deputy_youth_organiser",
      "nasara_coordinator",
      "deputy_nasara_coordinator",
    ],
  },
  youth_wing: {
    label: "Youth Wing (Organisers & Deputies)",
    ids: ["youth_organiser", "deputy_youth_organiser"],
  },
  youth_substantive: {
    label: "Youth Organisers Only (Substantive)",
    ids: ["youth_organiser"],
  },
  youth_deputies: {
    label: "Deputy Youth Organisers Only",
    ids: ["deputy_youth_organiser"],
  },
  constituency_slate: {
    label: "Full Constituency Slate (19)",
    ids: [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "financial_secretary",
      "organiser",
      "deputy_organiser",
      "women_organiser",
      "deputy_women_organiser",
      "youth_organiser",
      "deputy_youth_organiser",
      "nasara_coordinator",
      "deputy_nasara_coordinator",
      "communication_officer",
      "electoral_affairs",
      "research_officer",
      "pwd_officer",
    ],
  },
  elected_constituency: {
    label: "Elected Only (11)",
    ids: [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "financial_secretary",
      "organiser",
      "women_organiser",
      "youth_organiser",
      "nasara_coordinator",
    ],
  },
  appointed_constituency: {
    label: "Appointed Only (8)",
    ids: [
      "deputy_organiser",
      "deputy_women_organiser",
      "deputy_youth_organiser",
      "deputy_nasara_coordinator",
      "communication_officer",
      "electoral_affairs",
      "research_officer",
      "pwd_officer",
    ],
  },
  regional_rec_17: {
    label: "Regional Executive Committee (17)",
    ids: [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "financial_secretary",
      "organiser",
      "deputy_organiser",
      "women_organiser",
      "deputy_women_organiser",
      "youth_organiser",
      "deputy_youth_organiser",
      "nasara_coordinator",
      "deputy_nasara_coordinator",
      "communication_officer",
      "research_officer",
    ],
  },
  regional_slate: {
    label: "Full Regional Slate (21)",
    ids: [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "financial_secretary",
      "organiser",
      "deputy_organiser",
      "women_organiser",
      "deputy_women_organiser",
      "youth_organiser",
      "deputy_youth_organiser",
      "nasara_coordinator",
      "deputy_nasara_coordinator",
      "communication_officer",
      "electoral_affairs",
      "research_officer",
      "pwd_officer",
      "special_duties",
      "legal_officer",
    ],
  },
  deputies_only: {
    label: "Deputies Only",
    ids: [
      "1st_vice",
      "2nd_vice",
      "deputy_secretary",
      "deputy_organiser",
      "deputy_women_organiser",
      "deputy_youth_organiser",
      "deputy_nasara_coordinator",
    ],
  },
  councils_and_mps: {
    label: "MPs, Council & Founders",
    ids: [
      "member_of_parliament",
      "national_council_rep",
      "foundation_member",
    ],
  },
  regional_leadership: {
    label: "Regional Leadership (24)",
    ids: [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "financial_secretary",
      "organiser",
      "deputy_organiser",
      "women_organiser",
      "deputy_women_organiser",
      "youth_organiser",
      "deputy_youth_organiser",
      "nasara_coordinator",
      "deputy_nasara_coordinator",
      "communication_officer",
      "electoral_affairs",
      "research_officer",
      "pwd_officer",
      "special_duties",
      "legal_officer",
      "national_council_rep",
      "foundation_member",
      "member_of_parliament",
    ],
  },
} as const;

export const CONSTITUENCY_POSITION_IDS = new Set<string>(POSITION_PRESETS.constituency_slate.ids);
export const REGIONAL_POSITION_IDS = new Set<string>(POSITION_PRESETS.regional_slate.ids);
export const REGIONAL_SLATE_21_IDS = new Set<string>(POSITION_PRESETS.regional_slate.ids);
export const REGIONAL_REC_17_IDS = new Set<string>(POSITION_PRESETS.regional_rec_17.ids);

export const DEPUTY_POSITION_IDS = new Set<string>([
  "1st_vice",
  "2nd_vice",
  "deputy_secretary",
  "deputy_organiser",
  "deputy_women_organiser",
  "deputy_youth_organiser",
  "deputy_nasara_coordinator",
]);

export const APPOINTED_POSITION_IDS = new Set<string>([
  "deputy_organiser",
  "deputy_women_organiser",
  "deputy_youth_organiser",
  "deputy_nasara_coordinator",
  "communication_officer",
  "electoral_affairs",
  "research_officer",
  "pwd_officer",
]);

export const FULL_EXECUTIVE_POSITION_IDS: string[] = [
  "chairperson",
  "1st_vice",
  "2nd_vice",
  "secretary",
  "deputy_secretary",
  "treasurer",
  "financial_secretary",
  "organiser",
  "deputy_organiser",
  "women_organiser",
  "deputy_women_organiser",
  "youth_organiser",
  "deputy_youth_organiser",
  "nasara_coordinator",
  "deputy_nasara_coordinator",
  "communication_officer",
  "electoral_affairs",
  "research_officer",
  "pwd_officer",
  "special_duties",
  "legal_officer",
  "tescon_president",
  "member_of_parliament",
  "national_council_rep",
  "foundation_member",
];

export function getDefaultPositionIdsForContest(
  contest: ContestType | string,
  scope: string = "all_voters"
): string[] {
  const normContest = String(contest || "").trim().toLowerCase();

  // 1. Youth Wing (Organisers & Deputies)
  if (
    normContest === "youth organisers & deputies" ||
    (normContest.includes("youth") && scope === "organisers_only")
  ) {
    return ["youth_organiser", "deputy_youth_organiser", "tescon_president"];
  }

  // 2. Youth Organiser (National Contest - All eligible youth voters)
  // TESCON WOCOM and TESCON Nasara are strictly excluded from Youth
  if (normContest === "youth organiser" || normContest.includes("youth")) {
    return [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "financial_secretary",
      "organiser",
      "deputy_organiser",
      "youth_organiser",
      "deputy_youth_organiser",
      "women_organiser",
      "deputy_women_organiser",
      "nasara_coordinator",
      "deputy_nasara_coordinator",
      "communication_officer",
      "electoral_affairs",
      "research_officer",
      "pwd_officer",
      "special_duties",
      "legal_officer",
      "tescon_president",
      "member_of_parliament",
      "national_council_rep",
      "foundation_member",
    ];
  }

  // 3. Women Wing (Organisers & Deputies)
  if (
    normContest === "women organisers & deputies" ||
    (normContest.includes("women") && scope === "organisers_only")
  ) {
    return ["women_organiser", "deputy_women_organiser", "tescon_wocom"];
  }

  // 4. Women Organiser (National Contest - All eligible female executives)
  if (
    normContest === "women organiser" ||
    normContest === "all women" ||
    normContest.includes("women")
  ) {
    return [
      "chairperson",
      "1st_vice",
      "2nd_vice",
      "secretary",
      "deputy_secretary",
      "treasurer",
      "financial_secretary",
      "organiser",
      "deputy_organiser",
      "women_organiser",
      "deputy_women_organiser",
      "youth_organiser",
      "deputy_youth_organiser",
      "nasara_coordinator",
      "deputy_nasara_coordinator",
      "communication_officer",
      "electoral_affairs",
      "research_officer",
      "pwd_officer",
      "special_duties",
      "legal_officer",
      "tescon_wocom",
      "tescon_president",
      "tescon_nasara",
      "member_of_parliament",
      "national_council_rep",
      "foundation_member",
    ];
  }

  // 5. Nasara Coordinators & Deputies
  if (
    normContest === "nasara coordinators & deputies" ||
    normContest === "nasara organiser" ||
    normContest.includes("nasara")
  ) {
    return ["nasara_coordinator", "deputy_nasara_coordinator", "tescon_nasara"];
  }

  // 6. Custom Contest
  if (normContest === "custom") {
    return [...POSITION_PRESETS.constituency_slate.ids];
  }

  // 7. General Contests / National Chairperson / All Men
  return [...FULL_EXECUTIVE_POSITION_IDS];
}

export function isRegionalTescon(r: {
  position?: string | null;
  polling_station?: string | null;
  executive_level?: string | null;
}): boolean {
  if (!r) return false;
  const pos = String(r.position || "").trim().toLowerCase();
  const ps = String(r.polling_station || "").trim().toLowerCase();
  const lvl = String(r.executive_level || "").trim().toLowerCase();

  // Regional level never has TESCON officers in the electoral college
  if ((lvl === "region" || lvl === "regional") && /tescon/i.test(pos)) {
    return true;
  }

  // Position is Regional TESCON Coordinator or variant
  if (
    pos.includes("regional tescon") ||
    pos.includes("tescon regional") ||
    pos.includes("tescon coordinator") ||
    pos.includes("tescon cordinator") ||
    /regional.*tescon/i.test(pos) ||
    /tescon.*coord/i.test(pos)
  ) {
    return true;
  }

  // Polling station / Institution is "REGIONAL TESCON COORDINATOR", "Western Regional TESCON", etc.
  // Note: Regional Maritime University is an accredited tertiary institution, not Regional TESCON
  const isBonaFideInstitution =
    /university|college|polytechnic|institute|school|academy/i.test(ps) &&
    !/regional.*tescon|tescon.*regional/i.test(ps);

  if (!isBonaFideInstitution) {
    if (
      ps.includes("regional tescon") ||
      ps.includes("tescon regional") ||
      ps.includes("western regional tescon") ||
      ps.includes("tescon coordinator") ||
      ps.includes("tescon cordinator") ||
      /regional.*tescon/i.test(ps) ||
      /tescon.*coord/i.test(ps) ||
      (lvl === "tescon" &&
        (/^regional tescon/i.test(ps) ||
          /tescon.*regional/i.test(ps) ||
          /tescon cordinator/i.test(ps)))
    ) {
      return true;
    }
  }

  return false;
}

export function isRecognizedRegionalExecutive(pos: string | null | undefined): boolean {
  const s = String(pos || "").trim().toLowerCase();
  if (
    s.includes("tescon") ||
    /regional.*tescon/i.test(s) ||
    /tescon.*regional/i.test(s)
  ) {
    return false;
  }
  return true;
}

export const isStatutoryRegionalREC = isRecognizedRegionalExecutive;

export function isElectedRegionalPosition(pos: string | null | undefined): boolean {
  const s = String(pos || "").trim().toLowerCase();
  if (!isRecognizedRegionalExecutive(pos)) return false;
  // The 10 elected regional officers: Chairperson, 1st Vice, 2nd Vice, Secretary, Assistant/Deputy Secretary, Treasurer, Organiser, Women Organiser, Youth Organiser, Nasara Coordinator
  // The 11 appointed functional regional officers:
  if (
    s.includes("financial secretary") ||
    s.includes("deputy organiser") ||
    s.includes("deputy organizer") ||
    s.includes("deputy women") ||
    s.includes("deputy youth") ||
    s.includes("deputy nasara") ||
    s.includes("communication") ||
    s.includes("research") ||
    s.includes("electoral affairs") ||
    s.includes("pwd") ||
    s.includes("disability") ||
    s.includes("special duties") ||
    s.includes("legal")
  ) {
    return false;
  }
  return true;
}

export function isElectedConstituencyPosition(pos: string | null | undefined): boolean {
  const s = String(pos || "").trim().toLowerCase();
  // In NPP at constituency level, all Secretary positions (Secretary, Assistant/Deputy Secretary, Financial Secretary) are ELECTED
  if (s.includes("secretary")) return true;
  // Other deputies / assistants are appointed
  if (s.includes("deputy") || s.includes("assistant")) return false;
  // Appointed / co-opted portfolio officers
  if (
    s.includes("communication") ||
    s.includes("electoral") ||
    s.includes("research") ||
    s.includes("pwd") ||
    s.includes("disability") ||
    s.includes("special duties") ||
    s.includes("legal")
  ) {
    return false;
  }
  return true;
}

export function normalizeCanonicalPosition(pos: string | null, level: string | null): string {
  const s = String(pos || "").trim().toLowerCase();
  const lvl = String(level || "").toLowerCase();

  // 1. Dignitaries & Former Officers
  if (s.includes("former president")) return "Former President";
  if (s.includes("vice president") || s.includes("flagbearer")) return pos || "Current Flagbearer / Former Vice President";
  if (s.includes("running mate")) return "Former Running Mate";
  if (s.includes("past national chairman") || s.includes("past national chairperson")) return "Past National Chairman";
  if (s.includes("past general secretary")) return "Past General Secretary";
  if (s.includes("past national officer") || s.includes("council of elders")) return pos || "Council of Elders / Past National Officer";
  if (s.includes("national council representative")) return "National Council Representative";
  if (s.includes("national council of patrons")) return "National Council of Patrons";
  if (s.includes("national council of elders")) return "National Council of Elders";
  if (s.includes("foundation member")) return "Foundation Member";
  if (s.includes("member of parliament") || s === "mp" || /\bmp\b/i.test(s) || s.includes("parliamentarian")) {
    return "Member of Parliament";
  }

  // 2. Legal Committee & Legal Affairs
  if (s.includes("chairman of the legal committee") || (s.includes("legal committee") && s.includes("chair"))) {
    return "Chairman of The Legal Committee";
  }
  if (s.includes("director of legal affairs") || s.includes("director of legal")) {
    return "Director of Legal Affairs";
  }

  // 3. National Directors & Specialized Officers
  if (s.includes("director of elections") || s.includes("director of research and elections")) {
    return lvl === "national" ? "Director of Elections" : "Electoral Affairs Officer";
  }
  if (s.includes("director of research")) {
    return lvl === "national" ? "Director of Research" : "Research Officer";
  }
  if (s.includes("director of finance")) {
    return "Director of Finance and Administration";
  }
  if (s.includes("deputy communication director") || (lvl === "national" && s.includes("deputy") && s.includes("communication"))) {
    return "Deputy Communication Director";
  }
  if (s.includes("national communication director") || (lvl === "national" && s.includes("communication"))) {
    return "National Communication Director";
  }
  if (s.includes("deputy director of it") || s.includes("deputy it director")) {
    return "Deputy Director of IT";
  }
  if (s.includes("director of it") || s.includes("it director")) {
    return "Director of IT";
  }
  if (s.includes("deputy director of protocol") || s.includes("deputy protocol director")) {
    return "Deputy Director of Protocol";
  }
  if (s.includes("director of protocol") || s.includes("protocol director")) {
    return "Director of Protocol";
  }
  if (s.includes("deputy external relations")) {
    return "Deputy External Relations Officer";
  }
  if (s.includes("external relations")) {
    return "External Relations Officer";
  }

  // 4. Wings (Youth, Women, Nasara, Organiser) & Deputies
  if (lvl === "national") {
    if (s.includes("deputy") && s.includes("youth")) return "Deputy National Youth Organiser";
    if (s.includes("youth")) return "National Youth Organiser";
    if (s.includes("deputy") && s.includes("women")) return "Deputy National Women Organiser";
    if (s.includes("women")) return "National Women Organiser";
    // Nasara must be checked BEFORE generic organiser (both contain "organiser")
    if (s.includes("deputy") && s.includes("nasara")) return "Deputy National Nasara Coordinator";
    if (s.includes("nasara")) return "National Nasara Coordinator";
    if (s.includes("deputy") && (s.includes("organiser") || s.includes("organizer"))) return "Deputy National Organiser";
    if (s.includes("organiser") || s.includes("organizer")) return "National Organiser";
    if (s.includes("deputy") && s.includes("treasurer")) return "Deputy National Treasurer";
    if (s.includes("treasurer")) return "National Treasurer";
  } else {
    if (s.includes("deputy") && s.includes("youth")) return "Deputy Youth Organiser";
    if (s.includes("youth")) return "Youth Organiser";
    if (s.includes("deputy") && s.includes("women")) return "Deputy Women Organiser";
    if (s.includes("women")) return "Women Organiser";
    // Nasara must be checked BEFORE generic organiser (both contain "organiser")
    const isRegionalTier = lvl === "region" || lvl === "regional";
    if (s.includes("deputy") && s.includes("nasara")) return isRegionalTier ? "Deputy Nasara Coordinator" : "Deputy Nasara Organiser";
    if (s.includes("nasara")) return isRegionalTier ? "Nasara Coordinator" : "Nasara Organiser";
    if (s.includes("deputy") && (s.includes("organiser") || s.includes("organizer"))) return "Deputy Organiser";
    if (s.includes("organiser") || s.includes("organizer")) return "Organiser";
    if (s.includes("treasurer")) return "Treasurer";
  }

  // 5. Chairpersons & Vice Chairpersons
  if (s.includes("chairperson") || s.includes("chairman")) {
    if (s.includes("1st") || s.includes("first")) return "1st Vice Chairperson";
    if (s.includes("2nd") || s.includes("second")) return "2nd Vice Chairperson";
    if (s.includes("3rd") || s.includes("third")) return "3rd Vice Chairperson";
    return lvl === "national" ? "National Chairperson" : "Chairperson";
  }

  // 6. Secretariat & Financial Secretary
  if (s.includes("financial secretary")) return "Financial Secretary";
  if (s.includes("deputy general secretary")) return "Deputy General Secretary";
  if (s.includes("deputy secretary") || s.includes("assistant secretary")) return "Deputy Secretary";
  if (s.includes("secretary")) return lvl === "national" ? "General Secretary" : "Secretary";

  // 7. General Officers & TESCON
  if (s.includes("wocom")) return "TESCON WOCOM";
  if ((lvl === "tescon" || s.includes("tescon")) && s.includes("president")) return "TESCON President";
  if (lvl === "national" && s.includes("president")) return "President";
  if (s.includes("pwd") || s.includes("disability")) return lvl === "region" || lvl === "national" ? "PWD Officer" : "PWD Coordinator";
  if (s.includes("special duties")) return "Special Duties Officer";
  if (s.includes("legal")) return "Legal Representative Officer";
  if (s.includes("electoral") || s.includes("elections")) return "Electoral Affairs Officer";
  if (s.includes("communication")) return "Communication Officer";
  if (s.includes("research")) return "Research Officer";

  return pos || "Executive Member";
}

export function getCanonicalPositionsForSelection(selected: string[]): {
  canonicalSet: Set<string>;
  displayLabels: string[];
  isTesconNasaraIncluded: boolean;
} {
  const canonicalSet = new Set<string>();
  const displayLabels: string[] = [];
  let isTesconNasaraIncluded = false;

  const lookup = new Map<string, CustomizablePosition>();
  for (const pos of ALL_CUSTOMIZABLE_POSITIONS) {
    lookup.set(pos.id.toLowerCase(), pos);
    lookup.set(pos.canonicalName.toLowerCase(), pos);
    lookup.set(pos.label.toLowerCase(), pos);
    for (const syn of pos.synonyms) {
      lookup.set(syn.toLowerCase(), pos);
    }
  }

  const CANONICAL_MAP: Record<string, string[]> = {
    chairperson: ["Chairperson", "National Chairperson", "Past National Chairman", "Chairman of The Legal Committee"],
    "1st_vice": ["1st Vice Chairperson"],
    "2nd_vice": ["2nd Vice Chairperson", "3rd Vice Chairperson"],
    secretary: ["Secretary", "General Secretary", "Past General Secretary"],
    deputy_secretary: ["Deputy Secretary", "Deputy General Secretary"],
    treasurer: ["Treasurer", "National Treasurer", "Deputy National Treasurer"],
    financial_secretary: ["Financial Secretary"],
    organiser: ["Organiser", "National Organiser"],
    deputy_organiser: ["Deputy Organiser", "Deputy National Organiser"],
    women_organiser: ["Women Organiser", "National Women Organiser"],
    deputy_women_organiser: ["Deputy Women Organiser", "Deputy National Women Organiser"],
    youth_organiser: ["Youth Organiser", "National Youth Organiser"],
    deputy_youth_organiser: ["Deputy Youth Organiser", "Deputy National Youth Organiser"],
    nasara_coordinator: ["Nasara Coordinator", "Nasara Organiser", "National Nasara Coordinator", "National Nasara Organiser"],
    deputy_nasara_coordinator: ["Deputy Nasara Coordinator", "Deputy Nasara Organiser", "Deputy National Nasara Coordinator", "Deputy National Nasara Organiser"],
    communication_officer: ["Communication Officer", "National Communication Director", "Deputy Communication Director"],
    electoral_affairs: ["Electoral Affairs Officer", "Director of Elections", "Director of Research and Elections"],
    research_officer: ["Research Officer", "Director of Research"],
    pwd_officer: ["PWD Officer", "PWD Coordinator"],
    special_duties: ["Special Duties Officer"],
    legal_officer: ["Legal Representative Officer", "Director of Legal Affairs", "Chairman of The Legal Committee"],
    tescon_president: ["TESCON President"],
    tescon_wocom: ["TESCON WOCOM"],
    tescon_nasara: ["Nasara Coordinator", "Nasara Organiser", "TESCON Nasara Coordinator"],
    member_of_parliament: ["Member of Parliament"],
    national_council_rep: ["National Council Representative"],
    foundation_member: ["Foundation Member"],
    council_of_elders: ["National Council of Elders", "Council of Elders / Past National Officer", "Council of Elders"],
    council_of_patrons: ["National Council of Patrons"],
  };

  const processedIds = new Set<string>();

  for (const item of selected) {
    const raw = String(item || "").trim();
    if (!raw) continue;
    const lower = raw.toLowerCase();
    const matchedDef = lookup.get(lower);

    if (matchedDef) {
      if (!processedIds.has(matchedDef.id)) {
        processedIds.add(matchedDef.id);
        displayLabels.push(matchedDef.label.split(" / ")[0]);
        const canons = CANONICAL_MAP[matchedDef.id] || [matchedDef.canonicalName];
        for (const c of canons) canonicalSet.add(c);
        if (matchedDef.id === "tescon_nasara") {
          isTesconNasaraIncluded = true;
        }
      }
    } else {
      canonicalSet.add(raw);
      displayLabels.push(raw);
    }
  }

  return { canonicalSet, displayLabels, isTesconNasaraIncluded };
}

export interface CustomizableLevel {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const ALL_CUSTOMIZABLE_LEVELS: CustomizableLevel[] = [
  {
    id: "National",
    label: "National Council / Executives",
    shortLabel: "National",
    description: "National council & executive committee leadership",
  },
  {
    id: "Regional",
    label: "Regional Executives (16 Regions)",
    shortLabel: "Regional",
    description: "All 16 regional executive committees",
  },
  {
    id: "Constituency",
    label: "Constituency Executives (276 Constituencies)",
    shortLabel: "Constituency",
    description: "All 276 constituency executive committees in Ghana",
  },
  {
    id: "External Branch",
    label: "External Branches (Diaspora Chapters)",
    shortLabel: "External Branch",
    description: "Accredited diaspora chapters worldwide",
  },
  {
    id: "TESCON",
    label: "TESCON (Campus Institutions)",
    shortLabel: "TESCON",
    description: "Accredited tertiary institution chapters",
  },
];

export const LEVEL_PRESETS = {
  all_levels: {
    label: "All Levels (Full College)",
    ids: ["National", "Regional", "Constituency", "External Branch", "TESCON"],
  },
  regional_only: {
    label: "Regional Only",
    ids: ["Regional"],
  },
  constituency_only: {
    label: "Constituency Only",
    ids: ["Constituency"],
  },
  branches_only: {
    label: "External Branches Only",
    ids: ["External Branch"],
  },
  tescon_only: {
    label: "TESCON Only",
    ids: ["TESCON"],
  },
  core_executives: {
    label: "Regional + Constituency",
    ids: ["Regional", "Constituency"],
  },
} as const;

export type LevelPresetKey = keyof typeof LEVEL_PRESETS;

export interface ElectoralJurisdiction {
  id: string;
  name: string;
  shortName: string;
  belt: "Southern" | "Middle" | "Northern" | "Special";
  constituencies?: number;
  description?: string;
}

export const ALL_ELECTORAL_JURISDICTIONS: ElectoralJurisdiction[] = [
  { id: "Ahafo", name: "Ahafo Region", shortName: "Ahafo", belt: "Middle", constituencies: 6, description: "Middle Belt · 6 Constituencies" },
  { id: "Ashanti", name: "Ashanti Region", shortName: "Ashanti", belt: "Middle", constituencies: 47, description: "Middle Belt · 47 Constituencies" },
  { id: "Bono", name: "Bono Region", shortName: "Bono", belt: "Middle", constituencies: 12, description: "Middle Belt · 12 Constituencies" },
  { id: "Bono East", name: "Bono East Region", shortName: "Bono East", belt: "Middle", constituencies: 11, description: "Middle Belt · 11 Constituencies" },
  { id: "Central", name: "Central Region", shortName: "Central", belt: "Southern", constituencies: 23, description: "Southern Belt · 23 Constituencies" },
  { id: "Eastern", name: "Eastern Region", shortName: "Eastern", belt: "Southern", constituencies: 33, description: "Southern Belt · 33 Constituencies" },
  { id: "Greater Accra", name: "Greater Accra Region", shortName: "Greater Accra", belt: "Southern", constituencies: 34, description: "Southern Belt · 34 Constituencies" },
  { id: "North East", name: "North East Region", shortName: "North East", belt: "Northern", constituencies: 6, description: "Northern Belt · 6 Constituencies" },
  { id: "Northern", name: "Northern Region", shortName: "Northern", belt: "Northern", constituencies: 18, description: "Northern Belt · 18 Constituencies" },
  { id: "Oti", name: "Oti Region", shortName: "Oti", belt: "Southern", constituencies: 9, description: "Southern Belt · 9 Constituencies" },
  { id: "Savannah", name: "Savannah Region", shortName: "Savannah", belt: "Northern", constituencies: 7, description: "Northern Belt · 7 Constituencies" },
  { id: "Upper East", name: "Upper East Region", shortName: "Upper East", belt: "Northern", constituencies: 15, description: "Northern Belt · 15 Constituencies" },
  { id: "Upper West", name: "Upper West Region", shortName: "Upper West", belt: "Northern", constituencies: 11, description: "Northern Belt · 11 Constituencies" },
  { id: "Volta", name: "Volta Region", shortName: "Volta", belt: "Southern", constituencies: 18, description: "Southern Belt · 18 Constituencies" },
  { id: "Western", name: "Western Region", shortName: "Western", belt: "Southern", constituencies: 17, description: "Southern Belt · 17 Constituencies" },
  { id: "Western North", name: "Western North Region", shortName: "Western North", belt: "Middle", constituencies: 9, description: "Middle Belt · 9 Constituencies" },
  { id: "External Branch", name: "External Branches (Diaspora)", shortName: "External Branch", belt: "Special", constituencies: 30, description: "Diaspora Chapters · 30 Countries" },
  { id: "National Headquarters", name: "National Headquarters (Council & Officers)", shortName: "National HQ", belt: "Special", description: "National Council & Party Headquarters" },
];

export const ALL_JURISDICTION_IDS = ALL_ELECTORAL_JURISDICTIONS.map((j) => j.id);

export const JURISDICTION_PRESETS = {
  all: {
    label: "All Ghana (18 Jurisdictions)",
    ids: [...ALL_JURISDICTION_IDS],
  },
  sixteen_regions: {
    label: "16 Administrative Regions",
    ids: ALL_ELECTORAL_JURISDICTIONS.filter((j) => j.belt !== "Special").map((j) => j.id),
  },
  southern_belt: {
    label: "Southern Belt (6 Regions)",
    ids: ["Central", "Eastern", "Greater Accra", "Oti", "Volta", "Western"],
  },
  middle_belt: {
    label: "Middle Belt (5 Regions)",
    ids: ["Ahafo", "Ashanti", "Bono", "Bono East", "Western North"],
  },
  northern_belt: {
    label: "Northern Belt (5 Regions)",
    ids: ["Northern", "North East", "Savannah", "Upper East", "Upper West"],
  },
  diaspora_and_hq: {
    label: "Diaspora & National HQ",
    ids: ["External Branch", "National Headquarters"],
  },
} as const;

export type JurisdictionPresetKey = keyof typeof JURISDICTION_PRESETS;

export type VoterDetailField =
  | "photo"
  | "name"
  | "position"
  | "level"
  | "voter_id"
  | "phone"
  | "institution"
  | "demographics"
  | "polling_station";

export interface VoterDetailDefinition {
  id: VoterDetailField;
  label: string;
  shortLabel: string;
  description: string;
  category: "identity" | "electoral" | "contact";
  isStandard: boolean;
}

export const ALL_VOTER_DETAILS: VoterDetailDefinition[] = [
  {
    id: "photo",
    label: "Portrait Photo",
    shortLabel: "Photo",
    description: "Official portrait or biometric avatar image",
    category: "identity",
    isStandard: true,
  },
  {
    id: "name",
    label: "Executive Full Name",
    shortLabel: "Name",
    description: "Official executive name in full capital letters",
    category: "identity",
    isStandard: true,
  },
  {
    id: "position",
    label: "Portfolio / Position Badge",
    shortLabel: "Position",
    description: "Canonical executive portfolio badge",
    category: "electoral",
    isStandard: true,
  },
  {
    id: "level",
    label: "Administrative Level & Jurisdiction",
    shortLabel: "Level / Jurisdiction",
    description: "Level (National, Regional, Constituency) with constituency jurisdiction",
    category: "electoral",
    isStandard: true,
  },
  {
    id: "voter_id",
    label: "EC Voter ID Number",
    shortLabel: "Voter ID",
    description: "10-digit official Electoral Commission voter ID",
    category: "identity",
    isStandard: true,
  },
  {
    id: "phone",
    label: "Telephone / Contact Number",
    shortLabel: "Phone",
    description: "Executive contact telephone number",
    category: "contact",
    isStandard: true,
  },
  {
    id: "institution",
    label: "Campus Institution (TESCON)",
    shortLabel: "Institution",
    description: "Tertiary campus chapter for TESCON delegates",
    category: "electoral",
    isStandard: true,
  },
  {
    id: "demographics",
    label: "Demographics (Gender & Age)",
    shortLabel: "Demographics",
    description: "Gender and calculated age in years",
    category: "identity",
    isStandard: false,
  },
  {
    id: "polling_station",
    label: "Polling Station Code / Name",
    shortLabel: "Polling Station",
    description: "Registered voting station or center",
    category: "electoral",
    isStandard: false,
  },
];

export const DEFAULT_VOTER_DETAILS: VoterDetailField[] = [
  "photo",
  "name",
  "position",
  "level",
  "voter_id",
  "phone",
  "institution",
];

export const VOTER_DETAIL_PRESETS = {
  default_standard: {
    label: "Standard Album (Default)",
    description: "All 7 standard card details (Photo, Name, Position, Level, Voter ID, Phone, Institution)",
    ids: ["photo", "name", "position", "level", "voter_id", "phone", "institution"] as VoterDetailField[],
  },
  id_verification: {
    label: "ID Verification",
    description: "Key electoral roll fields (Photo, Name, Position, Level, Voter ID)",
    ids: ["photo", "name", "position", "level", "voter_id"] as VoterDetailField[],
  },
  photo_badge: {
    label: "Accreditation / Photo Badge",
    description: "Badge fields (Photo, Name, Position, Voter ID)",
    ids: ["photo", "name", "position", "voter_id"] as VoterDetailField[],
  },
  contact_directory: {
    label: "Contact Directory",
    description: "Directory roster (Name, Position, Level, Phone)",
    ids: ["name", "position", "level", "phone"] as VoterDetailField[],
  },
  full_profile: {
    label: "Full Profile (All 9)",
    description: "Includes Demographics and Polling Station",
    ids: [
      "photo",
      "name",
      "position",
      "level",
      "voter_id",
      "phone",
      "institution",
      "demographics",
      "polling_station",
    ] as VoterDetailField[],
  },
} as const;

export type VoterDetailPresetKey = keyof typeof VOTER_DETAIL_PRESETS;

const VALID_VOTER_DETAIL_SET = new Set<string>(
  ALL_VOTER_DETAILS.map((d) => d.id.toLowerCase())
);

export function parseVoterDetails(param?: string | null): Set<VoterDetailField> {
  if (param === undefined || param === null) {
    return new Set(DEFAULT_VOTER_DETAILS);
  }
  const raw = String(param).trim().toLowerCase();
  if (raw === "" || raw === "default" || raw === "standard") {
    return new Set(DEFAULT_VOTER_DETAILS);
  }
  if (raw === "all") {
    return new Set(ALL_VOTER_DETAILS.map((d) => d.id));
  }
  if (raw === "none" || raw === "empty") {
    return new Set<VoterDetailField>();
  }

  const result = new Set<VoterDetailField>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim().toLowerCase();
    if (VALID_VOTER_DETAIL_SET.has(trimmed)) {
      result.add(trimmed as VoterDetailField);
    }
  }
  return result;
}
