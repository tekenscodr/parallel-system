import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = '/Users/THINKPAD/Documents/parallel/outputs/019fe8e0-0a1c-7b02-9f0d-46904ea7322e/nationwide-executives';
const checkpointPath = `${outputDir}/nationwide_checkpoint.json`;
const xlsxPath = `${outputDir}/nationwide_all_executive_levels.xlsx`;
const csvPath = `${outputDir}/nationwide_all_executives.csv`;
const jsonPath = `${outputDir}/nationwide_all_executive_levels.json`;

await fs.mkdir(outputDir, { recursive: true });
const source = JSON.parse(await fs.readFile(checkpointPath, 'utf8'));

const columns = [
  'Executive Level', 'Slot Status', 'Region', 'Constituency', 'Electoral Area',
  'Polling Station', 'Position', 'Executive Name', 'Membership ID', 'Phone',
  'Email', 'Ghana Card', 'Voter ID', 'Gender', 'Status'
];

function normalized(level, row) {
  return {
    executive_level: level,
    slot_status: row.slot_status || '',
    region: row.region || '',
    constituency: row.constituency || '',
    electoral_area: row.electoral_area || '',
    polling_station: row.polling_station || '',
    position: row.position || '',
    executive_name: row.applicant_name || '',
    membership_id: row.membership_id || '',
    phone: row.phone || '',
    email: row.email || '',
    ghana_card: row.ghana_card || '',
    voter_id: row.voter_id || '',
    gender: row.gender || '',
    status: row.status || 'Election won',
  };
}

const constituencyRows = source.constituencyExecutives.map(r => normalized('Constituency', r));
const electoralRows = source.electoralArea.map(r => normalized('Electoral Area', r));
const pollingRows = source.polling.map(r => normalized('Polling Station', r));
const allRows = [...constituencyRows, ...electoralRows, ...pollingRows];

await fs.writeFile(jsonPath, JSON.stringify({
  extracted_at: source.completedAt || source.updatedAt,
  constituency_count: source.constituencies.length,
  counts: {
    constituency_executives: constituencyRows.length,
    electoral_area_executives: electoralRows.length,
    polling_station_executives: pollingRows.length,
    total_executives: allRows.length,
  },
  constituency_executives: constituencyRows,
  electoral_area_executives: electoralRows,
  polling_station_executives: pollingRows,
}));

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
const keys = Object.keys(allRows[0]);
const csvLines = [keys.map(csvEscape).join(',')];
for (const row of allRows) csvLines.push(keys.map(k => csvEscape(row[k])).join(','));
await fs.writeFile(csvPath, `${csvLines.join('\n')}\n`);

const workbook = Workbook.create();
const summary = workbook.worksheets.add('Summary');
const conSheet = workbook.worksheets.add('Constituency Executives');
const eaSheet = workbook.worksheets.add('Electoral Area Executives');
const psSheet = workbook.worksheets.add('Polling Station Executives');

function titleBand(sheet, title, subtitle) {
  sheet.showGridLines = false;
  sheet.getRange('A1:H1').merge();
  sheet.getRange('A1').values = [[title]];
  sheet.getRange('A1:H1').format = {
    fill: '#132A13', font: { bold: true, color: '#FFFFFF', size: 18 },
    verticalAlignment: 'center',
  };
  sheet.getRange('A1:H1').format.rowHeight = 32;
  sheet.getRange('A2:H2').merge();
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange('A2:H2').format = { fill: '#E9F5E9', font: { color: '#31572C', italic: true } };
  sheet.getRange('A2:H2').format.rowHeight = 24;
}

