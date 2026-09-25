import { normalizeTesconInstitution } from "./tescon-institutions.ts";

export type AlbumHierarchyDelegate = {
  executive_name: string;
  executive_level: string;
  region: string;
  constituency: string;
  polling_station?: string;
  level_rank: number;
  position_rank: number;
  id?: number | string;
};

// External Branch executives have constituency status, but are kept in a
// dedicated diaspora subsection immediately before TESCON in the PDF.
export const CANONICAL_LEVEL_ORDER: Record<string, number> = {
  national: 1,
  region: 2,
  regional: 2,
  constituency: 3,
  "external branch": 4,
  tescon: 5,
};

export function normalizePositionRank(position: string | null): number {
  const value = String(position || "").trim().toLowerCase();
  if (!value) return 99;
  if (value.includes("former president") || value.includes("past president")) return 0.1;
  if (value.includes("flagbearer") || (value.includes("vice president") && !value.includes("running mate"))) return 0.2;
  if (value.includes("running mate")) return 0.25;
  if (value.includes("president") && !value.includes("tescon")) return 0.3;
  if (value.includes("chairperson") || value.includes("chairman")) {
    if (value.includes("1st") || value.includes("first")) return 2;
    if (value.includes("2nd") || value.includes("second")) return 3;
    if (value.includes("3rd") || value.includes("third")) return 3.5;
    return 1;
  }
  if (value.includes("financial secretary")) return 11;
  if (value.includes("deputy secretary") || value.includes("assistant secretary") || value.includes("deputy general secretary")) return 5;
  if (value.includes("secretary")) return 4;
  if (value.includes("treasurer")) return 6;

  // Match qualified organiser roles before the generic organiser label.
  if (value.includes("deputy") && value.includes("women")) return 17;
  if (value.includes("deputy") && value.includes("youth")) return 18;
  if (value.includes("deputy") && value.includes("nasara")) return 19;
  if (value.includes("deputy") && (value.includes("organiser") || value.includes("organizer"))) return 16;
  if (value.includes("women") || value.includes("wocom")) return 8;
  if (value.includes("youth")) return 9;
  if (value.includes("nasara")) return 10;
  if (value.includes("organiser") || value.includes("organizer")) return 7;

  if (value.includes("electoral") || value.includes("elections")) return 12;
  if (value.includes("communication")) return 13;
  if (value.includes("research")) return 14;
  if (value.includes("pwd") || value.includes("disability")) return 15;
  if (value.includes("special duties")) return 20;
  if (value.includes("legal")) return 21;
  if (value.includes("president")) return 22;
  return 30;
}

export type NationalSectionName =
  | "President, Flagbearer, Running Mate & Speaker of Parliament"
  | "National Executives and Directors"
  | "Former Chairman and Former General Secretary"
  | "Council of Elders"
  | "Council of Patrons"
  | "Other National Executives";

export interface NationalSectionInfo {
  rank: number;
  section: NationalSectionName;
  badge: string;
  subRank: number;
}

/**
 * Authoritative hierarchy for full National level register:
 * 1. President, Flagbearer, Running Mate and Speaker of Parliament
 * 2. National Executives and Directors
 * 3. Former Chairman and Former General Secretary
 * 4. Council of Elders
 * 5. Council of Patrons
 * 6. Other National Executives
 */
