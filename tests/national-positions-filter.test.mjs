import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  GENERAL_CONTEST_LIST,
  CUSTOM_POSITION_CATEGORIES,
  POSITION_PRESETS,
  getCanonicalPositionsForSelection,
  normalizeCanonicalPosition,
} from '../lib/election-contests.ts';
import { normalizePosition } from '../lib/position-matcher.ts';

test('National Directors, Council & Elders, and Leadership in election contests & presets', () => {
  // Check General Contest List
  assert.ok(GENERAL_CONTEST_LIST.includes('National Directors'), 'GENERAL_CONTEST_LIST must include National Directors');
  assert.ok(GENERAL_CONTEST_LIST.includes('National Council & Elders'), 'GENERAL_CONTEST_LIST must include National Council & Elders');
  assert.ok(GENERAL_CONTEST_LIST.includes('National Leadership & Flagbearers'), 'GENERAL_CONTEST_LIST must include National Leadership & Flagbearers');

  // Check Categories
  const directorCategory = CUSTOM_POSITION_CATEGORIES.find((c) => c.category === 'National Directorate & Directors');
  assert.ok(directorCategory, 'CUSTOM_POSITION_CATEGORIES must include National Directorate & Directors');
  assert.ok(directorCategory.positions.length >= 10, 'Must have at least 10 director positions');

  const directorIds = directorCategory.positions.map((p) => p.id);
  assert.ok(directorIds.includes('director_finance'), 'Must have director_finance');
  assert.ok(directorIds.includes('director_elections'), 'Must have director_elections');
  assert.ok(directorIds.includes('director_research'), 'Must have director_research');
  assert.ok(directorIds.includes('director_it'), 'Must have director_it');
  assert.ok(directorIds.includes('deputy_director_it'), 'Must have deputy_director_it');
  assert.ok(directorIds.includes('director_protocol'), 'Must have director_protocol');
  assert.ok(directorIds.includes('director_legal'), 'Must have director_legal');
  assert.ok(directorIds.includes('chairman_legal_committee'), 'Must have chairman_legal_committee');
  assert.ok(directorIds.includes('national_comm_director'), 'Must have national_comm_director');

  const councilCategory = CUSTOM_POSITION_CATEGORIES.find((c) => c.category === 'Party Councils & Founders');
  assert.ok(councilCategory, 'CUSTOM_POSITION_CATEGORIES must include Party Councils & Founders');
  const councilIds = councilCategory.positions.map((p) => p.id);
  assert.ok(councilIds.includes('national_council_rep'), 'Must have national_council_rep');
  assert.ok(councilIds.includes('council_of_elders'), 'Must have council_of_elders');
  assert.ok(councilIds.includes('council_of_elders_past_officer'), 'Must have council_of_elders_past_officer');
  assert.ok(councilIds.includes('council_of_patrons'), 'Must have council_of_patrons');

  const leadershipCategory = CUSTOM_POSITION_CATEGORIES.find((c) => c.category === 'National Leadership & Flagbearers');
  assert.ok(leadershipCategory, 'CUSTOM_POSITION_CATEGORIES must include National Leadership & Flagbearers');
  const leadershipIds = leadershipCategory.positions.map((p) => p.id);
  assert.ok(leadershipIds.includes('former_president'), 'Must have former_president');
  assert.ok(leadershipIds.includes('flagbearer_vp'), 'Must have flagbearer_vp');
  assert.ok(leadershipIds.includes('past_national_chairman'), 'Must have past_national_chairman');
  assert.ok(leadershipIds.includes('past_general_secretary'), 'Must have past_general_secretary');
  assert.ok(leadershipIds.includes('3rd_vice'), 'Must have 3rd_vice');
  assert.ok(leadershipIds.includes('deputy_national_treasurer'), 'Must have deputy_national_treasurer');

  // Check Presets
  assert.ok(POSITION_PRESETS.national_directors, 'POSITION_PRESETS must have national_directors');
  assert.ok(POSITION_PRESETS.national_council, 'POSITION_PRESETS must have national_council');
  assert.ok(POSITION_PRESETS.national_leadership, 'POSITION_PRESETS must have national_leadership');

  // Check Resolution
  const resolvedDirectors = getCanonicalPositionsForSelection(POSITION_PRESETS.national_directors.ids);
  assert.ok(resolvedDirectors.canonicalSet.has('Director of IT'), 'Resolved directors must include Director of IT');
  assert.ok(resolvedDirectors.canonicalSet.has('Director of Elections'), 'Resolved directors must include Director of Elections');
  assert.ok(resolvedDirectors.canonicalSet.has('Director of Research'), 'Resolved directors must include Director of Research');

  const resolvedCouncil = getCanonicalPositionsForSelection(POSITION_PRESETS.national_council.ids);
  assert.ok(resolvedCouncil.canonicalSet.has('National Council Representative'), 'Must include National Council Representative');
  assert.ok(resolvedCouncil.canonicalSet.has('Council of Elders / Past National Officer'), 'Must include Council of Elders / Past National Officer');
  assert.ok(resolvedCouncil.canonicalSet.has('National Council of Patrons'), 'Must include National Council of Patrons');
});

