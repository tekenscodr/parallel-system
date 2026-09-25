import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getTesconInstitutionsForRegion,
  CANONICAL_TESCON_INSTITUTIONS_BY_REGION,
  ALL_CANONICAL_TESCON_INSTITUTIONS,
  buildTesconInstitutionCondition,
  CANONICAL_TO_RAW_STATIONS_BY_REGION,
} from "../lib/tescon-institutions.ts";

test("getTesconInstitutionsForRegion returns exact statutory institutions per region", () => {
  assert.equal(getTesconInstitutionsForRegion("Ahafo").length, 8);
  assert.equal(getTesconInstitutionsForRegion("Ashanti").length, 49);
  assert.equal(getTesconInstitutionsForRegion("Bono").length, 16);
  assert.equal(getTesconInstitutionsForRegion("Bono East").length, 8);
  assert.equal(getTesconInstitutionsForRegion("Central").length, 16);
  assert.equal(getTesconInstitutionsForRegion("Eastern").length, 25);
  assert.equal(getTesconInstitutionsForRegion("Greater Accra").length, 35);
  assert.equal(getTesconInstitutionsForRegion("North East").length, 4);
  assert.equal(getTesconInstitutionsForRegion("Northern").length, 20);
  assert.equal(getTesconInstitutionsForRegion("Oti").length, 3);
  assert.equal(getTesconInstitutionsForRegion("Savannah").length, 7);
  assert.equal(getTesconInstitutionsForRegion("Upper East").length, 13);
  assert.equal(getTesconInstitutionsForRegion("Upper West").length, 13);
  assert.equal(getTesconInstitutionsForRegion("Volta").length, 17);
  assert.equal(getTesconInstitutionsForRegion("Western").length, 14);
  assert.equal(getTesconInstitutionsForRegion("Western North").length, 6);

  // All regions / empty / null
  assert.equal(getTesconInstitutionsForRegion("all").length, 251);
  assert.equal(getTesconInstitutionsForRegion("").length, 251);
  assert.equal(getTesconInstitutionsForRegion(null).length, 251);
  assert.equal(ALL_CANONICAL_TESCON_INSTITUTIONS.length, 251);
});

test("Ashanti TESCON institutions include key colleges and universities", () => {
  const ashanti = getTesconInstitutionsForRegion("Ashanti");
  assert.ok(ashanti.includes("Kwame Nkrumah University of Science and Technology (KNUST - Main Campus)"));
  assert.ok(ashanti.includes("KNUST (Obuasi Campus)"));
  assert.ok(ashanti.includes("AAMUSTED (Kumasi Campus)"));
  assert.ok(ashanti.includes("AAMUSTED (Mampong Campus)"));
  assert.ok(ashanti.includes("Kumasi Technical University (KsTU)"));
  assert.ok(ashanti.includes("St. Louis College of Education"));
  assert.ok(ashanti.includes("Wesley College of Education"));
});

test("buildTesconInstitutionCondition constructs SQL matching canonical name and raw aliases", () => {
  // Mock sql template tag
  const mockSql = (strings, ...values) => ({ strings, values, type: "SQL_FRAGMENT" });
  mockSql.raw = (str) => str;

  const cond = buildTesconInstitutionCondition(
    mockSql,
    "Kwame Nkrumah University of Science and Technology (KNUST - Main Campus)",
    "Ashanti"
  );

  assert.ok(cond, "Condition fragment should not be null");
  assert.equal(cond.type, "SQL_FRAGMENT");
  assert.ok(cond.values.includes("Kwame Nkrumah University of Science and Technology (KNUST - Main Campus)"));

  const emptyCond = buildTesconInstitutionCondition(mockSql, "");
  assert.equal(emptyCond, null);
});

test("Dashboard page.tsx integrates dynamic TESCON institution dropdown", () => {
  const code = fs.readFileSync("app/admin/dashboard/page.tsx", "utf8");

  // State definitions
  assert.ok(code.includes("selectedInstitution"), "State selectedInstitution must be defined");
  assert.ok(code.includes("tesconInstitutions"), "State tesconInstitutions must be defined");
  assert.ok(code.includes("loadingInstitutions"), "State loadingInstitutions must be defined");

  // Endpoint call
  assert.ok(code.includes("/api/admin/tescon/institutions"), "Must fetch from /api/admin/tescon/institutions");

  // Filter bar conditional rendering
  assert.ok(code.includes('selectedLevel === "TESCON"'), "Must check selectedLevel === 'TESCON'");
  assert.ok(code.includes("🏛️ All ${selectedRegion} Institutions"), "Must render regional institutions option");
  assert.ok(code.includes("🏛️ All Nationwide Institutions"), "Must render nationwide institutions option");

  // fetchRoster & exportUrl integration
  assert.ok(code.includes('params.set("institution", selectedInstitution)'), "fetchRoster must pass institution");
  assert.ok(code.includes("&institution="), "exportUrl must support institution parameter");

  // Modals integration
  assert.ok(code.includes("Institution (TESCON Tertiary Campus)"), "Edit modal must support TESCON institution dropdown");
  assert.ok(code.includes("Institution (Accredited Tertiary Institution)"), "Add modal must support TESCON institution dropdown");
});

test("API routes support institution filter query parameter", () => {
  const execRoute = fs.readFileSync("app/api/admin/executives/route.ts", "utf8");
  assert.ok(execRoute.includes('url.searchParams.get("institution")'), "Executives route must read institution param");
  assert.ok(execRoute.includes("buildTesconInstitutionCondition"), "Executives route must apply buildTesconInstitutionCondition");

  const exportRoute = fs.readFileSync("app/api/admin/export/route.ts", "utf8");
  assert.ok(exportRoute.includes('url.searchParams.get("institution")'), "Export route must read institution param");
  assert.ok(exportRoute.includes("buildTesconInstitutionCondition"), "Export route must apply buildTesconInstitutionCondition");

  const overviewRoute = fs.readFileSync("app/api/admin/overview/route.ts", "utf8");
  assert.ok(overviewRoute.includes('url.searchParams.get("institution")'), "Overview route must read institution param");
  assert.ok(overviewRoute.includes("buildTesconInstitutionCondition"), "Overview route must apply buildTesconInstitutionCondition");

  const tesconRoute = fs.readFileSync("app/api/admin/tescon/institutions/route.ts", "utf8");
  assert.ok(tesconRoute.includes("getTesconInstitutionsForRegion"), "TESCON route must call getTesconInstitutionsForRegion");
});
