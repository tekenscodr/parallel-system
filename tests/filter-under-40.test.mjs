import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("/api/admin/executives supports under40 and cohort=under_40 filters", () => {
  const file = fs.readFileSync(path.join(rootDir, "app/api/admin/executives/route.ts"), "utf8");
  assert.ok(file.includes('const under40 = url.searchParams.get("under40")'), "Parses under40 query parameter");
  assert.ok(file.includes('cohort === "under_40"'), "Handles cohort=under_40 filter");
  assert.ok(file.includes("substring(date_of_birth from '^([0-9]{4})')::int > 1986"), "Applies born > 1986 condition");
  assert.ok(file.includes("substring(date_of_birth from '^([0-9]{4})')::int = 1986"), "Applies born = 1986 cutoff check");
  assert.ok(file.includes(">= 22"), "Checks 21st August cutoff date boundary (day >= 22 in Aug 1986)");
  assert.ok(file.includes("(age + 2) < 40"), "Calculates fallback age < 40");
});

test("/api/admin/export supports under40 filter", () => {
  const file = fs.readFileSync(path.join(rootDir, "app/api/admin/export/route.ts"), "utf8");
  assert.ok(file.includes('const under40 = url.searchParams.get("under40")'), "Parses under40 query parameter in export");
  assert.ok(file.includes('under40 === "true"'), "Applies under40 filter condition in export");
  assert.ok(file.includes(">= 22"), "Checks 21st August cutoff date boundary in export");
});

test("/api/admin/overview supports under40 and cohort=under_40 filters", () => {
  const file = fs.readFileSync(path.join(rootDir, "app/api/admin/overview/route.ts"), "utf8");
  assert.ok(file.includes('const under40 = url.searchParams.get("under40")'), "Parses under40 query parameter in overview");
  assert.ok(file.includes('const cohort = url.searchParams.get("cohort")'), "Parses cohort query parameter in overview");
  assert.ok(file.includes('cohort === "under_40"'), "Handles cohort=under_40 in overview");
  assert.ok(file.includes('under40:'), "Includes under40 in activeFilter object");
  assert.ok(file.includes("as under_40"), "Computes under_40 total count");
});

test("Dashboard page.tsx implements complete Under 40 filter UI and state", () => {
  const file = fs.readFileSync(path.join(rootDir, "app/admin/dashboard/page.tsx"), "utf8");

  // State & imports
  assert.ok(file.includes("filterUnder40"), "Declares filterUnder40 state");
  assert.ok(file.includes("isUnder40Active"), "Has isUnder40Active helper");
  assert.ok(file.includes("handleToggleUnder40"), "Has handleToggleUnder40 handler");
  assert.ok(file.includes("Sparkles"), "Imports Sparkles icon from lucide-react");
  assert.ok(file.includes("isUnder40AsOfCutoff"), "Imports isUnder40AsOfCutoff from voting-rules");

  // OverviewData typing
  assert.ok(file.includes("under_40?: number;"), "OverviewData.totals includes under_40");

  // fetchRoster & export
  assert.ok(file.includes('params.set("under40", "true")'), "Passes under40 to /api/admin/executives in fetchRoster");
  assert.ok(file.includes('&under40=true'), "Appends under40 to exportUrl when active");

  // Dropdown
  assert.ok(file.includes('<option value="under_40">Under 40 (Youth)</option>'), "Has Under 40 option in Demographics dropdown");

  // Toolbar switch button
  assert.ok(file.includes('role="switch"'), "Toolbar button has role switch");
  assert.ok(file.includes('onClick={handleToggleUnder40}'), "Toolbar button calls handleToggleUnder40");
  assert.ok(file.includes('overview.totals.under_40.toLocaleString()'), "Toolbar button displays Under 40 count badge");

  // KPI card
  assert.ok(file.includes('Under 40 (Youth)'), "KPI card titled Under 40 (Youth)");
  assert.ok(file.includes('(overview.totals.under_40 ?? 0).toLocaleString()'), "KPI card displays Under 40 total");
  assert.ok(file.includes('Cutoff: 21 Aug 2026'), "KPI card references constitutional cutoff date");

  // Table badge
  assert.ok(file.includes('isUnder40AsOfCutoff(row.dateOfBirth, row.age)'), "Roster table checks isUnder40AsOfCutoff in Age column");
  assert.ok(file.includes('&lt; 40'), "Roster table displays < 40 badge tag");

  // Clear filters
  assert.ok(file.includes('setFilterUnder40(false)'), "Clear All Filters resets filterUnder40");
});

test("/api/admin/albums/election supports under40 query parameter", () => {
  const file = fs.readFileSync(path.join(rootDir, "app/api/admin/albums/election/route.ts"), "utf8");
  assert.ok(file.includes('searchParams.get("under40")'), "Parses under40 query parameter in album election API");
  assert.ok(file.includes('filterUnder40 = under40Query === "true"'), "Detects filterUnder40 flag from query params");
  assert.ok(file.includes('filterUnder40 && !isUnder40AsOfCutoff(r.date_of_birth, r.age)'), "Filters delegates using isUnder40AsOfCutoff");
  assert.ok(file.includes('(Under 40)'), "Appends (Under 40) to effectiveContestName");
});

test("Album page.tsx implements complete Under 40 filter UI and state", () => {
  const file = fs.readFileSync(path.join(rootDir, "app/admin/albums/page.tsx"), "utf8");

  // State & imports
  assert.ok(file.includes("const [under40, setUnder40] = useState<boolean>(false);"), "Declares under40 state in albums page");
  assert.ok(file.includes("is_under_40?: boolean;"), "Delegate interface includes is_under_40");

  // Accordion 6
  assert.ok(file.includes("Age & Youth Roll Filter (Under 40 Cutoff)"), "Has Accordion 6 for Age & Youth Roll Filter");
  assert.ok(file.includes("openAccordions.age"), "Handles openAccordions.age toggle");
  assert.ok(file.includes("Under 40 Only (Youth Statutory Cutoff)"), "Has Under 40 option card in Accordion 6");
  assert.ok(file.includes("Strictly officers not 40 as at 21st August 2026"), "Explains statutory cutoff date in Accordion 6");

  // Header and Table Quick Actions
  assert.ok(file.includes("Under 40: Active"), "Configuration header includes Under 40 active indicator");
  assert.ok(file.includes("Toggle Under 40 (Youth) filter"), "Register table includes Under 40 toggle button");
  assert.ok(file.includes("&lt; 40"), "Register table renders < 40 badge for eligible youth delegates");

  // Query & client-side filtering
  assert.ok(file.includes("&under40=true"), "Appends under40=true to API query string");
  assert.ok(file.includes("matchesUnder40"), "Calculates matchesUnder40 in filtered list");
  assert.ok(file.includes("!under40 || Boolean(d.is_under_40)"), "Applies client-side under40 filter check");
  assert.ok(file.includes("setUnder40(false);"), "Resets under40 in resetAllFilters");
});
