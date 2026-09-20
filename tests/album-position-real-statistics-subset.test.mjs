import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Election album route enforces authoritative real position statistics when regions are left out', () => {
  const routePath = path.join(process.cwd(), 'app/api/admin/albums/election/route.ts');
  const routeContent = fs.readFileSync(routePath, 'utf8');

  // Verify positionNationalExpected statutory benchmarks
  assert.ok(
    routeContent.includes('matchedContest === "Women Organisers & Deputies"') &&
    routeContent.includes('positionNationalExpected = 1390;'),
    'Route must set Women Organisers & Deputies statutory quota to 1,390'
  );

  assert.ok(
    routeContent.includes('matchedContest === "Youth Organisers & Deputies"') &&
    routeContent.includes('positionNationalExpected = 1400;'),
    'Route must set Youth Wing statutory quota to 1,400'
  );

  assert.ok(
    routeContent.includes('matchedContest === "Youth Organiser"') &&
    routeContent.includes('positionNationalExpected = filterGender === "male" ? 2292 : filterGender === "female" ? 558 : 2850;'),
    'Route must set Youth Organiser statutory quota to 2,850'
  );

  assert.ok(
    routeContent.includes('matchedContest === "Nasara Organiser"') &&
    routeContent.includes('positionNationalExpected = 867;'),
    'Route must set Nasara statutory quota to 867'
  );

  assert.ok(
    routeContent.includes('matchedContest === "All Men"') &&
    routeContent.includes('positionNationalExpected = 5606;'),
    'Route must set All Men statutory quota to 5,606'
  );

  // Verify nationwide decoupling for position statistics
  assert.ok(
    routeContent.includes('positionNationwideRows = validRows.filter(isRowEligibleForContest);'),
    'Route must decouple nationwide confirmed delegates from regional query filter'
  );

  // Verify allRegionalRows mapping of all 16 Ghanaian regions with isIncluded flag
  assert.ok(
    routeContent.includes('const allRegionalRows = GHANA_REGIONS_ORDER.map((reg) =>'),
    'Route must construct allRegionalRows across all 16 Ghanaian regions'
  );
  assert.ok(
    routeContent.includes('isIncluded: activeRegions.some(') || routeContent.includes('const isIncluded = activeRegions.some('),
    'allRegionalRows must check isIncluded against activeRegions'
  );

  // Verify Left Out tag and styling
  assert.ok(
    routeContent.includes('[Left Out]'),
    'Route must tag excluded jurisdictions with [Left Out]'
  );

  // Verify 3-tier footer summary structure for regional subsets
  assert.ok(
    routeContent.includes('ALBUM SUB-TOTAL (') && routeContent.includes('JURISDICTIONS INCLUDED):'),
    'Route must display ALBUM SUB-TOTAL row with included jurisdictions count'
  );
  assert.ok(
    routeContent.includes('EXCLUDED JURISDICTIONS (') && routeContent.includes('LEFT OUT):'),
    'Route must display EXCLUDED JURISDICTIONS row with left out count'
  );
  assert.ok(
    routeContent.includes('REAL POSITION TOTAL ('),
    'Route must display REAL POSITION TOTAL row'
  );

  // Verify position stats banner on the final page
  assert.ok(
    routeContent.includes('position-stats-banner'),
    'generateAlbumHtml must render position-stats-banner container'
  );
  assert.ok(
    routeContent.includes('AUTHORITATIVE STATUTORY POSITION BENCHMARK'),
    'position-stats-banner must feature AUTHORITATIVE STATUTORY POSITION BENCHMARK title'
  );
  assert.ok(
    routeContent.includes('confirmed nationwide across all 18 jurisdictions'),
    'position-stats-banner must detail nationwide confirmed delegates across 18 jurisdictions'
  );
  assert.ok(
    routeContent.includes('ALBUM SELECTION SCOPE'),
    'position-stats-banner must detail ALBUM SELECTION SCOPE'
  );

  // Verify metrics response object
  assert.ok(
    routeContent.includes('positionNational: {'),
    'Route metrics response must include positionNational object'
  );
  assert.ok(
    routeContent.includes('statutoryBenchmark: positionNationalExpected'),
    'metrics.positionNational must return statutoryBenchmark'
  );
  assert.ok(
    routeContent.includes('confirmedTotal: positionNationalConfirmed'),
    'metrics.positionNational must return confirmedTotal'
  );
});

test('Admin Album page UI synchronizes position benchmark in Confirmed voters KPI card', () => {
  const pagePath = path.join(process.cwd(), 'app/admin/albums/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Verify AlbumData type definition contains positionNational
  assert.ok(
    pageContent.includes('positionNational?: {'),
    'AlbumData.metrics must define optional positionNational object'
  );
  assert.ok(
    pageContent.includes('statutoryBenchmark: number;'),
    'positionNational type must include statutoryBenchmark'
  );

  // Verify KPI card includes Position Benchmark detail
  assert.ok(
    pageContent.includes('metrics.positionNational?.isRegionalSubset'),
    'KPI card must check if regional subset is active'
  );
  assert.ok(
    pageContent.includes('Position Benchmark:'),
    'KPI card detail must display Position Benchmark when subset is active'
  );
});
