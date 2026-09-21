import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getDefaultPositionIdsForContest,
  DEPUTY_POSITION_IDS,
  APPOINTED_POSITION_IDS,
  FULL_EXECUTIVE_POSITION_IDS,
  getCanonicalPositionsForSelection,
  normalizeCanonicalPosition,
  ALL_CUSTOMIZABLE_POSITIONS,
} from "../lib/election-contests.ts";

test("getDefaultPositionIdsForContest returns accurate constituent positions for Youth and Women", () => {
  // 1. Youth Wing (Organisers & Deputies)
  const youthWing = getDefaultPositionIdsForContest("Youth Organisers & Deputies", "organisers_only");
  assert.ok(youthWing.includes("youth_organiser"), "Youth Wing must include youth_organiser");
  assert.ok(youthWing.includes("deputy_youth_organiser"), "Youth Wing must include deputy_youth_organiser");
  assert.ok(youthWing.includes("tescon_president"), "Youth Wing must include tescon_president");
  assert.ok(youthWing.includes("tescon_wocom"), "Youth Wing must include tescon_wocom");
  assert.ok(youthWing.includes("tescon_nasara"), "Youth Wing must include tescon_nasara");

  // 2. Youth Organiser (Full electoral college)
  const youthFull = getDefaultPositionIdsForContest("Youth Organiser", "all_voters");
  assert.ok(youthFull.length >= 20, "Youth Organiser must include full slate of eligible portfolios");
  assert.ok(youthFull.includes("chairperson"), "Youth Organiser includes chairperson");
  assert.ok(youthFull.includes("secretary"), "Youth Organiser includes secretary");
  assert.ok(youthFull.includes("youth_organiser"), "Youth Organiser includes youth_organiser");
  assert.ok(youthFull.includes("deputy_youth_organiser"), "Youth Organiser includes deputy_youth_organiser");
  assert.ok(youthFull.includes("tescon_president"), "Youth Organiser includes tescon_president");
  assert.ok(youthFull.includes("tescon_wocom"), "Youth Organiser includes tescon_wocom");
  assert.ok(youthFull.includes("tescon_nasara"), "Youth Organiser includes tescon_nasara");

  // 3. Women Wing (Organisers & Deputies)
  const womenWing = getDefaultPositionIdsForContest("Women Organisers & Deputies", "all_voters");
  assert.ok(womenWing.includes("women_organiser"), "Women Wing must include women_organiser");
  assert.ok(womenWing.includes("deputy_women_organiser"), "Women Wing must include deputy_women_organiser");
  assert.ok(womenWing.includes("tescon_wocom"), "Women Wing must include tescon_wocom");
  assert.ok(!womenWing.includes("tescon_president"), "Women Wing must strictly exclude tescon_president");
  assert.ok(!womenWing.includes("tescon_nasara"), "Women Wing must strictly exclude tescon_nasara");

  // 4. Women Organiser (Full female electoral college)
  const womenFull = getDefaultPositionIdsForContest("Women Organiser", "all_voters");
  assert.ok(womenFull.length >= 20, "Women Organiser must include full female slate");
  assert.ok(womenFull.includes("chairperson"), "Women Organiser includes female chairpersons");
  assert.ok(womenFull.includes("women_organiser"), "Women Organiser includes women_organiser");
  assert.ok(womenFull.includes("tescon_wocom"), "Women Organiser includes tescon_wocom");
});

test("DEPUTY_POSITION_IDS and APPOINTED_POSITION_IDS correctly identify secondary roles", () => {
  // Deputy positions
  assert.ok(DEPUTY_POSITION_IDS.has("deputy_youth_organiser"));
  assert.ok(DEPUTY_POSITION_IDS.has("deputy_women_organiser"));
  assert.ok(DEPUTY_POSITION_IDS.has("deputy_secretary"));
  assert.ok(DEPUTY_POSITION_IDS.has("deputy_organiser"));
  assert.ok(DEPUTY_POSITION_IDS.has("deputy_nasara_coordinator"));
  assert.ok(!DEPUTY_POSITION_IDS.has("youth_organiser"));
  assert.ok(!DEPUTY_POSITION_IDS.has("women_organiser"));
  assert.ok(!DEPUTY_POSITION_IDS.has("secretary"));

  // Appointed constituency positions (exactly 8 statutory roles)
  assert.equal(APPOINTED_POSITION_IDS.size, 8);
  assert.ok(APPOINTED_POSITION_IDS.has("communication_officer"));
  assert.ok(APPOINTED_POSITION_IDS.has("electoral_affairs"));
  assert.ok(APPOINTED_POSITION_IDS.has("research_officer"));
  assert.ok(APPOINTED_POSITION_IDS.has("pwd_officer"));
  assert.ok(APPOINTED_POSITION_IDS.has("deputy_organiser"));
  assert.ok(APPOINTED_POSITION_IDS.has("deputy_youth_organiser"));
  assert.ok(APPOINTED_POSITION_IDS.has("deputy_women_organiser"));
  assert.ok(APPOINTED_POSITION_IDS.has("deputy_nasara_coordinator"));

  // Substantive elected roles must not be in appointed set
  assert.ok(!APPOINTED_POSITION_IDS.has("chairperson"));
  assert.ok(!APPOINTED_POSITION_IDS.has("secretary"));
  assert.ok(!APPOINTED_POSITION_IDS.has("treasurer"));
  assert.ok(!APPOINTED_POSITION_IDS.has("organiser"));
  assert.ok(!APPOINTED_POSITION_IDS.has("youth_organiser"));
  assert.ok(!APPOINTED_POSITION_IDS.has("women_organiser"));
});

