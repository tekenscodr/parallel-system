import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CUSTOM_CONTEST,
  CONTEST_LIST,
  CUSTOM_POSITION_CATEGORIES,
  ALL_CUSTOMIZABLE_POSITIONS,
  POSITION_PRESETS,
  getCanonicalPositionsForSelection,
  normalizeCanonicalPosition,
} from "../lib/election-contests.ts";

test("lib/election-contests exports custom position definitions, presets and resolvers", () => {
  // 1. CUSTOM_CONTEST is registered
  assert.equal(CUSTOM_CONTEST, "Custom");
  assert.ok(CONTEST_LIST.includes("Custom"));

  // 2. Position categories and positions exist
  assert.ok(CUSTOM_POSITION_CATEGORIES.length >= 6);
  assert.ok(ALL_CUSTOMIZABLE_POSITIONS.length >= 20);

  // 3. Presets exist
  assert.ok(POSITION_PRESETS.core_slate);
  assert.ok(POSITION_PRESETS.key_officers);
  assert.ok(POSITION_PRESETS.wings_only);
  assert.ok(POSITION_PRESETS.constituency_slate);
  assert.ok(POSITION_PRESETS.deputies_only);

  // 4. getCanonicalPositionsForSelection resolves IDs to canonical names
  const chairAndSec = getCanonicalPositionsForSelection(["chairperson", "secretary"]);
  assert.ok(chairAndSec.canonicalSet.has("Chairperson"));
  assert.ok(chairAndSec.canonicalSet.has("Secretary"));
  assert.ok(!chairAndSec.canonicalSet.has("Deputy Secretary"));
  assert.ok(!chairAndSec.canonicalSet.has("1st Vice Chairperson"));
  assert.equal(chairAndSec.displayLabels.length, 2);

  // 5. Deputy vs Primary position isolation
  const depSecOnly = getCanonicalPositionsForSelection(["deputy_secretary"]);
  assert.ok(depSecOnly.canonicalSet.has("Deputy Secretary"));
  assert.ok(!depSecOnly.canonicalSet.has("Secretary"));

  const orgOnly = getCanonicalPositionsForSelection(["organiser"]);
  assert.ok(orgOnly.canonicalSet.has("Organiser"));
  assert.ok(!orgOnly.canonicalSet.has("Deputy Organiser"));
});

test("Election album route and frontend correctly integrate custom position filtering", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const routeCode = fs.readFileSync(routePath, "utf8");

  // Route file checks
  assert.ok(routeCode.includes("isCustomContest"), "Route must recognize isCustomContest");
  assert.ok(routeCode.includes("customResolved"), "Route must resolve custom positions");
  assert.ok(routeCode.includes("effectiveContestName"), "Route must compute effectiveContestName");
  assert.ok(routeCode.includes("customResolved.canonicalSet.has(canonPos)"), "Route must match canonical positions");

  // Page file checks
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const pageCode = fs.readFileSync(pagePath, "utf8");

  assert.ok(pageCode.includes("selectedPositions"), "Page must maintain selectedPositions state");
  assert.ok(pageCode.includes("togglePosition"), "Page must have togglePosition handler");
  assert.ok(pageCode.includes("applyPreset"), "Page must support position presets");
  assert.ok(pageCode.includes("CUSTOM_POSITION_CATEGORIES"), "Page must render categorized positions");
  assert.ok(pageCode.includes("positionsQuery"), "Page must pass positions query parameter");
});

test("Custom position matching strictly isolates selected portfolios and excludes unselected ones", () => {
  const { canonicalSet, isTesconNasaraIncluded } = getCanonicalPositionsForSelection([
    "chairperson",
    "secretary",
    "treasurer",
  ]);

  const candidates = [
    { position: "Constituency Chairman", executive_level: "Constituency", canon: "Chairperson", expected: true },
    { position: "General Secretary", executive_level: "National", canon: "General Secretary", expected: true },
    { position: "Constituency Secretary", executive_level: "Constituency", canon: "Secretary", expected: true },
    { position: "Assistant Secretary", executive_level: "Constituency", canon: "Deputy Secretary", expected: false },
    { position: "1st Vice Chairman", executive_level: "Constituency", canon: "1st Vice Chairperson", expected: false },
    { position: "Constituency Youth Organiser", executive_level: "Constituency", canon: "Youth Organiser", expected: false },
    { position: "Constituency Treasurer", executive_level: "Constituency", canon: "Treasurer", expected: true },
  ];

  for (const c of candidates) {
    const matched = canonicalSet.has(c.canon);
    assert.equal(
      matched,
      c.expected,
      `Position ${c.position} (${c.canon}) should have matched=${c.expected} but got ${matched}`
    );
  }
});

