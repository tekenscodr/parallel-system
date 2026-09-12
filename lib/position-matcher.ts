/**
 * Canonicalizes an executive position title, eliminating typos,
 * casing differences, and non-standard synonyms.
 */
export function normalizePosition(raw?: string | null, level?: string | null): string {
  if (!raw) return "";
  let p = raw.trim();

  // Fix known typos
  p = p.replace(/Cooordinator/gi, "Coordinator");
  p = p.replace(/\bTreasure\b(?!r)/gi, "Treasurer");
  // Remove "Regional" from positions (e.g. Regional Chairman -> Chairman)
  p = p.replace(/\bregional\s+/gi, "");

  const lower = p.toLowerCase();

  // 1. Chairperson / Chairman
  if (lower === "chairman" || lower === "chairperson") {
    if (level === "National") return "National Chairperson";
    return "Chairperson";
  }

  // 2. 1st Vice
  if (/^1st\s+(?:regional\s+)?vice[- ]*(?:chairman|chairperson|chair)$/i.test(p)) {
    return "1st Vice-Chairperson";
  }

  // 3. 2nd Vice
  if (/^2nd\s+(?:regional\s+)?vice[- ]*(?:chairman|chairperson|chair)$/i.test(p)) {
    return "2nd Vice-Chairperson";
  }

  // 4. Treasurer
  if (lower === "treasurer") return "Treasurer";

  // 5. Secretary
  if (lower === "secretary") return "Secretary";
  if (lower === "deputy secretary" || lower === "assistant secretary") {
    return "Deputy Secretary";
  }

  // 6. Financial Secretary
  if (lower === "financial secretary") return "Financial Secretary";

  // 7. Organiser / Organizer
  if (lower === "organiser" || lower === "organizer") return "Organiser";
  if (lower === "deputy organiser" || lower === "deputy organizer") return "Deputy Organiser";

  // 8. Women Organiser
  if (/^(?:women\x27?s?|woman)\s+organi[sz]er$/i.test(p)) return "Women Organiser";
  if (/^deputy\s+(?:women\x27?s?|woman)\s+organi[sz]er$/i.test(p)) return "Deputy Women Organiser";

  // 9. Youth Organiser
  if (/^youth\s+organi[sz]er$/i.test(p)) return "Youth Organiser";
  if (/^deputy\s+youth\s+organi[sz]er$/i.test(p)) return "Deputy Youth Organiser";

  // 10. Nasara Organiser / Coordinator
  if (/^(?:deputy\s+)?nasara\s+organi[sz]er$/i.test(p)) {
    return /^deputy/i.test(p) ? "Deputy Nasara Organiser" : "Nasara Organiser";
  }
  if (/^(?:deputy\s+)?nasara\s+coordinator$/i.test(p)) {
    return /^deputy/i.test(p) ? "Deputy Nasara Coordinator" : "Nasara Coordinator";
  }

  // 11. Communication Officer
  if (/^communications?\s+officer$/i.test(p)) return "Communication Officer";

  // 12. Electoral Affairs Officer
  if (/^(?:electoral\s+affairs(?:\s+officer)?|elections\s+officer)$/i.test(p)) return "Electoral Affairs Officer";

  // 13. Research Officer
  if (/^research\s+officer$/i.test(p)) return "Research Officer";

  // 14. PWD
  if (/^pwd\s+(?:coordinator|officer)$/i.test(p)) {
    return "PWD Coordinator";
  }

  // 15. Special Duties
  if (/^special\s+duties\s+officer$/i.test(p)) return "Special Duties Officer";

  // 16. Legal Representative
  if (/^legal\s+(?:representative|affairs)\s+officer$/i.test(p)) return "Legal Representative Officer";

  // 17. National Council Rep
  if (/^national\s+council\s+rep(?:resentative)?$/i.test(p)) return "National Council Representative";

  // 18. Foundation Member
  if (/^foundation\s+member$/i.test(p)) return "Foundation Member";

  return p;
}

/**
 * Helper to build PostgreSQL search condition for executive positions.
 * Handles common spelling variations, synonyms, hyphens, and casing.
 */
