import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import ExcelJS from "exceljs";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  let rawSource = readFileSync(filename, "utf8");
  if (relativePath.includes("route.ts")) {
    rawSource += "\n;module.exports.generateAlbumHtml = generateAlbumHtml;\nmodule.exports.generateAlbumExcel = generateAlbumExcel;";
  }
  const source = ts.transpileModule(rawSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === "next/server") {
      return {
        NextResponse: class {
          constructor(body, init) { this.body = body; this.init = init; }
          static json(data, init) { return new this(JSON.stringify(data), init); }
        }
      };
    }
    if (specifier.startsWith("@/")) {
      const base = specifier.slice(2);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(path.join(root, p)));
      if (file) return load(file, mocks);
    }
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const { generateAlbumHtml, generateAlbumExcel } = load("app/api/admin/albums/election/route.ts", {
  "@/lib/db-ec": { withEcSql: async () => [] },
  "@/lib/admin-auth": { getAuthenticatedAdmin: async () => null }
});

const mockMetrics = {
  contest: "Youth Organisers & Deputies",
  scope: "Nationwide",
  expectedFigures: 663,
  actualFigures: 10,
  variance: 653,
  complianceRate: "1.5%",
  quorumRequirement: 7,
  levelBreakdown: { Regional: 5, Constituency: 5 },
  genderBreakdown: { male: 6, female: 4, femalePercentage: "40.0%" },
  ageBreakdown: { under40: 7, fortyPlus: 3, under40Percentage: "70.0%" },
  biometricVerification: { verified: 8, pending: 2, verificationRate: "80.0%" },
};

const mockDelegates = [
  {
    id: "1",
    executive_name: "KWAME MENSAH",
    position: "Youth Organiser",
    canonical_position: "Youth Organiser",
    executive_level: "Regional",
    region: "Ahafo",
    constituency: "",
    voter_id: "1806003701",
    has_voter_id: true,
    phone: "0240000001",
    gender: "Male",
    age: 35,
    avatar_svg: "data:image/svg+xml;base64,mock",
  },
];

const mockRegionalBreakdown = [{ region: "Ahafo", count: 1 }];

test("generateAlbumHtml renders Regional statistics with statutory quota 21 when Regional level is selected", () => {
  const levelStats = {
    selectedLevels: ["regional"],
    regionalTargetPerUnit: 21,
    constituencyTargetPerUnit: 19,
    regionalExecutiveStats: [
      {
        region: "Ahafo",
        confirmed: 21,
        target: 21,
        variance: 0,
        complianceRate: "100.0%",
        status: "Fully Constituted (21/21)",
      },
      {
        region: "Ashanti",
        confirmed: 19,
        target: 21,
        variance: 2,
        complianceRate: "90.5%",
        status: "19/21 (2 Vacant)",
      },
    ],
    constituencyRegionalSummary: [],
    constituencyDetailedBreakdown: [],
  };

  const html = generateAlbumHtml(
    "Youth Organisers & Deputies",
    "all",
    mockMetrics,
    mockDelegates,
    mockRegionalBreakdown,
    undefined,
    levelStats
  );

  // 1. Regional Leadership table must be rendered
  assert.ok(html.includes("REGIONAL LEADERSHIP STATISTICAL AUDIT"));
  assert.ok(html.includes("Target: 21 per Region"));
  assert.ok(html.includes("Statutory Expected Quota"));
  assert.ok(html.includes("Fully Constituted (21/21)"));
  assert.ok(html.includes("19/21 (2 Vacant)"));

  // 2. Constituency stats must NOT be rendered when only Regional is selected
  assert.ok(!html.includes("CONSTITUENCY LEADERSHIP REGIONAL SUMMARY"));
  assert.ok(!html.includes("CONSTITUENCY LEADERSHIP STATISTICAL AUDIT"));

  // 3. Declaration must be present on the final page
  assert.ok(html.includes("NATIONAL ELECTIONS COMMITTEE DECLARATION"));
});

