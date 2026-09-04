import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = '/Users/THINKPAD/Documents/parallel/outputs/019fe8e0-0a1c-7b02-9f0d-46904ea7322e/nationwide-executives';
const source = JSON.parse(await fs.readFile(`${outputDir}/nationwide_checkpoint.json`, 'utf8'));
const appointedSource = JSON.parse(await fs.readFile(`${outputDir}/appointed_executives_checkpoint.json`, 'utf8')).rows;
const albumEnrichment = JSON.parse(await fs.readFile(`${outputDir}/appointed_album_enrichment_checkpoint.json`, 'utf8'));
const albumProfileRows = Object.values(albumEnrichment.profiles);
const albumProfiles = new Map(albumProfileRows.map(profile => [String(profile.voter_id || '').trim(), profile]));
const enrichedList = JSON.parse(await fs.readFile(`${outputDir}/nationwide_executives_fully_enriched.json`, 'utf8'));
const enrichedMap = new Map(enrichedList.map(r => [String(r.voter_id || '').trim(), r]));
const regions = [...new Set(source.constituencies.map(c => c.region))];
const columns = ['Executive Level','Slot Status','Region','Constituency','Electoral Area','Polling Station','Position','Executive Name','Membership ID','Phone','Email','Ghana Card','Voter ID','Gender','Date of Birth','Record Entered By','Status'];

const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const normalize = (level, r) => {
  const en = enrichedMap.get(String(r.voter_id || '').trim()) || {};
  return [
    level,
    r.slot_status || '',
    r.region || '',
    r.constituency || '',
    r.electoral_area || '',
    r.polling_station || '',
    r.position || '',
    r.applicant_name || '',
    en.membership_id || r.membership_id || '',
    en.phone || r.phone || '',
    en.email || r.email || '',
    en.ghana_card || r.ghana_card || '',
    r.voter_id || '',
    r.gender || en.gender || '',
    en.date_of_birth || '',
    '',
    r.status || 'Election won'
  ];
};
const appointed = appointedSource.map(r => {
  const geo = r.geography.split('·').map(x => x.trim());
  const vid = String(r.voter_id || '').trim();
  const profile = albumProfiles.get(vid);
  const en = enrichedMap.get(vid) || {};
  const matched = profile?.match_status === 'matched';
  const memId = (matched ? profile.membership_id : '') || en.membership_id || '';
  const phone = (matched ? profile.phone : '') || en.phone || '';
  const email = (matched ? profile.email : '') || en.email || '';
  const gc = en.ghana_card || '';
  const gender = en.gender || '';
  const dob = (matched ? profile.date_of_birth : '') || en.date_of_birth || '';
  return ['Constituency', 'Appointed · Approved', geo[0] || '', geo.slice(1).join(' · '), '', '', r.position || '', r.name || '', memId, phone, email, gc, vid, gender, dob, r.entered_by || '', 'Appointed executive'];
});

