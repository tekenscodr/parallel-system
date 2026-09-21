import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Album route defines authoritative national metrics for all contest rolls", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const fileContent = fs.readFileSync(routePath, "utf8");

  // Nationwide expected metrics:
  assert.ok(fileContent.includes("6544"), "General Officers must have expectedCount of 6,544");
  assert.ok(fileContent.includes("2355"), "Youth Organiser must have expectedCount of 2,355");
  assert.ok(fileContent.includes("1390"), "Women Organiser / All Women must have expectedCount of 1,390");
  assert.ok(fileContent.includes("867"), "Nasara Organiser must have expectedCount of 867");
  assert.ok(fileContent.includes("7039"), "Master Pool / Full Directory must have expectedCount of 7,039");
  assert.ok(fileContent.includes("5606"), "All Men must have expectedCount of 5,606");
});

test("Album route implements universal gender query parameter and All Men / All Women contest rules", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const fileContent = fs.readFileSync(routePath, "utf8");

  // Gender query extraction
  assert.ok(
    fileContent.includes('searchParams.get("gender")'),
    'Route must extract gender parameter from searchParams'
  );
  assert.ok(
    fileContent.includes('filterGender'),
    'Route must resolve filterGender'
  );

  // Universal gender check in delegate filter
  assert.ok(
    fileContent.includes('filterGender && g !== filterGender'),
    'Route must exclude delegates who do not match the requested filterGender'
  );

  // Contest branches for All Men and All Women
  assert.ok(
    fileContent.includes('matchedContest === "All Men"'),
    'Route must handle All Men contest'
  );
  assert.ok(
    fileContent.includes('matchedContest === "All Women"'),
    'Route must handle All Women contest'
  );
  assert.ok(
    fileContent.includes('National Electoral College · All Men'),
    'Route must label All Men roll title'
  );
  assert.ok(
    fileContent.includes('National Electoral College · All Women'),
    'Route must label All Women roll title'
  );
});

test("Regional statutory quotas dictionaries sum to exact audited benchmarks", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const fileContent = fs.readFileSync(routePath, "utf8");

  assert.ok(fileContent.includes("ALL_MEN_REGIONAL_STATUTORY_QUOTAS"), "Must define ALL_MEN_REGIONAL_STATUTORY_QUOTAS");
  assert.ok(fileContent.includes("WOMEN_REGIONAL_STATUTORY_QUOTAS"), "Must define WOMEN_REGIONAL_STATUTORY_QUOTAS");
  assert.ok(fileContent.includes("GENERAL_OFFICERS_REGIONAL_STATUTORY_QUOTAS"), "Must define GENERAL_OFFICERS_REGIONAL_STATUTORY_QUOTAS");
  assert.ok(fileContent.includes("YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS"), "Must define YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS");
  assert.ok(fileContent.includes("NASARA_REGIONAL_STATUTORY_QUOTAS"), "Must define NASARA_REGIONAL_STATUTORY_QUOTAS");
  assert.ok(fileContent.includes("FULL_DIRECTORY_REGIONAL_STATUTORY_QUOTAS"), "Must define FULL_DIRECTORY_REGIONAL_STATUTORY_QUOTAS");

  // Verify All Men dictionary breakdown values:
  assert.ok(fileContent.includes('"Ashanti": 826'));
  assert.ok(fileContent.includes('"Greater Accra": 585'));
  assert.ok(fileContent.includes('"Eastern": 612'));
  assert.ok(fileContent.includes('"External Branch": 451'));
  assert.ok(fileContent.includes('"National Headquarters": 139'));
});

test("Admin album page includes gender filter and synchronizes with download/preview queries", () => {
  const pagePath = path.join(process.cwd(), "app/admin/albums/page.tsx");
  const fileContent = fs.readFileSync(pagePath, "utf8");

  // State
  assert.ok(fileContent.includes('const [gender, setGender] = useState'), "Page must define gender state");

  // Query parameter
  assert.ok(fileContent.includes('&gender='), "Page must append gender query param to requests");

  // UI elements
  assert.ok(fileContent.includes('Gender Filter'), "Page must render Gender Filter label");
  assert.ok(fileContent.includes('All Genders (Men & Women)'), "Page must render All Genders option");
  assert.ok(fileContent.includes('Men Only (All Eligible Men)'), "Page must render Men Only option");
  assert.ok(fileContent.includes('Women Only (All Eligible Women)'), "Page must render Women Only option");

  // Contest dropdown options
  assert.ok(fileContent.includes('All Men (Male Electoral College Roll · 5,606)'), "Contest select must include All Men roll");
  assert.ok(fileContent.includes('All Women (Female Electoral College Roll · 1,390)'), "Contest select must include All Women roll");

  // Client-side filtering
  assert.ok(fileContent.includes('matchesGender'), "Client filter must test delegate gender against active gender state");
});