test('normalizePosition properly preserves National specific titles and variations', () => {
  // Directors
  assert.equal(normalizePosition('director of it', 'National'), 'Director of IT');
  assert.equal(normalizePosition('director of finance and administration', 'National'), 'Director of Finance and Administration');
  assert.equal(normalizePosition('chairman of the legal committee', 'National'), 'Chairman of The Legal Committee');

  // Council of Elders / Past Officers
  assert.equal(normalizePosition('council of elders', 'National'), 'National Council of Elders');
  assert.equal(normalizePosition('council of elders / past national officer', 'National'), 'Council of Elders / Past National Officer');
  assert.equal(normalizePosition('national council of patrons', 'National'), 'National Council of Patrons');

  // National Wings isolation
  assert.equal(normalizePosition('nasara coordinator', 'National'), 'National Nasara Coordinator');
  assert.equal(normalizePosition('deputy nasara coordinator', 'National'), 'Deputy National Nasara Coordinator');
  assert.equal(normalizePosition('Chairman', 'National'), 'National Chairperson');

  // Canonical normalization
  assert.equal(normalizeCanonicalPosition('Director of IT', 'National'), 'Director of IT');
  assert.equal(normalizeCanonicalPosition('Former President', 'National'), 'Former President');
  assert.equal(normalizeCanonicalPosition('Chairman of The Legal Committee', 'National'), 'Chairman of The Legal Committee');
});

test('Admin dashboard position filter groups National positions cleanly with optgroups', () => {
  const dashboardPath = path.resolve('app/admin/dashboard/page.tsx');
  const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');

  assert.ok(dashboardSource.includes('Directors & Directorate'), 'Dashboard must group Directors & Directorate');
  assert.ok(dashboardSource.includes('National Council & Elders'), 'Dashboard must group National Council & Elders');
  assert.ok(dashboardSource.includes('Executive Leadership & Dignitaries'), 'Dashboard must group Executive Leadership & Dignitaries');
  assert.ok(dashboardSource.includes('Wings & Other National Positions'), 'Dashboard must group Wings & Other National Positions');
});

test('Admin album page offers quick buttons and preset filters for National portfolios', () => {
  const albumsPath = path.resolve('app/admin/albums/page.tsx');
  const albumsSource = fs.readFileSync(albumsPath, 'utf8');

  assert.ok(albumsSource.includes('⭐ National Directors'), 'Album page must feature quick portfolio button for National Directors');
  assert.ok(albumsSource.includes('🏛️ National Council'), 'Album page must feature quick portfolio button for National Council');
  assert.ok(albumsSource.includes('👑 National Leadership'), 'Album page must feature quick portfolio button for National Leadership');
  assert.ok(albumsSource.includes('national_directors'), 'Album page must feature preset for national_directors');
  assert.ok(albumsSource.includes('national_council'), 'Album page must feature preset for national_council');
  assert.ok(albumsSource.includes('national_leadership'), 'Album page must feature preset for national_leadership');
});

