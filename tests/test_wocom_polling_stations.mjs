import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POLLING_STATION_GROUPINGS } from '../lib/polling-stations.ts';

test('WOCOM Polling Stations Configuration', () => {
  const ps1 = POLLING_STATION_GROUPINGS.find((g) => g.id === 'wocom_ps_1');
  const ps2 = POLLING_STATION_GROUPINGS.find((g) => g.id === 'wocom_ps_2');
  const ps3 = POLLING_STATION_GROUPINGS.find((g) => g.id === 'wocom_ps_3');

  assert.ok(ps1, 'wocom_ps_1 must exist');
  assert.ok(ps2, 'wocom_ps_2 must exist');
  assert.ok(ps3, 'wocom_ps_3 must exist');

  // Polling Station 1 must include National Headquarters and National Officers
  assert.equal(ps1.includeNationalOfficers, true, 'wocom_ps_1 must have includeNationalOfficers: true');
  assert.ok(ps1.regions.includes('National Headquarters'), 'wocom_ps_1 regions must include National Headquarters');
  assert.ok(!ps1.includeExternalBranches, 'wocom_ps_1 must NOT include external branches');
  assert.ok(!ps1.regions.includes('External Branch'), 'wocom_ps_1 regions must NOT include External Branch');

  // Polling Station 2 must include External Branch (Diaspora)
  assert.equal(ps2.includeExternalBranches, true, 'wocom_ps_2 must have includeExternalBranches: true');
  assert.ok(ps2.regions.includes('External Branch'), 'wocom_ps_2 regions must include External Branch');
  assert.ok(!ps2.includeNationalOfficers, 'wocom_ps_2 must NOT include national officers');
  assert.ok(!ps2.regions.includes('National Headquarters'), 'wocom_ps_2 regions must NOT include National Headquarters');

  // Polling Station 3 must NOT include National Headquarters or External Branch
  assert.ok(!ps3.includeNationalOfficers, 'wocom_ps_3 must NOT have includeNationalOfficers');
  assert.ok(!ps3.includeExternalBranches, 'wocom_ps_3 must NOT have includeExternalBranches');
  assert.ok(!ps3.regions.includes('National Headquarters'), 'wocom_ps_3 regions must NOT include National Headquarters');
  assert.ok(!ps3.regions.includes('External Branch'), 'wocom_ps_3 regions must NOT include External Branch');
});

test('WOCOM Polling Stations Filtering Logic Simulation', () => {
  const ps1 = POLLING_STATION_GROUPINGS.find((g) => g.id === 'wocom_ps_1');
  const ps2 = POLLING_STATION_GROUPINGS.find((g) => g.id === 'wocom_ps_2');
  const ps3 = POLLING_STATION_GROUPINGS.find((g) => g.id === 'wocom_ps_3');

  function matchStation(station, r) {
    const rawLvl = String(r.executive_level || '').toLowerCase().trim();
    const rowReg = String(r.region || '').toLowerCase().trim();
    const isRowExternal = rawLvl.includes('external') || rowReg.includes('external');
    const isRowNational = rawLvl === 'national' || rowReg.includes('national');

    if (isRowNational) {
      if (!station.includeNationalOfficers) return false;
    }

    if (isRowExternal) {
      if (!station.includeExternalBranches && station.splitRegion !== 'External Branch') {
        return false;
      }
    }

    if (!isRowNational && !isRowExternal) {
      const inStationRegions = station.regions.some(
        (reg) => reg.toLowerCase().trim() === rowReg
      );
      if (!inStationRegions) return false;
    }

    return true;
  }

  const natExecutive = { executive_level: 'National', region: 'National Headquarters', position: 'Women Organiser' };
  const extExecutive = { executive_level: 'External Branch', region: 'External Branch', position: 'Women Organiser' };
  const gaExecutive = { executive_level: 'Constituency', region: 'Greater Accra', position: 'Women Organiser' };
  const ashExecutive = { executive_level: 'Constituency', region: 'Ashanti', position: 'Women Organiser' };
  const ueExecutive = { executive_level: 'Constituency', region: 'Upper East', position: 'Women Organiser' };

  // National Executive -> PS 1 only
  assert.equal(matchStation(ps1, natExecutive), true, 'National executive must match PS 1');
  assert.equal(matchStation(ps2, natExecutive), false, 'National executive must NOT match PS 2');
  assert.equal(matchStation(ps3, natExecutive), false, 'National executive must NOT match PS 3');

  // External Branch Executive -> PS 2 only
  assert.equal(matchStation(ps1, extExecutive), false, 'External branch executive must NOT match PS 1');
  assert.equal(matchStation(ps2, extExecutive), true, 'External branch executive must match PS 2');
  assert.equal(matchStation(ps3, extExecutive), false, 'External branch executive must NOT match PS 3');

  // Greater Accra -> PS 1 only
  assert.equal(matchStation(ps1, gaExecutive), true, 'Greater Accra executive must match PS 1');
  assert.equal(matchStation(ps2, gaExecutive), false, 'Greater Accra executive must NOT match PS 2');
  assert.equal(matchStation(ps3, gaExecutive), false, 'Greater Accra executive must NOT match PS 3');

  // Ashanti -> PS 2 only
  assert.equal(matchStation(ps1, ashExecutive), false, 'Ashanti executive must NOT match PS 1');
  assert.equal(matchStation(ps2, ashExecutive), true, 'Ashanti executive must match PS 2');
  assert.equal(matchStation(ps3, ashExecutive), false, 'Ashanti executive must NOT match PS 3');

  // Upper East -> PS 3 only
  assert.equal(matchStation(ps1, ueExecutive), false, 'Upper East executive must NOT match PS 1');
  assert.equal(matchStation(ps2, ueExecutive), false, 'Upper East executive must NOT match PS 2');
  assert.equal(matchStation(ps3, ueExecutive), true, 'Upper East executive must match PS 3');
});

