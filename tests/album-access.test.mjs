import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

// Exercise the actual handlers with controlled session/database dependencies.
function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
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
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const user = (role) => ({ id: "test", email: "test@example.com", name: "Test", role, status: "ACTIVE", passwordChanged: true });
const sessionMocks = (role) => ({
  "@/lib/admin-auth": { getAuthenticatedAdmin: async () => role ? { user: user(role) } : null },
});

for (const role of [null, "ADMIN", "NATIONAL", "ADMIN_REGIONAL", "ADMIN_NATIONAL", "admin_national"]) {
  test(`album API access for ${role ?? "anonymous"}`, async () => {
    let queries = 0;
    const mocks = {
      ...sessionMocks(role),
      "@/lib/db-ec": { withEcSql: async (callback) => { queries++; return callback(async () => []); } },
    };
    const { GET } = load("app/api/admin/albums/election/route.ts", mocks);
    const allowed = role?.toUpperCase() === "ADMIN_NATIONAL";
    for (const format of ["json", "html"]) {
      const response = await GET(new Request(`http://localhost/api/admin/albums/election?format=${format}`));
      assert.equal(response.status, allowed ? 200 : role ? 403 : 401);
      if (allowed) {
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.match(response.headers.get("content-type"), format === "json" ? /json/ : /html/);
      }
    }
    assert.equal(queries, allowed ? 2 : 0, "unauthorized requests must not query the electorate");
  });

  test(`album page, images and downloads access for ${role ?? "anonymous"}`, async () => {
    const mocks = sessionMocks(role);
    const allowed = role?.toUpperCase() === "ADMIN_NATIONAL";
    const { GET: image } = load("app/api/admin/albums/image/route.ts", mocks);
    const imageResponse = await image(new Request("http://localhost/api/admin/albums/image"));
    assert.equal(imageResponse.status, allowed ? 400 : role ? 403 : 401);
    const { GET: download } = load("app/api/admin/albums/files/[filename]/route.ts", mocks);
    const response = await download(new Request("http://localhost/exports/unknown.pdf"), { params: Promise.resolve({ filename: "unknown.pdf" }) });
    assert.equal(response.status, allowed ? 404 : role ? 403 : 401);
    const { default: layout } = load("app/admin/albums/layout.tsx", {
      ...mocks,
      "next/headers": { headers: async () => new Headers() },
      "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
      "./session": { AlbumSessionProvider: ({ children }) => children },
    });
    if (allowed) assert.ok(await layout({ children: "Album content" }));
    else await assert.rejects(layout({ children: "Album content" }), new RegExp(`redirect:${role ? "/admin/dashboard" : "/admin/login"}`));
  });

  test(`album navigation for ${role ?? "unknown session"}`, () => {
    const { AdminShell } = load("app/admin/components/AdminShell.tsx", {
      "next/navigation": { usePathname: () => "/admin/dashboard", useRouter: () => ({}) },
      "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
      "@/lib/client-device": { initClientIpDetection: () => {} },
    });
    const html = renderToStaticMarkup(React.createElement(AdminShell, { currentUser: role ? user(role) : null }, "Dashboard"));
    assert.equal(html.includes('href="/admin/albums"'), role?.toUpperCase() === "ADMIN_NATIONAL");
    assert.equal(html.includes('href="/admin/albums/ahafo"'), role?.toUpperCase() === "ADMIN_NATIONAL");
  });
}

test("download allowlist blocks path traversal and serves private album content", async () => {
  const { GET } = load("app/api/admin/albums/files/[filename]/route.ts", {
    ...sessionMocks("ADMIN_NATIONAL"),
    "node:fs/promises": { readFile: async (file) => {
      assert.equal(file, path.join(root, "exports/albums/ahafo_election_album.html"));
      return Buffer.from("<html>Private album</html>");
    } },
  });
  const request = new Request("http://localhost/exports/ahafo_election_album.html");
  for (const filename of ["../../.env.local", "toString", "__proto__"]) {
    assert.equal((await GET(request, { params: Promise.resolve({ filename }) })).status, 404);
  }
  const response = await GET(request, { params: Promise.resolve({ filename: "ahafo_election_album.html" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(await response.text(), "<html>Private album</html>");
});

test("album files are not exposed by the public directory", () => {
  for (const file of ["ahafo_election_album.html", "ahafo_album_data.json", "NPP_Ahafo_Region_Election_Album_2026.pdf", "NPP_National_Youth_Organiser_Election_Album_2026.pdf", "NPP_National_Youth_Organiser_Electorate_Directory_2026.pdf"]) {
    assert.equal(existsSync(path.join(root, "public/exports", file)), false, `${file} must be served through authentication`);
  }
});

test("legacy album URLs are routed through authentication and old image caches are blocked", () => {
  const { NextRequest } = require("next/server");
  const { middleware } = load("middleware.ts", {
    "@/lib/rate-limiter": {
      checkRateLimit: () => ({ allowed: true }),
      getRateLimitHeaders: () => ({}),
      isKnownScraperUserAgent: () => ({ isScraper: false }),
    },
  });
  for (const filename of ["ahafo_election_album.html", "ahafo_album_data.json", "NPP_Ahafo_Region_Election_Album_2026.pdf", "NPP_National_Youth_Organiser_Election_Album_2026.pdf", "NPP_National_Youth_Organiser_Electorate_Directory_2026.pdf"]) {
    const response = middleware(new NextRequest(`http://localhost/exports/${filename}?v=2`));
    assert.equal(response.headers.get("x-middleware-rewrite"), `http://localhost/api/admin/albums/files/${filename}?v=2`);
  }
  assert.equal(middleware(new NextRequest("http://localhost/cdn/cache/webp/test.webp")).status, 404);
});