test("generateAlbumHtml renders Constituency statistics with statutory quota 19 when Constituency level is selected", () => {
  const levelStats = {
    selectedLevels: ["constituency"],
    regionalTargetPerUnit: 21,
    constituencyTargetPerUnit: 19,
    regionalExecutiveStats: [],
    constituencyRegionalSummary: [
      {
        region: "Ahafo",
        constituenciesCount: 6,
        confirmed: 114,
        target: 114,
        variance: 0,
        complianceRate: "100.0%",
      },
    ],
    constituencyDetailedBreakdown: [
      {
        region: "Ahafo",
        constituency: "Asunafo North",
        confirmed: 19,
        target: 19,
        variance: 0,
        complianceRate: "100.0%",
        status: "Full Slate (19/19)",
      },
      {
        region: "Ahafo",
        constituency: "Asunafo South",
        confirmed: 18,
        target: 19,
        variance: 1,
        complianceRate: "94.7%",
        status: "18/19 (1 Vacant)",
      },
    ],
  };

  const html = generateAlbumHtml(
    "Youth Organisers & Deputies",
    "Ahafo",
    mockMetrics,
    mockDelegates,
    mockRegionalBreakdown,
    undefined,
    levelStats
  );

  // 1. Constituency audit must be rendered
  assert.ok(html.includes("CONSTITUENCY LEADERSHIP"));
  assert.ok(html.includes("Target: 19 per Constituency"));
  assert.ok(html.includes("Asunafo North"));
  assert.ok(html.includes("Asunafo South"));
  assert.ok(html.includes("Full Slate (19/19)"));
  assert.ok(html.includes("18/19 (1 Vacant)"));

  // 2. Regional leadership audit table must NOT be rendered
  assert.ok(!html.includes("REGIONAL LEADERSHIP STATISTICAL AUDIT"));

  // 3. Declaration must be present
  assert.ok(html.includes("NATIONAL ELECTIONS COMMITTEE DECLARATION"));
});

test("generateAlbumHtml renders BOTH Regional and Constituency stats when both levels are selected", () => {
  const levelStats = {
    selectedLevels: ["regional", "constituency"],
    regionalTargetPerUnit: 21,
    constituencyTargetPerUnit: 19,
    regionalExecutiveStats: [
      {
        region: "Ahafo",
        confirmed: 21,
        target: 21,
        variance: 0,
        complianceRate: "100.0%",
        status: "Fully Constituted (21/21)",
      },
    ],
    constituencyRegionalSummary: [
      {
        region: "Ahafo",
        constituenciesCount: 6,
        confirmed: 114,
        target: 114,
        variance: 0,
        complianceRate: "100.0%",
      },
    ],
    constituencyDetailedBreakdown: [
      {
        region: "Ahafo",
        constituency: "Asunafo North",
        confirmed: 19,
        target: 19,
        variance: 0,
        complianceRate: "100.0%",
        status: "Full Slate (19/19)",
      },
    ],
  };

  const html = generateAlbumHtml(
    "Youth Organisers & Deputies",
    "Ahafo",
    mockMetrics,
    mockDelegates,
    mockRegionalBreakdown,
    undefined,
    levelStats
  );

  // Both sections must exist!
  assert.ok(html.includes("REGIONAL LEADERSHIP STATISTICAL AUDIT"), "Must have Regional audit page");
  assert.ok(html.includes("CONSTITUENCY LEADERSHIP"), "Must have Constituency audit page");
  assert.ok(html.includes("Target: 21 per Region"), "Regional target 21 must be stated");
  assert.ok(html.includes("Target: 19 per Constituency"), "Constituency target 19 must be stated");

  // Verify sequential page numbers
  assert.ok(html.includes("<span class=\"footer-page-pill\">1</span>"));
  assert.ok(html.includes("<span class=\"footer-page-pill\">2</span>"));
  assert.ok(html.includes("<span class=\"footer-page-pill\">3</span>"));
  assert.ok(html.includes("<span class=\"footer-page-pill\">4</span>"));
  assert.ok(html.includes("<span class=\"footer-page-pill\">5</span>"));
  assert.ok(html.includes("5 PAGES"));
});

