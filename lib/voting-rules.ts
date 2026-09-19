export type VotingSource = {
  id: number; executive_name: string | null; executive_level: string | null;
  position: string | null; region: string | null; constituency: string | null;
  polling_station?: string | null; voter_id: string | null; membership_id: string | null;
  gender: string | null; date_of_birth: string | null; age?: number | null;
  phone?: string | null;
};
export const contests = [
  ['National Chairperson', 'general'], ['Vice Chairperson', 'general'],
  ['General Secretary', 'general'], ['Treasurer', 'general'], ['Communication', 'general'],
  ['Organiser', 'general'], ['Youth Organiser', 'youth'],
  ['Women Organiser', 'women'], ['Nasara Organiser', 'nasara'],
] as const;
export type Electorate = 'general' | 'youth' | 'women' | 'nasara';
const clean = (v: unknown) => String(v ?? '').trim();
const norm = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const unique = (v: string[]) => [...new Set(v.filter(Boolean))];
export function calculateExactAge(dob: string | null | undefined, asOfDate: Date = new Date()): number | null {
  const s = clean(dob);
  let year: number, month: number, day: number;
  let hasMonthDay = false;

  // Full date: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if (m) {
    year = +m[1];
    month = +m[2];
    day = +m[3];
    hasMonthDay = true;
  } else {
    // Full date: DD/MM/YYYY or DD-MM-YYYY
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) {
      day = +m[1];
      month = +m[2];
      year = +m[3];
      hasMonthDay = true;
    } else {
      // Year-only: "1988"
      m = s.match(/\b(19\d\d|20[0-2]\d)\b/);
      if (m) {
        year = +m[1];
        if (year >= 1906 && year <= asOfDate.getFullYear() + 1) return asOfDate.getFullYear() - year;
        return null;
      }
      return null;
    }
  }

  // Validate date range and components
  if (year < 1906 || year > asOfDate.getFullYear() + 1) return null;
  if (hasMonthDay) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  }

  let age = asOfDate.getFullYear() - year;
  if (hasMonthDay) {
    const curMonth = asOfDate.getMonth() + 1;
    const curDay = asOfDate.getDate();
    if (curMonth < month || (curMonth === month && curDay < day)) {
      age--;
    }
  }
  return age;
}

export const ageIn2026 = (dob: string | null | undefined, asOfDate: Date = new Date()): number | null =>
  calculateExactAge(dob, asOfDate);

export const DEFAULT_YOUTH_CUTOFF_DATE = new Date("2026-08-21T00:00:00Z");

/**
 * Determines whether an individual qualifies as "under 40" for youth eligibility.
 * All under 40s are calculated as all those who were not 40 as at the cutoff date: 21st August, 2026.
 * E.g., someone born on 24th November 1986 is 39 on 21st August 2026 (under 40).
 * Someone born on 22nd August 1986 is 39 on 21st August 2026, so they qualify.
 * Someone born on 15th August 1986 had already celebrated their 40th birthday on 21st August 2026.
 */
export function isUnder40AsOfCutoff(
  dob: string | null | undefined,
  fallbackAge?: number | null,
  cutoffDate: Date = DEFAULT_YOUTH_CUTOFF_DATE
): boolean {
  if (dob) {
    const ageAtCutoff = calculateExactAge(dob, cutoffDate);
    if (ageAtCutoff !== null) {
      return ageAtCutoff < 40;
    }
  }

  if (fallbackAge !== null && fallbackAge !== undefined && Number.isFinite(fallbackAge)) {
    return fallbackAge < 40;
  }

  return false;
}

/** Alias for backward compatibility */
export const isUnder40AsOf3MonthsAgo = (
  dob: string | null | undefined,
  fallbackAge?: number | null,
  cutoffDate: Date = DEFAULT_YOUTH_CUTOFF_DATE
): boolean => isUnder40AsOfCutoff(dob, fallbackAge, cutoffDate);

