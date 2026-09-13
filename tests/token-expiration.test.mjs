import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

function load(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
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
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier.startsWith("@/")) {
      const base = specifier.slice(2);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(path.join(root, p)));
      return load(file, mocks);
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const resolved = path.resolve(path.dirname(filename), specifier);
      const file = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`].find((p) => existsSync(p));
      if (file) return load(path.relative(root, file), mocks);
    }
    return require(specifier);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
    localRequire,
    compiledModule,
    compiledModule.exports
  );
  return compiledModule.exports;
}

test("client-session correctly handles expiration and storage", () => {
  const storage = new Map();
  let cookieVal = "";

  global.window = {
    location: { href: "", pathname: "/admin/dashboard" },
  };
  global.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
  };
  global.sessionStorage = {
    clear: () => {},
  };
  global.document = {
    get cookie() {
      return cookieVal;
    },
    set cookie(val) {
      cookieVal = val;
    },
  };

  const clientSession = load("lib/client-session.ts");

  // 1. Initially no session
  assert.equal(clientSession.getSessionExpiresAt(), null);
  assert.equal(clientSession.isSessionTokenExpired(), false);

  // 2. Save active future session
  const futureDate = new Date(Date.now() + 3600 * 1000); // 1 hour in future
  clientSession.saveClientSession("token_12345", futureDate, "ADMIN_NATIONAL");
  assert.equal(storage.get(clientSession.SESSION_TOKEN_KEY), "token_12345");
  assert.equal(storage.get("admin_user_role"), "ADMIN_NATIONAL");
  assert.equal(clientSession.isSessionTokenExpired(), false);
  assert.equal(clientSession.getSessionExpiresAt(), futureDate.getTime());

  // 3. Save expired past session
  const pastDate = new Date(Date.now() - 10000); // 10 seconds in past
  clientSession.saveClientSession("token_expired", pastDate, "NATIONAL");
  assert.equal(clientSession.isSessionTokenExpired(), true, "Should report token as expired");

  // 4. Clear session
  clientSession.clearClientSession();
  assert.equal(storage.get(clientSession.SESSION_TOKEN_KEY), undefined);
  assert.equal(storage.get(clientSession.SESSION_EXPIRES_KEY), undefined);
  assert.equal(clientSession.getSessionExpiresAt(), null);
  assert.equal(clientSession.isSessionTokenExpired(), false);
  assert.match(cookieVal, /Expires=Thu, 01 Jan 1970/);
});

test("validateAdminSession detects expired tokens and revokes them", async () => {
  const expiredDate = new Date(Date.now() - 60000); // 1 minute in the past
  const testToken = "test_raw_token_xyz";
  const testTokenHash = crypto.createHash("sha256").update(testToken).digest("hex");

  let revokedSessionId = null;

  const mockDb = {
    withEcSql: async (callback) => {
      return callback(async (strings, ...values) => {
        const queryStr = Array.isArray(strings) ? strings.join("?") : String(strings);
        if (queryStr.includes('UPDATE "Session" SET "revokedAt" = NOW()')) {
          revokedSessionId = values[0];
          return [];
        }
        if (queryStr.includes('FROM "Session" s')) {
          return [
            {
              sessionId: "sess_expired_1",
              expiresAt: expiredDate.toISOString(),
              revokedAt: null,
              userId: "u1",
              email: "test@domain.com",
              name: "Test Officer",
              role: "NATIONAL",
              status: "ACTIVE",
              passwordChanged: true,
              passwordChangedAt: null,
            },
          ];
        }
        return [];
      });
    },
  };

  const adminAuth = load("lib/admin-auth.ts", {
    "@/lib/db-ec": mockDb,
    "./db-ec": mockDb,
    "./audit-logger": { getClientIp: () => "127.0.0.1" },
    "@/lib/audit-logger": { getClientIp: () => "127.0.0.1" },
  });

  const expiredReq = new Request("http://localhost/api/admin/auth/me", {
    headers: {
      cookie: `admin_session=${testToken}`,
    },
  });

  // validateAdminSession should detect expired token
  const result = await adminAuth.validateAdminSession(expiredReq);
  assert.equal(result.authenticated, false);
  assert.equal(result.reason, "expired");
  assert.equal(result.error, "Session token has expired");
  assert.equal(revokedSessionId, "sess_expired_1", "Expired session must be revoked in database");

  // getAuthenticatedAdmin should return null for expired session
  const session = await adminAuth.getAuthenticatedAdmin(expiredReq);
  assert.equal(session, null);
});

test("GET /api/admin/auth/me returns 401 with SESSION_EXPIRED and clears cookie when expired", async () => {
  const expiredDate = new Date(Date.now() - 60000);
  const testToken = "test_expired_cookie_token";

  const mockDb = {
    withEcSql: async (callback) => {
      return callback(async (strings) => {
        const queryStr = Array.isArray(strings) ? strings.join("?") : String(strings);
        if (queryStr.includes('UPDATE "Session" SET "revokedAt" = NOW()')) {
          return [];
        }
        if (queryStr.includes('FROM "Session" s')) {
          return [
            {
              sessionId: "sess_expired_2",
              expiresAt: expiredDate.toISOString(),
              revokedAt: null,
              userId: "u1",
              email: "test@domain.com",
              name: "Test Officer",
              role: "NATIONAL",
              status: "ACTIVE",
              passwordChanged: true,
              passwordChangedAt: null,
            },
          ];
        }
        return [];
      });
    },
  };

  const adminAuth = load("lib/admin-auth.ts", {
    "@/lib/db-ec": mockDb,
    "./db-ec": mockDb,
    "./audit-logger": { getClientIp: () => "127.0.0.1" },
    "@/lib/audit-logger": { getClientIp: () => "127.0.0.1" },
  });

  const { GET } = load("app/api/admin/auth/me/route.ts", {
    "@/lib/admin-auth": adminAuth,
  });

  const req = new Request("http://localhost/api/admin/auth/me", {
    headers: {
      cookie: `admin_session=${testToken}`,
    },
  });

  const response = await GET(req);
  assert.equal(response.status, 401);
  const data = await response.json();
  assert.equal(data.authenticated, false);
  assert.equal(data.expired, true);
  assert.equal(data.code, "SESSION_EXPIRED");
  assert.match(response.headers.get("set-cookie") || "", /Expires=Thu, 01 Jan 1970/);
});
