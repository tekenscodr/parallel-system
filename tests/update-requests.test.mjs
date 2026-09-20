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

test("Executive Update Requests Service & API Suite", async (t) => {
  const { updateRequestsService } = load("lib/update-requests.ts");
  const { POST: publicPost, GET: publicGet } = load("app/api/update-requests/route.ts");

  await t.test("Tracking code generation format", () => {
    const code = updateRequestsService.generateTrackingCode();
    assert.match(code, /^REQ-2026-[0-9A-F]{6}$/);
  });

  await t.test("Tracking code uniqueness across iterations", () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      const c = updateRequestsService.generateTrackingCode();
      assert.strictEqual(codes.has(c), false, `Collision found: ${c}`);
      codes.add(c);
    }
    assert.strictEqual(codes.size, 100);
  });

  await t.test("Public API POST validation error on empty payload", async () => {
    const req = new Request("http://localhost/api/update-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await publicPost(req);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  await t.test("Public API GET validation error on missing query params", async () => {
    const req = new Request("http://localhost/api/update-requests", {
      method: "GET",
    });
    const res = await publicGet(req);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });
});
