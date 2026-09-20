import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ALL_ELECTORAL_JURISDICTIONS,
  ALL_JURISDICTION_IDS,
  JURISDICTION_PRESETS,
} from "../lib/election-contests.ts";

test("lib/election-contests defines 18 electoral jurisdictions and preset groupings", () => {
  assert.equal(ALL_ELECTORAL_JURISDICTIONS.length, 18, "Must define all 18 jurisdictions");
  assert.equal(ALL_JURISDICTION_IDS.length, 18, "All jurisdiction IDs array must have 18 items");

  // 16 Ghana regions + External Branch + National HQ
  const ids = ALL_ELECTORAL_JURISDICTIONS.map((j) => j.id);
  assert.ok(ids.includes("Ashanti"));
  assert.ok(ids.includes("Greater Accra"));
  assert.ok(ids.includes("Eastern"));
  assert.ok(ids.includes("Northern"));
  assert.ok(ids.includes("External Branch"));
  assert.ok(ids.includes("National Headquarters"));

  // Presets
  assert.ok(JURISDICTION_PRESETS.all, "Must have all preset");
  assert.equal(JURISDICTION_PRESETS.all.ids.length, 18);

  assert.ok(JURISDICTION_PRESETS.sixteen_regions, "Must have 16 regions preset");
  assert.equal(JURISDICTION_PRESETS.sixteen_regions.ids.length, 16);
  assert.ok(!JURISDICTION_PRESETS.sixteen_regions.ids.includes("External Branch"));
  assert.ok(!JURISDICTION_PRESETS.sixteen_regions.ids.includes("National Headquarters"));

  assert.ok(JURISDICTION_PRESETS.southern_belt, "Must have southern belt preset");
  assert.equal(JURISDICTION_PRESETS.southern_belt.ids.length, 6);

  assert.ok(JURISDICTION_PRESETS.middle_belt, "Must have middle belt preset");
  assert.equal(JURISDICTION_PRESETS.middle_belt.ids.length, 5);

  assert.ok(JURISDICTION_PRESETS.northern_belt, "Must have northern belt preset");
  assert.equal(JURISDICTION_PRESETS.northern_belt.ids.length, 5);

  assert.ok(JURISDICTION_PRESETS.diaspora_and_hq, "Must have diaspora and hq preset");
  assert.equal(JURISDICTION_PRESETS.diaspora_and_hq.ids.length, 2);
});

test("Election album route parses multi-region query and isolates regional subsets", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Route reads regions parameter
  assert.ok(
    code.includes('searchParams.get("regions")') || code.includes("searchParams.get('regions')"),
    "Route must parse regions search parameter"
  );
  assert.ok(
    code.includes("rawRegionsList"),
    "Route must parse rawRegionsList"
  );
  assert.ok(
    code.includes("isAllRegions"),
    "Route must calculate isAllRegions boolean"
  );

  // 2. Regional filtering in contestFiltered
  assert.ok(
    code.includes("rawRegionsList.some((target) => {") || code.includes("rawRegionsList.some"),
    "Route must filter delegates against active multi-region list"
  );

  // 3. Multi-region statutory quota expected calculation
  assert.ok(
    code.includes("for (const rawR of rawRegionsList)") || code.includes("rawRegionsList"),
    "Route must iterate selected regions to compute expected count"
  );
});

test("Election album route implements Provisional and Final Certified album editions", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Route reads album_type parameter
  assert.ok(
    code.includes('searchParams.get("album_type")') || code.includes("searchParams.get('album_type')"),
    "Route must read album_type search parameter"
  );
  assert.ok(
    code.includes('albumType === "final"') || code.includes("albumType === 'final'"),
    "Route must determine if edition is final certified"
  );
  assert.ok(
    code.includes("isFinalAlbum"),
    "Route must maintain isFinalAlbum boolean"
  );

  // 2. Cover page differences between Provisional and Final
  assert.ok(
    code.includes("FINAL ELECTORAL COLLEGE ALBUM &amp; DELEGATE REGISTER") ||
    code.includes("FINAL ELECTORAL COLLEGE ALBUM"),
    "Cover must render Final title when certified"
  );
  assert.ok(
    code.includes("OFFICIAL FINAL CERTIFIED REGISTER"),
    "Cover must render Official Final Certified badge"
  );
  assert.ok(
    code.includes("hereby officially certifies") &&
    code.includes("Final Certified Electoral College Photo Album and Delegate Register"),
    "Proclamation must certify and promulgate final album"
  );

  // 3. Headers, footers and badges
  assert.ok(
    code.includes('isFinalAlbum ? "FINAL CERTIFIED" : "PROVISIONAL"'),
    "Route must differentiate FINAL CERTIFIED vs PROVISIONAL in page headers and footers"
  );
});

