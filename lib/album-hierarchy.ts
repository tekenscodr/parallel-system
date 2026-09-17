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
  if (value.includes("deputy women")) return 17;
  if (value.includes("deputy youth")) return 18;
  if (value.includes("deputy nasara")) return 19;
  if (value.includes("deputy organiser") || value.includes("deputy organizer")) return 16;
  if (value.includes("women") || value.includes("wocom")) return 8;
  if (value.includes("youth")) return 9;
  if (value.includes("nasara")) return 10;
  if (value.includes("organiser") || value.includes("organizer")) return 7;

  if (value.includes("electoral")) return 12;
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
