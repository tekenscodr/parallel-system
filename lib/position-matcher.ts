/**
 * Helper to build PostgreSQL search condition for executive positions.
 * Handles common spelling variations, synonyms, hyphens, and casing.
 */
export function buildPositionCondition(sql: any, position: string) {
  const p = position.trim();
  if (!p) return null;

  const variants = new Set<string>();
  variants.add(p);

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