export function buildPositionCondition(sql: any, position: string) {
  const p = position.trim();
  if (!p) return null;

  const variants = new Set<string>();
  variants.add(p);

  const canonical = normalizePosition(p);
  if (canonical) variants.add(canonical);

  // 1. Organiser / Organizer
  if (/organiser/i.test(p)) {
    variants.add(p.replace(/organiser/gi, 'Organizer'));
    variants.add(p.replace(/organiser/gi, 'organizer'));
  }
  if (/organizer/i.test(p)) {
    variants.add(p.replace(/organizer/gi, 'Organiser'));
    variants.add(p.replace(/organizer/gi, 'organiser'));
  }

  // 2. Chairperson / Chairman / Chair
  if (/chairperson/i.test(p)) {
    variants.add(p.replace(/chairperson/gi, 'Chairman'));
    variants.add(p.replace(/chairperson/gi, 'Chair'));
  }
  if (/chairman/i.test(p)) {
    variants.add(p.replace(/chairman/gi, 'Chairperson'));
  }

  // 3. Hyphen variations (e.g. 1st Vice-Chairperson vs 1st Vice Chairperson)
  if (p.includes('-')) {
    variants.add(p.replace(/-/g, ' '));
  }
  if (p.includes('Vice ')) {
    variants.add(p.replace(/Vice /gi, 'Vice-'));
  }

  // 4. Coordinator vs Organiser for Nasara
  if (/nasara organiser/i.test(p)) {
    variants.add(p.replace(/nasara organiser/gi, 'Nasara Coordinator'));
  }
  if (/nasara coordinator/i.test(p)) {
    variants.add(p.replace(/nasara coordinator/gi, 'Nasara Organiser'));
  }
  if (/deputy nasara organiser/i.test(p)) {
    variants.add(p.replace(/deputy nasara organiser/gi, 'Deputy Nasara Coordinator'));
    variants.add(p.replace(/deputy nasara organiser/gi, 'Deputy Nasara Cooordinator'));
  }

  // 5. Women's vs Women
  if (/women organiser/i.test(p)) {
    variants.add(p.replace(/women organiser/gi, "Women's Organiser"));
    variants.add(p.replace(/women organiser/gi, "Women's Organizer"));
  }

  // 6. PWD variations
  if (/pwd/i.test(p)) {
    variants.add(p.replace(/pwd/gi, 'PWD'));
    variants.add(p.replace(/pwd/gi, 'Pwd'));
  }

  const conds = Array.from(variants).map((v) => sql`position ILIKE ${v}`);
  return sql`(${conds.reduce((prev: any, curr: any) => sql`${prev} OR ${curr}`)})`;
}

/**
 * Returns a numerical rank representing the official constitutional hierarchy
 * of the position. Lower numbers indicate higher seniority.
 */
export function getPositionRank(pos?: string | null, level?: string | null): number {
  if (!pos) return 999;
  const p = pos.trim().toLowerCase();

  // 1. Presidential Candidate / Flagbearer
  if (p.includes("flagbearer") || p.includes("presidential candidate")) return 1;
  if (p.includes("running mate") || p.includes("vice presidential")) return 2;

  // 2. Chairperson & Vice-Chairpersons
  if (p.includes("1st vice") || p.includes("first vice")) return 11;
  if (p.includes("2nd vice") || p.includes("second vice")) return 12;
  if (p.includes("3rd vice") || p.includes("third vice")) return 13;
  if (p.includes("vice-chair") || p.includes("vice chair") || p.includes("vice chairperson") || p.includes("vice chairman")) return 14;
  if (p.includes("chairperson") || p.includes("chairman") || p.includes("chair")) return 10;

  // 3. Secretary & Deputy Secretary
  if (p.includes("deputy secretary") || p.includes("assistant secretary") || p.includes("deputy general secretary")) return 21;
  if (p.includes("financial secretary")) return 32;
  if (p.includes("general secretary") || p.includes("secretary")) return 20;

  // 4. Treasurer & Financial Secretary
  if (p.includes("deputy treasurer") || p.includes("deputy regional treasurer") || p.includes("deputy national treasurer")) return 31;
  if (p.includes("treasurer") || p.includes("treasure")) return 30;

  // 5. Organisers & Deputies
  if (p.includes("deputy organiser") || p.includes("deputy organizer") || p.includes("assistant organiser")) return 41;
  if (p.includes("deputy women") || p.includes("assistant women")) return 51;
  if (p.includes("women organiser") || p.includes("women organizer") || p.includes("women's organiser") || p.includes("women")) return 50;
  if (p.includes("deputy youth") || p.includes("assistant youth")) return 61;
  if (p.includes("youth organiser") || p.includes("youth organizer") || p.includes("youth")) return 60;
  if (p.includes("deputy nasara")) return 71;
  if (p.includes("nasara")) return 70;
  if (p.includes("organiser") || p.includes("organizer")) return 40;

  // 6. Communication
  if (p.includes("deputy communication")) return 81;
  if (p.includes("communication")) return 80;

  // 7. Electoral Affairs, Research & PWD
  if (p.includes("electoral") || p.includes("elections")) return 90;
  if (p.includes("research")) return 100;
  if (p.includes("pwd") || p.includes("disability")) return 110;

  // 8. Institutional & TESCON
  if (p.includes("president")) return 120;
  if (p.includes("wocom")) return 125;

  // 9. Special Duties, Legal & Council
  if (p.includes("special duties")) return 130;
  if (p.includes("legal")) return 140;
  if (p.includes("national council")) return 150;
  if (p.includes("patron")) return 160;
  if (p.includes("council of elders") || p.includes("elders")) return 170;
  if (p.includes("foundation member")) return 180;
  if (p.includes("coordinator")) return 190;
  if (p.includes("officer")) return 200;

  return 300;
}
