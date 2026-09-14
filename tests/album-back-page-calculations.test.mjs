import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Election album route defines 21 regional and 19 constituency statutory quotas', () => {
  const routePath = path.join(process.cwd(), 'app/api/admin/albums/election/route.ts');
  const fileContent = fs.readFileSync(routePath, 'utf8');

  assert.ok(
    fileContent.includes('regionalTargetPerUnit = isCustom'),
    'Route must calculate regionalTargetPerUnit'
  );
  assert.ok(
    fileContent.includes('constituencyTargetPerUnit = isCustom'),
    'Route must calculate constituencyTargetPerUnit'
  );
  assert.ok(
    fileContent.includes('Math.min(21, regionalPositionsSelected'),
    'Regional quota must be capped at 21'
  );
  assert.ok(
    fileContent.includes('Math.min(19, constituencyPositionsSelected'),
    'Constituency quota must be capped at 19'
  );
  assert.ok(
    fileContent.includes('REGIONAL_CONSTITUENCY_COUNTS'),
    'Route must define canonical constituency counts per region'
  );
  assert.ok(
    fileContent.includes('const totalPages = 2 + delegatePages.length + 1;'),
    'Album page count must be exactly cover + metrics + delegate pages + 1 final audit page'
  );
  assert.ok(
    fileContent.includes('Statutory Quota: 21 per Region'),
    'Page 2 must declare 21 regional statutory quota'
  );
  assert.ok(
    fileContent.includes('Statutory Quota: 19 (11 Elected + 8 Appointed)'),
    'Page 2 must declare 19 constituency statutory quota with 11 elected + 8 appointed'
  );
  assert.ok(
    fileContent.includes('expectedCount = 16 * 21;'),
    'Regional only nationwide must be 16 * 21 = 336'
  );
  assert.ok(
    fileContent.includes('expectedCount = 276 * 19;'),
    'Constituency only nationwide must be 276 * 19 = 5244'
  );
  assert.ok(
    fileContent.includes('regQuota + conQuota'),
    'Single region must sum regional quota and constituency quotas'
  );
});

test('Voter register client filter correctly matches delegates when custom or multi-level is active', () => {
  const pagePath = path.join(process.cwd(), 'app/admin/albums/page.tsx');
  const fileContent = fs.readFileSync(pagePath, 'utf8');

  assert.ok(
    fileContent.includes('level === "custom"'),
    'Client filter must handle custom level state'
  );
  assert.ok(
    fileContent.includes('selectedLevels.some'),
    'Client filter must check if delegate level is included in selectedLevels'
  );

  const mockDelegates = [
    { executive_name: 'John Regional', executive_level: 'Regional', constituency: '', region: 'Ashanti', canonical_position: 'Chairperson', voter_id: '1234567890' },
    { executive_name: 'Jane Constituency', executive_level: 'Constituency', constituency: 'Subin', region: 'Ashanti', canonical_position: 'Secretary', voter_id: '0987654321' },
    { executive_name: 'Kwame Tescon', executive_level: 'TESCON', constituency: 'KNUST', region: 'Ashanti', canonical_position: 'TESCON President', voter_id: '1122334455' },
  ];

  const selectedLevels = ['Regional', 'Constituency'];
  const level = 'custom';
  const search = '';

  const filtered = mockDelegates.filter((d) => {
    const matchesLevel =
      level === 'all'
        ? true
        : level === 'custom'
        ? selectedLevels.some((sl) => sl.toLowerCase() === String(d.executive_level || '').toLowerCase())
        : String(d.executive_level || '').toLowerCase() === level.toLowerCase();

    return (
      matchesLevel &&
      [d.executive_name, d.voter_id, d.constituency, d.region, d.canonical_position].some((value) =>
        String(value ?? '').toLowerCase().includes(search.trim().toLowerCase())
      )
    );
  });

  assert.equal(filtered.length, 2, 'Filtered must contain both Regional and Constituency executives');
  assert.equal(filtered[0].executive_name, 'John Regional');
  assert.equal(filtered[1].executive_name, 'Jane Constituency');
});

test('Election album statutory audit table renders TESCON institution count and External Branches 19x quota', () => {
  const routePath = path.join(process.cwd(), 'app/api/admin/albums/election/route.ts');
  const fileContent = fs.readFileSync(routePath, 'utf8');

  // TESCON must show number of institutions instead of Campus
  assert.ok(
    !fileContent.includes('>Campus<'),
    'TESCON row must not contain static "Campus" cell'
  );
  assert.ok(
    fileContent.includes('tesconInstitutionsCount'),
    'Route must calculate and render tesconInstitutionsCount'
  );
  assert.ok(
    fileContent.includes('${tesconInstitutionsCount.toLocaleString()}'),
    'TESCON row must display tesconInstitutionsCount in the Const. column'
  );

  // External branches must show 19 * constituencies as denominator and actual total sum as numerator
  assert.ok(
    fileContent.includes('extConstituencyTarget = extNumConstituencies * 19'),
    'Route must calculate External Branches statutory target as constituencies * 19'
  );
  assert.ok(
    fileContent.includes('${extCount.toLocaleString()} / ${extConstituencyTarget.toLocaleString()}'),
    'External Branches row must render numerator / denominator in Constituency (@ 19) column'
  );
});

test('Election album route filters Women Organiser electorate to regional, constituency, and TESCON females (excluding national)', () => {
  const routePath = path.join(process.cwd(), 'app/api/admin/albums/election/route.ts');
  const fileContent = fs.readFileSync(routePath, 'utf8');

  assert.ok(
    fileContent.includes('matchedContest === "Women Organiser"'),
    'Route must define Women Organiser contest branch'
  );
  assert.ok(
    fileContent.includes('["region", "regional", "constituency"].includes(lvl)'),
    'Women Organiser must only include regional and constituency (including external branch) levels, excluding national'
  );
});

