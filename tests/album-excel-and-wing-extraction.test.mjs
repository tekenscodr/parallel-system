import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { WING_PORTFOLIOS, GENERAL_CONTEST_LIST, CONTEST_LIST } from '../lib/election-contests.ts';

test('lib/election-contests contains wing portfolios and general contests', () => {
  assert.ok(WING_PORTFOLIOS.includes('Youth Organisers & Deputies'));
  assert.ok(WING_PORTFOLIOS.includes('Women Organisers & Deputies'));
  assert.ok(WING_PORTFOLIOS.includes('Nasara Coordinators & Deputies'));
  assert.equal(WING_PORTFOLIOS.length, 3);

  assert.ok(CONTEST_LIST.includes('Youth Organisers & Deputies'));
  assert.ok(CONTEST_LIST.includes('Youth Organiser'));
  assert.ok(CONTEST_LIST.includes('Women Organiser'));
  assert.ok(CONTEST_LIST.includes('Nasara Organiser'));
});

test('ExcelJS produces valid multi-sheet workbook buffer with voter directory and metrics', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Voter Directory');
  
  const headers = [
    '#', 'Voter ID', 'Executive Name', 'Executive Level', 'Region',
    'Constituency / Jurisdiction', 'Position Held', 'Canonical Position',
    'Gender', 'Age', 'Date of Birth', 'Phone Number', 'Biometric Status', 'Photo Available'
  ];
  sheet.addRow(headers);
  sheet.addRow([1, '1806003705', 'ROBERT SARFO-MENSAH', 'Regional', 'Ahafo', 'Asunafo North', 'Chairman', 'Chairperson', 'Male', 56, '1970-01-01', '0241484864', 'Verified', 'Yes']);

  const metricsSheet = workbook.addWorksheet('Summary & Metrics');
  metricsSheet.addRow(['Portfolio / Wing', 'Youth Organisers & Deputies', 'Confirmed Voters', 552]);

  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000, 'Excel buffer must be substantial');

  // Re-read workbook to verify integrity
  const readWorkbook = new ExcelJS.Workbook();
  await readWorkbook.xlsx.load(buffer);
  const readSheet = readWorkbook.getWorksheet('Voter Directory');
  assert.ok(readSheet, 'Voter Directory sheet must exist');
  assert.equal(readSheet.rowCount, 2);
  assert.equal(readSheet.getRow(2).getCell(3).value, 'ROBERT SARFO-MENSAH');

  const readMetrics = readWorkbook.getWorksheet('Summary & Metrics');
  assert.ok(readMetrics, 'Summary & Metrics sheet must exist');
  assert.equal(readMetrics.getRow(1).getCell(2).value, 'Youth Organisers & Deputies');
});