/** Resolve age: DOB-based age first, then fall back to DB stored age column. */
function resolveAge(dobAge: number | null, dbAge: number | null | undefined): number | null {
  if (dobAge !== null) return dobAge;
  if (dbAge !== null && dbAge !== undefined && Number.isFinite(dbAge) && dbAge >= 0 && dbAge <= 120) return dbAge;
  return null;
}
export function buildVotingReport(source: VotingSource[]) {
  const groups = new Map<string, VotingSource[]>();
  let excludedVacancies = 0;
  for (const row of source) {
    const rawLvl = norm(row.executive_level);
    const lvl = rawLvl === 'externalbranch' ? 'constituency' : rawLvl;
    if (!['constituency', 'region', 'regional', 'national', 'tescon'].includes(lvl)) continue;
    if (!clean(row.executive_name) || /^(vacant|vacancy|unknown|not available|representative)\b/i.test(clean(row.executive_name)) || /^n\/?a$/i.test(clean(row.executive_name))) { excludedVacancies++; continue; }
    const vid = clean(row.voter_id).replace(/\s/g, '');
    const member = clean(row.membership_id);
    const key = /^\d{10}$/.test(vid) ? `voter:${vid}` : member ? `member:${member}` : `record:${row.id}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const people = [...groups].map(([key, rows]) => {
    const issues: string[] = [];
    const names = unique(rows.map(r => norm(clean(r.executive_name).replace(/^(mr\.?|mrs\.?|ms\.?|hon\.?|dr\.?)\s+/i, ''))));
    const identityConflict = names.length > 1;
    if (identityConflict) issues.push('Conflicting names on shared identity');
    if (!key.startsWith('voter:')) issues.push('Missing or invalid voter ID; identity review');
    // Resolve age: try DOB parsing first, then fall back to DB age column
    const dobAges = unique(rows.map(r => ageIn2026(r.date_of_birth)).filter(a=>a!==null).map(String));
    const dbAges = unique(rows.map(r => r.age).filter(a => a !== null && a !== undefined && Number.isFinite(a)).map(a => String(a)));
    const ages = dobAges.length > 0 ? dobAges : dbAges;
    const ageSource = dobAges.length > 0 ? 'dob' : dbAges.length > 0 ? 'db' : 'none';
    const genders = unique(rows.map(r => norm(r.gender)).filter(g=>['male','female'].includes(g)));
    if (ages.length > 1) issues.push('Conflicting DOB years');
    if (genders.length > 1) issues.push('Conflicting genders');
    const age = ages.length === 1 ? +ages[0] : null;
    const gender = genders.length === 1 ? genders[0] : '';
    const getRowLevel = (r: VotingSource) => {
      const l = norm(r.executive_level);
      return l === 'externalbranch' ? 'constituency' : l;
    };
    const core = rows.some(r=>['constituency','region','regional','national'].includes(getRowLevel(r)));
    const tescon = rows.filter(r=>norm(r.executive_level)==='tescon' && !/patron/i.test(clean(r.position)));
    const hasYouthPortfolio = rows.some(r => /youth\s*organi[sz]er/i.test(clean(r.position)) && !/former/i.test(clean(r.position)));
    const isUnder40 = rows.some(r => isUnder40AsOf3MonthsAgo(r.date_of_birth, r.age));
    if (core && age === null && !hasYouthPortfolio) issues.push('DOB missing, invalid or conflicting: youth eligibility unresolved');
    if (core && !gender) issues.push('Gender missing or conflicting: women eligibility unresolved');
    const isFormerOfficer = rows.some(r => /former/i.test(clean(r.position)));
    const flags = {
      general: !identityConflict && (core || tescon.some(r=>norm(r.position)==='president')),
      youth: !identityConflict && !isFormerOfficer && (tescon.length > 0 || hasYouthPortfolio || (core && isUnder40)),
      women: !identityConflict && ((core && gender==='female') || tescon.some(r=>['wocom','womencommissioner','womenscommissioner'].includes(norm(r.position)) || ((norm(r.position)==='president' || norm(r.position).includes('nasara')) && gender==='female'))),
      nasara: !identityConflict && rows.some(r=>/nasara/i.test(clean(r.position)) && !(norm(r.executive_level)==='tescon' && /patron/i.test(clean(r.position)))),
    };
    const regions = unique(rows.map(r => norm(r.executive_level)==='national' ? 'National' : clean(r.region).replace(/-/g,' ')));
    const region = regions.length===1 ? regions[0] : regions.length===0 ? 'Unassigned' : 'Multiple jurisdictions - review';
    const constituencies = unique(rows.map(r => {
      const level = getRowLevel(r);
      return level==='national' ? 'National level' : ['region','regional'].includes(level) ? 'Regional level' : clean(r.constituency).toUpperCase().replace(/\s*\/\s*/g,'/');
    }));
    const constituency = constituencies.length===1 ? constituencies[0] : constituencies.length===0 ? 'Unassigned' : 'Multiple jurisdictions - review';
    if (region.includes('review') || constituency.includes('review')) issues.push('Multiple jurisdictions require allocation');
    if (region==='Unassigned' || constituency==='Unassigned') issues.push('Missing jurisdiction');
    return { key, name: clean(rows[0].executive_name), voterId: clean(rows[0].voter_id), region, constituency,
      levels: unique(rows.map(r=>clean(r.executive_level))).join('; '),
      positions: unique(rows.map(r=>clean(r.position))).join('; '),
      dob: unique(rows.map(r=>clean(r.date_of_birth))).join('; '), age, gender,
      recordIds: rows.map(r=>r.id).join('; '), sourceRecords:rows.length, flags, issues,
      reasons: {general: flags.general ? (core ? 'Constituency/regional/national executive' : 'TESCON President') : '',
        youth: flags.youth ? (hasYouthPortfolio ? 'Ex-officio Youth Organiser' : (tescon.length ? 'TESCON executive excluding patron' : (age !== null && age < 40 ? 'Exact age below 40' : 'Under 40 as at 21st August 2026'))) : '',
        women: flags.women ? (core && gender==='female' ? 'Female executive' : (tescon.some(r=>norm(r.position).includes('nasara') && gender==='female') ? 'Female TESCON Nasara' : (tescon.some(r=>norm(r.position)==='president' && gender==='female') ? 'Female TESCON President' : 'TESCON WOCOM'))) : '',
        nasara: flags.nasara ? 'Nasara office' : ''},
    };
  }).sort((a,b)=>a.region.localeCompare(b.region)||a.constituency.localeCompare(b.constituency)||a.name.localeCompare(b.name));
  const metrics = (p: typeof people) => ({people:p.length, general:p.filter(r=>r.flags.general).length,
    youth:p.filter(r=>r.flags.youth).length, women:p.filter(r=>r.flags.women).length, nasara:p.filter(r=>r.flags.nasara).length,
    review:p.filter(r=>r.issues.length).length});
  function group(byConstituency: boolean) {
    const map = new Map<string, typeof people>();
    for(const p of people) { const k=JSON.stringify([p.region,byConstituency?p.constituency:'']); map.set(k,[...(map.get(k)||[]),p]); }
    return [...map].map(([k,p])=>({region:JSON.parse(k)[0] as string,constituency:JSON.parse(k)[1] as string,...metrics(p)}));
  }
  return {year:2026,generatedAt:new Date().toISOString(),sourceRecords:source.length,excludedVacancies,
    totals:metrics(people),contests:contests.map(([position,group])=>({position,group,count:metrics(people)[group]})),
    regional:group(false),constituency:group(true),people};
}
export type VotingReport = ReturnType<typeof buildVotingReport>;

export function computeExecutiveAgeAndDob(
  dob: string | undefined | null,
  pos?: string | undefined | null,
  level?: string | undefined | null,
  reg?: string | undefined | null
): { age: number | null; dob: string } {
  if (!dob || typeof dob !== "string") return { age: null, dob: dob || "" };
  const trimmed = dob.trim();
  const yearMatch = trimmed.match(/^(\d{4})(.*)$/);
  if (!yearMatch) return { age: null, dob: trimmed };

  const birthYear = parseInt(yearMatch[1], 10);
  let age = 2026 - birthYear;
  let finalDob = trimmed;
  const isYouth = pos ? /youth/i.test(pos) : false;
  const isExternalBranch =
    (level && /external\s*branch/i.test(level)) ||
    (reg && /external\s*branch/i.test(reg));

  // When entering anybody from the external branch and the age is more than 40, do NOT reduce the age
  if (isYouth && age > 39 && !isExternalBranch) {
    age = 39;
    finalDob = `1987${yearMatch[2]}`;
  }
  return { age, dob: finalDob };
}
