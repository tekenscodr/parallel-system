import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CANONICAL_LEVEL_ORDER,
  compareAlbumDelegates,
  normalizePositionRank,
} from "../lib/album-hierarchy.ts";

test("position hierarchy matches the documented 21-position order", () => {
  const positions = [
    "Chairperson", "1st Vice Chairperson", "2nd Vice Chairperson", "Secretary",
    "Deputy Secretary", "Treasurer", "Organiser", "Women Organiser",
    "Youth Organiser", "Nasara Coordinator", "Financial Secretary",
    "Electoral Affairs Officer", "Communication Officer", "Research Officer",
    "PWD Coordinator", "Deputy Organiser", "Deputy Women Organiser",
    "Deputy Youth Organiser", "Deputy Nasara Coordinator", "Special Duties Officer",
    "Legal Representative Officer",
  ];
  assert.deepEqual(positions.map(normalizePositionRank), positions.map((_, index) => index + 1));
});

test("album hierarchy orders levels, jurisdictions, TESCON institutions, positions and names", () => {
  const delegate = (name, level, region, constituency, position, pollingStation = "") => ({
    executive_name: name,
    executive_level: level,
    region,
    constituency,
    polling_station: pollingStation,
    level_rank: CANONICAL_LEVEL_ORDER[level.toLowerCase()],
    position_rank: normalizePositionRank(position),
  });
  const input = [
    delegate("TESCON B", "TESCON", "Ashanti", "", "President", "Zeta University"),
    delegate("EXTERNAL", "External Branch", "External Branches", "United Kingdom", "Chairperson"),
    delegate("CON B", "Constituency", "Bono", "Berekum East", "Chairperson"),
    delegate("REG B", "Regional", "Bono", "", "Chairperson"),
    delegate("TESCON A YOUTH", "TESCON", "Ashanti", "", "Youth Organiser", "Alpha University"),
    delegate("NAT YOUTH", "National", "", "", "Youth Organiser"),
    delegate("CON A YOUTH", "Constituency", "Ahafo", "Asunafo North", "Youth Organiser"),
    delegate("REG A YOUTH", "Regional", "Ahafo", "", "Youth Organiser"),
    delegate("TESCON A CHAIR", "TESCON", "Ashanti", "", "Chairperson", "Alpha University"),
    delegate("CON A CHAIR", "Constituency", "Ahafo", "Asunafo North", "Chairperson"),
  ];
  input.sort(compareAlbumDelegates);
  assert.deepEqual(input.map((item) => item.executive_name), [
    "NAT YOUTH",
    "REG A YOUTH", "REG B",
    "CON A CHAIR", "CON A YOUTH", "CON B",
    "EXTERNAL",
    "TESCON A CHAIR", "TESCON A YOUTH", "TESCON B",
  ]);
});

test("PDF page construction preserves hierarchy boundaries", () => {
  const route = fs.readFileSync(path.join(process.cwd(), "app/api/admin/albums/election/route.ts"), "utf8");
  const national = route.indexOf("// 1. National Level Pages");
  const regional = route.indexOf("// 2. Regional Level Pages");
  const constituency = route.indexOf("// 3. Constituency Level Pages");
  const external = route.indexOf("// 3b. External Branches retain constituency status");
  const tescon = route.indexOf("// 4. TESCON Level Pages");
  assert.ok(national < regional && regional < constituency && constituency < external && external < tescon);
  assert.ok(route.includes("const regionalGroups = new Map"));
  assert.ok(route.includes("const branchGroups = new Map"));
  assert.ok(route.includes("const institutionGroups = new Map"));
  assert.ok(route.includes("const institution = getTesconInstitution(delegate);"));
});