test("generateAlbumExcel includes level statistics and dedicated constituency sheet", async () => {
  const levelStats = {
    selectedLevels: ["regional", "constituency"],
    regionalTargetPerUnit: 21,
    constituencyTargetPerUnit: 19,
    regionalExecutiveStats: [
      { region: "Ahafo", confirmed: 21, target: 21, complianceRate: "100.0%" },
    ],
    constituencyRegionalSummary: [
      { region: "Ahafo", constituenciesCount: 6, target: 114, confirmed: 114, complianceRate: "100.0%" },
    ],
    constituencyDetailedBreakdown: [
      {
        region: "Ahafo",
        constituency: "Asunafo North",
        confirmed: 19,
        target: 19,
        variance: 0,
        complianceRate: "100.0%",
        status: "Full Slate (19/19)",
      },
    ],
  };

  const buffer = await generateAlbumExcel(
    "Youth Organisers & Deputies",
    "all",
    mockMetrics,
    mockDelegates,
    mockRegionalBreakdown,
    levelStats
  );

  assert.ok(buffer.byteLength > 1000);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Check worksheets
  assert.ok(workbook.getWorksheet("Voter Directory"), "Voter Directory sheet must exist");
  assert.ok(workbook.getWorksheet("Summary & Metrics"), "Summary & Metrics sheet must exist");
  assert.ok(workbook.getWorksheet("Constituency Audit"), "Constituency Audit sheet must exist");

  const conSheet = workbook.getWorksheet("Constituency Audit");
  assert.equal(conSheet.rowCount, 2);
  assert.equal(conSheet.getRow(2).getCell(3).value, "Asunafo North");
  assert.equal(conSheet.getRow(2).getCell(5).value, 19);
});

test("generateAlbumHtml cleanly paginates nationwide constituency audit across multiple pages", () => {
  // Generate 65 constituencies
  const mockConstituencies = [];
  for (let i = 1; i <= 65; i++) {
    mockConstituencies.push({
      region: i <= 35 ? "Ashanti" : "Eastern",
      constituency: "Constituency " + i,
      confirmed: 19,
      target: 19,
      variance: 0,
      complianceRate: "100.0%",
      status: "Full Slate (19/19)",
    });
  }

  const levelStats = {
    selectedLevels: ["constituency"],
    regionalTargetPerUnit: 21,
    constituencyTargetPerUnit: 19,
    regionalExecutiveStats: [],
    constituencyRegionalSummary: [
      { region: "Ashanti", constituenciesCount: 35, confirmed: 665, target: 665, variance: 0, complianceRate: "100.0%" },
      { region: "Eastern", constituenciesCount: 30, confirmed: 570, target: 570, variance: 0, complianceRate: "100.0%" },
    ],
    constituencyDetailedBreakdown: mockConstituencies,
  };

  const html = generateAlbumHtml(
    "Youth Organisers & Deputies",
    "all",
    mockMetrics,
    mockDelegates,
    mockRegionalBreakdown,
    undefined,
    levelStats
  );

  // 65 constituencies / 28 per page = 3 chunks (28, 28, 9)
  // Back pages: 1 (Summary) + 3 (Chunks) = 4 back pages!
  // Base pages: 1 (Cover) + 1 (Metrics) + 1 (Delegates) = 3
  // Total pages: 3 + 4 = 7 pages!
  assert.ok(html.includes("CONSTITUENCY LEADERSHIP REGIONAL SUMMARY"));
  assert.ok(html.includes("Part 1 of 3"));
  assert.ok(html.includes("Part 2 of 3"));
  assert.ok(html.includes("Part 3 of 3"));

  // Check page pills 1 to 7
  for (let p = 1; p <= 7; p++) {
    assert.ok(html.includes(`<span class="footer-page-pill">${p}</span>`), "Must contain page pill for page " + p);
  }
  assert.ok(html.includes("7 PAGES"));

  // Declaration must be on the last page (Part 3)
  assert.ok(html.includes("NATIONAL ELECTIONS COMMITTEE DECLARATION"));
});
