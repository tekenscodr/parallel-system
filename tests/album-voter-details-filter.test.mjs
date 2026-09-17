import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ALL_VOTER_DETAILS,
  DEFAULT_VOTER_DETAILS,
  VOTER_DETAIL_PRESETS,
  parseVoterDetails,
} from "../lib/election-contests.ts";

test("lib/election-contests defines all 9 voter detail fields and valid presets", () => {
  assert.equal(ALL_VOTER_DETAILS.length, 9, "Must define 9 voter detail fields");
  
  const ids = ALL_VOTER_DETAILS.map((d) => d.id);
  assert.ok(ids.includes("photo"));
  assert.ok(ids.includes("name"));
  assert.ok(ids.includes("position"));
  assert.ok(ids.includes("level"));
  assert.ok(ids.includes("voter_id"));
  assert.ok(ids.includes("phone"));
  assert.ok(ids.includes("institution"));
  assert.ok(ids.includes("demographics"));
  assert.ok(ids.includes("polling_station"));

  assert.equal(DEFAULT_VOTER_DETAILS.length, 7, "Default standard details must have 7 items");
  assert.ok(DEFAULT_VOTER_DETAILS.includes("voter_id"));
  assert.ok(DEFAULT_VOTER_DETAILS.includes("name"));
  assert.ok(DEFAULT_VOTER_DETAILS.includes("photo"));

  // Presets
  assert.ok(VOTER_DETAIL_PRESETS.default_standard, "Default standard preset must exist");
  assert.ok(VOTER_DETAIL_PRESETS.id_verification, "ID verification preset must exist");
  assert.ok(VOTER_DETAIL_PRESETS.photo_badge, "Accreditation badge preset must exist");
  assert.ok(VOTER_DETAIL_PRESETS.contact_directory, "Contact directory preset must exist");
  assert.ok(VOTER_DETAIL_PRESETS.full_profile, "Full profile preset must exist");

  assert.equal(VOTER_DETAIL_PRESETS.full_profile.ids.length, 9);
});

test("parseVoterDetails parses query parameters, defaults, and custom subsets correctly", () => {
  // 1. Default fallback when null, undefined, or empty
  const defaultSet = parseVoterDetails(null);
  assert.equal(defaultSet.size, 7);
  assert.ok(defaultSet.has("voter_id"));
  assert.ok(defaultSet.has("name"));
  assert.ok(defaultSet.has("photo"));

  const emptySet = parseVoterDetails("");
  assert.equal(emptySet.size, 7);

  // 2. 'all' keyword
  const allSet = parseVoterDetails("all");
  assert.equal(allSet.size, 9);
  assert.ok(allSet.has("demographics"));
  assert.ok(allSet.has("polling_station"));

  // 3. 'none' keyword
  const noneSet = parseVoterDetails("none");
  assert.equal(noneSet.size, 0);

  // 4. Specific subsets (e.g. voter_id and name only)
  const subset = parseVoterDetails("name,voter_id");
  assert.equal(subset.size, 2);
  assert.ok(subset.has("name"));
  assert.ok(subset.has("voter_id"));
  assert.ok(!subset.has("photo"));
  assert.ok(!subset.has("phone"));
  assert.ok(!subset.has("position"));

  // 5. Handling spaces, case, and invalid values
  const mixed = parseVoterDetails(" Photo,  VOTER_ID, invalid_field, PHONE ");
  assert.equal(mixed.size, 3);
  assert.ok(mixed.has("photo"));
  assert.ok(mixed.has("voter_id"));
  assert.ok(mixed.has("phone"));
  assert.ok(!mixed.has("name"));
});

test("Election album route integrates voter details filtering", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // Route reads details query param
  assert.ok(
    code.includes('searchParams.get("details")') || code.includes("searchParams.get('details')"),
    "Route must parse details search parameter"
  );
  assert.ok(
    code.includes("parseVoterDetails(detailsParam)"),
    "Route must use parseVoterDetails"
  );

  // generateAlbumHtml accepts visibleDetails
  assert.ok(
    code.includes("visibleDetails?: Set<VoterDetailField>"),
    "generateAlbumHtml must accept visibleDetails"
  );

  // renderVoterCard gates fields conditionally
  assert.ok(
    code.includes("${showVoterId ? `"),
    "Voter card must conditionally render Voter ID"
  );
  assert.ok(
    code.includes("${showName ? `<div class=\"exec-name\">${d.executive_name}</div>` : \"\"}"),
    "Voter card must conditionally render Name"
  );
  assert.ok(
    code.includes("${showPhone ? `"),
    "Voter card must conditionally render Phone"
  );
  assert.ok(
    code.includes("const effectivePhotoSrc = showPhoto ? photoSrc : d.avatar_svg;"),
    "When filtering no image or when photo is missing, must use initial abbreviation avatar"
  );
  assert.ok(
    code.includes('src="${effectivePhotoSrc}"'),
    "Voter card image must use effectivePhotoSrc"
  );
  assert.ok(
    code.includes("${showDemographics && demographicText ? `"),
    "Voter card must conditionally render Demographics"
  );
  assert.ok(
    code.includes("${showPollingStation && d.polling_station ? `"),
    "Voter card must conditionally render Polling Station"
  );
});

test("Album UI page.tsx includes voter details filter panel and synchronized table columns", () => {
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const code = fs.readFileSync(pagePath, "utf8");

  // State & Handlers
  assert.ok(code.includes("selectedDetails"), "Page must maintain selectedDetails state");
  assert.ok(code.includes("detailsFilterOpen"), "Page must maintain detailsFilterOpen state");
  assert.ok(code.includes("toggleDetail"), "Page must have toggleDetail handler");
  assert.ok(code.includes("applyDetailPreset"), "Page must have applyDetailPreset handler");
  assert.ok(code.includes("detailsQuery"), "Page must compute detailsQuery");

  // UI elements
  assert.ok(code.includes("Filter Voter Details"), "Page must include Filter Voter Details button");
  assert.ok(code.includes("ID Verification"), "Page must include ID Verification preset button");
  assert.ok(code.includes("Contact Directory"), "Page must include Contact Directory preset button");
  assert.ok(code.includes("Accreditation Badge"), "Page must include Accreditation Badge preset button");
  assert.ok(code.includes("Full Profile (All 9)"), "Page must include Full Profile preset button");

  // Table header synchronization
  assert.ok(
    code.includes('selectedDetails.includes("voter_id") && <TableHead>Voter ID</TableHead>'),
    "Table must conditionally render Voter ID header"
  );
  assert.ok(
    code.includes('selectedDetails.includes("phone") && <TableHead>Phone</TableHead>'),
    "Table must conditionally render Phone header"
  );
});
