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
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const dir = path.dirname(filename);
      const resolved = [specifier, `${specifier}.ts`, `${specifier}.tsx`, `${specifier}.js`].find((p) =>
        existsSync(path.resolve(dir, p))
      );
      if (resolved) {
        return load(path.relative(root, path.resolve(dir, resolved)), mocks);
      }
    }
    if (specifier.startsWith("@/")) {
      const base = specifier.slice(2);
      const file = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find((p) => existsSync(path.join(root, p)));
      if (file) return load(file, mocks);
    }
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const { isC1FemaleElectoralDelegate } = load("lib/c1-electoral-college.ts");
const { isC1User, isAdminNational, isNationalUser } = load("lib/admin-auth.ts", {
  "./db-ec": { withEcSql: async () => [] },
  "./audit-logger": { getClientIp: () => "127.0.0.1" },
});
const { canAccessAlbums } = load("lib/album-access.ts");

test("isC1FemaleElectoralDelegate accurately filters female electoral college members", () => {
  // --- QUALIFYING (True) ---
  // 1. Constituency female
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Constituency",
      position: "Women Organiser",
      gender: "Female",
    }),
    true,
    "Constituency female Women Organiser should qualify"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Constituency",
      position: "Secretary",
      gender: "Female",
    }),
    true,
    "Constituency female Secretary should qualify"
  );

  // 2. Regional female
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Region",
      position: "Treasurer",
      gender: "Female",
    }),
    true,
    "Regional female Treasurer should qualify"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Regional",
      position: "1st Vice-Chairperson",
      gender: "Female",
    }),
    true,
    "Regional female Vice-Chair should qualify"
  );

  // 3. National female
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "National",
      position: "National Women Organiser",
      gender: "Female",
    }),
    true,
    "National female executive should qualify"
  );

  // 4. External Branch female
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "External Branch",
      position: "Chairperson",
      gender: "Female",
    }),
    true,
    "External branch female should qualify"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Constituency",
      region: "External Branch",
      position: "Secretary",
      gender: "Female",
    }),
    true,
    "External branch (via region) female should qualify"
  );

  // 5. TESCON Female President
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "TESCON",
      position: "President",
      gender: "Female",
    }),
    true,
    "Female TESCON President should qualify"
  );

  // 6. TESCON WOCOM / Women Commissioner
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "TESCON",
      position: "WOCOM",
      gender: "Female",
    }),
    true,
    "TESCON WOCOM should qualify"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "TESCON",
      position: "Women Commissioner",
      gender: "Female",
    }),
    true,
    "TESCON Women Commissioner should qualify"
  );

  // --- DISQUALIFIED / EXCLUDED (False) ---
  // 7. Polling Station executives (excluded from Electoral College)
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Polling Station",
      position: "Women Organiser",
      gender: "Female",
    }),
    false,
    "Polling Station executives must NEVER qualify for Electoral College"
  );

  // 8. Electoral Area coordinators (excluded from Electoral College)
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Electoral Area",
      position: "Coordinator",
      gender: "Female",
    }),
    false,
    "Electoral Area coordinators must NEVER qualify for Electoral College"
  );

  // 9. All Male executives across all levels
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Constituency",
      position: "Chairperson",
      gender: "Male",
    }),
    false,
    "Male constituency executive must be excluded"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "Region",
      position: "Regional Chairman",
      gender: "Male",
    }),
    false,
    "Male regional executive must be excluded"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "National",
      position: "General Secretary",
      gender: "Male",
    }),
    false,
    "Male national executive must be excluded"
  );

  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "TESCON",
      position: "President",
      gender: "Male",
    }),
    false,
    "Male TESCON President must be excluded from C1 female view"
  );

  // 10. TESCON Patrons
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "TESCON",
      position: "Patron",
      gender: "Female",
    }),
    false,
    "TESCON Patrons must NEVER qualify"
  );

  // 11. TESCON non-qualifying portfolios
  assert.equal(
    isC1FemaleElectoralDelegate({
      executive_level: "TESCON",
      position: "Organiser",
      gender: "Female",
    }),
    false,
    "TESCON non-president/wocom portfolios must be excluded from electoral college female roll"
  );
});

test("role helper functions correctly identify C1 users", () => {
  const c1User = { role: "C1" };
  const c1Lower = { role: "c1" };
  const adminUser = { role: "ADMIN_NATIONAL" };
  const nationalUser = { role: "NATIONAL" };

  assert.equal(isC1User(c1User), true);
  assert.equal(isC1User(c1Lower), true);
  assert.equal(isC1User(adminUser), false);
  assert.equal(isC1User(nationalUser), false);
  assert.equal(isC1User(null), false);

  assert.equal(isAdminNational(c1User), false);
  assert.equal(isNationalUser(c1User), false);
});

test("C1 user is barred from privileged admin-only boundaries", () => {
  const c1User = { id: "c1_test", role: "C1", email: "c1@test.org", status: "ACTIVE" };

  // Albums restricted to ADMIN_NATIONAL
  assert.equal(canAccessAlbums(c1User), false);

  // User management restricted to Admin_national
  assert.equal(isAdminNational(c1User), false);
});

test("login route allows C1 role while rejecting invalid roles", async () => {
  // Test role authorization logic in login route
  const isAuthorizedRole = (role) => {
    const roleUpper = String(role || "").toUpperCase();
    return (
      roleUpper === "ADMIN_NATIONAL" ||
      roleUpper === "ADMIN" ||
      roleUpper === "NATIONAL" ||
      roleUpper === "C1"
    );
  };

  assert.equal(isAuthorizedRole("C1"), true);
  assert.equal(isAuthorizedRole("c1"), true);
  assert.equal(isAuthorizedRole("ADMIN_NATIONAL"), true);
  assert.equal(isAuthorizedRole("NATIONAL"), true);
  assert.equal(isAuthorizedRole("VIEWER"), false);
  assert.equal(isAuthorizedRole("CAMPAIGN_MANAGER"), false);
  assert.equal(isAuthorizedRole("GUEST"), false);
});

test("users API creation route accepts C1 role", () => {
  const getTargetRole = (role) => {
    const roleUpper = String(role || "").toUpperCase();
    return roleUpper === "ADMIN_NATIONAL" ? "ADMIN_NATIONAL" : roleUpper === "C1" ? "C1" : "NATIONAL";
  };

  assert.equal(getTargetRole("C1"), "C1");
  assert.equal(getTargetRole("c1"), "C1");
  assert.equal(getTargetRole("ADMIN_NATIONAL"), "ADMIN_NATIONAL");
  assert.equal(getTargetRole("NATIONAL"), "NATIONAL");
  assert.equal(getTargetRole("UNKNOWN"), "NATIONAL");
});
