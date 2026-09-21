import { ageIn2026, isUnder40AsOf3MonthsAgo } from "./voting-rules";

export interface EntitledPosition {
  id: string;
  title: string;
  category: "general" | "youth" | "women" | "nasara";
  reason: string;
}

export interface DelegateRecord {
  id?: number | string;
  executive_name?: string | null;
  executive_level?: string | null;
  position?: string | null;
  region?: string | null;
  constituency?: string | null;
  polling_station?: string | null;
  voter_id?: string | null;
  phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  age?: number | null;
}

const clean = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, "");

export function isTesconPatron(delegate: DelegateRecord): boolean {
  const lvl = norm(delegate.executive_level);
  const pos = clean(delegate.position);
  return lvl === "tescon" && /patron/i.test(pos);
}

export function getDelegateEntitledPositions(delegate: DelegateRecord): EntitledPosition[] {
  // TESCON Patrons NEVER vote in party elections
  if (isTesconPatron(delegate)) {
    return [];
  }

  const rawLvl = norm(delegate.executive_level);
  const lvl = rawLvl === "externalbranch" ? "constituency" : rawLvl;
  const pos = clean(delegate.position);
  const posNorm = norm(pos);
  const gender = norm(delegate.gender);

  // Core administrative levels: National, Regional, Constituency, External Branch
  const isCore = ["constituency", "region", "regional", "national"].includes(lvl);
  const isTescon = rawLvl === "tescon";

  if (!isCore && !isTescon) {
    return [];
  }

  // Resolve age
  const dobAge = delegate.date_of_birth ? ageIn2026(delegate.date_of_birth) : null;
  const resolvedAge = dobAge !== null ? dobAge : (delegate.age ?? null);
  const isUnder40 = isUnder40AsOf3MonthsAgo(delegate.date_of_birth, resolvedAge);

  const entitled: EntitledPosition[] = [];

  // 1. General Contests
  // Core executives + TESCON Presidents vote in all general national contests
  const isTesconPresident = isTescon && posNorm.includes("president");
  const canVoteGeneral = isCore || isTesconPresident;
  const generalReason = isCore
    ? `${clean(delegate.executive_level)} executive officer`
    : "TESCON Institutional President";

  if (canVoteGeneral) {
    entitled.push(
      { id: "chairperson", title: "National Chairperson", category: "general", reason: generalReason },
      { id: "1st_vice_chairperson", title: "1st Vice Chairperson", category: "general", reason: generalReason },
      { id: "2nd_vice_chairperson", title: "2nd Vice Chairperson", category: "general", reason: generalReason },
      { id: "general_secretary", title: "General Secretary", category: "general", reason: generalReason },
      { id: "treasurer", title: "National Treasurer", category: "general", reason: generalReason },
      { id: "organiser", title: "National Organiser", category: "general", reason: generalReason },
      { id: "communication", title: "National Communication Officer", category: "general", reason: generalReason }
    );
  }

  // 2. Youth Organiser Contest
  // Qualifies if: TESCON executive (excluding patrons, wocom, and nasara) OR substantive Youth portfolio OR core executive under 40
  // Former officers are strictly excluded from youth voting eligibility
  const isFormer = /former/i.test(pos);
  const hasYouthPortfolio = /youth\s*organi[sz]er/i.test(pos) && !isFormer;
  if (!isFormer) {
    const isEligibleTesconYouth = isTescon && !/patron/i.test(pos);
    if (isEligibleTesconYouth) {
      entitled.push({
        id: "youth_organiser",
        title: "National Youth Organiser",
        category: "youth",
        reason: "Accredited TESCON Tertiary Institution Executive",
      });
    } else if (hasYouthPortfolio) {
      entitled.push({
        id: "youth_organiser",
        title: "National Youth Organiser",
        category: "youth",
        reason: "Ex-officio Youth Organiser portfolio",
      });
    } else if (isCore && isUnder40) {
      entitled.push({
        id: "youth_organiser",
        title: "National Youth Organiser",
        category: "youth",
        reason: resolvedAge !== null && resolvedAge < 40
          ? `Youth wing eligible (age ${resolvedAge} < 40)`
          : "Youth wing eligible (under 40 as at 21st August 2026)",
      });
    }
  }

  // 3. Women Organiser Contest
  // Qualifies if: core female executive OR TESCON WOCOM OR female TESCON President OR female TESCON Nasara Coordinator
  const isTesconWocom = isTescon && (posNorm.includes("wocom") || posNorm.includes("women"));
  const isTesconNasara = isTescon && posNorm.includes("nasara");
  if (isCore && gender === "female") {
    entitled.push({
      id: "women_organiser",
      title: "National Women Organiser",
      category: "women",
      reason: "Female executive officer",
    });
  } else if (isTesconWocom) {
    entitled.push({
      id: "women_organiser",
      title: "National Women Organiser",
      category: "women",
      reason: "TESCON Women Commissioner (WOCOM)",
    });
  } else if (isTesconPresident && gender === "female") {
    entitled.push({
      id: "women_organiser",
      title: "National Women Organiser",
      category: "women",
      reason: "Female TESCON President",
    });
  } else if (isTesconNasara && gender === "female") {
    entitled.push({
      id: "women_organiser",
      title: "National Women Organiser",
      category: "women",
      reason: "Female TESCON Nasara Coordinator",
    });
  }

  // 4. Nasara Organiser Contest
  // Qualifies if: Nasara Coordinator / Deputy at any level
  const isNasara = /nasara/i.test(pos);
  if (isNasara) {
    entitled.push({
      id: "nasara_coordinator",
      title: "National Nasara Coordinator",
      category: "nasara",
      reason: "Nasara portfolio holder",
    });
  }

  return entitled;
}
