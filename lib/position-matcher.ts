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

  const lower = p.toLowerCase();

  // 1. Chairperson / Chairman
  if (lower === "chairman" || lower === "chairperson") {
    if (level === "Region") return "Regional Chairman";
    if (level === "National") return "National Chairman";
    return "Chairperson";
  }

  // 2. 1st Vice
  if (/^1st\s+(?:regional\s+)?vice[- ]*(?:chairman|chairperson|chair)$/i.test(p)) {
    if (level === "Region") return "1st Regional Vice-Chairman";
    return "1st Vice-Chairperson";
  }

  // 3. 2nd Vice
  if (/^2nd\s+(?:regional\s+)?vice[- ]*(?:chairman|chairperson|chair)$/i.test(p)) {
    if (level === "Region") return "2nd Regional Vice-Chairman";
    return "2nd Vice-Chairperson";
  }

  // 4. Treasurer
  if (lower === "treasurer") return "Treasurer";

  // 5. Secretary
  if (lower === "secretary") return "Secretary";
  if (lower === "deputy secretary" || lower === "assistant secretary") {
    if (level === "Region") return "Assistant Regional Secretary";
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
    if (level === "Region") return /^deputy/i.test(p) ? "Deputy Regional Nasara Coordinator" : "Regional Nasara Coordinator";
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
    if (level === "Region") return "Regional PWD Officer";
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
