import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getCanonicalPositionsForSelection,
  normalizeCanonicalPosition,
  isRegionalTescon,
} from "../lib/election-contests.ts";

test("normalizeCanonicalPosition correctly distinguishes TESCON Nasara from Constituency and Regional Nasara", () => {
  // TESCON level must strictly produce "TESCON Nasara Coordinator", never "Nasara Organiser"
  assert.equal(
    normalizeCanonicalPosition("Nasara Coordinator", "TESCON"),
    "TESCON Nasara Coordinator",
    "TESCON level with raw 'Nasara Coordinator' must normalize to 'TESCON Nasara Coordinator'"
  );
  assert.equal(
    normalizeCanonicalPosition("Nasara Organiser", "TESCON"),
    "TESCON Nasara Coordinator",
    "TESCON level with raw 'Nasara Organiser' must normalize to 'TESCON Nasara Coordinator'"
  );
  assert.equal(
    normalizeCanonicalPosition("TESCON Nasara Coordinator", "TESCON"),
    "TESCON Nasara Coordinator"
  );
  assert.equal(
    normalizeCanonicalPosition("TESCON Nasara Organiser", "Constituency"),
    "TESCON Nasara Coordinator",
    "Any position containing 'tescon' and 'nasara' must normalize to 'TESCON Nasara Coordinator'"
  );

  // Constituency level must produce "Nasara Organiser"
  assert.equal(
    normalizeCanonicalPosition("Nasara Coordinator", "Constituency"),
    "Nasara Organiser"
  );
  assert.equal(
    normalizeCanonicalPosition("Nasara Organiser", "Constituency"),
    "Nasara Organiser"
  );

  // Regional level must produce "Nasara Coordinator"
  assert.equal(
    normalizeCanonicalPosition("Nasara Coordinator", "Region"),
    "Nasara Coordinator"
  );
  assert.equal(
    normalizeCanonicalPosition("Nasara Coordinator", "Regional"),
    "Nasara Coordinator"
  );
});

test("isRegionalTescon does not falsely flag Campus TESCON Nasara Coordinators", () => {
  assert.equal(
    isRegionalTescon({ position: "TESCON Nasara Coordinator", executive_level: "TESCON" }),
    false,
    "Campus TESCON Nasara must not be flagged as Regional TESCON"
  );
  assert.equal(
    isRegionalTescon({ position: "Nasara Coordinator", executive_level: "TESCON" }),
    false,
    "Campus Nasara Coordinator must not be flagged as Regional TESCON"
  );
  assert.equal(
    isRegionalTescon({ position: "Regional TESCON Coordinator", executive_level: "Region" }),
    true,
    "Regional TESCON Coordinator must be identified"
  );
});

test("Position selection strictly isolates Nasara Coordinator from TESCON Nasara Coordinator", () => {
  // Scenario 1: User selects Wings Nasara ("nasara_coordinator") and TESCON President ("tescon_president"),
  // but leaves TESCON Nasara ("tescon_nasara") DESELECTED (the exact user configuration from screenshot)
  const userSelection = ["nasara_coordinator", "tescon_president"];
  const resolved = getCanonicalPositionsForSelection(userSelection);

  assert.ok(resolved.canonicalSet.has("Nasara Coordinator"), "Must include Regional Nasara Coordinator");
  assert.ok(resolved.canonicalSet.has("Nasara Organiser"), "Must include Constituency Nasara Organiser");
  assert.ok(resolved.canonicalSet.has("TESCON President"), "Must include TESCON President");
  assert.equal(
    resolved.canonicalSet.has("TESCON Nasara Coordinator"),
    false,
    "Must NOT include TESCON Nasara Coordinator when tescon_nasara is deselected"
  );
  assert.equal(resolved.isTesconNasaraIncluded, false);

  // Test simulated delegate matching logic matching route.ts
  const matchesDelegate = (r) => {
    const rawLvl = String(r.executive_level || "").toLowerCase().trim();
    const lvl = rawLvl === "external branch" ? "constituency" : rawLvl;
    const pos = String(r.position || "").trim();
    const posLower = pos.toLowerCase();
    const canonPos = normalizeCanonicalPosition(r.position, r.executive_level);

    let matches =
      resolved.canonicalSet.has(canonPos) ||
      (resolved.isTesconNasaraIncluded && lvl === "tescon" && /nasara/i.test(posLower));
    if (!matches && lvl !== "tescon") {
      for (const target of resolved.canonicalSet) {
        if (posLower === target.toLowerCase()) {
          matches = true;
          break;
        }
      }
    }
    return matches;
  };

  // Constituency Nasara -> MATCH
  assert.equal(
    matchesDelegate({ position: "Nasara Coordinator", executive_level: "Constituency" }),
    true,
    "Constituency Nasara must match"
  );

  // Regional Nasara -> MATCH
  assert.equal(
    matchesDelegate({ position: "Nasara Coordinator", executive_level: "Region" }),
    true,
    "Regional Nasara must match"
  );

  // TESCON President -> MATCH
  assert.equal(
    matchesDelegate({ position: "President", executive_level: "TESCON" }),
    true,
    "TESCON President must match"
  );

  // Campus TESCON Nasara (raw position: 'Nasara Coordinator', executive_level: 'TESCON') -> MUST NOT MATCH
  assert.equal(
    matchesDelegate({ position: "Nasara Coordinator", executive_level: "TESCON" }),
    false,
    "Campus TESCON Nasara must NOT match when tescon_nasara is deselected"
  );

  // Campus TESCON Nasara (raw position: 'TESCON Nasara Coordinator', executive_level: 'TESCON') -> MUST NOT MATCH
  assert.equal(
    matchesDelegate({ position: "TESCON Nasara Coordinator", executive_level: "TESCON" }),
    false,
    "Campus TESCON Nasara must NOT match when tescon_nasara is deselected"
  );
});

test("Selecting TESCON Nasara includes Campus TESCON Nasara with correct canonical title", () => {
  const selection = ["tescon_nasara"];
  const resolved = getCanonicalPositionsForSelection(selection);

  assert.ok(resolved.canonicalSet.has("TESCON Nasara Coordinator"));
  assert.equal(resolved.isTesconNasaraIncluded, true);

  const tesconDelegate = { position: "Nasara Coordinator", executive_level: "TESCON" };
  const canonPos = normalizeCanonicalPosition(tesconDelegate.position, tesconDelegate.executive_level);

  assert.equal(canonPos, "TESCON Nasara Coordinator", "Must display as 'TESCON Nasara Coordinator'");
  assert.ok(resolved.canonicalSet.has(canonPos), "Canonical set must match canonPos");
});

test("Route code contains guarded position matching and exclusion logic", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  assert.ok(
    code.includes('if (!matches && lvl !== "tescon")'),
    "Route must guard customResolved fallback loop with lvl !== 'tescon'"
  );
  assert.ok(
    code.includes('if (lvl !== "tescon")'),
    "Route must guard position fallback loops against TESCON leakage"
  );
});
