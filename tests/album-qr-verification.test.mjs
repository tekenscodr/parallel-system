import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { generateQrMatrix, renderQrCodeSvg } from "../lib/qr-svg.ts";
import {
  CANONICAL_LOCAL_ORIGIN,
  CANONICAL_PROD_ORIGIN,
  buildAlbumVerificationUrl,
  expandShortLevelsCode,
  expandShortPositionsCode,
  expandShortRegionCode,
  expandShortScopeCode,
  resolveVerificationOrigin,
  signAlbumVerificationParams,
  verifyAlbumVerificationSignature,
} from "../lib/album-verification.ts";

test("QR Code SVG generator produces valid ISO 18004 matrix and compact SVG path", () => {
  const url = "https://paratrooper-navy.vercel.app/verify/album?contest=Presidential&region=Ahafo&album_type=final&page=1&sig=0123456789abcdef0123456789abcdef";
  const matrix = generateQrMatrix(url);

  // Version 1..20 size formula: 17 + 4 * version
  assert.ok(matrix.length >= 21, "QR matrix must be at least 21x21 modules");
  assert.equal(matrix.length, matrix[0].length, "QR matrix must be square");
  assert.equal((matrix.length - 17) % 4, 0, "QR matrix size must match 17 + 4*V");

  // Top-left finder pattern outer corner and center must be dark (true)
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[3][3], true);
  assert.equal(matrix[6][6], true);

  const svg = renderQrCodeSvg(url, {
    size: 54,
    margin: 2,
    color: "#003399",
    bgColor: "#FFFFFF",
  });
  assert.ok(svg.startsWith("<svg "), "Must render an <svg> element");
  assert.ok(svg.includes('fill="#003399"'), "Must use NPP navy dark module fill");
  assert.ok(svg.includes("<path d=\"M"), "Must contain compact SVG path commands");
});

test("Album verification HMAC signature validates authentic URLs and rejects tampering", () => {
  const params = {
    position: "Youth Organisers & Deputies",
    region: "Ashanti",
    constituency: "Bantama",
    album_type: "final",
  };

  assert.equal(resolveVerificationOrigin("http://localhost:3000"), CANONICAL_LOCAL_ORIGIN);
  assert.equal(resolveVerificationOrigin("http://127.0.0.1:3000"), CANONICAL_LOCAL_ORIGIN);
  assert.equal(resolveVerificationOrigin("https://paratrooper-navy.vercel.app/"), CANONICAL_PROD_ORIGIN);

  const sig = signAlbumVerificationParams(params);
  assert.equal(sig.length, 24, "Signature must be 24 hex chars");
  assert.equal(verifyAlbumVerificationSignature(params, sig), true);

  // Tampering with position or region must fail verification
  assert.equal(
    verifyAlbumVerificationSignature({ ...params, region: "Greater Accra" }, sig),
    false
  );
  assert.equal(
    verifyAlbumVerificationSignature({ ...params, album_type: "provisional" }, sig),
    false
  );

  const verifyUrl = buildAlbumVerificationUrl("https://paratrooper-navy.vercel.app/", params, {
    page: 4,
    pageConstituency: "Bantama",
  });
  assert.ok(verifyUrl.startsWith("https://paratrooper-navy.vercel.app/verify/album?"));
  assert.ok(verifyUrl.includes("p=yo"));
  assert.ok(verifyUrl.includes("r=Ashanti"));
  assert.ok(verifyUrl.includes("c=Bantama"));
  assert.ok(verifyUrl.includes("pg=4"));
  assert.ok(verifyUrl.includes(`s=${sig.slice(0, 16)}`));
  assert.equal(verifyAlbumVerificationSignature(params, sig.slice(0, 16)), true);

  const localVerifyUrl = buildAlbumVerificationUrl("http://localhost:3000", params, {
    page: 4,
    pageConstituency: "Bantama",
  });
  assert.ok(localVerifyUrl.startsWith("http://localhost:3000/verify/album?"));
});

