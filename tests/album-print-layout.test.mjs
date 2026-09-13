import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("Election album print stylesheet and HTML strictly prevent footer and page number overflow", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Cover page inner border must use flexible height (flex: 1) and NOT height: 100%,
  // because height: 100% leaves no room for the cover footer/page-pill, forcing it onto page 2.
  assert.ok(
    code.includes(".cover-inner-border {") && code.includes("flex: 1;"),
    ".cover-inner-border must use flex: 1 to ensure the footer fits on the cover page"
  );
  assert.ok(
    !code.includes(".cover-inner-border {\n      border: 3px double #003399;\n      padding: 8mm 10mm;\n      display: flex;\n      flex-direction: column;\n      height: 100%;"),
    ".cover-inner-border must not be hardcoded to height: 100%"
  );

  // 2. @media print must enforce overflow: hidden !important on .album-page to prevent any sub-pixel fragment spill
  assert.ok(
    code.includes("overflow: hidden !important;"),
    "@media print must include overflow: hidden !important"
  );

  // 3. .album-page must enforce break avoidance inside and explicit A4 page sizing
  assert.ok(
    code.includes("page-break-inside: avoid !important;"),
    "@media print must have page-break-inside: avoid !important"
  );
  assert.ok(
    code.includes("break-inside: avoid !important;"),
    "@media print must have break-inside: avoid !important"
  );
  assert.ok(
    code.includes("page-break-after: always !important;"),
    "@media print must have page-break-after: always !important"
  );
  assert.ok(
    code.includes("break-after: page !important;"),
    "@media print must have break-after: page !important"
  );

  // 4. .voter-card must avoid break inside and maintain strict height
  assert.ok(
    code.includes(".voter-card {") && code.includes("page-break-inside: avoid !important;"),
    ".voter-card must avoid break-inside"
  );

  // 5. .page-footer and .footer-page-pill must avoid break-inside
  assert.ok(
    code.includes(".page-footer {") && code.includes("page-break-inside: avoid !important;"),
    ".page-footer must avoid break-inside"
  );
  assert.ok(
    code.includes(".footer-page-pill {") && code.includes("break-inside: avoid !important;"),
    ".footer-page-pill must avoid break-inside"
  );
});
