import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";

declare global {
  // eslint-disable-next-line no-var
  var _ecSql: ReturnType<typeof postgres> | undefined;
}

const requestSqlStorage = new AsyncLocalStorage<ReturnType<typeof postgres>>();

export function isWorkerEnvironment(): boolean {
  return (
    typeof (globalThis as any).WebSocketPair !== "undefined" ||
    typeof (globalThis as any).EdgeRuntime !== "undefined" ||
    Boolean(process.env.WRANGLER_LOG_PATH) ||
    Boolean(process.env.CF_PAGES) ||
    (typeof navigator !== "undefined" && String(navigator.userAgent || "").includes("Cloudflare-Workers")) ||
    process.env.NEXT_RUNTIME === "edge"
  );
}

function parseConnectionString(raw: string) {
  try {
    const parsed = new URL(raw);

    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const sslParam = parsed.searchParams.get("ssl")?.toLowerCase();

    let ssl: boolean | "require" | "prefer" = false;
    if (sslMode === "require" || sslParam === "true" || sslParam === "1") {
      ssl = "require";
    } else if (sslMode === "prefer") {
      ssl = "prefer";
    }

    // Strip parameters that postgres.js passes to PostgreSQL as GUC options,
    // which cause PostgreSQL to abort connection with:
    // FATAL 42704: unrecognized configuration parameter "schema"
    parsed.searchParams.delete("schema");
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("ssl");

    return {
      url: parsed.toString(),
      ssl,
    };
  } catch {
    return {
      url: raw,
      ssl: "prefer" as const,
    };
  }
}

export function createEcSql(options: { max?: number; idle_timeout?: number } = {}): ReturnType<typeof postgres> {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (connectionString) {
    const { url, ssl } = parseConnectionString(connectionString);

    return postgres(url, {
      ssl,
      max: options.max ?? 5,
      idle_timeout: options.idle_timeout ?? 0,
      connect_timeout: 45,
      max_lifetime: 60 * 5,
      transform: {
        undefined: null,
      },
    });
  } else {
    const host = process.env.PGHOST;
    const password = process.env.PGPASSWORD;

    if (!host || !password) {
      throw new Error(
        "Database credentials missing: Please configure DATABASE_URL or PGHOST and PGPASSWORD in environment variables (.env.local)."
      );
    }

    return postgres({
      host,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.EC_DATABASE_NAME || process.env.PGDATABASE || "ec-data",
      username: process.env.PGUSER || "postgres",
      password,
      ssl: "prefer",
      max: options.max ?? 5,
      idle_timeout: options.idle_timeout ?? 0,
      connect_timeout: 45,
      max_lifetime: 60 * 5,
      transform: {
        undefined: null,
      },
    });
  }
}

export function getEcSql(): ReturnType<typeof postgres> {
  const scopedSql = requestSqlStorage.getStore();
  if (scopedSql) {
    return scopedSql;
  }

  if (isWorkerEnvironment()) {
    // In Cloudflare Workers, persistent TCP connections cannot cross request boundaries.
    // Provide a fresh scoped client.
    return createEcSql({ max: 5, idle_timeout: 0 });
  }

  if (globalThis._ecSql) {
    return globalThis._ecSql;
  }

  const client = createEcSql({ max: 15, idle_timeout: 30 });
  globalThis._ecSql = client;
  return client;
}

function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const code = String(e.code || "").toUpperCase();
  const msg = String(e.message || "");
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH" || /ENETUNREACH|EHOSTUNREACH/i.test(msg)) {
    return false;
  }
  return (
    code === "CONNECT_TIMEOUT" ||
    code === "CONNECTION_CLOSED" ||
    code === "CONNECTION_DESTROYED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    /different request|Cannot perform I\/O|CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|EPIPE|Connection terminated|socket|closed/i.test(msg)
  );
}

/**
 * Execute queries within the PostgreSQL client pool.
 * In Cloudflare Workers/workerd environments, instantiates request-scoped clients
 * so that TCP sockets are never accessed across request boundaries.
 * In standard Node.js environments, uses the pooled connection with automatic retry.
 */
export async function withEcSql<T>(
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>
): Promise<T> {
  const existingSql = requestSqlStorage.getStore();
  if (existingSql) {
    return await fn(existingSql);
  }

  const isWorker = isWorkerEnvironment();
  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sql = isWorker ? createEcSql({ max: 5, idle_timeout: 0 }) : getEcSql();

    try {
      return await requestSqlStorage.run(sql, async () => {
        return await fn(sql);
      });
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isTransientDbError(err)) {
        try {
          if (globalThis._ecSql) {
            void globalThis._ecSql.end({ timeout: 1 }).catch(() => {});
            globalThis._ecSql = undefined;
          }
        } catch {
          globalThis._ecSql = undefined;
        }
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      throw err;
    } finally {
      if (isWorker) {
        void sql.end({ timeout: 1 }).catch(() => {});
      }
    }
  }
  throw lastErr;
}

/**
 * Gracefully close the connection pool during shutdown or testing.
 */
export async function closeEcSql(): Promise<void> {
  if (globalThis._ecSql) {
    await globalThis._ecSql.end({ timeout: 5 });
    globalThis._ecSql = undefined;
  }
}