export function getNationalSectionInfo(delegate: {
  position?: string | null;
  canonical_position?: string | null;
  executive_level?: string | null;
  executive_name?: string | null;
  name?: string | null;
  voter_id?: string | null;
}): NationalSectionInfo {
  const pos = String(delegate.position || "").trim().toLowerCase();
  const canon = String(delegate.canonical_position || "").trim().toLowerCase();
  const s = `${pos} ${canon}`.toLowerCase();
  const rawName = String(
    (delegate as any).executive_name ||
    (delegate as any).name ||
    ""
  ).toLowerCase();
  const voterId = String((delegate as any).voter_id || "").trim();

  const isEdmundAnnan =
    voterId === "8698012141" ||
    (rawName.includes("edmund") && rawName.includes("annan"));

  // 1. President, Flagbearer, Running Mate and Speaker of Parliament
  const isSpeaker = s.includes("speaker of parliament") || s.includes("speaker");
  const isPresident =
    (s.includes("former president") || s.includes("past president") || s === "president" || s.startsWith("president ")) &&
    !s.includes("vice president") &&
    !s.includes("presidential candidate");
  const isFlagbearer =
    s.includes("flagbearer") ||
    s.includes("presidential candidate") ||
    (s.includes("vice president") && !s.includes("running mate"));
  const isRunningMate =
    s.includes("running mate") ||
    s.includes("vice presidential candidate") ||
    s.includes("vice-presidential candidate");

  if (isPresident || isFlagbearer || isRunningMate || isSpeaker) {
    let sub = 1;
    let badge = "PRESIDENT";
    if (isPresident) {
      sub = 1;
      badge = "PAST PRESIDENT";
    } else if (isFlagbearer) {
      sub = 2;
      badge = "FLAGBEARER";
    } else if (isRunningMate) {
      sub = 3;
      badge = "RUNNING MATE";
    } else if (isSpeaker) {
      sub = 4;
      badge = (s.includes("former") || s.includes("past")) ? "FORMER SPEAKER OF PARLIAMENT" : "SPEAKER OF PARLIAMENT";
    }

    return {
      rank: 1,
      section: "President, Flagbearer, Running Mate & Speaker of Parliament",
      badge,
      subRank: sub,
    };
  }

  // 2. National Executives and Directors
  const isDirector =
    s.includes("director") ||
    s.includes("external relations") ||
    s.includes("legal committee") ||
    (s.includes("research officer") && !s.includes("region"));

  const isNationalExecutive =
    (s.includes("national chairperson") || s.includes("national chairman") || (s.includes("chairperson") && !s.includes("legal") && !s.includes("council") && !s.includes("past") && !s.includes("former"))) ||
    s.includes("1st vice") ||
    s.includes("2nd vice") ||
    s.includes("3rd vice") ||
    (s.includes("general secretary") && !s.includes("past") && !s.includes("former")) ||
    (s.includes("treasurer") && !s.includes("past") && !s.includes("former")) ||
    ((s.includes("organiser") || s.includes("organizer")) && !s.includes("director") && !s.includes("branch")) ||
    s.includes("women organiser") || s.includes("woman organiser") ||
    s.includes("youth organiser") ||
    s.includes("nasara");

  if (
    (isNationalExecutive || isDirector) &&
    !s.includes("past national chairman") &&
    !s.includes("former national chairman") &&
    !s.includes("past national chairperson") &&
    !s.includes("former national chairperson") &&
    !s.includes("past general secretary") &&
    !s.includes("former general secretary") &&
    !s.includes("council")
  ) {
    let sub = 99;
    let badge = "NATIONAL EXECUTIVE";

    if (isNationalExecutive) {
      if (s.includes("chairperson") || s.includes("chairman")) {
        if (s.includes("1st")) sub = 2;
        else if (s.includes("2nd")) sub = 3;
        else if (s.includes("3rd")) sub = 4;
        else sub = 1;
      } else if (s.includes("general secretary")) {
        sub = s.includes("deputy") || s.includes("assistant") ? 6 : 5;
      } else if (s.includes("treasurer")) {
        sub = s.includes("deputy") || s.includes("assistant") ? 8 : 7;
      } else if (s.includes("organiser") || s.includes("organizer")) {
        sub = s.includes("deputy") ? 10 : 9;
      } else if (s.includes("women")) {
        sub = s.includes("deputy") ? 12 : 11;
      } else if (s.includes("youth")) {
        sub = s.includes("deputy") ? 14 : 13;
      } else if (s.includes("nasara")) {
        sub = s.includes("deputy") ? 16 : 15;
      }
    } else if (isDirector) {
      badge = "NATIONAL DIRECTOR";
      if (s.includes("finance")) sub = 20;
      else if (s.includes("elections")) sub = 21;
      else if (s.includes("research") && !s.includes("officer")) sub = 22;
      else if (s.includes("it") && !s.includes("deputy")) sub = 23;
      else if (s.includes("it") && s.includes("deputy")) sub = 24;
      else if (s.includes("protocol") && !s.includes("deputy")) sub = 25;
      else if (s.includes("protocol") && s.includes("deputy")) sub = 26;
      else if (s.includes("legal committee")) sub = 27;
      else if (s.includes("legal affairs") || s.includes("legal")) sub = 28;
      else if (s.includes("comm") && !s.includes("deputy")) sub = 29;
      else if (s.includes("comm") && s.includes("deputy")) sub = 30;
      else if (s.includes("external") && !s.includes("deputy")) sub = 31;
      else if (s.includes("external") && s.includes("deputy")) sub = 32;
      else if (s.includes("research officer")) sub = 33;
      else sub = 35;
    }

    return {
      rank: 2,
      section: "National Executives and Directors",
      badge,
      subRank: sub,
    };
  }

  // 3. Former Chairman and Former General Secretary (and Past Executives Rep)
  if (
    s.includes("past national chairman") ||
    s.includes("former national chairman") ||
    s.includes("past national chairperson") ||
    s.includes("former national chairperson") ||
    s.includes("past general secretary") ||
    s.includes("former general secretary") ||
    isEdmundAnnan
  ) {
    const isChairman = s.includes("chairman") || s.includes("chairperson");
    const isGenSec = s.includes("general secretary");

    let sub = 3;
    let badge = "NATIONAL COUNCIL REP";
    if (isChairman) {
      sub = 1;
      badge = "FORMER NATIONAL CHAIRMAN";
    } else if (isGenSec) {
      sub = 2;
      badge = "FORMER GENERAL SECRETARY";
    } else if (isEdmundAnnan) {
      sub = 3;
      badge = "NATIONAL COUNCIL REP";
    }

    return {
      rank: 3,
      section: "Former Chairman and Former General Secretary",
      badge,
      subRank: sub,
    };
  }

  // 4. Council of Elders
  if (
    s.includes("council of elders") ||
    s.includes("national council of elders") ||
    s.includes("past national officer / elder") ||
    s.includes("council of elders / past national officer") ||
    (s.includes("elder") && !s.includes("patron"))
  ) {
    const rawName = String(
      (delegate as any).executive_name ||
      (delegate as any).name ||
      ""
    ).toLowerCase();

    const isChairman =
      s.includes("chairman") ||
      s.includes("chairperson") ||
      (rawName.includes("hackman") && (rawName.includes("agyeman") || rawName.includes("owusu")));

    return {
      rank: 4,
      section: "Council of Elders",
      badge: isChairman ? "CHAIRMAN, COUNCIL OF ELDERS" : "COUNCIL OF ELDERS",
      subRank: isChairman ? 1 : 2,
    };
  }

  // 5. Council of Patrons
  if (
    s.includes("council of patrons") ||
    s.includes("national council of patrons") ||
    s.includes("patron") ||
    s.includes("foundation member")
  ) {
    return {
      rank: 5,
      section: "Council of Patrons",
      badge: "COUNCIL OF PATRONS",
      subRank: s.includes("foundation") ? 2 : 1,
    };
  }

  // 6. Other National Executives (e.g. National Council Representative, MP)
  return {
    rank: 6,
    section: "Other National Executives",
    badge: s.includes("national council rep") ? "NATIONAL COUNCIL REP" : "OTHER NATIONAL EXECUTIVE",
    subRank: 99,
  };
}