const objectKeys=['executive_level','slot_status','region','constituency','electoral_area','polling_station','position','executive_name','membership_id','phone','email','ghana_card','voter_id','gender','date_of_birth','record_entered_by','status'];
const allMatrices=[...source.constituencyExecutives.map(r=>normalize('Constituency',r)),...appointed,...source.electoralArea.map(r=>normalize('Electoral Area',r)),...source.polling.map(r=>normalize('Polling Station',r))];
const allObjects=allMatrices.map(row=>Object.fromEntries(objectKeys.map((k,i)=>[k,row[i]])));
const albumEnrichedAppointmentRows=appointed.filter(row=>row[9]||row[10]||row[14]).length;
const albumMatchedUniqueProfiles=albumProfileRows.filter(profile=>profile.match_status==='matched').length;
const albumUnmatchedUniqueVoterIds=albumProfileRows.filter(profile=>profile.match_status!=='matched').length;
await fs.writeFile(`${outputDir}/nationwide_all_executive_levels.json`,JSON.stringify({extracted_at:source.completedAt||source.updatedAt,appointed_extracted_at:new Date().toISOString(),album_enriched_at:albumEnrichment.completedAt||albumEnrichment.updatedAt||new Date().toISOString(),constituency_count:source.constituencies.length,counts:{elected_constituency_executives:source.constituencyExecutives.length,appointed_constituency_executives:appointed.length,album_matched_unique_profiles:albumMatchedUniqueProfiles,album_enriched_appointment_rows:albumEnrichedAppointmentRows,album_unmatched_unique_voter_ids:albumUnmatchedUniqueVoterIds,constituency_executives:source.constituencyExecutives.length+appointed.length,electoral_area_executives:source.electoralArea.length,polling_station_executives:source.polling.length,total_executives:allObjects.length},executives:allObjects}));
const csvEscape=value=>{const text=String(value??'');return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
await fs.writeFile(`${outputDir}/nationwide_all_executives.csv`,`${objectKeys.join(',')}\n${allObjects.map(r=>objectKeys.map(k=>csvEscape(r[k])).join(',')).join('\n')}\n`);

function titleBand(sheet, title, subtitle) {
  sheet.showGridLines = false;
  sheet.getRange('A1:H1').merge();
  sheet.getRange('A1').values = [[title]];
  sheet.getRange('A1:H1').format = { fill:'#132A13', font:{bold:true,color:'#FFFFFF',size:18}, verticalAlignment:'center' };
  sheet.getRange('A1:H1').format.rowHeight = 32;
  sheet.getRange('A2:H2').merge();
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange('A2:H2').format = { fill:'#E9F5E9', font:{color:'#31572C',italic:true} };
}

function populate(sheet, title, rows, tableName) {
  titleBand(sheet, title, `${rows.length.toLocaleString()} executive records`);
  sheet.getRange('A4:Q4').values = [columns];
  sheet.getRange('A4:Q4').format = { fill:'#31572C', font:{bold:true,color:'#FFFFFF'}, wrapText:true, verticalAlignment:'center' };
  sheet.getRange('A4:Q4').format.rowHeight = 30;
  for (let start=0; start<rows.length; start+=3000) {
    const block=rows.slice(start,start+3000);
    sheet.getRangeByIndexes(4+start,0,block.length,columns.length).values=block;
  }
  const last=rows.length+4;
  if (rows.length) {
    sheet.getRange(`A5:Q${last}`).format.font={size:9,color:'#1F2937'};
    sheet.getRange(`I5:O${last}`).format.numberFormat='@';
    sheet.getRange(`A4:Q${last}`).format.borders={insideHorizontal:{style:'thin',color:'#E5E7EB'},bottom:{style:'thin',color:'#9CA3AF'}};
    sheet.tables.add(`A4:Q${last}`,true,tableName);
  }
  const widths=[18,20,16,26,28,34,28,30,24,16,28,22,18,11,16,28,20];
  widths.forEach((w,i)=>sheet.getRangeByIndexes(0,i,Math.max(last,5),1).format.columnWidth=w);
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(4);
}

const manifest=[];
for (const region of regions) {
  const rslug=slug(region);
  const electedCons=source.constituencyExecutives.filter(r=>r.region===region).map(r=>normalize('Constituency',r));
  const appointedCons=appointed.filter(r=>r[2]===region);
  const enrichedAppointments=appointedCons.filter(r=>r[9]||r[10]||r[14]).length;
  const cons=[...electedCons,...appointedCons];
  const eas=source.electoralArea.filter(r=>r.region===region).map(r=>normalize('Electoral Area',r));
  const polls=source.polling.filter(r=>r.region===region).map(r=>normalize('Polling Station',r));
  const wb=Workbook.create();
  const summary=wb.worksheets.add('Summary');
  const cs=wb.worksheets.add('Constituency Executives');
  const es=wb.worksheets.add('Electoral Area Executives');
  const ps=wb.worksheets.add('Polling Station Executives');
  titleBand(summary,`${region} Executive Directory`,'Constituency, electoral-area and polling-station executives');
  const constituencyCount=source.constituencies.filter(c=>c.region===region).length;
  summary.getRange('A4:B11').values=[['Metric','Count'],['Constituencies',constituencyCount],['Constituency executives',cons.length],['Approved appointed executives',appointedCons.length],['Album-enriched appointment rows',enrichedAppointments],['Electoral-area executives',eas.length],['Polling-station executives',polls.length],['Total executive records',cons.length+eas.length+polls.length]];
  summary.getRange('A4:B4').format={fill:'#31572C',font:{bold:true,color:'#FFFFFF'}};
  summary.getRange('A5:A11').format.font={bold:true,color:'#253D25'};
  summary.getRange('B5:B11').format.numberFormat='#,##0';
  summary.getRange('A4:B11').format.borders={preset:'outside',style:'thin',color:'#90A990'};
  summary.getRange('A:B').format.columnWidth=30;
  summary.freezePanes.freezeRows(3);
  populate(cs,'Constituency Executives',cons,`Constituency${rslug}Table`);
  populate(es,'Electoral Area Executives',eas,`ElectoralArea${rslug}Table`);
  populate(ps,'Polling Station Executives',polls,`PollingStation${rslug}Table`);
  const previewDir=`${outputDir}/previews/${rslug}`;
  await fs.mkdir(previewDir,{recursive:true});
  for (const [sheetName,range,name] of [['Summary','A1:H11','summary'],['Constituency Executives','A1:Q12','constituency'],['Electoral Area Executives','A1:Q12','electoral_area'],['Polling Station Executives','A1:Q12','polling_station']]) {
    const image=await wb.render({sheetName,range,scale:0.8,format:'png'});
    await fs.writeFile(`${previewDir}/${name}.png`,new Uint8Array(await image.arrayBuffer()));
  }
  const inspected=await wb.inspect({kind:'table',range:'Summary!A1:B9',include:'values,formulas',tableMaxRows:12,tableMaxCols:3});
  const formulaErrors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:100},summary:'final formula error scan'});
  await fs.writeFile(`${previewDir}/inspect.ndjson`,inspected.ndjson);
  await fs.writeFile(`${previewDir}/formula_errors.ndjson`,formulaErrors.ndjson);
  const filePath=`${outputDir}/${rslug}_all_executive_levels.xlsx`;
  const blob=await SpreadsheetFile.exportXlsx(wb);
  await blob.save(filePath);
  manifest.push({region,filePath,constituencies:constituencyCount,electedConstituencyExecutives:electedCons.length,appointedConstituencyExecutives:appointedCons.length,albumEnrichedAppointments:enrichedAppointments,constituencyExecutives:cons.length,electoralAreaExecutives:eas.length,pollingStationExecutives:polls.length,total:cons.length+eas.length+polls.length});
  console.log(JSON.stringify(manifest.at(-1)));
}
await fs.writeFile(`${outputDir}/regional_workbooks_manifest.json`,JSON.stringify(manifest,null,2));
console.log(JSON.stringify({complete:true,files:manifest.length,total:manifest.reduce((n,r)=>n+r.total,0)}));