test('getNationalSectionInfo assigns exact 5-tier hierarchy requested for National Register', async () => {
  const { getNationalSectionInfo } = await import('../lib/album-hierarchy.ts');

  // 1. President, Flagbearer, Running Mate & Speaker of Parliament (rank 1)
  const p1a = getNationalSectionInfo({ position: 'Former President', executive_level: 'National' });
  assert.equal(p1a.rank, 1);
  assert.equal(p1a.section, 'President, Flagbearer, Running Mate & Speaker of Parliament');

  const p1b = getNationalSectionInfo({ position: 'Current Flagbearer / Former Vice President', executive_level: 'National' });
  assert.equal(p1b.rank, 1);
  assert.equal(p1b.section, 'President, Flagbearer, Running Mate & Speaker of Parliament');

  const p1c = getNationalSectionInfo({ position: 'Former Running Mate', executive_level: 'National' });
  assert.equal(p1c.rank, 1);
  assert.equal(p1c.section, 'President, Flagbearer, Running Mate & Speaker of Parliament');

  const p1d = getNationalSectionInfo({ position: 'Speaker of Parliament', executive_level: 'National' });
  assert.equal(p1d.rank, 1);
  assert.equal(p1d.section, 'President, Flagbearer, Running Mate & Speaker of Parliament');

  // 2. National Executives and Directors (rank 2)
  const p2a = getNationalSectionInfo({ position: 'National Chairperson', executive_level: 'National' });
  assert.equal(p2a.rank, 2);
  assert.equal(p2a.section, 'National Executives and Directors');

  const p2b = getNationalSectionInfo({ position: 'General Secretary', executive_level: 'National' });
  assert.equal(p2b.rank, 2);
  assert.equal(p2b.section, 'National Executives and Directors');

  const p2c = getNationalSectionInfo({ position: 'Director of Finance and Administration', executive_level: 'National' });
  assert.equal(p2c.rank, 2);
  assert.equal(p2c.section, 'National Executives and Directors');

  const p2d = getNationalSectionInfo({ position: 'Director of Elections', executive_level: 'National' });
  assert.equal(p2d.rank, 2);
  assert.equal(p2d.section, 'National Executives and Directors');

  // 3. Former Chairman and Former General Secretary (rank 3)
  const p3a = getNationalSectionInfo({ position: 'Past National Chairman', executive_level: 'National' });
  assert.equal(p3a.rank, 3);
  assert.equal(p3a.section, 'Former Chairman and Former General Secretary');

  const p3b = getNationalSectionInfo({ position: 'Past General Secretary', executive_level: 'National' });
  assert.equal(p3b.rank, 3);
  assert.equal(p3b.section, 'Former Chairman and Former General Secretary');

  // 4. Council of Elders (rank 4)
  const p4 = getNationalSectionInfo({ position: 'Council of Elders / Past National Officer', executive_level: 'National' });
  assert.equal(p4.rank, 4);
  assert.equal(p4.section, 'Council of Elders');

  // 5. Council of Patrons (rank 5)
  const p5 = getNationalSectionInfo({ position: 'National Council of Patrons', executive_level: 'National' });
  assert.equal(p5.rank, 5);
  assert.equal(p5.section, 'Council of Patrons');

  // 6. Other National Executives (rank 6)
  const p6 = getNationalSectionInfo({ position: 'National Council Representative', executive_level: 'National' });
  assert.equal(p6.rank, 6);
  assert.equal(p6.section, 'Other National Executives');
});