test("Compact bitmask encoding keeps custom-position and multi-region QR URLs short and verifiable", () => {
  const fullPositions =
    "chairperson,1st_vice,2nd_vice,secretary,deputy_secretary,treasurer,financial_secretary,organiser,deputy_organiser,women_organiser,deputy_women_organiser,youth_organiser,deputy_youth_organiser,nasara_coordinator,deputy_nasara_coordinator,communication_officer,electoral_affairs,research_officer,pwd_officer";
  const multiRegions = "Ashanti,Eastern,Greater Accra";
  const levels = "Regional,Constituency";

  const params = {
    position: "Custom",
    region: multiRegions,
    constituency: "Bosome Freho",
    album_type: "provisional",
    scope: "all_voters",
    levels,
    positions: fullPositions,
  };

  const verifyUrl = buildAlbumVerificationUrl("https://paratrooper-navy.vercel.app", params, {
    page: 3,
    pageConstituency: "Bosome Freho",
  });

  assert.ok(
    verifyUrl.length < 180,
    `Compact QR verification URL must stay short (<180 chars), got ${verifyUrl.length}: ${verifyUrl}`
  );

  const parsed = new URL(verifyUrl);
  const psParam = parsed.searchParams.get("ps") || "";
  const rParam = parsed.searchParams.get("r") || "";
  const lvParam = parsed.searchParams.get("lv") || "";
  const scParam = parsed.searchParams.get("sc") || "";
  const sigParam = parsed.searchParams.get("s") || "";

  assert.ok(psParam.startsWith("~"), "Positions bitmask should start with ~");
  assert.equal(expandShortPositionsCode(psParam), fullPositions);
  assert.equal(expandShortRegionCode(rParam), multiRegions);
  assert.equal(expandShortLevelsCode(lvParam), levels);
  assert.equal(expandShortScopeCode(scParam), "all_voters");

  // Signature must verify whether passed compressed or expanded params
  assert.equal(verifyAlbumVerificationSignature(params, sigParam), true);
  assert.equal(
    verifyAlbumVerificationSignature(
      {
        ...params,
        region: rParam,
        levels: lvParam,
        positions: psParam,
        scope: scParam,
      },
      sigParam
    ),
    true
  );
});

test("Official Final Certified Album places QR code between crest and Chairman salutation and includes per-page and constituency QR codes", () => {
  const routePath = path.join(process.cwd(), "app/api/admin/albums/election/route.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // 1. Cover QR must be placed inside .signature-section strictly between .seal-container and .sig-block
  const sigSectionStart = code.indexOf('<div class="signature-section">');
  assert.ok(sigSectionStart !== -1, ".signature-section must exist on Cover Page");
  const sealIndex = code.indexOf('<div class="seal-container">', sigSectionStart);
  const coverQrIndex = code.indexOf('class="cover-qr-verification"', sigSectionStart);
  const chairmanSigIndex = code.indexOf('<div class="sig-block">', sigSectionStart);

  assert.ok(sealIndex !== -1, ".seal-container (crest) must exist in .signature-section");
  assert.ok(coverQrIndex !== -1, ".cover-qr-verification must exist in .signature-section");
  assert.ok(chairmanSigIndex !== -1, ".sig-block (Chairman salutation) must exist in .signature-section");
  assert.ok(
    sealIndex < coverQrIndex && coverQrIndex < chairmanSigIndex,
    "Cover QR code must be positioned strictly between the crest (.seal-container) and Chairman's salutation (.sig-block)"
  );

  // 2. Per-page security QR code and Constituency Audit QR code
  assert.ok(
    code.includes('class="page-audit-qr-link"'),
    "Every page header must include the per-page security QR code link (.page-audit-qr-link)"
  );
  assert.ok(
    code.includes('class="constituency-qr-link"') && code.includes("conSlotQrSvg"),
    "Constituency Part 2 validation slot must render a real scannable QR code for the constituency"
  );

  // 3. Read-only mode and Page Security Roster Check
  assert.ok(
    code.includes('id="nec-security-check-panel"') &&
      code.includes("PAGE &amp; CONSTITUENCY SECURITY AUDIT ROSTER"),
    "Read-only verification mode must render the Page & Constituency Security Audit Roster panel"
  );
  assert.ok(
    code.includes("user-select: none !important;") &&
      code.includes("READ-ONLY VERIFIED VIEW · COPY &amp; DOWNLOAD DISABLED"),
    "Read-only verification mode must disable text selection, copying, and downloading"
  );
});
