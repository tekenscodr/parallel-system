import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  isRegionalTescon,
  isRecognizedRegionalExecutive,
} from "../lib/election-contests.ts";
import { getRegionalSectionRank } from "../lib/album-hierarchy.ts";
import { isC1FemaleElectoralDelegate } from "../lib/c1-electoral-college.ts";

test("isRegionalTescon correctly identifies non-college Regional TESCON records while preserving accredited universities", () => {
  // 1. Regional TESCON Coordinator position
  assert.equal(
    isRegionalTescon({ position: "Regional TESCON Coordinator", executive_level: "Region" }),
    true,
    "Regional TESCON Coordinator at Region level must be excluded"
  );
  assert.equal(
    isRegionalTescon({ position: "Regional TESCON Coordinator", executive_level: "TESCON" }),
    true,
    "Regional TESCON Coordinator at TESCON level must be excluded"
  );
  assert.equal(
    isRegionalTescon({ position: "TESCON Regional Coordinator", executive_level: "Region" }),
    true,
    "TESCON Regional Coordinator must be excluded"
  );

  // 2. Pseudo-institutions labeled Regional TESCON Coordinator
  assert.equal(
    isRegionalTescon({
      position: "President",
      polling_station: "REGIONAL TESCON CORDINATOR",
      executive_level: "TESCON",
    }),
    true,
    "President under REGIONAL TESCON CORDINATOR pseudo-station must be excluded"
  );
  assert.equal(
    isRegionalTescon({
      position: "Nasara Coordinator",
      polling_station: "Western Regional TESCON",
      executive_level: "TESCON",
    }),
    true,
    "Western Regional TESCON pseudo-institution must be excluded"
  );
  assert.equal(
    isRegionalTescon({
      position: "Regional TESCON Coordinator",
      polling_station: "TESCON REGIONAL CORDINATOR",
      executive_level: "Region",
    }),
    true,
    "TESCON REGIONAL CORDINATOR must be excluded"
  );

  // 3. Accredited tertiary campuses with 'Regional' in name (e.g. Regional Maritime University) must NOT be excluded
  assert.equal(
    isRegionalTescon({
      position: "President",
      polling_station: "Regional Maritime University",
      executive_level: "TESCON",
    }),
    false,
    "Regional Maritime University President must be preserved as a legitimate accredited institution"
  );
  assert.equal(
    isRegionalTescon({
      position: "WOCOM",
      polling_station: "REGIONAL MARITIME UNIVERSITY",
      executive_level: "TESCON",
    }),
    false,
    "Regional Maritime University WOCOM must be preserved"
  );
  assert.equal(
    isRegionalTescon({
      position: "Nasara Coordinator",
      polling_station: "Regional Maritime University",
      executive_level: "TESCON",
    }),
    false,
    "Regional Maritime University Nasara must be preserved"
  );

  // 4. Standard Regional and Constituency executives must NOT be flagged
  assert.equal(
    isRegionalTescon({ position: "Regional Chairman", executive_level: "Region" }),
    false
  );
  assert.equal(
    isRegionalTescon({ position: "Regional Youth Organiser", executive_level: "Region" }),
    false
  );
  assert.equal(
    isRegionalTescon({ position: "Constituency Secretary", executive_level: "Constituency" }),
    false
  );
  assert.equal(
    isRegionalTescon({
      position: "President",
      polling_station: "University of Ghana, Legon",
      executive_level: "TESCON",
    }),
    false
  );
});

