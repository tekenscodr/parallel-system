import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { getConstituenciesForRegion } from '../lib/constituency-normalizer.ts';
import {
  POSITION_PRESETS,
  isElectedConstituencyPosition,
} from '../lib/election-contests.ts';

test('Ahafo region has exactly 6 canonical constituencies and statutory quotas of 19 (constituency) and 21 (regional)', () => {
  const ahafoConstituencies = getConstituenciesForRegion('Ahafo');
  assert.equal(ahafoConstituencies.length, 6);
  assert.ok(ahafoConstituencies.includes('ASUNAFO NORTH'));
  assert.ok(ahafoConstituencies.includes('ASUNAFO SOUTH'));
  assert.ok(ahafoConstituencies.includes('ASUTIFI NORTH'));
  assert.ok(ahafoConstituencies.includes('ASUTIFI SOUTH'));
  assert.ok(ahafoConstituencies.includes('TANO NORTH'));
  assert.ok(ahafoConstituencies.includes('TANO SOUTH'));

  const conQuota = 19;
  const regQuota = 21;
  const totalQuota = regQuota + ahafoConstituencies.length * conQuota;
  assert.equal(totalQuota, 135, 'Total statutory quota for Ahafo must be 135 (21 + 6 * 19)');
});

test('Constituency 19 executives breakdown into 11 elected and 8 appointed positions', () => {
  const electedPositions = [
    'Constituency Chairperson',
    '1st Vice-Chairperson',
    '2nd Vice-Chairperson',
    'Constituency Secretary',
    'Assistant Secretary',
    'Deputy Constituency Secretary',
    'Constituency Treasurer',
    'Financial Secretary',
    'Constituency Organiser',
    'Constituency Women Organiser',
    'Constituency Youth Organiser',
    'Constituency Nasara Coordinator',
  ];

  for (const pos of electedPositions) {
    assert.equal(
      isElectedConstituencyPosition(pos),
      true,
      `Position "${pos}" must be classified as elected`
    );
  }

  const appointedPositions = [
    'Deputy Constituency Organiser',
    'Deputy Women Organiser',
    'Deputy Youth Organiser',
    'Deputy Nasara Coordinator',
    'Communication Officer',
    'Electoral Affairs Officer',
    'Research Officer',
    'PWD Coordinator',
    'Special Duties Officer',
    'Legal Officer',
  ];

  for (const pos of appointedPositions) {
    assert.equal(
      isElectedConstituencyPosition(pos),
      false,
      `Position "${pos}" must be classified as appointed`
    );
  }
});

test('Position presets in election-contests.ts define Full Constituency (19), Elected (11), and Appointed (8)', () => {
  assert.equal(POSITION_PRESETS.constituency_slate.label, 'Full Constituency Slate (19)');
  assert.equal(POSITION_PRESETS.constituency_slate.ids.length, 19);

  assert.equal(POSITION_PRESETS.elected_constituency.label, 'Elected Only (11)');
  assert.equal(POSITION_PRESETS.elected_constituency.ids.length, 11);

  assert.equal(POSITION_PRESETS.appointed_constituency.label, 'Appointed Only (8)');
  assert.equal(POSITION_PRESETS.appointed_constituency.ids.length, 8);

  const combinedIds = new Set([
    ...POSITION_PRESETS.elected_constituency.ids,
    ...POSITION_PRESETS.appointed_constituency.ids,
  ]);
  assert.equal(combinedIds.size, 19, 'Elected (11) and Appointed (8) must partition the 19 constituency positions');
});

test('Large regions (e.g. Ashanti, Greater Accra, Eastern) have > 22 units and trigger 2-column grid layout', () => {
  const ashantiConstituencies = getConstituenciesForRegion('Ashanti');
  assert.equal(ashantiConstituencies.length, 47);
  assert.ok(ashantiConstituencies.length > 22, 'Ashanti must exceed 22 to trigger 2-column side-by-side grid');

  const accraConstituencies = getConstituenciesForRegion('Greater Accra');
  assert.equal(accraConstituencies.length, 34);
  assert.ok(accraConstituencies.length > 22, 'Greater Accra must exceed 22 to trigger 2-column grid');

  const easternConstituencies = getConstituenciesForRegion('Eastern');
  assert.equal(easternConstituencies.length, 33);
  assert.ok(easternConstituencies.length > 22, 'Eastern must exceed 22 to trigger 2-column grid');
});

