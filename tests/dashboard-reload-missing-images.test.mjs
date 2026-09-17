import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("ExecutiveAvatar.tsx exports cache helper functions", () => {
  const avatarFile = fs.readFileSync(path.join(rootDir, "app/admin/components/ExecutiveAvatar.tsx"), "utf8");
  assert.ok(avatarFile.includes("export function clearBrokenPhotoCache"), "clearBrokenPhotoCache is exported");
  assert.ok(avatarFile.includes("export function getBrokenPhotoUrls"), "getBrokenPhotoUrls is exported");
  assert.ok(avatarFile.includes("export function isBrokenPhotoUrl"), "isBrokenPhotoUrl is exported");
  assert.ok(avatarFile.includes("knownBrokenUrls.clear()"), "clearBrokenPhotoCache clears knownBrokenUrls");
});

test("/api/admin/executives supports missingImages filter", () => {
  const routeFile = fs.readFileSync(path.join(rootDir, "app/api/admin/executives/route.ts"), "utf8");
  assert.ok(routeFile.includes("missingImages"), "Has missingImages variable");
  assert.ok(
    routeFile.includes("image_url IS NULL OR trim(image_url) = ") &&
    routeFile.includes("image_url ILIKE \x27https://app.newpatrioticparty.org%\x27"),
    "Constructs SQL filter for missing/unmigrated images"
  );
});

test("/api/admin/overview computes missing_photos and verified_photos metrics", () => {
  const overviewFile = fs.readFileSync(path.join(rootDir, "app/api/admin/overview/route.ts"), "utf8");
  assert.ok(overviewFile.includes("missing_photos"), "Computes missing_photos metric");
  assert.ok(overviewFile.includes("verified_photos"), "Computes verified_photos metric");
  assert.ok(
    overviewFile.includes("image_url ILIKE \x27https://cms.newpatrioticparty.org%\x27"),
    "Computes verified photos based on party CMS CDN"
  );
});

test("/api/admin/export supports missingImages parameter", () => {
  const exportFile = fs.readFileSync(path.join(rootDir, "app/api/admin/export/route.ts"), "utf8");
  assert.ok(exportFile.includes("missingImages"), "Parses missingImages in export route");
  assert.ok(
    exportFile.includes("image_url IS NULL OR trim(image_url) = "),
    "Filters missing images in CSV export"
  );
});

test("Dashboard page.tsx implements missing images reload toggle and full data reload button", () => {
  const dashFile = fs.readFileSync(path.join(rootDir, "app/admin/dashboard/page.tsx"), "utf8");

  // State
  assert.ok(dashFile.includes("filterMissingImages"), "Has filterMissingImages state");
  assert.ok(dashFile.includes("rosterImageReloadKey"), "Has rosterImageReloadKey state");
  assert.ok(dashFile.includes("reloadingFullData"), "Has reloadingFullData state");
  assert.ok(dashFile.includes("fullReloadToast"), "Has fullReloadToast state");

  // Handlers
  assert.ok(dashFile.includes("handleToggleMissingImages"), "Has handleToggleMissingImages handler");
  assert.ok(dashFile.includes("handleReloadFullData"), "Has handleReloadFullData handler");
  assert.ok(dashFile.includes("clearBrokenPhotoCache()"), "Calls clearBrokenPhotoCache");

  // API parameter pass-through
  assert.ok(dashFile.includes("missingImages"), "Passes missingImages to executives API");
  assert.ok(dashFile.includes("missingImages=true"), "Appends missingImages to exportUrl");

  // Toolbar UI
  assert.ok(dashFile.includes("Reload Missing Images"), "Toolbar includes Reload Missing Images toggle text");
  assert.ok(dashFile.includes("Reload Full Data"), "Toolbar includes Reload Full Data button text");
  assert.ok(dashFile.includes("Missing Images Filter Active:"), "Includes Missing Images banner");

  // Reset Filters
  assert.ok(dashFile.includes("setFilterMissingImages(false)"), "Reset Filters resets missing images filter");

  // Avatar reloadKey wiring
  assert.ok(dashFile.includes("reloadKey={rosterImageReloadKey}"), "Passes rosterImageReloadKey to ExecutiveAvatar");
});
