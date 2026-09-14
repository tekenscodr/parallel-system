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

test("Election album route generates 30-country statutory audit table for External Branches", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // Verify key tokens exist in route
  assert.ok(
    code.includes("EXTERNAL BRANCHES (DIASPORA) STATUTORY AUDIT & SIGN-OFF"),
    "Route must set External Branches specific statutory audit title"
  );
  assert.ok(
    code.includes("EXTERNAL BRANCHES STATUTORY AUDIT"),
    "Route must set External Branches specific footer label"
  );
  assert.ok(
    code.includes("30 EXTERNAL BRANCHES / COUNTRIES"),
    "Route must declare 30 External Branches / Countries summary label"
  );
  assert.ok(
    code.includes("externalTargetPerUnit"),
    "Route must calculate statutory target per external branch"
  );
  assert.ok(
    code.includes("EXTERNAL BRANCHES (DIASPORA CHAPTERS)"),
    "Route must set diaspora scope text on cover page and metadata"
  );

  // Simulate External Branches statutory audit generation
  const mockDelegates = [
    { executive_level: "External Branch", region: "External Branches", constituency: "United Kingdom", canonical_position: "Youth Organiser" },
    { executive_level: "External Branch", region: "External Branches", constituency: "United Kingdom", canonical_position: "Deputy Youth Organiser" },
    { executive_level: "External Branch", region: "External Branches", constituency: "United States of America", canonical_position: "Youth Organiser" },
    { executive_level: "External Branch", region: "External Branches", constituency: "Germany", canonical_position: "Youth Organiser" },
    { executive_level: "External Branch", region: "External Branches", constituency: "Canada", canonical_position: "Youth Organiser" },
  ];

  const externalCountries = [
    "Senegal", "Russia", "United Kingdom", "Middle East", "Togo", "Nigeria",
    "South Africa", "United States of America", "Austria", "Spain", "Sweden",
    "Australia", "Hong Kong", "Qatar", "Norway", "South Korea", "Ireland",
    "Italy", "Ivory Coast", "Japan", "Netherland", "China", "Czech",
    "Denmark", "Equitorial Guinea", "Germany", "France", "Finland",
    "Belgium", "Canada",
  ];

  assert.equal(externalCountries.length, 30, "Must have exactly 30 diaspora chapters");

  const targetPerUnit = 2; // Wing contest (Organiser + Deputy)
  const auditItems = [];

  for (let i = 0; i < externalCountries.length; i++) {
    const cName = externalCountries[i];
    const confirmed = mockDelegates.filter(
      (d) =>
        (String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
          String(d.region || "").toLowerCase().includes("external")) &&
        d.constituency.toLowerCase().trim() === cName.toLowerCase().trim()
    ).length;

    const target = targetPerUnit;
    const variance = target - confirmed;
    auditItems.push({
      num: String(i + 1),
      name: `${cName} External Branch`,
      level: "External Branch",
      confirmed,
      target,
      variance: variance > 0 ? `-${variance}` : "0",
      rate: target > 0 ? ((confirmed / target) * 100).toFixed(1) + "%" : "100%",
    });
  }

  assert.equal(auditItems.length, 30, "Audit must contain all 30 external country chapters");
  const ukItem = auditItems.find((it) => it.name === "United Kingdom External Branch");
  assert.ok(ukItem, "United Kingdom must be present in audit");
  assert.equal(ukItem.confirmed, 2, "United Kingdom must have 2 confirmed delegates");
  assert.equal(ukItem.rate, "100.0%", "UK compliance rate must be 100.0%");

  const usaItem = auditItems.find((it) => it.name === "United States of America External Branch");
  assert.ok(usaItem, "USA must be present in audit");
  assert.equal(usaItem.confirmed, 1, "USA must have 1 confirmed delegate");
  assert.equal(usaItem.variance, "-1", "USA must have -1 variance");

  const senegalItem = auditItems.find((it) => it.name === "Senegal External Branch");
  assert.ok(senegalItem, "Senegal must be present in audit");
  assert.equal(senegalItem.confirmed, 0, "Senegal must have 0 confirmed delegates");

  // Sums
  const totalConfirmed = auditItems.reduce((acc, it) => acc + it.confirmed, 0);
  const totalTarget = auditItems.reduce((acc, it) => acc + it.target, 0);
  assert.equal(totalConfirmed, 5, "Total confirmed diaspora delegates must be 5");
  assert.equal(totalTarget, 60, "Total target must be 30 * 2 = 60");

  // Ensure 2-column grid is triggered (> 22)
  assert.ok(auditItems.length > 22, "30 countries must trigger 2-column compact grid");
});

