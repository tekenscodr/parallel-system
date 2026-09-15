import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  const dir = path.dirname(filename);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = { exports: {} };
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
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const { getDelegateEntitledPositions, isTesconPatron } = load("lib/voting-entitlement.ts");
const { normalizePhoneNumber, maskPhoneNumber } = load("lib/sms.ts");
const { createOtp, verifyOtp, signDelegateSession, verifyDelegateSession } = load("lib/delegate-auth.ts");

test("Voting entitlement correctly resolves portfolios for each executive category", () => {
  // 1. Core male under 40
  const coreMaleUnder40 = {
    executive_name: "KWAME ADDO",
    executive_level: "Constituency",
    position: "Youth Organiser",
    gender: "Male",
    date_of_birth: "1994-05-12",
    age: 32,
    voter_id: "1029384756",
  };
  const under40Positions = getDelegateEntitledPositions(coreMaleUnder40);
  assert.equal(under40Positions.some((p) => p.id === "chairperson"), true, "Should qualify for General Chairperson");
  assert.equal(under40Positions.some((p) => p.id === "general_secretary"), true, "Should qualify for General Secretary");
  assert.equal(under40Positions.some((p) => p.id === "youth_organiser"), true, "Should qualify for Youth Organiser");
  assert.equal(under40Positions.some((p) => p.id === "women_organiser"), false, "Male should not qualify for Women Organiser");
  assert.equal(under40Positions.length, 8); // 7 general + 1 youth

  // 2. Core female over 40
  const coreFemaleOver40 = {
    executive_name: "AKUA MANSAH",
    executive_level: "Regional",
    position: "Secretary",
    gender: "Female",
    date_of_birth: "1975-08-20",
    age: 51,
    voter_id: "2039485761",
  };
  const over40Positions = getDelegateEntitledPositions(coreFemaleOver40);
  assert.equal(over40Positions.some((p) => p.id === "chairperson"), true);
  assert.equal(over40Positions.some((p) => p.id === "women_organiser"), true, "Female executive should qualify for Women Organiser");
  assert.equal(over40Positions.some((p) => p.id === "youth_organiser"), false, "Age 51 should not qualify for Youth Organiser without youth portfolio");
  assert.equal(over40Positions.length, 8); // 7 general + 1 women

  // 3. Core female under 40 (triple eligibility: General + Youth + Women)
  const coreFemaleUnder40 = {
    executive_name: "AMA SERWAA",
    executive_level: "Constituency",
    position: "Treasurer",
    gender: "Female",
    date_of_birth: "1998-02-14",
    age: 28,
    voter_id: "3049586712",
  };
  const femaleYouthPositions = getDelegateEntitledPositions(coreFemaleUnder40);
  assert.equal(femaleYouthPositions.some((p) => p.id === "chairperson"), true);
  assert.equal(femaleYouthPositions.some((p) => p.id === "youth_organiser"), true);
  assert.equal(femaleYouthPositions.some((p) => p.id === "women_organiser"), true);
  assert.equal(femaleYouthPositions.length, 9); // 7 general + 1 youth + 1 women

  // 4. TESCON President
  const tesconPresident = {
    executive_name: "KOFI CAMPUS",
    executive_level: "TESCON",
    position: "TESCON President",
    gender: "Male",
    voter_id: "4059687123",
  };
  const tesconPresPositions = getDelegateEntitledPositions(tesconPresident);
  assert.equal(tesconPresPositions.some((p) => p.id === "chairperson"), true, "TESCON President votes for General Officers");
  assert.equal(tesconPresPositions.some((p) => p.id === "youth_organiser"), true, "TESCON executive votes for Youth Organiser");
  assert.equal(tesconPresPositions.some((p) => p.id === "women_organiser"), false);

  // 5. TESCON WOCOM
  const tesconWocom = {
    executive_name: "YAA CAMPUS",
    executive_level: "TESCON",
    position: "TESCON WOCOM",
    gender: "Female",
    voter_id: "5069788234",
  };
  const tesconWocomPositions = getDelegateEntitledPositions(tesconWocom);
  assert.equal(tesconWocomPositions.some((p) => p.id === "chairperson"), false, "TESCON non-president does not vote for General Officers");
  assert.equal(tesconWocomPositions.some((p) => p.id === "youth_organiser"), true, "TESCON votes for Youth Organiser");
  assert.equal(tesconWocomPositions.some((p) => p.id === "women_organiser"), true, "TESCON WOCOM votes for Women Organiser");
  assert.equal(tesconWocomPositions.length, 2);

  // 6. TESCON Patron - Constitutionally barred from voting
  const tesconPatron = {
    executive_name: "PROF PATRON",
    executive_level: "TESCON",
    position: "TESCON Patron",
    gender: "Male",
    voter_id: "6079899345",
  };
  assert.equal(isTesconPatron(tesconPatron), true);
  assert.equal(getDelegateEntitledPositions(tesconPatron).length, 0, "TESCON Patron must have 0 voting entitlements");
});

