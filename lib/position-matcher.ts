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

  // Regional TESCON Coordinator typos/caps
  if (
    /regional.*tescon.*coord/i.test(p) ||
    /tescon.*regional.*coord/i.test(p) ||
    /regional.*coord/i.test(p) ||
    /^tescon\s+c?o+rdinator$/i.test(p)
  ) {
    return "Regional TESCON Coordinator";
  }

  // Branch prefix positions
  if (/^branch\s+chair(?:man|person)$/i.test(p)) return "Chairperson";
  if (/^branch\s+organi[sz]er$/i.test(p)) return "Organiser";
  if (/^deputy\s+branch\s+organi[sz]er$/i.test(p)) return "Deputy Organiser";
  if (/^branch\s+woma?e?n\s+organi[sz]er$/i.test(p)) return "Women Organiser";
  if (/^deputy\s+branch\s+woma?e?n\s+organi[sz]er$/i.test(p)) return "Deputy Women Organiser";
  if (/^branch\s+nasara\s+organi[sz]er$/i.test(p)) return "Nasara Coordinator";
  if (/^deputy\s+branch\s+nasara\s+organi[sz]er$/i.test(p)) return "Deputy Nasara Coordinator";
  if (/^branch\s+treasurer$/i.test(p)) return "Treasurer";
  if (/^branch\s+financial\s+secretary$/i.test(p)) return "Financial Secretary";
  if (/^branch\s+communication\s+officer$/i.test(p)) return "Communication Officer";
  if (/^branch\s+electoral\s+officer$/i.test(p)) return "Electoral Affairs Officer";
  if (/^branch\s+research\s+officer$/i.test(p)) return "Research Officer";
  if (/^branch\s+legal\s+officer$/i.test(p)) return "Legal Representative Officer";

  // 1. Chairperson / Chairman -> Always Chairperson
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

  // 4. 3rd Vice
  if (/^3rd\s+(?:regional\s+)?vice[- ]*(?:chairman|chairperson|chair)$/i.test(p)) {
    return "3rd Vice-Chairperson";
  }

  // 5. Treasurer
  if (lower === "treasurer" || lower === "treasure") return "Treasurer";

  // 6. Secretary & Assistant / Deputy Secretary
  if (lower === "secretary") return "Secretary";
  if (lower === "deputy secretary" || lower === "assistant secretary") {
    return "Deputy Secretary";
  }

  // 7. Financial Secretary
  if (lower === "financial secretary") return "Financial Secretary";

  // 8. Organiser / Organizer
  if (lower === "organiser" || lower === "organizer") return "Organiser";
  if (lower === "deputy organiser" || lower === "deputy organizer") return "Deputy Organiser";

  // 9. Women Organiser
  if (/^(?:women\x27?s?|woman)\s+organi[sz]er$/i.test(p)) return "Women Organiser";
  if (/^deputy\s+(?:women\x27?s?|woman)\s+organi[sz]er$/i.test(p)) return "Deputy Women Organiser";

  // 10. Youth Organiser
  if (/^youth\s+organi[sz]er$/i.test(p)) return "Youth Organiser";
  if (/^deputy\s+youth\s+organi[sz]er$/i.test(p)) return "Deputy Youth Organiser";

  // 11. Nasara Organiser / Coordinator
  if (level === "Region" || level === "TESCON") {
    if (/^deputy\s+nasara/i.test(p)) return "Deputy Nasara Coordinator";
    if (/nasara/i.test(p)) return "Nasara Coordinator";
  } else {
    // Constituency level
    if (/^deputy\s+nasara/i.test(p)) return "Deputy Nasara Organiser";
    if (/nasara/i.test(p)) return "Nasara Organiser";
  }

  // 12. Communication Officer
  if (/^communications?\s+officer$/i.test(p)) return "Communication Officer";

  // 13. Electoral Affairs Officer
  if (/^(?:electoral\s+affairs(?:\s+officer)?|elections\s+officer)$/i.test(p)) return "Electoral Affairs Officer";

  // 14. Research Officer
  if (/^(?:research\s+officer|research\s+&\s+electoral\s+officer)$/i.test(p)) return "Research Officer";

  // 15. PWD Coordinator
  if (/^pwd\s+(?:coordinator|officer)$/i.test(p) || lower === "pwd") {
    return "PWD Coordinator";
  }

  // 16. Special Duties
  if (/^special\s+duties(?:\s+officer)?$/i.test(p)) return "Special Duties Officer";

  // 17. Legal Representative
  if (/^legal\s+(?:representative|affairs)(?:\s+officer)?$/i.test(p)) return "Legal Representative Officer";

  // 18. Patron
  if (/^patron(?:\s+\d+)?$/i.test(p)) return "Patron";

  // 19. President (TESCON)
  if (lower === "president") return "President";

  // 20. WOCOM (TESCON)
  if (lower === "wocom") return "WOCOM";

  // 21. National Council Rep
  if (/^national\s+council\s+rep(?:resentative)?$/i.test(p)) return "National Council Representative";

  // 22. National Council of Elders
  if (/^(?:national\s+)?council\s+of\s+elders$/i.test(p) || (level === "National" && /^elders?$/i.test(p))) {
    return "National Council of Elders";
  }

  // 23. National Council of Patrons
  if (/^(?:national\s+)?council\s+of\s+patrons$/i.test(p) || (level === "National" && /^patrons?$/i.test(p))) {
    return "National Council of Patrons";
  }

  // 24. Foundation Member
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

  // Cross-apply hyphen/space with Chairman/Chairperson
  for (const v of Array.from(variants)) {
    if (v.includes('-')) variants.add(v.replace(/-/g, ' '));
    if (v.includes('Vice ')) variants.add(v.replace(/Vice /gi, 'Vice-'));
    if (/chairperson/i.test(v)) variants.add(v.replace(/chairperson/gi, 'Chairman'));
    if (/chairman/i.test(v)) variants.add(v.replace(/chairman/gi, 'Chairperson'));
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
  if (/deputy nasara coordinator/i.test(p)) {
    variants.add(p.replace(/deputy nasara coordinator/gi, 'Deputy Nasara Organiser'));
  }

  // 5. Secretary title used by the Region and Constituency tables.
  if (/assistant secretary/i.test(p)) {
    variants.add(p.replace(/assistant secretary/gi, "Deputy Secretary"));
  }
  if (/deputy secretary/i.test(p)) {
    variants.add(p.replace(/deputy secretary/gi, "Assistant Secretary"));
  }

  // 6. Communications Officer variations
  if (/communications?\s+officer/i.test(p)) {
    variants.add(p.replace(/communications?\s+officer/gi, "Communication Officer"));
    variants.add(p.replace(/communications?\s+officer/gi, "Communications Officer"));
  }

  // 7. Women's vs Women
  if (/women organiser/i.test(p)) {
    variants.add(p.replace(/women organiser/gi, "Women's Organiser"));
    variants.add(p.replace(/women organiser/gi, "Women's Organizer"));
  }

  // 8. PWD variations
  if (/pwd/i.test(p)) {
    variants.add("PWD");
    variants.add("PWD Officer");
    variants.add("PWD Coordinator");
    variants.add("Regional PWD Officer");
    variants.add("Pwd");
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
  const tier = String(level || "").trim().toLowerCase();

  if (tier === "region" || tier === "regional" || tier === "constituency") {
    // 1. Chairperson / Chairman
    if (p.includes("1st vice") || p.includes("first vice")) return 2;
    if (p.includes("2nd vice") || p.includes("second vice")) return 3;
    if (p.includes("chairperson") || p.includes("chairman") || p === "chair") return 1;

    // 4. Secretary & 5. Assistant Secretary
    if (p.includes("deputy secretary") || p.includes("assistant secretary")) return 5;
    if (p === "secretary" || (p.endsWith(" secretary") && !p.includes("financial"))) return 4;

    // 6. Treasurer
    if (p.includes("treasurer") || p.includes("treasure")) return 6;

    // Deputies (16-19) - checked before main roles to avoid greedy substring match
    if (p.includes("deputy women") || p.includes("assistant women")) return 17;
    if (p.includes("deputy youth") || p.includes("assistant youth")) return 18;
    if (p.includes("deputy nasara")) return 19;
    if (p.includes("deputy organiser") || p.includes("deputy organizer") || p.includes("assistant organiser")) return 16;

    // 8. Women Organiser
    if (p.includes("women organiser") || p.includes("women organizer") || p.includes("women's organiser") || p === "women") return 8;

    // 9. Youth Organiser
    if (p.includes("youth organiser") || p.includes("youth organizer") || p === "youth") return 9;

    // 10. Nasara Organiser
    if (p.includes("nasara")) return 10;

    // 7. Organiser
    if (p.includes("organiser") || p.includes("organizer")) return 7;

    // 11. Financial Secretary
    if (p.includes("financial secretary")) return 11;

    // 12. Electoral Affairs Officer
    if (p.includes("electoral") || p.includes("elections")) return 12;

    // 13. Communication Officer
    if (p.includes("communication")) return 13;

    // 14. Research Officer
    if (p.includes("research")) return 14;

    // 15. PWD
    if (p.includes("pwd") || p.includes("disability")) return 15;

    // 20. Special Duties Officer
    if (p.includes("special duties")) return 20;

    // 21. Legal Representative Officer
    if (p.includes("legal")) return 21;

    return 300;
  }

  // 1. Presidential Candidate / Flagbearer
  if (p.includes("flagbearer") || p.includes("presidential candidate")) return 1;
  if (p.includes("running mate") || p.includes("vice presidential")) return 2;

  // 2. Chairperson & Vice-Chairpersons
  if (p.includes("1st vice") || p.includes("first vice")) return 11;
  if (p.includes("2nd vice") || p.includes("second vice")) return 12;
  if (p.includes("3rd vice") || p.includes("third vice")) return 13;
  if (p.includes("vice-chair") || p.includes("vice chair")) return 14;
  if (p.includes("chairperson") || p.includes("chairman") || p === "chair") return 10;

  // 3. Secretaries and treasurers
  if (p.includes("deputy secretary") || p.includes("assistant secretary") || p.includes("deputy general secretary")) return 21;
  if (p.includes("financial secretary")) return 32;
  if (p.includes("general secretary") || p === "secretary") return 20;
  if (p.includes("deputy treasurer")) return 31;
  if (p.includes("treasurer") || p.includes("treasure")) return 30;

  // 4. Organisers and deputies
  if (p.includes("deputy organiser") || p.includes("deputy organizer") || p.includes("assistant organiser")) return 41;
  if (p.includes("deputy women") || p.includes("assistant women")) return 51;
  if (p.includes("women organiser") || p.includes("women organizer") || p.includes("women's organiser") || p === "women") return 50;
  if (p.includes("deputy youth") || p.includes("assistant youth")) return 61;
  if (p.includes("youth organiser") || p.includes("youth organizer") || p === "youth") return 60;
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
  if (p.includes("national council rep")) return 150;
  if (p.includes("national council of elders") || p.includes("council of elders") || p.includes("elders")) return 152;
  if (p.includes("national council of patrons") || p.includes("council of patrons")) return 154;
  if (p.includes("national council")) return 150;
  if (p.includes("patron")) return 160;
  if (p.includes("foundation member")) return 180;
  if (p.includes("coordinator")) return 190;
  if (p.includes("officer")) return 200;

  return 300;
}
