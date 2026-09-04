import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const base = '/Users/THINKPAD/Documents/parallel/outputs/019fe8e0-0a1c-7b02-9f0d-46904ea7322e/nationwide-executives';
const out = `${base}/matched_album_members.xlsx`;
const previewPath = `${base}/previews/matched_album_members.png`;
const enrichment = JSON.parse(await fs.readFile(`${base}/appointed_album_enrichment_checkpoint.json`, 'utf8'));
const appointments = JSON.parse(await fs.readFile(`${base}/appointed_executives_checkpoint.json`, 'utf8')).rows;
const profiles = Object.values(enrichment.profiles)
  .filter(p => p.match_status === 'matched')
  .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
const byVoterId = new Map(profiles.map(p => [String(p.voter_id), p]));
const matchedAppointments = appointments
  .filter(a => byVoterId.has(String(a.voter_id)))
  .map(a => ({ ...a, profile: byVoterId.get(String(a.voter_id)) }));
const displayPhone = value => {
  const phone = String(value || '').replace(/\s+/g, '');
  const match = phone.match(/^\+233(\d{2})(\d{3})(\d{4})$/);
  return match ? `+233 ${match[1]} ${match[2]} ${match[3]}` : phone;
};

const wb = Workbook.create();
const summary = wb.worksheets.add('Summary');
const unique = wb.worksheets.add('Unique Matched Profiles');
const rows = wb.worksheets.add('Matched Appointments');

function title(sheet, text, subtitle, endColumn) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${endColumn}1`).merge();
  sheet.getRange('A1').values = [[text]];
  sheet.getRange(`A1:${endColumn}1`).format = {fill:'#132A13',font:{bold:true,color:'#FFFFFF',size:18},verticalAlignment:'center'};
  sheet.getRange(`A1:${endColumn}1`).format.rowHeight = 32;
  sheet.getRange(`A2:${endColumn}2`).merge();
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange(`A2:${endColumn}2`).format = {fill:'#E9F5E9',font:{italic:true,color:'#31572C'}};
}

title(summary, 'Matched Album Members', 'Profiles matched from the appointed-executive voter IDs', 'H');
summary.getRange('A4:B7').values = [
  ['Metric','Count'],
  ['Unique matched profiles',''],
  ['Matched appointment rows',''],
  ['Appointments with date of birth',''],
];
summary.getRange('B5').formulas = [[`=COUNTA('Unique Matched Profiles'!A5:A${profiles.length + 4})`]];
summary.getRange('B6').formulas = [[`=COUNTA('Matched Appointments'!A5:A${matchedAppointments.length + 4})`]];
summary.getRange('B7').formulas = [[`=COUNT('Matched Appointments'!K5:K${matchedAppointments.length + 4})`]];
summary.getRange('A4:B4').format = {fill:'#31572C',font:{bold:true,color:'#FFFFFF'}};
summary.getRange('A5:A7').format.font = {bold:true,color:'#253D25'};
summary.getRange('B5:B7').format.numberFormat = '#,##0';
summary.getRange('A4:B7').format.borders = {preset:'outside',style:'thin',color:'#90A990'};
summary.getRange('A:A').format.columnWidth = 34;
summary.getRange('B:B').format.columnWidth = 14;

const uniqueHeaders = ['Voter ID','Full Name','Member ID','Phone','Email','Date of Birth','Profile URL'];
const uniqueData = profiles.map(p => [
  p.voter_id || '', p.name || '', p.membership_id || '', displayPhone(p.phone), p.email || '',
  p.date_of_birth ? new Date(`${p.date_of_birth}T00:00:00Z`) : '', p.profile_url || '',
]);
title(unique, 'Unique Matched Album Profiles', `${profiles.length} unique voter IDs matched`, 'G');
unique.getRange('A4:G4').values = [uniqueHeaders];
unique.getRange(`A5:E${profiles.length + 4}`).format.numberFormat = '@';
unique.getRange(`F5:F${profiles.length + 4}`).format.numberFormat = 'yyyy-mm-dd';
unique.getRangeByIndexes(4,0,uniqueData.length,uniqueHeaders.length).values = uniqueData;
unique.getRange('A4:G4').format = {fill:'#31572C',font:{bold:true,color:'#FFFFFF'},wrapText:true};
unique.getRange(`A4:G${profiles.length + 4}`).format.borders = {insideHorizontal:{style:'thin',color:'#E5E7EB'}};
unique.tables.add(`A4:G${profiles.length + 4}`, true, 'UniqueMatchedProfilesTable');
[18,28,24,18,32,16,48].forEach((w,i) => unique.getRangeByIndexes(0,i,profiles.length+4,1).format.columnWidth = w);
unique.freezePanes.freezeRows(4);

const rowHeaders = ['Voter ID','Executive Name','Position','Region','Constituency','Review Status','Album Full Name','Member ID','Phone','Email','Date of Birth','Profile URL'];
const appointmentData = matchedAppointments.map(a => {
  const geography = String(a.geography || '').split('·').map(v => v.trim());
  const p = a.profile;
  return [a.voter_id || '',a.name || '',a.position || '',geography[0] || '',geography.slice(1).join(' · '),a.review_status || '',p.name || '',p.membership_id || '',displayPhone(p.phone),p.email || '',p.date_of_birth ? new Date(`${p.date_of_birth}T00:00:00Z`) : '',p.profile_url || ''];
});
title(rows, 'Matched Appointed Executives', `${matchedAppointments.length} appointment rows linked to matched Album profiles`, 'L');
rows.getRange('A4:L4').values = [rowHeaders];
rows.getRange(`A5:J${matchedAppointments.length + 4}`).format.numberFormat = '@';
rows.getRange(`K5:K${matchedAppointments.length + 4}`).format.numberFormat = 'yyyy-mm-dd';
rows.getRangeByIndexes(4,0,appointmentData.length,rowHeaders.length).values = appointmentData;
rows.getRange('A4:L4').format = {fill:'#31572C',font:{bold:true,color:'#FFFFFF'},wrapText:true};
rows.getRange(`A4:L${matchedAppointments.length + 4}`).format.borders = {insideHorizontal:{style:'thin',color:'#E5E7EB'}};
rows.tables.add(`A4:L${matchedAppointments.length + 4}`, true, 'MatchedAppointmentsTable');
[18,30,28,18,28,16,28,24,18,32,16,48].forEach((w,i) => rows.getRangeByIndexes(0,i,matchedAppointments.length+4,1).format.columnWidth = w);
rows.freezePanes.freezeRows(4);
rows.freezePanes.freezeColumns(2);

const check = await wb.inspect({kind:'table',range:'Summary!A1:B7',include:'values,formulas',tableMaxRows:10,tableMaxCols:3});
const errors = await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:100},summary:'final formula error scan'});
await fs.writeFile(`${base}/matched_album_members_inspect.ndjson`, check.ndjson);
await fs.writeFile(`${base}/matched_album_members_formula_errors.ndjson`, errors.ndjson);
const preview = await wb.render({sheetName:'Unique Matched Profiles',range:'A1:G14',scale:1,format:'png'});
await fs.writeFile(previewPath,new Uint8Array(await preview.arrayBuffer()));
const blob = await SpreadsheetFile.exportXlsx(wb);
await blob.save(out);
console.log(JSON.stringify({out,uniqueProfiles:profiles.length,matchedAppointmentRows:matchedAppointments.length,withDob:matchedAppointments.filter(a=>a.profile.date_of_birth).length}));
