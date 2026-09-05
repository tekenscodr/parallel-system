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

    let ssl: boolean | "require" | "prefer" = isLocal ? false : "prefer";
    if (sslMode === "disable" || sslParam === "false" || sslParam === "0") {
      ssl = false;
    } else if (sslMode === "require" || sslParam === "true" || sslParam === "1") {
      ssl = "require";
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
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      transform: {
        undefined: null,
      },
    });
  } else {
    client = postgres({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.EC_DATABASE_NAME || "ec-data",
      username: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "B@nku%%St3w",
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      transform: {
        undefined: null,
      },
    });
  }

  globalThis._ecSql = client;
  return client;
}

/**
 * Execute queries within the shared PostgreSQL client pool.
 * Uses a persistent connection pool to eliminate socket churn,
 * ephemeral port exhaustion, and command-in-progress race conditions.
 */
export async function withEcSql<T>(
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>
): Promise<T> {
  const sql = getEcSql();
  return await fn(sql);
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