test('Wing extraction filtering rules correctly isolate organisers and deputies', () => {
  const sampleExecutives = [
    { position: 'Youth Organiser', gender: 'Male', age: 32, executive_level: 'Constituency' },
    { position: 'Deputy Youth Organiser', gender: 'Female', age: 28, executive_level: 'Constituency' },
    { position: 'Chairperson', gender: 'Male', age: 34, executive_level: 'Constituency' }, // Under 40, but NOT youth organiser
    { position: 'Women Organiser', gender: 'Female', age: 45, executive_level: 'Constituency' },
    { position: 'Deputy Women Organiser', gender: 'Female', age: 40, executive_level: 'Constituency' },
    { position: 'Secretary', gender: 'Female', age: 38, executive_level: 'Constituency' }, // Female, but NOT women organiser
    { position: 'Nasara Coordinator', gender: 'Male', age: 50, executive_level: 'Region' },
    { position: 'Deputy Nasara Coordinator', gender: 'Male', age: 42, executive_level: 'Region' },
    { position: 'Nasara Organiser', gender: 'Male', age: 48, executive_level: 'Constituency' },
    { position: 'Deputy Nasara Organiser', gender: 'Male', age: 39, executive_level: 'Constituency' },
    { position: 'Former Youth Organiser', gender: 'Male', age: 45, executive_level: 'National' }, // Former, should be excluded
  ];

  // Youth Organisers & Deputies test
  const youthExtracted = sampleExecutives.filter((r) => {
    const posLower = r.position.toLowerCase();
    return (
      (posLower.includes('youth organiser') ||
        posLower.includes('youth organizer') ||
        posLower === 'youth' ||
        posLower.includes('deputy youth') ||
        posLower.includes('assistant youth')) &&
      !posLower.includes('former') &&
      !posLower.includes('patron')
    );
  });
  assert.equal(youthExtracted.length, 2, 'Should only extract substantive Youth Organisers & Deputies');
  assert.ok(youthExtracted.some(e => e.position === 'Youth Organiser'));
  assert.ok(youthExtracted.some(e => e.position === 'Deputy Youth Organiser'));
  assert.ok(!youthExtracted.some(e => e.position === 'Chairperson'), 'Under 40 Chairperson must NOT be in wing extraction');

  // Women Organisers & Deputies test
  const womenExtracted = sampleExecutives.filter((r) => {
    const posLower = r.position.toLowerCase();
    return (
      (posLower.includes('women organiser') ||
        posLower.includes('women organizer') ||
        posLower === 'women' ||
        posLower.includes('deputy women') ||
        posLower.includes('assistant women') ||
        posLower.includes('wocom')) &&
      !posLower.includes('former') &&
      !posLower.includes('patron')
    );
  });
  assert.equal(womenExtracted.length, 2, 'Should only extract substantive Women Organisers & Deputies');
  assert.ok(womenExtracted.some(e => e.position === 'Women Organiser'));
  assert.ok(womenExtracted.some(e => e.position === 'Deputy Women Organiser'));
  assert.ok(!womenExtracted.some(e => e.position === 'Secretary'), 'Female Secretary must NOT be in wing extraction');

  // Nasara Coordinators & Deputies test
  const nasaraExtracted = sampleExecutives.filter((r) => {
    const posLower = r.position.toLowerCase();
    return (
      posLower.includes('nasara') &&
      !posLower.includes('former') &&
      !posLower.includes('patron')
    );
  });
  assert.equal(nasaraExtracted.length, 4, 'Should only extract Nasara Coordinators, Organisers & Deputies');
});

test('Route and page files contain Excel export and Wing extraction capabilities', () => {
  const routeCode = fs.readFileSync(
    path.join(process.cwd(), 'app/api/admin/albums/election/route.ts'),
    'utf8'
  );
  assert.ok(routeCode.includes('import ExcelJS from "exceljs"'), 'Route must import ExcelJS');
  assert.ok(routeCode.includes('generateAlbumExcel'), 'Route must define generateAlbumExcel');
  assert.ok(routeCode.includes('format === "excel" || format === "xlsx"'), 'Route must handle format=excel/xlsx');
  assert.ok(routeCode.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'Route must set correct spreadsheet mime type');

  const pageCode = fs.readFileSync(
    path.join(process.cwd(), 'app/admin/albums/page.tsx'),
    'utf8'
  );
  assert.ok(pageCode.includes('Download Excel (.xlsx)'), 'Page must have Download Excel button');
  assert.ok(pageCode.includes('Export Excel (.xlsx)'), 'Page must have Export Excel in voter register');
  assert.ok(pageCode.includes('Wing Organisers & Deputies (Exclusive Extraction)'), 'Page must feature Wing extraction optgroup');
  assert.ok(pageCode.includes('organisers_only'), 'Page must support organisers_only scope');
});

test('Election route strictly excludes TESCON WOCOM and TESCON Nasara from Youth contests', () => {
  const routeCode = fs.readFileSync(
    path.join(process.cwd(), 'app/api/admin/albums/election/route.ts'),
    'utf8'
  );

  // In Youth Organisers & Deputies:
  assert.ok(
    routeCode.includes('if (/wocom|women|nasara/i.test(posLower)) return false;'),
    'Youth contest must explicitly exclude TESCON WOCOM and Nasara'
  );

  // In Youth regional statutory quotas:
  assert.ok(routeCode.includes('"Ashanti": 141,'), 'Youth Wing Ashanti statutory quota must be 141 (excluding WOCOM and Nasara)');
  assert.ok(routeCode.includes('"Ashanti": 351,'), 'Youth General Ashanti statutory quota must be 351 (excluding WOCOM and Nasara)');
  assert.ok(routeCode.includes('positionNationalExpected = 887;'), 'Youth Wing national expected benchmark must be 887');
  assert.ok(routeCode.includes('positionNationalExpected = filterGender === "male" ? 1990 : filterGender === "female" ? 350 : 2355;'), 'Youth Organiser national expected benchmark must be 2,355');
});
