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
export function ageIn2026(dob: string | null): number | null {
  const s = clean(dob);
  let year: number, month: number, day: number;
  // Full date: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (m) { year = +m[1]; month = +m[2]; day = +m[3]; }
  else {
    // Full date: DD/MM/YYYY or DD-MM-YYYY
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) { day = +m[1]; month = +m[2]; year = +m[3]; }
    else {
      // Year-only: "1988"
      m = s.match(/^(\d{4})$/);
      if (m) {
        year = +m[1];
        if (year >= 1906 && year <= 2026) return 2026 - year;
        return null;
      }
      return null;
    }
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day || year > 2026 || year < 1906) return null;
  return 2026 - year;
}
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
    if (!['constituency', 'region', 'regional', 'national', 'tescon'].includes(norm(row.executive_level))) continue;
    if (!clean(row.executive_name) || /^(vacant|vacancy|unknown|n\/?a|not available|representative)\b/i.test(clean(row.executive_name))) { excludedVacancies++; continue; }
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
    const core = rows.some(r=>['constituency','region','regional','national'].includes(norm(r.executive_level)));
    const tescon = rows.filter(r=>norm(r.executive_level)==='tescon' && !/patron/i.test(clean(r.position)));
    if (core && age === null) issues.push('DOB missing, invalid or conflicting: youth eligibility unresolved');
    if (core && !gender) issues.push('Gender missing or conflicting: women eligibility unresolved');
    const flags = {
      general: !identityConflict && (core || tescon.some(r=>norm(r.position)==='president')),
      youth: !identityConflict && (tescon.length > 0 || (core && age !== null && age < 40)),
      women: !identityConflict && ((core && gender==='female') || tescon.some(r=>['wocom','womencommissioner','womenscommissioner'].includes(norm(r.position)))),
      nasara: !identityConflict && rows.some(r=>/nasara/i.test(clean(r.position)) && !(norm(r.executive_level)==='tescon' && /patron/i.test(clean(r.position)))),
    };
    const regions = unique(rows.map(r => norm(r.executive_level)==='national' ? 'National' : clean(r.region).replace(/-/g,' ')));
    const region = regions.length===1 ? regions[0] : regions.length===0 ? 'Unassigned' : 'Multiple jurisdictions - review';
    const constituencies = unique(rows.map(r => {
      const level = norm(r.executive_level);
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
        youth: flags.youth ? (tescon.length ? 'TESCON executive excluding patron' : (ageSource === 'db' ? 'DB age below 40 (DOB missing)' : 'DOB age below 40')) : '',
        women: flags.women ? (core && gender==='female' ? 'Female executive' : 'TESCON WOCOM') : '',
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