titleBand(summary, 'Nationwide Executive Directory', 'All 276 constituencies · constituency, electoral-area and polling-station executives');
summary.getRange('A4:B9').values = [
  ['Metric', 'Count'],
  ['Constituencies', source.constituencies.length],
  ['Constituency executives', constituencyRows.length],
  ['Electoral-area executives', electoralRows.length],
  ['Polling-station executives', pollingRows.length],
  ['Total executive records', allRows.length],
];
summary.getRange('A4:B4').format = { fill: '#31572C', font: { bold: true, color: '#FFFFFF' } };
summary.getRange('A5:A9').format.font = { bold: true, color: '#253D25' };
summary.getRange('B5:B9').format.numberFormat = '#,##0';
summary.getRange('A4:B9').format.borders = { preset: 'outside', style: 'thin', color: '#90A990' };
summary.getRange('A11:B27').values = [['Region', 'Constituencies'], ...Object.entries(source.constituencies.reduce((m, c) => { m[c.region] = (m[c.region] || 0) + 1; return m; }, {}))];
summary.getRange('A11:B11').format = { fill: '#31572C', font: { bold: true, color: '#FFFFFF' } };
summary.getRange('B12:B27').format.numberFormat = '#,##0';
summary.getRange('A:B').format.columnWidth = 28;
summary.freezePanes.freezeRows(3);

function matrix(row) {
  return [row.executive_level, row.slot_status, row.region, row.constituency, row.electoral_area,
    row.polling_station, row.position, row.executive_name, row.membership_id, row.phone,
    row.email, row.ghana_card, row.voter_id, row.gender, row.status];
}

function populate(sheet, title, subtitle, rows) {
  titleBand(sheet, title, subtitle);
  sheet.getRange('A4:O4').values = [columns];
  sheet.getRange('A4:O4').format = {
    fill: '#31572C', font: { bold: true, color: '#FFFFFF' },
    verticalAlignment: 'center', wrapText: true,
  };
  sheet.getRange('A4:O4').format.rowHeight = 30;
  const chunk = 5000;
  for (let start = 0; start < rows.length; start += chunk) {
    const block = rows.slice(start, start + chunk).map(matrix);
    sheet.getRangeByIndexes(4 + start, 0, block.length, columns.length).values = block;
  }
  const last = rows.length + 4;
  sheet.getRange(`A5:O${last}`).format.font = { size: 9, color: '#1F2937' };
  sheet.getRange(`I5:M${last}`).format.numberFormat = '@';
  sheet.getRange(`A4:O${last}`).format.borders = {
    insideHorizontal: { style: 'thin', color: '#E5E7EB' },
    bottom: { style: 'thin', color: '#9CA3AF' },
  };
  const widths = [18, 12, 16, 26, 28, 34, 28, 30, 24, 16, 28, 22, 18, 11, 16];
  widths.forEach((w, i) => sheet.getRangeByIndexes(0, i, last, 1).format.columnWidth = w);
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(4);
  sheet.tables.add(`A4:O${last}`, true, title.replace(/[^A-Za-z0-9]/g, '') + 'Table');
}

populate(conSheet, 'Constituency Executives', `${constituencyRows.length.toLocaleString()} executive records`, constituencyRows);
populate(eaSheet, 'Electoral Area Executives', `${electoralRows.length.toLocaleString()} executive records`, electoralRows);
populate(psSheet, 'Polling Station Executives', `${pollingRows.length.toLocaleString()} executive records`, pollingRows);

const preview = await workbook.render({ sheetName: 'Summary', range: 'A1:B27', scale: 1.4, format: 'png' });
await fs.writeFile(`${outputDir}/nationwide_summary_preview.png`, new Uint8Array(await preview.arrayBuffer()));
for (const [sheetName, range, file] of [
  ['Constituency Executives', 'A1:O14', 'nationwide_constituency_preview.png'],
  ['Electoral Area Executives', 'A1:O14', 'nationwide_electoral_area_preview.png'],
  ['Polling Station Executives', 'A1:O14', 'nationwide_polling_station_preview.png'],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(`${outputDir}/${file}`, new Uint8Array(await image.arrayBuffer()));
}

const inspect = await workbook.inspect({ kind: 'table', range: 'Summary!A1:B27', include: 'values,formulas', tableMaxRows: 30, tableMaxCols: 4 });
await fs.writeFile(`${outputDir}/nationwide_workbook_inspect.ndjson`, inspect.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'final formula error scan' });
await fs.writeFile(`${outputDir}/nationwide_formula_errors.ndjson`, errors.ndjson);

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(xlsxPath);
console.log(JSON.stringify({ xlsxPath, csvPath, jsonPath, counts: { constituencyRows: constituencyRows.length, electoralRows: electoralRows.length, pollingRows: pollingRows.length, total: allRows.length } }));
