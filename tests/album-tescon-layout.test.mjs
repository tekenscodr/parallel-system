import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Election album route groups TESCON executives contiguously into 10-card pages", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Check that TESCON does not key by institution (which caused 1-2 card pages per school)
  assert.ok(
    !code.includes("${regionName.toLowerCase()}\\u0000${institution.toLowerCase()}"),
    "TESCON groups must not be keyed by school/institution"
  );

  // 2. Check that institution is attached to the delegate object
  assert.ok(
    code.includes('const isTescon = lvl === "tescon";') &&
      code.includes('const institution = isTescon ? getTesconInstitution(r as any) : "";'),
    "Delegate mapper must attach institution to TESCON executives"
  );

  // 3. Check that TESCON delegates are sliced into 10-card chunks per region
  assert.ok(
    code.includes("regTesconDelegates.slice(i, i + 10)"),
    "TESCON executives must flow contiguously in 10-card page chunks"
  );

  // 4. Check that voter card details explicitly render Institution for TESCON
  assert.ok(
    code.includes('<span class="lbl">Institution:</span>') &&
      code.includes('<span class="val" style="font-weight: 700;">${institution}</span>'),
    "Voter card details must display executive's institution"
  );

  // 5. Header and Footer labels reflect TESCON EXECUTIVES without institution fragmentation
  assert.ok(
    code.includes("headerSubTitle: `${regPrefix}TESCON EXECUTIVES (PART ${partIdx})`") &&
      code.includes("footerLabel: `${regFooter}TESCON EXECUTIVES`"),
    "Page header and footer must reflect contiguous TESCON EXECUTIVES"
  );
});