test('compareNationalAlbumDelegates sorts National register in strict 5-tier order', async () => {
  const { compareNationalAlbumDelegates, compareAlbumDelegates } = await import('../lib/album-hierarchy.ts');

  const delegates = [
    { executive_name: 'William Yamoah', position: 'Director of Finance and Administration', executive_level: 'National', level_rank: 1 },
    { executive_name: 'Stephen Ayesu Ntim', position: 'National Chairperson', executive_level: 'National', level_rank: 1 },
    { executive_name: 'Dr. Matthew Opoku Prempeh', position: 'Former Running Mate', executive_level: 'National', level_rank: 1 },
    { executive_name: 'Edmund Annan', position: 'Council of Elders / Past National Officer', executive_level: 'National', level_rank: 1 },
    { executive_name: 'H.E. John Agyekum Kuffuor', position: 'Former President', executive_level: 'National', level_rank: 1 },
    { executive_name: 'Justin Frimpong Kodua', position: 'General Secretary', executive_level: 'National', level_rank: 1 },
    { executive_name: 'H.E. Dr. Mahamudu Bawumia', position: 'Current Flagbearer / Former Vice President', executive_level: 'National', level_rank: 1 },
    { executive_name: 'Evans Nimako', position: 'Director of Elections', executive_level: 'National', level_rank: 1 },
    { executive_name: 'Nana Akosua Frema Opare', position: 'National Council of Patrons', executive_level: 'National', level_rank: 1 },
    { executive_name: 'Kwabena Agyei Agyepong', position: 'Past General Secretary', executive_level: 'National', level_rank: 1 },
  ];

  delegates.sort(compareNationalAlbumDelegates);

  assert.deepEqual(delegates.map((d) => d.executive_name), [
    'H.E. John Agyekum Kuffuor',      // 1. President
    'H.E. Dr. Mahamudu Bawumia',       // 1. Flagbearer
    'Dr. Matthew Opoku Prempeh',       // 1. Running Mate
    'Stephen Ayesu Ntim',              // 2. National Executive (Chairperson)
    'Justin Frimpong Kodua',           // 2. National Executive (General Secretary)
    'William Yamoah',                  // 2. Director (Finance)
    'Evans Nimako',                    // 2. Director (Elections)
    'Kwabena Agyei Agyepong',          // 3. Former General Secretary
    'Edmund Annan',                    // 4. Council of Elders
    'Nana Akosua Frema Opare',         // 5. Council of Patrons
  ]);

  // compareAlbumDelegates must delegate to compareNationalAlbumDelegates for National level
  const albumSorted = [...delegates].reverse().sort(compareAlbumDelegates);
  assert.equal(albumSorted[0].executive_name, 'H.E. John Agyekum Kuffuor');
  assert.equal(albumSorted[1].executive_name, 'H.E. Dr. Mahamudu Bawumia');
  assert.equal(albumSorted[2].executive_name, 'Dr. Matthew Opoku Prempeh');
});

test('Election route sorts National level pages and displays informative section header subtitles', () => {
  const routePath = path.resolve('app/api/admin/albums/election/route.ts');
  const routeSource = fs.readFileSync(routePath, 'utf8');

  assert.ok(routeSource.includes('nationalDelegates.sort(compareNationalAlbumDelegates);'), 'Route must sort nationalDelegates with compareNationalAlbumDelegates');
  assert.ok(routeSource.includes('NATIONAL LEVEL REGISTER · ${sec.title}${partSuffix}'), 'Route must generate descriptive section headers for National register');
  assert.ok(routeSource.includes('levelDisplay = isNational && natSectionInfo'), 'Voter card must display National section category in level line');
});

