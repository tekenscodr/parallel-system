import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ALL_CUSTOMIZABLE_POSITIONS,
  CUSTOM_POSITION_CATEGORIES,
  POSITION_PRESETS,
  normalizeCanonicalPosition,
} from "../lib/election-contests.ts";
import {
  getRegionalSectionRank,
  compareRegionalAlbumDelegates,
} from "../lib/album-hierarchy.ts";
import {
  normalizeConstituency,
  CANONICAL_CONSTITUENCIES,
  getConstituenciesForRegion,
} from "../lib/constituency-normalizer.ts";
import { getConstituencyCapital } from "../lib/constituency-capitals.ts";

test("Position filter includes Member of Parliament, National Council Rep, and Foundation Member", () => {
  const ids = ALL_CUSTOMIZABLE_POSITIONS.map((p) => p.id);
  assert.ok(ids.includes("member_of_parliament"), "Must include member_of_parliament");
  assert.ok(ids.includes("national_council_rep"), "Must include national_council_rep");
  assert.ok(ids.includes("foundation_member"), "Must include foundation_member");

  // Verify category
  const councilCat = CUSTOM_POSITION_CATEGORIES.find(
    (c) => c.category === "Party Councils & Founders"
  );
  assert.ok(councilCat, "Must have 'Party Councils & Founders' category");
  const councilIds = councilCat.positions.map((p) => p.id);
  assert.ok(councilIds.includes("national_council_rep"));
  assert.ok(councilIds.includes("foundation_member"));

  // Verify Parliamentary Group category
  const parlCat = CUSTOM_POSITION_CATEGORIES.find(
    (c) => c.category === "Parliamentary Group"
  );
  assert.ok(parlCat, "Must have 'Parliamentary Group' category");
  const parlIds = parlCat.positions.map((p) => p.id);
  assert.ok(parlIds.includes("member_of_parliament"));

  // Verify presets
  assert.ok(POSITION_PRESETS.councils_and_mps, "Must define councils_and_mps preset");
  assert.deepEqual(POSITION_PRESETS.councils_and_mps.ids, [
    "member_of_parliament",
    "national_council_rep",
    "foundation_member",
  ]);

  assert.ok(POSITION_PRESETS.regional_leadership, "Must define regional_leadership preset");
  assert.ok(POSITION_PRESETS.regional_leadership.ids.includes("member_of_parliament"));
  assert.ok(POSITION_PRESETS.regional_leadership.ids.includes("national_council_rep"));
  assert.ok(POSITION_PRESETS.regional_leadership.ids.includes("foundation_member"));
  assert.equal(POSITION_PRESETS.regional_leadership.ids.length, 24, "Regional leadership must be 21 regional positions + 3 councils/MPs");
});

test("Canonical normalization handles MPs, National Council, and Foundation Members", () => {
  assert.equal(normalizeCanonicalPosition("Member of Parliament"), "Member of Parliament");
  assert.equal(normalizeCanonicalPosition("MP"), "Member of Parliament");
  assert.equal(normalizeCanonicalPosition("Sitting MP"), "Member of Parliament");
  assert.equal(normalizeCanonicalPosition("Parliamentarian"), "Member of Parliament");
  assert.equal(
    normalizeCanonicalPosition("National Council Representative"),
    "National Council Representative"
  );
  assert.equal(normalizeCanonicalPosition("Foundation Member"), "Foundation Member");
});

test("getRegionalSectionRank orders Regional Execs, NC Reps, Foundation Members, MPs, Constituencies, TESCON", () => {
  const regExec = { position: "Secretary", executive_level: "Regional" };
  const ncRep = { position: "National Council Representative", executive_level: "National", region: "Central" };
  const foundationMember = { position: "Foundation Member", executive_level: "National", region: "Central" };
  const mp = { position: "Member of Parliament", executive_level: "Constituency", constituency: "Cape Coast South", region: "Central" };
  const conExec = { position: "Chairperson", executive_level: "Constituency", constituency: "Cape Coast South", region: "Central" };
  const tesconExec = { position: "President", executive_level: "TESCON", constituency: "UCC", region: "Central" };

  assert.equal(getRegionalSectionRank(regExec), 1, "Regional Exec must be rank 1");
  assert.equal(getRegionalSectionRank(ncRep), 2, "National Council Rep must be rank 2");
  assert.equal(getRegionalSectionRank(foundationMember), 3, "Foundation Member must be rank 3");
  assert.equal(getRegionalSectionRank(mp), 4, "MP must be rank 4");
  assert.equal(getRegionalSectionRank(conExec), 5, "Constituency Exec must be rank 5");
  assert.equal(getRegionalSectionRank(tesconExec), 6, "TESCON Exec must be rank 6");
});

test("compareRegionalAlbumDelegates sorts delegates in exact requested sequence", () => {
  const list = [
    { executive_name: "Kwame Tescon", executive_level: "TESCON", polling_station: "UCC", region: "Central", position: "President", position_rank: 1 },
    { executive_name: "Hon. Kojo MP (Cape Coast North)", executive_level: "Constituency", constituency: "Cape Coast North", region: "Central", position: "Member of Parliament", position_rank: 0 },
    { executive_name: "Hon. Ama MP (Abura)", executive_level: "Constituency", constituency: "Abura Asebu Kwamankese", region: "Central", position: "Member of Parliament", position_rank: 0 },
    { executive_name: "Papa Founder", executive_level: "National", region: "Central", position: "Foundation Member", position_rank: 20 },
    { executive_name: "Chief Council Rep", executive_level: "National", region: "Central", position: "National Council Representative", position_rank: 10 },
    { executive_name: "Yaw Reg Secretary", executive_level: "Regional", region: "Central", position: "Secretary", position_rank: 4 },
    { executive_name: "Kofi Con Chair", executive_level: "Constituency", constituency: "Abura Asebu Kwamankese", region: "Central", position: "Chairperson", position_rank: 1 },
  ];

  list.sort(compareRegionalAlbumDelegates);

  assert.deepEqual(list.map((d) => d.executive_name), [
    "Yaw Reg Secretary", // 1. Regional Exec
    "Chief Council Rep", // 2. National Council Rep
    "Papa Founder", // 3. Foundation Member
    "Hon. Ama MP (Abura)", // 4. MP (Abura - alphabetical)
    "Hon. Kojo MP (Cape Coast North)", // 4. MP (Cape Coast North)
    "Kofi Con Chair", // 5. Constituency Exec
    "Kwame Tescon", // 6. TESCON Exec
  ]);
});

