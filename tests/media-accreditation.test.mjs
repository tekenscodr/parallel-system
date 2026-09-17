import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

const moduleCache = new Map();

function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  if (moduleCache.has(filename)) {
    return moduleCache.get(filename);
  }
  const dir = path.dirname(filename);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const compiledModule = { exports: {} };
  moduleCache.set(filename, compiledModule.exports);
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier.startsWith("@/")) {
      const base = specifier.slice(2);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(path.join(root, p)));
      return load(file, mocks);
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const resolved = path.resolve(dir, specifier);
      const file = [resolved, `${resolved}.ts`, `${resolved}.tsx`].find((p) => existsSync(p));
      if (file) return load(path.relative(root, file), mocks);
    }
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
    localRequire,
    compiledModule,
    compiledModule.exports
  );
  moduleCache.set(filename, compiledModule.exports);
  return compiledModule.exports;
}

test("Media Accreditation Service & Route Suite", async (t) => {
  const { mediaAccreditationService } = load("lib/media-accreditation.ts");
  const { POST: linkHandler } = load("app/api/accreditation/link/route.ts");
  const { POST: submitHandler, GET: getHandler } = load("app/api/accreditation/route.ts");

  await t.test("Code generation prefixes for different categories", () => {
    const mediaCode = mediaAccreditationService.generateAccreditationCode("MEDIA");
    const secCode = mediaAccreditationService.generateAccreditationCode("SECURITY");
    const usherCode = mediaAccreditationService.generateAccreditationCode("USHER");

    assert.match(mediaCode, /^MED-2026-[0-9A-F]{6}$/);
    assert.match(secCode, /^SEC-2026-[0-9A-F]{6}$/);
    assert.match(usherCode, /^USH-2026-[0-9A-F]{6}$/);
  });

  await t.test("ID normalization", () => {
    const raw = "  gha - 001928 - 2  ";
    const normalized = mediaAccreditationService.normalizeId(raw);
    assert.equal(normalized, "GHA-001928-2");
  });

  const testIdNumber = `TEST-MED-${Date.now().toString().slice(-6)}`;
  let generatedMediaCode = "";

  await t.test("Submit Media House accreditation", async () => {
    const res = await mediaAccreditationService.submitAccreditation({
      category: "MEDIA",
      name: "Kwame Kyeremeh",
      gender: "Male",
      company: "Joy FM / Multimedia Group",
      roleTitle: "Senior Reporter",
      assignedZone: "Press Gallery",
      serviceNumber: "MMG-5510",
      emergencyContact: "0244112233",
      region: "Greater Accra",
      street: "Kokomlemle",
      ghanaPostAddress: "GA-039-4411",
      idType: "ghana-card",
      idNumber: testIdNumber,
      phone: "0241234567",
      email: "kwame@joyfm.com.gh",
    });

    assert.equal(res.isExisting, false);
    assert.equal(res.accreditation.name, "Kwame Kyeremeh");
    assert.equal(res.accreditation.company, "Joy FM / Multimedia Group");
    assert.equal(res.accreditation.category, "MEDIA");
    assert.match(res.accreditation.accreditationCode, /^MED-2026-/);
    generatedMediaCode = res.accreditation.accreditationCode;
  });

  await t.test("Submitting duplicate ID returns isExisting: true", async () => {
    const res = await mediaAccreditationService.submitAccreditation({
      category: "MEDIA",
      name: "Kwame Kyeremeh",
      gender: "Male",
      company: "Joy FM / Multimedia Group",
      region: "Greater Accra",
      street: "Kokomlemle",
      ghanaPostAddress: "GA-039-4411",
      idType: "ghana-card",
      idNumber: testIdNumber,
    });

    assert.equal(res.isExisting, true);
    assert.equal(res.accreditation.accreditationCode, generatedMediaCode);
  });

  const testVoterId = `VTR-LINK-${Date.now().toString().slice(-4)}`;

  await t.test("Link Voter ID to Media Accreditation", async () => {
    const linked = await mediaAccreditationService.linkVoterToAccreditation({
      idNumber: testIdNumber,
      idType: "ghana-card",
      voterId: testVoterId,
    });

    assert.ok(linked, "Linked record should not be null");
    assert.equal(linked.voterId, testVoterId);
    assert.equal(linked.idNumber, testIdNumber);

    // Verify lookup by voterId
    const foundByVoterId = await mediaAccreditationService.getAccreditation({
      voterId: testVoterId,
    });
    assert.ok(foundByVoterId, "Should find accreditation by voterId");
    assert.equal(foundByVoterId.accreditationCode, generatedMediaCode);
  });

  await t.test("API Route: POST /api/accreditation/link validation errors", async () => {
    // Missing body
    const req1 = new Request("http://localhost:3000/api/accreditation/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res1 = await linkHandler(req1);
    assert.equal(res1.status, 400);

    // Missing voterId
    const req2 = new Request("http://localhost:3000/api/accreditation/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idNumber: testIdNumber }),
    });
    const res2 = await linkHandler(req2);
    assert.equal(res2.status, 400);
  });

  await t.test("API Route: POST /api/accreditation/link success", async () => {
    const updatedVoterId = `VTR-UPD-${Date.now().toString().slice(-4)}`;
    const req = new Request("http://localhost:3000/api/accreditation/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idNumber: testIdNumber,
        idType: "ghana-card",
        voterId: updatedVoterId,
      }),
    });
    const res = await linkHandler(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.accreditation.voterId, updatedVoterId);
  });

  await t.test("API Route: GET /api/accreditation retrieval", async () => {
    // By code
    const reqCode = new Request(`http://localhost:3000/api/accreditation?code=${generatedMediaCode}`);
    const resCode = await getHandler(reqCode);
    assert.equal(resCode.status, 200);
    const dataCode = await resCode.json();
    assert.equal(dataCode.success, true);
    assert.equal(dataCode.accreditation.name, "Kwame Kyeremeh");

    // Non-existent code
    const reqNone = new Request("http://localhost:3000/api/accreditation?code=DOES-NOT-EXIST");
    const resNone = await getHandler(reqNone);
    assert.equal(resNone.status, 404);
  });
});