export function compareNationalAlbumDelegates(a: any, b: any): number {
  const infoA = getNationalSectionInfo(a);
  const infoB = getNationalSectionInfo(b);

  if (infoA.rank !== infoB.rank) {
    return infoA.rank - infoB.rank;
  }

  if (infoA.subRank !== infoB.subRank) {
    return infoA.subRank - infoB.subRank;
  }

  return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
}

export function getTesconInstitution(
  delegate: Pick<AlbumHierarchyDelegate, "polling_station" | "constituency"> & {
    region?: string;
    id?: number | string;
  }
): string {
  return normalizeTesconInstitution(
    delegate.polling_station,
    delegate.region,
    delegate.constituency,
    delegate.id
  );
}

export function compareAlbumDelegates(a: AlbumHierarchyDelegate, b: AlbumHierarchyDelegate): number {
  if (a.level_rank !== b.level_rank) return a.level_rank - b.level_rank;

  // National Level (level_rank === 1): sort by authoritative 7-stage national hierarchy
  if (a.level_rank === 1) {
    return compareNationalAlbumDelegates(a, b);
  }

  if (a.level_rank > 1) {
    const regionComparison = a.region.localeCompare(b.region);
    if (regionComparison !== 0) return regionComparison;
  }

  // Domestic and diaspora constituency units are alphabetical within region.
  if (a.level_rank === CANONICAL_LEVEL_ORDER.constituency || a.level_rank === CANONICAL_LEVEL_ORDER["external branch"]) {
    const constituencyComparison = a.constituency.localeCompare(b.constituency);
    if (constituencyComparison !== 0) return constituencyComparison;
  }

  // TESCON is grouped by region and then institution before position.
  if (a.level_rank === CANONICAL_LEVEL_ORDER.tescon) {
    const institutionComparison = getTesconInstitution(a).localeCompare(getTesconInstitution(b));
    if (institutionComparison !== 0) return institutionComparison;
  }

  if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
  return a.executive_name.localeCompare(b.executive_name);
}


