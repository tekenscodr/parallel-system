import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getConstituencyCapital } from "../lib/constituency-capitals.ts";

test("Constituency capitals dictionary correctly resolves Ghana 275 administrative capitals", () => {
  assert.equal(getConstituencyCapital("Asunafo North"), "Goaso");
  assert.equal(getConstituencyCapital("Asunafo South"), "Kukuom");
  assert.equal(getConstituencyCapital("Asutifi North"), "Kenyasi");
  assert.equal(getConstituencyCapital("Asutifi South"), "Hwidiem");
  assert.equal(getConstituencyCapital("Tano North"), "Duayaw Nkwanta");
  assert.equal(getConstituencyCapital("Tano South"), "Bechem");
  assert.equal(getConstituencyCapital("Ayawaso West Wuogon"), "Dzorwulu");
  assert.equal(getConstituencyCapital("Bantama"), "Bantama");
});

test("Election album route file enforces the 6 user design rules", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // Rule 1: Voter Profile shows ONLY level (no jurisdiction suffix)
  assert.ok(
    code.includes('<span class="lbl">Level:</span> <span class="val">${d.executive_level}</span>'),
    "Voter card Level must show only ${d.executive_level} without jurisdiction suffix"
  );
  assert.ok(
    !code.includes('${d.executive_level}${d.constituency'),
    "Voter card must not append constituency or region to Level"
  );

  // Rule 2: Dedicated 2 pages per constituency & separation of regional executives
  assert.ok(
    code.includes("CONSTITUENCY EXECUTIVES · ${cName.toUpperCase()} (PART 1)"),
    "Constituency dedicated Page 1 header must match PART 1 pattern"
  );
  assert.ok(
    code.includes("CONSTITUENCY EXECUTIVES · ${cName.toUpperCase()} (PART 2)"),
    "Constituency dedicated Page 2 header must match PART 2 pattern"
  );
  assert.ok(
    code.includes("REGIONAL EXECUTIVES (PART ${partIdx})"),
    "Regional executives must be partitioned separately from constituencies"
  );

  // Rule 3: Page 3 Directory removed per user request; voter card pages start directly at Page 3
  assert.ok(
    !code.includes("ELECTORAL COLLEGE DIRECTORY &amp; PAGE ALLOCATION"),
    "Page 3 Electoral College Directory & Page Allocation index must be removed"
  );
  assert.ok(
    code.includes("d.page_number = currentCardPageNum;"),
    "Each delegate must be assigned their corresponding album page number"
  );
  assert.ok(
    code.includes("let currentCardPageNum = 3;"),
    "Voter card pages must start on Page 3 immediately following Executive Metrics"
  );

  // Rule 4: Dynamic Header with Constituency and Region names
  assert.ok(
    code.includes("NEW PATRIOTIC PARTY</h1>") && code.includes("<h2>${spec.headerSubTitle}</h2>"),
    "Header line 1 must be NEW PATRIOTIC PARTY and line 2 must be dynamic sub-title"
  );

  // Rule 5: Provisional album renders Constituency Validated box in 10th slot; Official renders QR box
  assert.ok(
    code.includes("CONSTITUENCY VALIDATED"),
    "Provisional album must render CONSTITUENCY VALIDATED box"
  );
  assert.ok(
    code.includes(".cert-card {") && code.includes("grid-column: 2;") && code.includes("grid-row: 5;"),
    ".cert-card must be pinned to the 10th slot (grid column 2, row 5)"
  );
  assert.ok(
    code.includes("border: 2.5px dashed #003399;"),
    ".cert-card must have dashed navy blue border matching reference image"
  );
  assert.ok(
    code.includes("CONSTITUENCY AUDIT QR"),
    "Official album must render CONSTITUENCY AUDIT QR box"
  );

  // Rule 6: Accurate TESCON statistics across tables and Last Page
  assert.ok(
    code.includes("metrics.tesconInstitutionsCount"),
    "Page 2 must display accurate TESCON institutions count from metrics"
  );
  assert.ok(
    code.includes("TESCON Tertiary Institutions") || code.includes("TESCON ACCREDITED TERTIARY INSTITUTIONS"),
    "Statutory audit table must report TESCON accredited institutions and counts"
  );

  // Branding: Hon. Frederick Opare-Ansah, Elephant seal (no stars), No green
  assert.ok(
    code.includes("HON. FREDERICK OPARE-ANSAH"),
    "Elections Committee Chairman must be HON. FREDERICK OPARE-ANSAH"
  );
  assert.ok(
    code.includes("National Elections Committee · NPP IT Directorate"),
    "Branding must cite NPP IT Directorate"
  );
  assert.ok(
    !code.includes('<polygon points="60,38 63,48 74,48 65,55 69,66 60,59 51,66 55,55 46,48 57,48" fill="#003399"/>'),
    "SVG seal must not contain 5-point star; elephant emblem must be used instead"
  );
  assert.ok(
    code.includes("scale(0.65)") && code.includes("M20,2 C15,2 10,6 8,11"),
    "SVG seal must contain elephant silhouette emblem"
  );
});

test("Election album official seal features authentic NPP Elephant and mathematically curved text", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  assert.ok(
    code.includes("getElephantSealDataUri"),
    "Route must include getElephantSealDataUri helper"
  );
  assert.ok(
    code.includes("renderCurvedText"),
    "Route must include renderCurvedText helper for mathematical glyph placement"
  );
  assert.ok(
    code.includes('effectiveElephantSealUri ? `<image href="${effectiveElephantSealUri}" x="37.5" y="27.5" width="45" height="45" />`'),
    "SVG seal must embed authentic NPP Elephant image via data URI"
  );
  assert.ok(
    code.includes('renderCurvedText("NATIONAL ELECTIONS COMMITTEE"'),
    "SVG seal must render curved unclipped top arc for NATIONAL ELECTIONS COMMITTEE"
  );
  assert.ok(
    code.includes('renderCurvedText("OFFICIAL SEAL · ELECTIONS 2026"'),
    "SVG seal must render curved unclipped bottom arc for OFFICIAL SEAL · ELECTIONS 2026"
  );
  assert.ok(
    code.includes('>CERTIFIED</text>'),
    "SVG seal must render CERTIFIED text beneath the elephant"
  );
});

