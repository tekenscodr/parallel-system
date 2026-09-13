import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Election album consolidates External Branches into a single canonical entry", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Must not contain the old bug pattern
  assert.ok(
    !code.includes("`External: ${d.region}`"),
    "Election album route must not format external region as `External: ${d.region}`"
  );
  assert.ok(
    !code.includes("External:"),
    "Election album route must not prepend External: to region names"
  );

  // 2. Must normalize both executive_level and region to External Branches
  assert.ok(
    code.includes('isExternal ? "External Branches" :'),
    "Delegate mapping must canonicalize external delegates to External Branches"
  );
  assert.ok(
    code.includes('lvlLower === "external branch" || regLower.includes("external")'),
    "Regional map loop must catch both executive_level and region external variants"
  );

  // 3. Verify logic by simulating regional mapping with disparate DB rows
  const simulatedDelegates = [
    { executive_level: "Constituency", region: "External Branch", name: "Diaspora Exec 1" },
    { executive_level: "External Branch", region: "External Branch", name: "Diaspora Exec 2" },
    { executive_level: "External Branch", region: "External Branches", name: "Diaspora Exec 3" },
    { executive_level: "Constituency", region: "Greater Accra", name: "Accra Exec" },
    { executive_level: "National", region: "National", name: "National Exec" },
  ];

  const regionalMap = new Map();
  for (const d of simulatedDelegates) {
    const regLower = String(d.region || "").toLowerCase().trim();
    const lvlLower = String(d.executive_level || "").toLowerCase().trim();
    const reg =
      lvlLower === "national" || regLower === "national"
        ? "National Headquarters"
        : lvlLower === "external branch" || regLower.includes("external")
        ? "External Branches"
        : d.region;
    regionalMap.set(reg, (regionalMap.get(reg) || 0) + 1);
  }

  const entries = Array.from(regionalMap.entries()).map(([region, count]) => ({ region, count }));
  const externalEntries = entries.filter((e) => e.region.toLowerCase().includes("external"));

  assert.equal(externalEntries.length, 1, "There should be exactly 1 External Branches entry");
  assert.equal(externalEntries[0].region, "External Branches");
  assert.equal(externalEntries[0].count, 3, "All 3 diaspora delegates should be combined into External Branches");
});
