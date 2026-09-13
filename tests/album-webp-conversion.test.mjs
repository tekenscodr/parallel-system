import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

test("sharp converts sample delegate image to valid WebP Data URI", async () => {
  const testImagePath = path.join(process.cwd(), "public/cdn/delegates/wocom-262054-christabel-sekyere.jpg");
  assert.ok(fs.existsSync(testImagePath), "Sample test image must exist");

  const rawBuf = fs.readFileSync(testImagePath);
  assert.ok(rawBuf.length > 1000, "Raw image must have content");

  const webpBuf = await sharp(rawBuf)
    .resize(240, 300, { fit: "cover", position: "top" })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  const webpDataUri = "data:image/webp;base64," + webpBuf.toString("base64");
  assert.ok(webpDataUri.startsWith("data:image/webp;base64,"));
  assert.ok(webpBuf.length < rawBuf.length, "WebP buffer must be smaller than JPEG");
});

test("Ahafo album data contains WebP base64 portraits", () => {
  const candidatePaths = [
    path.join(process.cwd(), "exports/albums/ahafo_album_data.json"),
    path.join(process.cwd(), "public/exports/ahafo_album_data.json"),
  ];
  const ahafoJsonPath = candidatePaths.find((p) => fs.existsSync(p));
  assert.ok(ahafoJsonPath, "Ahafo album data file must exist");

  const data = JSON.parse(fs.readFileSync(ahafoJsonPath, "utf8"));
  assert.ok(Array.isArray(data.regionalExecutives));

  const webpPhotos = data.regionalExecutives.filter(
    (e) => typeof e.photo_base64 === "string" && e.photo_base64.startsWith("data:image/webp;base64,")
  );
  assert.ok(webpPhotos.length > 0, "Regional executives must have WebP photos");
});

test("Route file converts images to WebP before calling generateAlbumHtml", () => {
  const routeCode = fs.readFileSync(
    path.join(process.cwd(), "app/api/admin/albums/election/route.ts"),
    "utf8"
  );

  // Must call convertDelegatesImagesToWebp before generateAlbumHtml
  const convertCallIdx = routeCode.indexOf("await convertDelegatesImagesToWebp(delegates);");
  const generateCallIdx = routeCode.indexOf("generateAlbumHtml(");

  assert.ok(convertCallIdx > -1, "Must call convertDelegatesImagesToWebp");
  assert.ok(generateCallIdx > -1, "Must call generateAlbumHtml");
  assert.ok(convertCallIdx < generateCallIdx, "Must convert delegates images to WebP BEFORE generateAlbumHtml");

  // In generateAlbumHtml, voter-img src must use webp_base64 or avatar_svg, NOT /api/admin/albums/image
  assert.ok(routeCode.includes("const photoSrc = d.webp_base64 || d.avatar_svg;"));
  assert.ok(!routeCode.includes("photoSrc = `/api/admin/albums/image?url="));

  // Must have provisional cover title
  assert.ok(routeCode.includes("PROVISIONAL ELECTORAL COLLEGE ALBUM &amp; VOTER DIRECTORY"));

  // A4 printing must reserve the footer and allow for browser sub-pixel rounding and printer margins,
  // otherwise the page number can be pushed onto the following sheet.
  assert.ok(routeCode.includes("height: 268mm !important;"));
  assert.ok(routeCode.includes("flex: 0 0 7mm;"));
  assert.ok(routeCode.includes("grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);"));
  assert.ok(routeCode.includes(".album-page:last-child { page-break-after: auto !important;"));
});