test("Phone normalization and masking utility works for Ghana numbers", () => {
  assert.equal(normalizePhoneNumber("0241234567"), "0241234567");
  assert.equal(normalizePhoneNumber("+233241234567"), "0241234567");
  assert.equal(normalizePhoneNumber("233241234567"), "0241234567");
  assert.equal(normalizePhoneNumber("024 123 4567"), "0241234567");
  assert.equal(normalizePhoneNumber("024-123-4567"), "0241234567");

  const masked = maskPhoneNumber("0241234567");
  assert.ok(masked.startsWith("024") && masked.endsWith("567") && masked.includes("*"));
});

test("OTP generation, verification and brute force prevention", async () => {
  const identifier = "test-voter-123";
  const otp = await createOtp(identifier, "0241234567", "1029384756");
  assert.equal(typeof otp, "string");
  assert.equal(otp.length, 6);

  // Incorrect code fails
  const badAttempt = await verifyOtp(identifier, "999999");
  assert.equal(badAttempt.success, false);

  // Correct code succeeds
  const goodAttempt = await verifyOtp(identifier, otp);
  assert.equal(goodAttempt.success, true);

  // Re-used code fails
  const reuseAttempt = await verifyOtp(identifier, otp);
  assert.equal(reuseAttempt.success, false);
});

test("Delegate session signing and HMAC validation", () => {
  const sessionData = {
    delegateId: 101,
    name: "KOFI MENSAH",
    voterId: "1234567890",
    phone: "0241234567",
    level: "Constituency",
    region: "Ashanti",
    constituency: "Bantama",
    position: "Youth Organiser",
    gender: "Male",
    age: 34,
    dateOfBirth: "1992-04-10",
    entitledPositions: [{ id: "chairperson", title: "National Chairperson", category: "general", reason: "Officer" }],
    verifiedAt: new Date().toISOString(),
    expiresAt: Date.now() + 3600000,
  };

  const token = signDelegateSession(sessionData);
  assert.ok(token && token.includes("."));

  const decoded = verifyDelegateSession(token);
  assert.ok(decoded);
  assert.equal(decoded.voterId, "1234567890");
  assert.equal(decoded.name, "KOFI MENSAH");

  // Tampered token fails
  const tampered = token.slice(0, -4) + "XXXX";
  assert.equal(verifyDelegateSession(tampered), null);
});

test("API route handlers validate inputs and enforce session requirements", async () => {
  const { POST: loginHandler } = load("app/api/voting/login/route.ts");
  const { POST: otpHandler } = load("app/api/voting/otp/route.ts");
  const { GET: confirmHandler } = load("app/api/voting/confirmation/route.ts");

  // 1. Login with empty payload returns 400
  const emptyLoginReq = new Request("http://localhost:3000/api/voting/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "" }),
  });
  const emptyLoginRes = await loginHandler(emptyLoginReq);
  assert.equal(emptyLoginRes.status, 400);
  const emptyLoginData = await emptyLoginRes.json();
  assert.equal(emptyLoginData.success, false);

  // 2. OTP verification with empty OTP returns 400
  const emptyOtpReq = new Request("http://localhost:3000/api/voting/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "1234567890", otp: "" }),
  });
  const emptyOtpRes = await otpHandler(emptyOtpReq);
  assert.equal(emptyOtpRes.status, 400);
  const emptyOtpData = await emptyOtpRes.json();
  assert.equal(emptyOtpData.success, false);

  // 3. Confirmation without session fails with 401 Unauthorized
  const unauthConfirmReq = new Request("http://localhost:3000/api/voting/confirmation", {
    method: "GET",
  });
  const unauthConfirmRes = await confirmHandler(unauthConfirmReq);
  assert.equal(unauthConfirmRes.status, 401);
  const unauthConfirmData = await unauthConfirmRes.json();
  assert.equal(unauthConfirmData.success, false);

  // 4. Confirmation with valid session returns delegate details and positions
  const testSession = {
    delegateId: 999,
    name: "ALHAJI HARUNA",
    voterId: "9876543210",
    phone: "0240001122",
    level: "Constituency",
    region: "Northern",
    constituency: "Tamale Central",
    position: "Nasara Coordinator",
    gender: "Male",
    age: 45,
    dateOfBirth: "1981-06-15",
    entitledPositions: [
      { id: "chairperson", title: "National Chairperson", category: "general", reason: "Constituency executive" },
      { id: "nasara_coordinator", title: "National Nasara Coordinator", category: "nasara", reason: "Nasara portfolio holder" },
    ],
    verifiedAt: new Date().toISOString(),
    expiresAt: Date.now() + 3600000,
  };
  const validToken = signDelegateSession(testSession);

  const authConfirmReq = new Request("http://localhost:3000/api/voting/confirmation", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${validToken}`,
    },
  });
  const authConfirmRes = await confirmHandler(authConfirmReq);
  assert.equal(authConfirmRes.status, 200);
  const authConfirmData = await authConfirmRes.json();
  assert.equal(authConfirmData.success, true);
  assert.equal(authConfirmData.delegate.name, "ALHAJI HARUNA");
  assert.equal(authConfirmData.delegate.voterId, "9876543210");
  assert.equal(authConfirmData.entitledPositions.length, 2);
});