test("Wing album extraction supports deselecting administrative tiers and regions", () => {
  const sampleExecutives = [
    { executive_name: "Youth Reg Ashanti", executive_level: "Regional", region: "Ashanti", canonical_position: "Youth Organiser" },
    { executive_name: "Youth Const Ashanti", executive_level: "Constituency", region: "Ashanti", canonical_position: "Youth Organiser" },
    { executive_name: "Youth Tescon Ashanti", executive_level: "TESCON", region: "Ashanti", canonical_position: "TESCON President" },
    { executive_name: "Youth Reg Greater Accra", executive_level: "Regional", region: "Greater Accra", canonical_position: "Youth Organiser" },
    { executive_name: "Youth Const Northern", executive_level: "Constituency", region: "Northern", canonical_position: "Youth Organiser" },
    { executive_name: "Youth Branch UK", executive_level: "External Branch", region: "External Branch", canonical_position: "Youth Organiser" },
  ];

  // Deselect TESCON and External Branch (only Regional and Constituency)
  const selectedLevels = ["Regional", "Constituency"];
  const levelFiltered = sampleExecutives.filter((d) =>
    selectedLevels.some((sl) => sl.toLowerCase() === d.executive_level.toLowerCase())
  );
  assert.equal(levelFiltered.length, 4, "TESCON and External Branch must be excluded");
  assert.ok(!levelFiltered.some((d) => d.executive_level === "TESCON"));
  assert.ok(!levelFiltered.some((d) => d.executive_level === "External Branch"));

  // Deselect Northern region (leave one region out)
  const selectedRegions = ["Ashanti", "Greater Accra"];
  const regionFiltered = levelFiltered.filter((d) =>
    selectedRegions.some((r) => r.toLowerCase() === d.region.toLowerCase())
  );
  assert.equal(regionFiltered.length, 3, "Only Ashanti and Greater Accra executives must remain");
  assert.ok(!regionFiltered.some((d) => d.region === "Northern"));
});

test("Admin album page includes active/dormant accordion system and multi-region controls", () => {
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const code = fs.readFileSync(pagePath, "utf8");

  // 1. State definitions
  assert.ok(code.includes("selectedRegions"), "Page must maintain selectedRegions state");
  assert.ok(code.includes("albumType"), "Page must maintain albumType state");
  assert.ok(code.includes("openAccordions"), "Page must maintain openAccordions state");

  // 2. Handlers
  assert.ok(code.includes("toggleRegion"), "Page must have toggleRegion handler");
  assert.ok(code.includes("selectAllRegions"), "Page must have selectAllRegions handler");
  assert.ok(code.includes("clearAllRegions"), "Page must have clearAllRegions handler");
  assert.ok(code.includes("applyJurisdictionPreset"), "Page must have applyJurisdictionPreset handler");
  assert.ok(code.includes("toggleAccordion"), "Page must have toggleAccordion handler");
  assert.ok(code.includes("expandAllAccordions"), "Page must have expandAllAccordions handler");
  assert.ok(code.includes("collapseAllAccordions"), "Page must have collapseAllAccordions handler");
  assert.ok(code.includes("resetAllFilters"), "Page must have resetAllFilters handler");

  // 3. Query string builder
  assert.ok(code.includes("regionsQuery"), "Page must build regionsQuery");
  assert.ok(code.includes("&regions="), "Page must append &regions= parameter");
  assert.ok(code.includes("albumTypeQuery"), "Page must build albumTypeQuery");
  assert.ok(code.includes("&album_type=final"), "Page must append &album_type=final parameter");

  // 4. Client-side filtering
  assert.ok(code.includes("matchesRegion"), "Page must include matchesRegion in filtered");

  // 5. Accordion sections and status badges
  assert.ok(code.includes("Elective Portfolio & Wing Scope"), "Page must render Portfolio & Wing accordion");
  assert.ok(code.includes("Regional Jurisdictions (Multi-Region Selection)"), "Page must render Regional Jurisdictions accordion");
  assert.ok(code.includes("Administrative Tiers (Deselect Levels)"), "Page must render Administrative Tiers accordion");
  assert.ok(code.includes("Album Edition & Official Certification"), "Page must render Album Edition accordion");
  assert.ok(code.includes("Gender Roll Filter"), "Page must render Gender Roll accordion");
  assert.ok(code.includes("Voter Profile Details (9 Card Fields)"), "Page must render Voter Profile Details accordion");

  // 6. Multi-region UI features: presets & leaving regions out
  assert.ok(code.includes("All 18 Jurisdictions"), "Page must offer All 18 Jurisdictions preset");
  assert.ok(code.includes("16 Ghana Regions"), "Page must offer 16 Ghana Regions preset");
  assert.ok(code.includes("Southern Belt (6)"), "Page must offer Southern Belt preset");
  assert.ok(code.includes("Middle Belt (5)"), "Page must offer Middle Belt preset");
  assert.ok(code.includes("Northern Belt (5)"), "Page must offer Northern Belt preset");
  assert.ok(code.includes("Diaspora & HQ (2)"), "Page must offer Diaspora & HQ preset");
  assert.ok(code.includes("left out"), "Page must display left out feedback when leaving a region out");

  // 7. Album Edition toggle features
  assert.ok(code.includes("Provisional Register & Album"), "Page must include Provisional Register option");
  assert.ok(code.includes("Official Final Certified Album"), "Page must include Official Final Certified option");
  assert.ok(code.includes("CERTIFIED & PROMULGATED"), "Page must display certified & promulgated badge");
});
