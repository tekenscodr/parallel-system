import postgres from "postgres";


declare global {
  // eslint-disable-next-line no-var
  var _ecSql: ReturnType<typeof postgres> | undefined;
}

function parseConnectionString(raw: string) {
  try {
    const parsed = new URL(raw);
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1";

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

export function getEcSql(): ReturnType<typeof postgres> {
  if (globalThis._ecSql) {
    return globalThis._ecSql;
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  let client: ReturnType<typeof postgres>;

  if (connectionString) {
    const { url, ssl } = parseConnectionString(connectionString);

    client = postgres(url, {
      ssl,
      max: 15,
      idle_timeout: 30,
      connect_timeout: 45,
      max_lifetime: 60 * 30,
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

    client = postgres({
      host,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.EC_DATABASE_NAME || process.env.PGDATABASE || "ec-data",
      username: process.env.PGUSER || "postgres",
      password,
      ssl: "prefer",
      max: 15,
      idle_timeout: 30,
      connect_timeout: 45,
      max_lifetime: 60 * 30,
      transform: {
        undefined: null,
      },
    });
  }

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
    /CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|EPIPE|Connection terminated|socket|closed/i.test(msg)
  );
}

/**
 * Execute queries within the shared PostgreSQL client pool.
 * Uses a persistent connection pool to eliminate socket churn,
 * ephemeral port exhaustion, and command-in-progress race conditions,
 * with automatic retry on transient connection/socket drops.
 */
export async function withEcSql<T>(
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>
): Promise<T> {
  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const sql = getEcSql();
      return await fn(sql);
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
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }
      throw err;
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

