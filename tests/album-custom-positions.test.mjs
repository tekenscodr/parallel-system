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

