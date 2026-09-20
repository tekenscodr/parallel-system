import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const pageContent = fs.readFileSync(
  path.resolve(process.cwd(), "app/admin/dashboard/page.tsx"),
  "utf8"
);

test("page.tsx defines POSITIONS_BY_LEVEL for all canonical levels", () => {
  const levels = [
    "National",
    "Region",
    "Constituency",
    "Electoral Area",
    "Polling Station",
    "External Branch",
    "TESCON",
  ];
  for (const lvl of levels) {
    assert.ok(
      pageContent.includes(`${lvl}: [`) || pageContent.includes(`"${lvl}": [`),
      `Expected POSITIONS_BY_LEVEL to define positions for ${lvl}`
    );
  }
  assert.ok(
    pageContent.includes('POSITIONS_BY_LEVEL["Regional"] = POSITIONS_BY_LEVEL["Region"]'),
    "Expected Regional alias for POSITIONS_BY_LEVEL"
  );
});

test("page.tsx defines normalizeLevelKey helper function", () => {
  assert.ok(
    pageContent.includes("function normalizeLevelKey("),
    "normalizeLevelKey should be defined"
  );
  assert.ok(
    pageContent.includes('if (/^region/i.test(trimmed)) return "Region"'),
    "normalizeLevelKey should handle Regional / Region"
  );
  assert.ok(
    pageContent.includes('if (/^national/i.test(trimmed)) return "National"'),
    "normalizeLevelKey should handle National"
  );
  assert.ok(
    pageContent.includes('if (/^external/i.test(trimmed)) return "External Branch"'),
    "normalizeLevelKey should handle External Branch"
  );
});

test("page.tsx defines fetchPositionsForLevel and level position loaders", () => {
  assert.ok(
    pageContent.includes("const fetchPositionsForLevel = useCallback"),
    "fetchPositionsForLevel should be defined with useCallback"
  );
  assert.ok(
    pageContent.includes("const [addPositionList, setAddPositionList]"),
    "addPositionList state should be defined"
  );
  assert.ok(
    pageContent.includes("const [editPositionList, setEditPositionList]"),
    "editPositionList state should be defined"
  );
  assert.ok(
    pageContent.includes("fetchPositionsForLevel(newExecLevel)"),
    "Add modal should fetch positions on newExecLevel change"
  );
  assert.ok(
    pageContent.includes("fetchPositionsForLevel(level)"),
    "Edit modal should fetch positions on executiveLevel change"
  );
});

test("handleFieldChange validates and resets position when executiveLevel changes", () => {
  assert.ok(
    pageContent.includes('if (field === "executiveLevel") {'),
    "handleFieldChange should check field === executiveLevel"
  );
  assert.ok(
    pageContent.includes("if (!levelPositions.includes(activeExecutive.position)) {"),
    "handleFieldChange should verify if position belongs to the new level"
  );
  assert.ok(
    pageContent.includes('nextPos = levelPositions[0] || "";'),
    "handleFieldChange should select the first valid position of the new level if invalid"
  );
});

test("Edit modal displays Executive Level before Position / Role", () => {
  const levelIndex = pageContent.indexOf("Executive Level *");
  const positionIndex = pageContent.indexOf("Position / Role ({activeExecutive.executiveLevel");

  assert.ok(levelIndex > 0, "Executive Level should be present in Edit modal");
  assert.ok(positionIndex > 0, "Position / Role should be present in Edit modal");
  assert.ok(
    levelIndex < positionIndex,
    `Expected Executive Level (pos ${levelIndex}) to appear before Position / Role (pos ${positionIndex}) in Edit modal`
  );
});

test("Both Add and Edit modals bind position select options to their respective position lists", () => {
  assert.ok(
    pageContent.includes("addPositionList.map((pos) => ("),
    "Add modal select should map over addPositionList"
  );
  assert.ok(
    pageContent.includes("editPositionList.map((pos) => ("),
    "Edit modal select should map over editPositionList"
  );
});

test("POSITIONS_BY_LEVEL.National includes National Council of Elders and National Council of Patrons", async () => {
  assert.ok(
    pageContent.includes('"National Council of Elders"'),
    "Expected POSITIONS_BY_LEVEL.National to include National Council of Elders"
  );
  assert.ok(
    pageContent.includes('"National Council of Patrons"'),
    "Expected POSITIONS_BY_LEVEL.National to include National Council of Patrons"
  );

  const { normalizePosition, getPositionRank } = await import("../lib/position-matcher.ts");
  assert.equal(
    normalizePosition("Council of Elders", "National"),
    "National Council of Elders"
  );
  assert.equal(
    normalizePosition("National Council of Elders"),
    "National Council of Elders"
  );
  assert.equal(
    normalizePosition("Council of Patrons", "National"),
    "National Council of Patrons"
  );
  assert.equal(
    normalizePosition("National Council of Patrons"),
    "National Council of Patrons"
  );

  assert.ok(getPositionRank("National Council of Elders") < 300);
  assert.ok(getPositionRank("National Council of Patrons") < 300);
});

test("POSITIONS_BY_LEVEL includes Member of Parliament at Constituency and National levels", async () => {
  const { normalizePosition, getPositionRank } = await import("../lib/position-matcher.ts");
  assert.ok(
    pageContent.includes('"Member of Parliament"'),
    "Expected page.tsx to include Member of Parliament"
  );

  const positionsApiContent = fs.readFileSync(
    path.resolve(process.cwd(), "app/api/admin/positions/route.ts"),
    "utf8"
  );
  assert.ok(
    positionsApiContent.includes('"Member of Parliament"'),
    "Expected positions API route to include Member of Parliament"
  );

  assert.equal(normalizePosition("Member of Parliament", "Constituency"), "Member of Parliament");
  assert.equal(normalizePosition("MP", "Constituency"), "Member of Parliament");
  assert.equal(getPositionRank("Member of Parliament", "Constituency"), 0);
  assert.equal(getPositionRank("MP", "Constituency"), 0);
});