test("normalizeCanonicalPosition properly isolates National dignitaries from TESCON Presidents", () => {
  // National Former Presidents must NOT be normalized to TESCON President
  assert.equal(
    normalizeCanonicalPosition("Former President", "National"),
    "Former President",
    "Former President at National level must remain Former President"
  );

  // Flagbearer / Former Vice President must not be TESCON President
  assert.equal(
    normalizeCanonicalPosition("Current Flagbearer / Former Vice President", "National"),
    "Current Flagbearer / Former Vice President"
  );

  // National President
  assert.equal(
    normalizeCanonicalPosition("President", "National"),
    "President"
  );

  // TESCON Presidents must be properly normalized
  assert.equal(
    normalizeCanonicalPosition("President", "TESCON"),
    "TESCON President"
  );
  assert.equal(
    normalizeCanonicalPosition("TESCON President", "TESCON"),
    "TESCON President"
  );
  assert.equal(
    normalizeCanonicalPosition("TESCON President", "Constituency"),
    "TESCON President"
  );

  // Custom contest selection for tescon_president must exclude Former Presidents
  const { canonicalSet } = getCanonicalPositionsForSelection(["tescon_president"]);
  assert.ok(canonicalSet.has("TESCON President"));
  assert.ok(!canonicalSet.has("Former President"));

  const akufoAddoCanon = normalizeCanonicalPosition("Former President", "National");
  assert.equal(canonicalSet.has(akufoAddoCanon), false, "Akufo-Addo must not match TESCON President contest");
});

test("Director of Elections and Director of Research are properly normalized and categorized", () => {
  assert.equal(
    normalizeCanonicalPosition("Director of Elections", "National"),
    "Director of Elections"
  );
  assert.equal(
    normalizeCanonicalPosition("Director of Research", "National"),
    "Director of Research"
  );

  const electoralSelection = getCanonicalPositionsForSelection(["electoral_affairs"]);
  assert.ok(electoralSelection.canonicalSet.has("Director of Elections"));

  const researchSelection = getCanonicalPositionsForSelection(["research_officer"]);
  assert.ok(researchSelection.canonicalSet.has("Director of Research"));
});

test("National executives preserve authentic designations without collapsing to generic roles", () => {
  const nationalTests = [
    { raw: "Director of Elections", expected: "Director of Elections" },
    { raw: "Director of Research", expected: "Director of Research" },
    { raw: "Chairman of The Legal Committee", expected: "Chairman of The Legal Committee" },
    { raw: "Director of Legal Affairs", expected: "Director of Legal Affairs" },
    { raw: "Past National Chairman", expected: "Past National Chairman" },
    { raw: "Past General Secretary", expected: "Past General Secretary" },
    { raw: "National Youth Organiser", expected: "National Youth Organiser" },
    { raw: "Deputy National Youth Organiser", expected: "Deputy National Youth Organiser" },
    { raw: "National Women Organiser", expected: "National Women Organiser" },
    { raw: "Deputy National Women Organiser", expected: "Deputy National Women Organiser" },
    { raw: "National Organiser", expected: "National Organiser" },
    { raw: "Deputy National Organiser", expected: "Deputy National Organiser" },
    { raw: "National Nasara Coordinator", expected: "National Nasara Coordinator" },
    { raw: "Deputy National Nasara Coordinator", expected: "Deputy National Nasara Coordinator" },
    { raw: "National Communication Director", expected: "National Communication Director" },
    { raw: "Deputy Communication Director", expected: "Deputy Communication Director" },
    { raw: "National Treasurer", expected: "National Treasurer" },
    { raw: "Director of IT", expected: "Director of IT" },
    { raw: "Deputy Director of IT", expected: "Deputy Director of IT" },
    { raw: "Director of Protocol", expected: "Director of Protocol" },
    { raw: "Deputy Director of Protocol", expected: "Deputy Director of Protocol" },
    { raw: "Director of Finance and Administration", expected: "Director of Finance and Administration" },
    { raw: "External Relations Officer", expected: "External Relations Officer" },
    { raw: "Deputy External Relations Officer", expected: "Deputy External Relations Officer" },
    { raw: "National Council Representative", expected: "National Council Representative" },
  ];

  for (const t of nationalTests) {
    const actual = normalizeCanonicalPosition(t.raw, "National");
    assert.equal(
      actual,
      t.expected,
      `Position "${t.raw}" at National level should normalize to "${t.expected}" but got "${actual}"`
    );
  }

  // Verify custom portfolio selectors map correctly to both national and regional titles
  const youthSelection = getCanonicalPositionsForSelection(["youth_organiser"]);
  assert.ok(youthSelection.canonicalSet.has("Youth Organiser"));
  assert.ok(youthSelection.canonicalSet.has("National Youth Organiser"));

  const depYouthSelection = getCanonicalPositionsForSelection(["deputy_youth_organiser"]);
  assert.ok(depYouthSelection.canonicalSet.has("Deputy Youth Organiser"));
  assert.ok(depYouthSelection.canonicalSet.has("Deputy National Youth Organiser"));

  const womenSelection = getCanonicalPositionsForSelection(["women_organiser"]);
  assert.ok(womenSelection.canonicalSet.has("Women Organiser"));
  assert.ok(womenSelection.canonicalSet.has("National Women Organiser"));

  const depWomenSelection = getCanonicalPositionsForSelection(["deputy_women_organiser"]);
  assert.ok(depWomenSelection.canonicalSet.has("Deputy Women Organiser"));
  assert.ok(depWomenSelection.canonicalSet.has("Deputy National Women Organiser"));

  const commSelection = getCanonicalPositionsForSelection(["communication_officer"]);
  assert.ok(commSelection.canonicalSet.has("Communication Officer"));
  assert.ok(commSelection.canonicalSet.has("National Communication Director"));

  const treasurerSelection = getCanonicalPositionsForSelection(["treasurer"]);
  assert.ok(treasurerSelection.canonicalSet.has("Treasurer"));
  assert.ok(treasurerSelection.canonicalSet.has("National Treasurer"));

  const legalSelection = getCanonicalPositionsForSelection(["legal_officer"]);
  assert.ok(legalSelection.canonicalSet.has("Legal Representative Officer"));
  assert.ok(legalSelection.canonicalSet.has("Director of Legal Affairs"));
  assert.ok(legalSelection.canonicalSet.has("Chairman of The Legal Committee"));
});