test("isRecognizedRegionalExecutive strictly excludes Regional TESCON from 21 Regional Executives", () => {
  // Regional TESCON Coordinator is NOT a recognized REC member
  assert.equal(isRecognizedRegionalExecutive("Regional TESCON Coordinator"), false);
  assert.equal(isRecognizedRegionalExecutive("TESCON Coordinator"), false);
  assert.equal(isRecognizedRegionalExecutive("TESCON Regional Coordinator"), false);

  // The 21 recognized REC positions must be recognized
  const recognized21 = [
    "Regional Chairman",
    "1st Vice Chairman",
    "2nd Vice Chairman",
    "Regional Secretary",
    "Assistant Regional Secretary",
    "Regional Treasurer",
    "Regional Organiser",
    "Regional Women Organiser",
    "Regional Youth Organiser",
    "Regional Nasara Coordinator",
    "Regional Financial Secretary",
    "Regional Communication Officer",
    "Regional Research Officer",
    "Regional Elections Officer",
    "Regional PWD Officer",
    "Deputy Regional Organiser",
    "Deputy Regional Women Organiser",
    "Deputy Regional Youth Organiser",
    "Deputy Regional Nasara Coordinator",
    "Special Duties Officer",
    "Director of Legal Affairs",
  ];

  for (const pos of recognized21) {
    assert.equal(
      isRecognizedRegionalExecutive(pos),
      true,
      `Expected ${pos} to be recognized REC member`
    );
  }
});

test("getRegionalSectionRank assigns non-college rank 999 to Regional TESCON", () => {
  assert.equal(
    getRegionalSectionRank({
      position: "Regional TESCON Coordinator",
      executive_level: "Region",
    }),
    999,
    "Regional TESCON Coordinator must receive rank 999 (strictly outside the college)"
  );

  assert.equal(
    getRegionalSectionRank({
      position: "President",
      polling_station: "Western Regional TESCON",
      executive_level: "TESCON",
    }),
    999,
    "Western Regional TESCON pseudo-institution must receive rank 999"
  );

  // Bona fide delegates maintain correct rank
  assert.equal(
    getRegionalSectionRank({
      position: "Regional Chairman",
      executive_level: "Region",
    }),
    1,
    "Regional Chairman must be rank 1"
  );
  assert.equal(
    getRegionalSectionRank({
      position: "President",
      polling_station: "Regional Maritime University",
      executive_level: "TESCON",
    }),
    6,
    "Regional Maritime University President must be rank 6 (TESCON)"
  );
});

test("isC1FemaleElectoralDelegate strictly excludes female Regional TESCON Coordinator", () => {
  assert.equal(
    isC1FemaleElectoralDelegate({
      gender: "female",
      position: "Regional TESCON Coordinator",
      executive_level: "Region",
    }),
    false,
    "Female Regional TESCON Coordinator must NOT qualify for C1 female college"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      gender: "female",
      position: "WOCOM",
      polling_station: "Western Regional TESCON",
      executive_level: "TESCON",
    }),
    false,
    "WOCOM under Western Regional TESCON must NOT qualify"
  );

  // Bona fide female delegates qualify
  assert.equal(
    isC1FemaleElectoralDelegate({
      gender: "female",
      position: "Regional Women Organiser",
      executive_level: "Region",
    }),
    true
  );
  assert.equal(
    isC1FemaleElectoralDelegate({
      gender: "female",
      position: "WOCOM",
      polling_station: "Regional Maritime University",
      executive_level: "TESCON",
    }),
    true
  );
});

test("POSITIONS_BY_LEVEL in dashboard and positions route strictly omit Regional TESCON Coordinator", () => {
  const dashCode = fs.readFileSync(
    path.join(process.cwd(), "app/admin/dashboard/page.tsx"),
    "utf8"
  );
  const routeCode = fs.readFileSync(
    path.join(process.cwd(), "app/api/admin/positions/route.ts"),
    "utf8"
  );

  assert.ok(
    !dashCode.includes('"Regional TESCON Coordinator"'),
    "Dashboard POSITIONS_BY_LEVEL must not contain Regional TESCON Coordinator"
  );
  assert.ok(
    !routeCode.includes('"Regional TESCON Coordinator"'),
    "Positions route POSITIONS_BY_LEVEL must not contain Regional TESCON Coordinator"
  );
});

test("app/api/admin/albums/election/route.ts strictly excludes Regional TESCON from electoral college", () => {
  const code = fs.readFileSync(
    path.join(process.cwd(), "app/api/admin/albums/election/route.ts"),
    "utf8"
  );

  assert.ok(
    code.includes("isRegionalTescon(r)"),
    "Route must test isRegionalTescon(r) in delegate eligibility"
  );
  assert.ok(
    code.includes("!isRecognizedRegionalExecutive(pos)"),
    "Route must enforce isRecognizedRegionalExecutive for regional executives"
  );
});