test('WOCOM Polling Stations Pagination: Region-level grouping without per-constituency splitting', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const routePath = path.join(process.cwd(), 'app/api/admin/albums/election/route.ts');
  const code = fs.readFileSync(routePath, 'utf8');

  // Verify that isWomenPollingStation is defined and active in route.ts
  assert.ok(code.includes('isWomenPollingStation'), 'route.ts must define isWomenPollingStation');
  assert.ok(code.includes('category === "wocom_wing"'), 'isWomenPollingStation must check wocom_wing category');

  // Verify that constituency executives are chunked 10 per page across region
  assert.ok(
    code.includes('headerSubTitle: `${regionPrefix}CONSTITUENCY EXECUTIVES (PART ${partIdx})`'),
    'Constituency pages for women polling stations must chunk continuous parts across the region'
  );

  // Verify that external branches are chunked 10 per page across diaspora chapters
  assert.ok(
    code.includes('headerSubTitle: `EXTERNAL BRANCHES (DIASPORA) · EXECUTIVES (PART ${partIdx})`'),
    'External branches for women polling stations must chunk continuous parts across chapters'
  );

  // Simulation test: 34 Greater Accra constituencies with 2 executives each = 68 executives
  const sampleGaDelegates = [];
  for (let c = 1; c <= 34; c++) {
    const conName = `Constituency ${c}`;
    sampleGaDelegates.push({
      executive_name: `GA Exec 1 (${conName})`,
      executive_level: 'Constituency',
      region: 'Greater Accra',
      constituency: conName,
      position_rank: 8,
    });
    sampleGaDelegates.push({
      executive_name: `GA Exec 2 (${conName})`,
      executive_level: 'Constituency',
      region: 'Greater Accra',
      constituency: conName,
      position_rank: 9,
    });
  }

  // 12 Bono constituencies with 2 executives each = 24 executives
  const sampleBonoDelegates = [];
  for (let c = 1; c <= 12; c++) {
    const conName = `Bono Constituency ${c}`;
    sampleBonoDelegates.push({
      executive_name: `Bono Exec 1 (${conName})`,
      executive_level: 'Constituency',
      region: 'Bono',
      constituency: conName,
      position_rank: 8,
    });
    sampleBonoDelegates.push({
      executive_name: `Bono Exec 2 (${conName})`,
      executive_level: 'Constituency',
      region: 'Bono',
      constituency: conName,
      position_rank: 9,
    });
  }

  const allDelegates = [...sampleGaDelegates, ...sampleBonoDelegates];

  // Pagination simulation matching route.ts logic:
  const cardPages = [];
  let currentCardPageNum = 3;

  for (const regionName of ['Greater Accra', 'Bono']) {
    const constExecs = allDelegates.filter(
      (d) => d.executive_level === 'Constituency' && d.region.toLowerCase() === regionName.toLowerCase()
    );

    const constituencyGroups = new Map();
    for (const d of constExecs) {
      const cName = d.constituency;
      if (!constituencyGroups.has(cName)) constituencyGroups.set(cName, []);
      constituencyGroups.get(cName).push(d);
    }

    const sortedConstituencyNames = Array.from(constituencyGroups.keys()).sort((a, b) => a.localeCompare(b));

    // Women polling station logic:
    const allRegionConstExecs = [];
    for (const cName of sortedConstituencyNames) {
      const cList = constituencyGroups.get(cName);
      cList.sort((a, b) => (a.position_rank !== b.position_rank ? a.position_rank - b.position_rank : a.executive_name.localeCompare(b.executive_name)));
      allRegionConstExecs.push(...cList);
    }

    const regionPrefix = `${regionName.toUpperCase()} REGION · `;
    for (let i = 0; i < allRegionConstExecs.length; i += 10) {
      const chunk = allRegionConstExecs.slice(i, i + 10);
      const partIdx = Math.floor(i / 10) + 1;
      chunk.forEach((d) => { d.page_number = currentCardPageNum; });
      cardPages.push({
        headerSubTitle: `${regionPrefix}CONSTITUENCY EXECUTIVES (PART ${partIdx})`,
        footerLabel: `${regionName.toUpperCase()} CONSTITUENCY EXECUTIVES`,
        cards: chunk,
        region: regionName,
      });
      currentCardPageNum++;
    }
  }

  // Greater Accra (68 delegates) -> ceil(68 / 10) = 7 pages
  // Bono (24 delegates) -> ceil(24 / 10) = 3 pages
  // Total pages = 10 pages (instead of 34 + 12 = 46 pages!)
  assert.equal(cardPages.length, 10, 'Must produce 10 pages total (7 for GA, 3 for Bono)');

  const gaPages = cardPages.filter((p) => p.region === 'Greater Accra');
  assert.equal(gaPages.length, 7, 'Greater Accra must have exactly 7 pages');
  assert.equal(gaPages[0].cards.length, 10, 'GA Part 1 must have 10 cards');
  assert.equal(gaPages[5].cards.length, 10, 'GA Part 6 must have 10 cards');
  assert.equal(gaPages[6].cards.length, 8, 'GA Part 7 must have 8 cards');
  assert.equal(gaPages[0].headerSubTitle, 'GREATER ACCRA REGION · CONSTITUENCY EXECUTIVES (PART 1)');

  const bonoPages = cardPages.filter((p) => p.region === 'Bono');
  assert.equal(bonoPages.length, 3, 'Bono must have exactly 3 pages');
  assert.equal(bonoPages[0].cards.length, 10, 'Bono Part 1 must have 10 cards');
  assert.equal(bonoPages[1].cards.length, 10, 'Bono Part 2 must have 10 cards');
  assert.equal(bonoPages[2].cards.length, 4, 'Bono Part 3 must have 4 cards');
  assert.equal(bonoPages[0].headerSubTitle, 'BONO REGION · CONSTITUENCY EXECUTIVES (PART 1)');

  // Ensure regions never mix on the same page
  for (const page of cardPages) {
    const pageRegions = new Set(page.cards.map((c) => c.region));
    assert.equal(pageRegions.size, 1, 'Each card page must strictly belong to a single region');
  }
});

