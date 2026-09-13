export const WING_PORTFOLIOS = [
  "Youth Organisers & Deputies",
  "Women Organisers & Deputies",
  "Nasara Coordinators & Deputies",
] as const;

export const GENERAL_CONTEST_LIST = [
  "Chairperson",
  "Vice Chairperson",
  "General Secretary",
  "Treasurer",
  "Communication Officer",
  "Organiser",
  "Youth Organiser",
  "Women Organiser",
  "Nasara Organiser",
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
      { id: "electoral_affairs", label: "Electoral Affairs Officer", canonicalName: "Electoral Affairs Officer", synonyms: ["electoral affairs officer", "electoral affairs", "elections officer", "director of research and elections"] },
      { id: "research_officer", label: "Research Officer", canonicalName: "Research Officer", synonyms: ["research officer"] },
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
  constituency_slate: {
    label: "Full Constituency Slate (17)",
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
} as const;

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
    chairperson: ["Chairperson", "National Chairperson"],
    "1st_vice": ["1st Vice Chairperson"],
    "2nd_vice": ["2nd Vice Chairperson", "3rd Vice Chairperson"],
    secretary: ["Secretary", "General Secretary"],
    deputy_secretary: ["Deputy Secretary", "Deputy General Secretary"],
    treasurer: ["Treasurer"],
    financial_secretary: ["Financial Secretary"],
    organiser: ["Organiser"],
    deputy_organiser: ["Deputy Organiser"],
    women_organiser: ["Women Organiser"],
    deputy_women_organiser: ["Deputy Women Organiser"],
    youth_organiser: ["Youth Organiser"],
    deputy_youth_organiser: ["Deputy Youth Organiser"],
    nasara_coordinator: ["Nasara Coordinator", "Nasara Organiser"],
    deputy_nasara_coordinator: ["Deputy Nasara Coordinator", "Deputy Nasara Organiser"],
    communication_officer: ["Communication Officer"],
    electoral_affairs: ["Electoral Affairs Officer"],
    research_officer: ["Research Officer"],
    pwd_officer: ["PWD Officer", "PWD Coordinator"],
    special_duties: ["Special Duties Officer"],
    legal_officer: ["Legal Representative Officer"],
    tescon_president: ["TESCON President"],
    tescon_wocom: ["TESCON WOCOM"],
    tescon_nasara: ["Nasara Coordinator", "Nasara Organiser"],
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