test("Youth position picker presets and fine-grained selection", () => {
  // 1. POSITION_PRESETS has youth presets
  assert.ok(POSITION_PRESETS.youth_wing);
  assert.deepEqual(POSITION_PRESETS.youth_wing.ids, ["youth_organiser", "deputy_youth_organiser"]);

  assert.ok(POSITION_PRESETS.youth_substantive);
  assert.deepEqual(POSITION_PRESETS.youth_substantive.ids, ["youth_organiser"]);

  assert.ok(POSITION_PRESETS.youth_deputies);
  assert.deepEqual(POSITION_PRESETS.youth_deputies.ids, ["deputy_youth_organiser"]);

  // 2. Substantive Youth Organiser isolation
  const youthSub = getCanonicalPositionsForSelection(POSITION_PRESETS.youth_substantive.ids);
  assert.ok(youthSub.canonicalSet.has("Youth Organiser"));
  assert.ok(youthSub.canonicalSet.has("National Youth Organiser"));
  assert.ok(!youthSub.canonicalSet.has("Deputy Youth Organiser"));
  assert.ok(!youthSub.canonicalSet.has("Deputy National Youth Organiser"));

  // 3. Deputy Youth Organiser isolation
  const youthDep = getCanonicalPositionsForSelection(POSITION_PRESETS.youth_deputies.ids);
  assert.ok(youthDep.canonicalSet.has("Deputy Youth Organiser"));
  assert.ok(youthDep.canonicalSet.has("Deputy National Youth Organiser"));
  assert.ok(!youthDep.canonicalSet.has("Youth Organiser"));
  assert.ok(!youthDep.canonicalSet.has("National Youth Organiser"));

  // 4. Combined Youth Wing
  const youthBoth = getCanonicalPositionsForSelection(POSITION_PRESETS.youth_wing.ids);
  assert.ok(youthBoth.canonicalSet.has("Youth Organiser"));
  assert.ok(youthBoth.canonicalSet.has("National Youth Organiser"));
  assert.ok(youthBoth.canonicalSet.has("Deputy Youth Organiser"));
  assert.ok(youthBoth.canonicalSet.has("Deputy National Youth Organiser"));

  // 5. Check page.tsx has youth position picker controls and tablePositionFilter
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const pageCode = fs.readFileSync(pagePath, "utf8");
  assert.ok(pageCode.includes("Pick Youth Position(s) for Album"), "Page must contain Youth Position Picker Card");
  assert.ok(pageCode.includes("Youth Organisers Only"), "Page must have Youth Organisers Only button");
  assert.ok(pageCode.includes("Deputy Youth Only"), "Page must have Deputy Youth Only button");
  assert.ok(pageCode.includes("tablePositionFilter"), "Page must have tablePositionFilter");
  assert.ok(pageCode.includes("availablePositions"), "Page must compute availablePositions");
});