export function isRegionalTescon(delegate: {
  position?: string | null;
  canonical_position?: string | null;
  polling_station?: string | null;
  executive_level?: string | null;
}): boolean {
  if (!delegate) return false;
  const pos = String(delegate.position || "").trim().toLowerCase();
  const canon = String(delegate.canonical_position || "").trim().toLowerCase();
  const ps = String(delegate.polling_station || "").trim().toLowerCase();
  const lvl = String(delegate.executive_level || "").trim().toLowerCase();

  if ((lvl === "region" || lvl === "regional") && (/tescon/i.test(pos) || /tescon/i.test(canon))) {
    return true;
  }
  if (
    !pos.includes("nasara") &&
    !canon.includes("nasara") &&
    (pos.includes("regional tescon") ||
      pos.includes("tescon regional") ||
      pos.includes("tescon coordinator") ||
      pos.includes("tescon cordinator") ||
      canon.includes("tescon coordinator") ||
      /regional.*tescon/i.test(pos) ||
      /tescon.*coord/i.test(pos))
  ) {
    return true;
  }

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

function isRecognizedRegionalExecutive(pos: string | null | undefined): boolean {
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

/**
 * Authoritative regional leadership ranking for display and album construction:
 * 1. Regional Executives (Regional tier officers: Chairperson .. Legal)
 * 2. National Council Representatives in the region in question
 * 3. Foundation Members in the region in question
 * 4. Members of Parliament (MPs) for that region
 * 5. Constituency Executives (19 per constituency)
 * 6. TESCON Executives
 * 7. External Branches
 */
export function getRegionalSectionRank(delegate: {
  position?: string | null;
  canonical_position?: string | null;
  polling_station?: string | null;
  executive_level?: string | null;
}): number {
  const pos = String(delegate.position || "").trim().toLowerCase();
  const canon = String(delegate.canonical_position || "").trim().toLowerCase();
  const lvl = String(delegate.executive_level || "").trim().toLowerCase();

  // Regional TESCON is strictly NOT part of the Electoral College
  if (isRegionalTescon(delegate as any)) {
    return 999;
  }

  // 1. Regional Executives (The 21 Recognized Regional Executive Committee officers: 10 Elected + 11 Appointed)
  // Strictly excludes roles outside the 21 (specifically Regional TESCON Coordinator, which is not an electoral college member)
  if (
    (lvl === "region" || lvl === "regional") &&
    !pos.includes("national council") &&
    !canon.includes("national council") &&
    !pos.includes("foundation member") &&
    !canon.includes("foundation member") &&
    !pos.includes("member of parliament") &&
    !canon.includes("member of parliament") &&
    pos !== "mp"
  ) {
    if (!isRecognizedRegionalExecutive(pos) || !isRecognizedRegionalExecutive(canon)) {
      return 999; // Outside the 21 recognized regional executives
    }
    return 1;
  }

  // 2. National Council Representatives in the region in question
  if (
    pos.includes("national council representative") ||
    pos.includes("national council rep") ||
    canon.includes("national council representative") ||
    pos === "national council"
  ) {
    return 2;
  }

  // 3. Foundation Members in the region in question
  if (pos.includes("foundation member") || canon.includes("foundation member")) {
    return 3;
  }

  // 4. Members of Parliament (MPs) for each region
  if (
    pos.includes("member of parliament") ||
    pos === "mp" ||
    /\bmp\b/i.test(pos) ||
    pos.includes("parliamentarian") ||
    canon.includes("member of parliament")
  ) {
    return 4;
  }

  // 5. Constituency Executives
  if (lvl === "constituency") {
    return 5;
  }

  // 6. TESCON Executives
  if (lvl === "tescon") {
    return 6;
  }

  // 7. External Branch
  if (lvl === "external branch" || lvl === "external") {
    return 7;
  }

  return 99;
}

export function compareRegionalAlbumDelegates(a: any, b: any): number {
  const rankA = getRegionalSectionRank(a);
  const rankB = getRegionalSectionRank(b);

  if (rankA !== rankB) return rankA - rankB;

  // Within Section 4 (MPs): sort alphabetically by constituency, then name
  if (rankA === 4) {
    const cComp = String(a.constituency || "").localeCompare(String(b.constituency || ""));
    if (cComp !== 0) return cComp;
    return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
  }

  // Within Section 5 (Constituency Executives): sort by constituency, then position rank, then name
  if (rankA === 5) {
    const cComp = String(a.constituency || "").localeCompare(String(b.constituency || ""));
    if (cComp !== 0) return cComp;
    if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
    return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
  }

  // Within Section 6 (TESCON): sort by institution, then position rank, then name
  if (rankA === 6) {
    const instA = getTesconInstitution(a);
    const instB = getTesconInstitution(b);
    const iComp = instA.localeCompare(instB);
    if (iComp !== 0) return iComp;
    if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
    return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
  }

  // For Section 1 (Regional Execs) and Section 2 (National Council Reps): sort by position rank, then name
  if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
  return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
}
