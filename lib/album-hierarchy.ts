export type AlbumHierarchyDelegate = {
  executive_name: string;
  executive_level: string;
  region: string;
  constituency: string;
  polling_station?: string;
  level_rank: number;
  position_rank: number;
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
  if (value.includes("former president")) return 0.1;
  if (value.includes("flagbearer") || value.includes("vice president")) return 0.2;
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

export function getTesconInstitution(delegate: Pick<AlbumHierarchyDelegate, "polling_station" | "constituency">): string {
  return String(delegate.polling_station || delegate.constituency || "Accredited Tertiary Institution").trim();
}

export function compareAlbumDelegates(a: AlbumHierarchyDelegate, b: AlbumHierarchyDelegate): number {
  if (a.level_rank !== b.level_rank) return a.level_rank - b.level_rank;

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
  executive_level?: string | null;
}): number {
  const pos = String(delegate.position || "").trim().toLowerCase();
  const canon = String(delegate.canonical_position || "").trim().toLowerCase();
  const lvl = String(delegate.executive_level || "").trim().toLowerCase();

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
    if (
      pos.includes("tescon coordinator") ||
      canon.includes("tescon coordinator") ||
      /regional.*tescon.*coord/i.test(pos) ||
      /tescon.*regional.*coord/i.test(pos)
    ) {
      return 8; // Outside the 21 recognized regional executives
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