test("Election album route file generates dedicated sections and audit entries for Regional Leadership, Council, and MPs", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Single region sorting uses compareRegionalAlbumDelegates
  assert.ok(
    code.includes("isSingleRegion ? compareRegionalAlbumDelegates : compareAlbumDelegates"),
    "Route must sort with compareRegionalAlbumDelegates when isSingleRegion is true"
  );

  // 2. Section 2 renders Regional Execs, NC Reps, Foundation Members, and MPs
  assert.ok(
    code.includes("NATIONAL COUNCIL REPRESENTATIVES (PART ${partIdx})"),
    "Route must generate National Council Representative card pages"
  );
  assert.ok(
    code.includes("FOUNDATION MEMBERS (PART ${partIdx})"),
    "Route must generate Foundation Member card pages"
  );
  assert.ok(
    code.includes("MEMBERS OF PARLIAMENT (PART ${partIdx})"),
    "Route must generate Members of Parliament card pages"
  );

  // 3. Constituency level pages exclude MPs to protect 19 statutory officers
  assert.ok(
    code.includes("lvl === \"constituency\" && getRegionalSectionRank(d) === 5"),
    "constituencyDelegates must exclude MPs and council members"
  );

  // 4. Single-region auditItems tracks NC, FM, and MP
  assert.ok(
    code.includes('level: "National Council"'),
    "Single region audit table must track National Council"
  );
  assert.ok(
    code.includes('level: "Foundation"'),
    "Single region audit table must track Foundation Members"
  );
  assert.ok(
    code.includes('level: "Parliament"'),
    "Single region audit table must track Members of Parliament"
  );

  // 5. MP cards display constituency in Level line
  assert.ok(
    code.includes("const isMp = getRegionalSectionRank(d) === 4;"),
    "renderVoterCard must detect MPs"
  );
});

test("Admin album page includes MPs, Council & Founders preset button", () => {
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const code = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    code.includes("MPs, Council & Founders"),
    "Album page must offer MPs, Council & Founders preset button"
  );
  assert.ok(
    code.includes("Regional Leadership (24)"),
    "Album page must offer Regional Leadership (24) preset button"
  );
});

test("Kwahu East is Abetifi and Kwahu Afram Plains is Afram Plains North", () => {
  // Normalization
  assert.equal(normalizeConstituency("Kwahu East"), "ABETIFI");
  assert.equal(normalizeConstituency("ABETIFI"), "ABETIFI");
  assert.equal(normalizeConstituency("kwahu east"), "ABETIFI");
  assert.equal(normalizeConstituency("Kwahu Afram Plains"), "AFRAM PLAINS NORTH");
  assert.equal(normalizeConstituency("Kwahu Afram Plains North"), "AFRAM PLAINS NORTH");
  assert.equal(normalizeConstituency("AFRAM PLAINS NORTH"), "AFRAM PLAINS NORTH");
  assert.equal(normalizeConstituency("kwahu afram plains"), "AFRAM PLAINS NORTH");

  // Canonical set integrity
  assert.ok(CANONICAL_CONSTITUENCIES.length >= 275, "Must maintain all canonical constituencies");
  assert.ok(CANONICAL_CONSTITUENCIES.includes("ABETIFI"), "ABETIFI must be canonical");
  assert.ok(CANONICAL_CONSTITUENCIES.includes("AFRAM PLAINS NORTH"), "AFRAM PLAINS NORTH must be canonical");
  assert.ok(!CANONICAL_CONSTITUENCIES.includes("KWAHU EAST"), "KWAHU EAST must not be in canonical list");
  assert.ok(!CANONICAL_CONSTITUENCIES.includes("KWAHU AFRAM PLAINS NORTH"), "KWAHU AFRAM PLAINS NORTH must not be in canonical list");

  // Eastern region (33 total)
  const eastern = getConstituenciesForRegion("Eastern");
  assert.equal(eastern.length, 33, "Eastern region must have exactly 33 constituencies");
  assert.ok(eastern.includes("ABETIFI"), "Eastern must include ABETIFI");
  assert.ok(eastern.includes("AFRAM PLAINS NORTH"), "Eastern must include AFRAM PLAINS NORTH");
  assert.ok(!eastern.includes("KWAHU EAST"), "Eastern must not include KWAHU EAST");
  assert.ok(!eastern.includes("KWAHU AFRAM PLAINS NORTH"), "Eastern must not include KWAHU AFRAM PLAINS NORTH");

  // Administrative Capitals
  assert.equal(getConstituencyCapital("Abetifi"), "Abetifi");
  assert.equal(getConstituencyCapital("Kwahu East"), "Abetifi");
  assert.equal(getConstituencyCapital("Afram Plains North"), "Donkorkrom");
  assert.equal(getConstituencyCapital("Kwahu Afram Plains"), "Donkorkrom");
  assert.equal(getConstituencyCapital("Kwahu Afram Plains North"), "Donkorkrom");
});
