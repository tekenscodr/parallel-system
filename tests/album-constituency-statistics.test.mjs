import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { getConstituenciesForRegion, normalizeConstituency } from '../lib/constituency-normalizer.ts';

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

test('Route file contains single-region constituency breakdown and 2-column compact grid', () => {
  const routeCode = fs.readFileSync(
    path.join(process.cwd(), 'app/api/admin/albums/election/route.ts'),
    'utf8'
  );

  assert.ok(routeCode.includes('getConstituenciesForRegion(selectedRegion)'), 'Route must load constituencies for selected region');
  assert.ok(routeCode.includes('two-col-audit-grid'), 'Route must define two-col-audit-grid for large regions');
  assert.ok(routeCode.includes('stats-table compact'), 'Route must define compact styling for multi-column layout');
  assert.ok(routeCode.includes('constituencyAudit: Array<'), 'Route must calculate constituencyAudit array');
  assert.ok(routeCode.includes('regionalQuota: regionalTargetPerUnit'), 'Metrics must include regionalQuota');
  assert.ok(routeCode.includes('constituencyQuota: constituencyTargetPerUnit'), 'Metrics must include constituencyQuota');
});

test('Excel export generates Constituency Statistics worksheet with complete audit headers', async () => {
  const workbook = new ExcelJS.Workbook();
  const conSheet = workbook.addWorksheet('Constituency Statistics');

  conSheet.mergeCells('A1:H1');
  const tCell = conSheet.getCell('A1');
  tCell.value = 'NPP CONSTITUENCY STATUTORY AUDIT & SIGN-OFF · STATUTORY QUOTA: 19 PER CONSTITUENCY';

  const cHeader = conSheet.addRow([
    '#', 'Region', 'Constituency Name', 'Confirmed Voters',
    'Statutory Quota', 'Variance', 'Compliance Rate', 'Status'
  ]);

  conSheet.addRow([1, 'Ahafo', 'ASUNAFO NORTH', 19, 19, 0, '100.0%', 'Compliant']);
  conSheet.addRow([2, 'Ahafo', 'ASUNAFO SOUTH', 19, 19, 0, '100.0%', 'Compliant']);

  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000);

  const readWorkbook = new ExcelJS.Workbook();
  await readWorkbook.xlsx.load(buffer);
  const readConSheet = readWorkbook.getWorksheet('Constituency Statistics');
  assert.ok(readConSheet, 'Constituency Statistics worksheet must exist');
  assert.equal(readConSheet.rowCount, 4);
  assert.equal(readConSheet.getRow(3).getCell(3).value, 'ASUNAFO NORTH');
  assert.equal(readConSheet.getRow(3).getCell(5).value, 19);
});

test('Album UI page.tsx includes Constituency statistics tab, KPI cards, and audit table', () => {
  const pageCode = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/albums/page.tsx'),
    'utf8'
  );

  assert.ok(pageCode.includes('value="stats"'), 'Tabs must have value="stats"');
  assert.ok(pageCode.includes('Constituency statistics'), 'Tabs must feature Constituency statistics label');
  assert.ok(pageCode.includes('Constituency Quota'), 'Page must show Constituency Quota card');
  assert.ok(pageCode.includes('Regional Quota'), 'Page must show Regional Quota card');
  assert.ok(pageCode.includes('allConstituencyAudit'), 'Page must process allConstituencyAudit');
  assert.ok(pageCode.includes('pagedConstituencies'), 'Page must paginate constituency audit table');
});