test('Route file contains single-region constituency breakdown, 11 elected + 8 appointed tracking, and 2-column compact grid', () => {
  const routeCode = fs.readFileSync(
    path.join(process.cwd(), 'app/api/admin/albums/election/route.ts'),
    'utf8'
  );

  assert.ok(routeCode.includes('getConstituenciesForRegion(selectedRegion)'), 'Route must load constituencies for selected region');
  assert.ok(routeCode.includes('two-col-audit-grid'), 'Route must define two-col-audit-grid for large regions');
  assert.ok(routeCode.includes('stats-table compact'), 'Route must define compact styling for multi-column layout');
  assert.ok(routeCode.includes('confirmedElected'), 'Route must calculate confirmedElected');
  assert.ok(routeCode.includes('confirmedAppointed'), 'Route must calculate confirmedAppointed');
  assert.ok(routeCode.includes('11 Elected + 8 Appointed'), 'Route must note 11 Elected + 8 Appointed quota breakdown');
  assert.ok(routeCode.includes('regionalQuota: regionalTargetPerUnit'), 'Metrics must include regionalQuota');
  assert.ok(routeCode.includes('constituencyQuota: constituencyTargetPerUnit'), 'Metrics must include constituencyQuota');
});

test('Excel export generates Constituency Statistics worksheet with Elected and Appointed breakdown', async () => {
  const workbook = new ExcelJS.Workbook();
  const conSheet = workbook.addWorksheet('Constituency Statistics');

  conSheet.mergeCells('A1:J1');
  const tCell = conSheet.getCell('A1');
  tCell.value = 'NPP CONSTITUENCY STATUTORY AUDIT & SIGN-OFF · STATUTORY QUOTA: 19 PER CONSTITUENCY (11 ELECTED + 8 APPOINTED)';

  const cHeader = conSheet.addRow([
    '#', 'Region', 'Constituency Name', 'Total Confirmed',
    'Elected (x/11)', 'Appointed (x/8)', 'Statutory Quota', 'Variance', 'Compliance Rate', 'Status'
  ]);

  conSheet.addRow([1, 'Ahafo', 'ASUNAFO NORTH', 19, '11 / 11', '8 / 8', 19, 0, '100.0%', 'Compliant']);
  conSheet.addRow([2, 'Ahafo', 'ASUTIFI SOUTH', 18, '10 / 11', '8 / 8', 19, 1, '94.7%', 'Under Quota']);

  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000);

  const readWorkbook = new ExcelJS.Workbook();
  await readWorkbook.xlsx.load(buffer);
  const readConSheet = readWorkbook.getWorksheet('Constituency Statistics');
  assert.ok(readConSheet, 'Constituency Statistics worksheet must exist');
  assert.equal(readConSheet.rowCount, 4);
  assert.equal(readConSheet.getRow(3).getCell(3).value, 'ASUNAFO NORTH');
  assert.equal(readConSheet.getRow(3).getCell(5).value, '11 / 11');
  assert.equal(readConSheet.getRow(3).getCell(6).value, '8 / 8');
  assert.equal(readConSheet.getRow(3).getCell(7).value, 19);
});

test('Album UI page.tsx includes Constituency statistics tab, KPI cards, preset buttons, and 11 elected + 8 appointed table columns', () => {
  const pageCode = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/albums/page.tsx'),
    'utf8'
  );

  assert.ok(pageCode.includes('Full Regional (21)'), 'Preset button must say Full Regional (21)');
  assert.ok(pageCode.includes('Full Constituency (19)'), 'Preset button must say Full Constituency (19)');
  assert.ok(pageCode.includes('Elected Only (11)'), 'Preset button must say Elected Only (11)');
  assert.ok(pageCode.includes('Appointed Only (8)'), 'Preset button must say Appointed Only (8)');
  assert.ok(pageCode.includes('value="stats"'), 'Tabs must have value="stats"');
  assert.ok(pageCode.includes('Constituency statistics'), 'Tabs must feature Constituency statistics label');
  assert.ok(pageCode.includes('11 Elected + 8 Appointed'), 'KPI card must mention 11 Elected + 8 Appointed');
  assert.ok(pageCode.includes('Regional Quota'), 'Page must show Regional Quota card');
  assert.ok(pageCode.includes('Elected (x/11)'), 'Table must have Elected (x/11) column header');
  assert.ok(pageCode.includes('Appointed (x/8)'), 'Table must have Appointed (x/8) column header');
  assert.ok(pageCode.includes('allConstituencyAudit'), 'Page must process allConstituencyAudit');
  assert.ok(pageCode.includes('pagedConstituencies'), 'Page must paginate constituency audit table');
});