test("Deselecting positions filters canonical roles while preserving contest qualification rules", () => {
  // Case A: Youth Wing with deputy_youth_organiser deselected
  const youthWingSelected = ["youth_organiser", "tescon_president"];
  const youthWingResolved = getCanonicalPositionsForSelection(youthWingSelected);
  assert.ok(youthWingResolved.canonicalSet.has("Youth Organiser"));
  assert.ok(youthWingResolved.canonicalSet.has("TESCON President"));
  assert.ok(!youthWingResolved.canonicalSet.has("Deputy Youth Organiser"), "Deputy Youth must be excluded");

  // Case B: Youth Organiser contest with deputies deselected
  const defaultYouth = getDefaultPositionIdsForContest("Youth Organiser");
  const substantiveYouthOnly = defaultYouth.filter((id) => !DEPUTY_POSITION_IDS.has(id));
  const substantiveYouthResolved = getCanonicalPositionsForSelection(substantiveYouthOnly);

  assert.ok(substantiveYouthResolved.canonicalSet.has("Chairperson"));
  assert.ok(substantiveYouthResolved.canonicalSet.has("Secretary"));
  assert.ok(substantiveYouthResolved.canonicalSet.has("Youth Organiser"));
  assert.ok(!substantiveYouthResolved.canonicalSet.has("Deputy Youth Organiser"));
  assert.ok(!substantiveYouthResolved.canonicalSet.has("Deputy Secretary"));
  assert.ok(!substantiveYouthResolved.canonicalSet.has("Deputy Organiser"));

  // Case C: Youth Organiser contest with 8 appointed roles deselected (leaving 11 elected + national/regional)
  const electedOnlyYouth = defaultYouth.filter((id) => !APPOINTED_POSITION_IDS.has(id));
  const electedOnlyYouthResolved = getCanonicalPositionsForSelection(electedOnlyYouth);

  assert.ok(electedOnlyYouthResolved.canonicalSet.has("Chairperson"));
  assert.ok(electedOnlyYouthResolved.canonicalSet.has("Secretary"));
  assert.ok(electedOnlyYouthResolved.canonicalSet.has("Youth Organiser"));
  assert.ok(!electedOnlyYouthResolved.canonicalSet.has("Communication Officer"));
  assert.ok(!electedOnlyYouthResolved.canonicalSet.has("Director of Research"));
  assert.ok(!electedOnlyYouthResolved.canonicalSet.has("Deputy Youth Organiser"));
});

test("app/api/admin/albums/election/route.ts preserves named contest and checks position constraints", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // Preserves named contest when positions parameter is passed
  assert.ok(
    code.includes("isNamedContest"),
    "Route must detect named contests"
  );
  assert.ok(
    code.includes("hasPositionFilter"),
    "Route must detect hasPositionFilter"
  );
  assert.ok(
    code.includes("checkPositionConstraint"),
    "Route must implement checkPositionConstraint inside eligibility checker"
  );
  assert.ok(
    code.includes("isDelegateInPositionSelection"),
    "Route must have isDelegateInPositionSelection helper"
  );
  assert.ok(
    code.includes("customPositionKeys"),
    "Route must parse customPositionKeys from positions param"
  );
  assert.ok(
    code.includes("excludedPositionKeys"),
    "Route must parse excludedPositionKeys from query"
  );
});

test("app/admin/albums/page.tsx renders position checklist, excluded pills, and deselection actions", () => {
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const code = fs.readFileSync(pagePath, "utf8");

  // Default contest position resolution
  assert.ok(
    code.includes("defaultContestPositionIds"),
    "Page must compute defaultContestPositionIds"
  );
  assert.ok(
    code.includes("excludedInAlbum"),
    "Page must compute excludedInAlbum"
  );
  assert.ok(
    code.includes("isPositionsCustomized"),
    "Page must track isPositionsCustomized"
  );

  // Deselection helper buttons
  assert.ok(
    code.includes("deselectDeputies"),
    "Page must provide deselectDeputies action"
  );
  assert.ok(
    code.includes("keepSubstantiveOnly"),
    "Page must provide keepSubstantiveOnly action"
  );
  assert.ok(
    code.includes("deselectAppointed"),
    "Page must provide deselectAppointed action"
  );
  assert.ok(
    code.includes("selectAllContestPositions"),
    "Page must provide selectAllContestPositions action"
  );

  // UI elements
  assert.ok(
    code.includes("Positions Voting for National Youth Organiser"),
    "Page must display Youth contest-aware position header"
  );
  assert.ok(
    code.includes("Deselect any position to exclude its delegates from this album"),
    "Page must display guidance for deselecting positions"
  );
  assert.ok(
    code.includes("Excluded:"),
    "Page must render Excluded banner when roles are deselected"
  );
  assert.ok(
    code.includes("handleContestSelect"),
    "Page must wire handleContestSelect"
  );
  assert.ok(
    code.includes('pos.id === "tescon_wocom"') && code.includes('pos.id === "tescon_nasara"'),
    "Page must explicitly include TESCON WOCOM and TESCON Nasara in eligible positions grid for visibility"
  );
});