test('National Album layout rule places each tier on separate pages with dedicated section headers', () => {
  const routePath = path.resolve('app/api/admin/albums/election/route.ts');
  const routeSource = fs.readFileSync(routePath, 'utf8');

  // Must isolate all 5 canonical tiers onto separate pages
  assert.ok(
    routeSource.includes('PRESIDENT, FLAGBEARER, RUNNING MATE & SPEAKER OF PARLIAMENT'),
    'Route must have dedicated header for leadership page'
  );
  assert.ok(
    routeSource.includes('NATIONAL EXECUTIVES AND DIRECTORS'),
    'Route must have dedicated header for national executives and directors'
  );
  assert.ok(
    routeSource.includes('FORMER CHAIRMAN AND FORMER GENERAL SECRETARY'),
    'Route must have dedicated header for former chairman and former general secretary'
  );
  assert.ok(
    routeSource.includes('COUNCIL OF ELDERS'),
    'Route must have dedicated header for council of elders'
  );
  assert.ok(
    routeSource.includes('COUNCIL OF PATRONS'),
    'Route must have dedicated header for council of patrons'
  );
  assert.ok(
    routeSource.includes('isLeadershipPage: sec.isLeadershipPage'),
    'Route must preserve isLeadershipPage flag for leadership'
  );
  assert.ok(
    routeSource.includes('${cardsHtml}'),
    'Route must render standard cardsHtml in grid-10'
  );
});

test('Hon. Hackman Owusu-Agyemang begins Council of Elders', async () => {
  const { compareNationalAlbumDelegates, getNationalSectionInfo } = await import('../lib/album-hierarchy.ts');

  const elders = [
    { executive_name: 'Akuamoah Boateng', position: 'National Council of Elders', executive_level: 'National' },
    { executive_name: 'Alberta Cudjoe', position: 'National Council of Elders', executive_level: 'National' },
    { executive_name: 'Hon. Hackman Owusu-Agyemang', position: 'National Council of Elders', executive_level: 'National' },
    { executive_name: 'Timothy E.K. Amesimeku', position: 'National Council of Elders', executive_level: 'National' },
  ];

  const hackmanInfo = getNationalSectionInfo(elders[2]);
  assert.equal(hackmanInfo.rank, 4);
  assert.equal(hackmanInfo.subRank, 1);
  assert.equal(hackmanInfo.badge, 'CHAIRMAN, COUNCIL OF ELDERS');

  const otherInfo = getNationalSectionInfo(elders[0]);
  assert.equal(otherInfo.rank, 4);
  assert.equal(otherInfo.subRank, 2);

  elders.sort(compareNationalAlbumDelegates);

  assert.equal(elders[0].executive_name, 'Hon. Hackman Owusu-Agyemang', 'Hackman Owusu-Agyemang must begin Council of Elders');
});

test('Edmund Annan (8698012141) is positioned as National Council Rep alongside past executives', async () => {
  const { compareNationalAlbumDelegates, getNationalSectionInfo } = await import('../lib/album-hierarchy.ts');

  const delegate = {
    executive_name: 'EDMUND ANNAN',
    position: 'National Council Representative',
    voter_id: '8698012141',
    executive_level: 'National',
  };

  const info = getNationalSectionInfo(delegate);
  assert.equal(info.rank, 3, 'Edmund Annan must be placed in Rank 3 (Former Chairman and Former General Secretary)');
  assert.equal(info.badge, 'NATIONAL COUNCIL REP');

  const page8Delegates = [
    { executive_name: 'PETER MAC-MANU', position: 'Past National Chairman', executive_level: 'National' },
    { executive_name: 'BOTWE, DANIEL', position: 'Past General Secretary', executive_level: 'National' },
    delegate,
  ];

  page8Delegates.sort(compareNationalAlbumDelegates);

  assert.equal(page8Delegates[0].executive_name, 'PETER MAC-MANU');
  assert.equal(page8Delegates[1].executive_name, 'BOTWE, DANIEL');
  assert.equal(page8Delegates[2].executive_name, 'EDMUND ANNAN');
});