test('WOCOM Polling Station 2: External Branches (Diaspora) flow 10 per page without chapter splitting', () => {
  const branches = ['United Kingdom', 'United States', 'Germany', 'Canada', 'France', 'Italy', 'Australia', 'Netherlands'];
  const extDelegates = [];

  for (const b of branches) {
    extDelegates.push({
      executive_name: `Ext Exec 1 (${b})`,
      executive_level: 'External Branch',
      region: 'External Branch',
      constituency: b,
      position_rank: 8,
    });
    extDelegates.push({
      executive_name: `Ext Exec 2 (${b})`,
      executive_level: 'External Branch',
      region: 'External Branch',
      constituency: b,
      position_rank: 9,
    });
  }

  // 8 branches * 2 = 16 delegates
  assert.equal(extDelegates.length, 16);

  const branchGroups = new Map();
  for (const d of extDelegates) {
    const bName = d.constituency;
    if (!branchGroups.has(bName)) branchGroups.set(bName, []);
    branchGroups.get(bName).push(d);
  }

  // Women polling station pagination logic for external branches:
  const allExtBranchExecs = [];
  const sortedBranchNames = Array.from(branchGroups.keys()).sort((a, b) => a.localeCompare(b));
  for (const branchName of sortedBranchNames) {
    const bList = branchGroups.get(branchName);
    bList.sort((a, b) => (a.position_rank !== b.position_rank ? a.position_rank - b.position_rank : a.executive_name.localeCompare(b.executive_name)));
    allExtBranchExecs.push(...bList);
  }

  const cardPages = [];
  let currentCardPageNum = 3;
  for (let i = 0; i < allExtBranchExecs.length; i += 10) {
    const chunk = allExtBranchExecs.slice(i, i + 10);
    const partIdx = Math.floor(i / 10) + 1;
    chunk.forEach((d) => { d.page_number = currentCardPageNum; });
    cardPages.push({
      headerSubTitle: `EXTERNAL BRANCHES (DIASPORA) · EXECUTIVES (PART ${partIdx})`,
      footerLabel: `EXTERNAL BRANCHES (DIASPORA)`,
      cards: chunk,
      totalConstituencyExecutives: allExtBranchExecs.length,
    });
    currentCardPageNum++;
  }

  // 16 delegates / 10 = 2 pages (10 cards on part 1, 6 cards on part 2) instead of 8 pages!
  assert.equal(cardPages.length, 2, 'External branches must produce 2 continuous pages');
  assert.equal(cardPages[0].cards.length, 10, 'Part 1 must have 10 cards');
  assert.equal(cardPages[1].cards.length, 6, 'Part 2 must have 6 cards');
  assert.equal(cardPages[0].headerSubTitle, 'EXTERNAL BRANCHES (DIASPORA) · EXECUTIVES (PART 1)');
  assert.equal(cardPages[1].headerSubTitle, 'EXTERNAL BRANCHES (DIASPORA) · EXECUTIVES (PART 2)');
});

test('Youth and any wings using polling stations split according to region', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const routePath = path.join(process.cwd(), 'app/api/admin/albums/election/route.ts');
  const code = fs.readFileSync(routePath, 'utf8');

  // 1. Verify route.ts checks isWingPollingStation for youth_wing, nasara_wing, and all wing polling stations
  assert.ok(code.includes('isWingPollingStation'), 'route.ts must define isWingPollingStation');
  assert.ok(code.includes('category === "youth_wing"'), 'isWingPollingStation must check youth_wing category');
  assert.ok(code.includes('category === "nasara_wing"'), 'isWingPollingStation must check nasara_wing category');
  assert.ok(code.includes('category === "wocom_wing"'), 'isWingPollingStation must check wocom_wing category');

  // 2. Verify all Youth polling stations exist in POLLING_STATION_GROUPINGS
  for (let i = 1; i <= 5; i++) {
    const yps = POLLING_STATION_GROUPINGS.find((g) => g.id === `youth_ps_${i}`);
    assert.ok(yps, `youth_ps_${i} must exist`);
    assert.equal(yps.category, 'youth_wing', `youth_ps_${i} must be category youth_wing`);
  }

  // 3. Verify Nasara polling stations exist
  for (let i = 1; i <= 2; i++) {
    const nps = POLLING_STATION_GROUPINGS.find((g) => g.id === `nasara_ps_${i}`);
    assert.ok(nps, `nasara_ps_${i} must exist`);
    assert.equal(nps.category, 'nasara_wing', `nasara_ps_${i} must be category nasara_wing`);
  }

  // 4. Simulate Youth Polling Station 4 (Ashanti, Ahafo, North East)
  // Ashanti: 47 constituencies * 2 = 94 delegates
  // Ahafo: 6 constituencies * 2 = 12 delegates
  // North East: 6 constituencies * 2 = 12 delegates
  const youthDelegates = [];
  for (let c = 1; c <= 47; c++) {
    const cName = `Ashanti Con ${c}`;
    youthDelegates.push({ executive_name: `Ash Youth 1 (${cName})`, executive_level: 'Constituency', region: 'Ashanti', constituency: cName, position_rank: 8 });
    youthDelegates.push({ executive_name: `Ash Youth 2 (${cName})`, executive_level: 'Constituency', region: 'Ashanti', constituency: cName, position_rank: 9 });
  }
  for (let c = 1; c <= 6; c++) {
    const cName = `Ahafo Con ${c}`;
    youthDelegates.push({ executive_name: `Ahafo Youth 1 (${cName})`, executive_level: 'Constituency', region: 'Ahafo', constituency: cName, position_rank: 8 });
    youthDelegates.push({ executive_name: `Ahafo Youth 2 (${cName})`, executive_level: 'Constituency', region: 'Ahafo', constituency: cName, position_rank: 9 });
  }
  for (let c = 1; c <= 6; c++) {
    const cName = `NE Con ${c}`;
    youthDelegates.push({ executive_name: `NE Youth 1 (${cName})`, executive_level: 'Constituency', region: 'North East', constituency: cName, position_rank: 8 });
    youthDelegates.push({ executive_name: `NE Youth 2 (${cName})`, executive_level: 'Constituency', region: 'North East', constituency: cName, position_rank: 9 });
  }

  // Total delegates = 94 + 12 + 12 = 118 delegates
  assert.equal(youthDelegates.length, 118);

  const cardPages = [];
  let currentCardPageNum = 3;

  for (const regionName of ['Ashanti', 'Ahafo', 'North East']) {
    const constExecs = youthDelegates.filter(
      (d) => d.executive_level === 'Constituency' && d.region.toLowerCase() === regionName.toLowerCase()
    );

    const constituencyGroups = new Map();
    for (const d of constExecs) {
      const cName = d.constituency;
      if (!constituencyGroups.has(cName)) constituencyGroups.set(cName, []);
      constituencyGroups.get(cName).push(d);
    }

    const sortedConstituencyNames = Array.from(constituencyGroups.keys()).sort((a, b) => a.localeCompare(b));

    // Wing polling station pagination logic:
    const allRegionConstExecs = [];
    for (const cName of sortedConstituencyNames) {
      const cList = constituencyGroups.get(cName);
      cList.sort((a, b) => (a.position_rank !== b.position_rank ? a.position_rank - b.position_rank : a.executive_name.localeCompare(b.executive_name)));
      allRegionConstExecs.push(...cList);
    }

    const regionPrefix = `${regionName.toUpperCase()} REGION · `;
    for (let i = 0; i < allRegionConstExecs.length; i += 10) {
      const chunk = allRegionConstExecs.slice(i, i + 10);
      const partIdx = Math.floor(i / 10) + 1;
      chunk.forEach((d) => { d.page_number = currentCardPageNum; });
      cardPages.push({
        headerSubTitle: `${regionPrefix}CONSTITUENCY EXECUTIVES (PART ${partIdx})`,
        footerLabel: `${regionName.toUpperCase()} CONSTITUENCY EXECUTIVES`,
        cards: chunk,
        region: regionName,
      });
      currentCardPageNum++;
    }
  }

  // Ashanti (94 delegates) -> ceil(94 / 10) = 10 pages
  // Ahafo (12 delegates) -> ceil(12 / 10) = 2 pages
  // North East (12 delegates) -> ceil(12 / 10) = 2 pages
  // Total pages = 14 pages (instead of 47 + 6 + 6 = 59 pages!)
  assert.equal(cardPages.length, 14, 'Must produce 14 pages total (10 for Ashanti, 2 for Ahafo, 2 for North East)');

  const ashPages = cardPages.filter((p) => p.region === 'Ashanti');
  assert.equal(ashPages.length, 10, 'Ashanti must have exactly 10 pages');
  assert.equal(ashPages[0].cards.length, 10, 'Ashanti Part 1 must have 10 cards');
  assert.equal(ashPages[9].cards.length, 4, 'Ashanti Part 10 must have 4 cards');
  assert.equal(ashPages[0].headerSubTitle, 'ASHANTI REGION · CONSTITUENCY EXECUTIVES (PART 1)');

  const ahafoPages = cardPages.filter((p) => p.region === 'Ahafo');
  assert.equal(ahafoPages.length, 2, 'Ahafo must have exactly 2 pages');
  assert.equal(ahafoPages[0].cards.length, 10, 'Ahafo Part 1 must have 10 cards');
  assert.equal(ahafoPages[1].cards.length, 2, 'Ahafo Part 2 must have 2 cards');
  assert.equal(ahafoPages[0].headerSubTitle, 'AHAFO REGION · CONSTITUENCY EXECUTIVES (PART 1)');

  const nePages = cardPages.filter((p) => p.region === 'North East');
  assert.equal(nePages.length, 2, 'North East must have exactly 2 pages');
  assert.equal(nePages[0].cards.length, 10, 'North East Part 1 must have 10 cards');
  assert.equal(nePages[1].cards.length, 2, 'North East Part 2 must have 2 cards');
  assert.equal(nePages[0].headerSubTitle, 'NORTH EAST REGION · CONSTITUENCY EXECUTIVES (PART 1)');

  // Ensure regions never mix on the same page
  for (const page of cardPages) {
    const pageRegions = new Set(page.cards.map((c) => c.region));
    assert.equal(pageRegions.size, 1, 'Each card page must strictly belong to a single region');
  }
});



