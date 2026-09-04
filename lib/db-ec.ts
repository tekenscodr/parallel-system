import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const host = process.env.PGHOST || "localhost";
const port = Number(process.env.PGPORT || 5432);
const database = process.env.EC_DATABASE_NAME || "ec-data";
const username = process.env.PGUSER || "postgres";
const password = process.env.PGPASSWORD || "B@nku%%St3w";

export function getEcSql() {
  if (connectionString) {
    const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    const urlLower = connectionString.toLowerCase();
    const hasExplicitDisable = urlLower.includes("sslmode=disable") || urlLower.includes("ssl=false");
    const hasExplicitRequire = urlLower.includes("sslmode=require") || urlLower.includes("ssl=true");

    let ssl: boolean | "require" | "prefer" = isLocal ? false : "prefer";
    if (hasExplicitDisable) {
      ssl = false;
    } else if (hasExplicitRequire) {
      ssl = "require";
    }

    return postgres(connectionString, {
      ssl,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      transform: {
        undefined: null,
      },
    });
  }

  return postgres({
    host,
    port,
    database,
    username,
    password,
    max: 1,
    idle_timeout: 0,
    connect_timeout: 10,
    transform: {
      undefined: null,
    },
  });
}

/**
 * Execute queries within a request-scoped PostgreSQL client.
 * In Cloudflare Workers (workerd runtime), sockets cannot be shared across
 * concurrent requests. withEcSql ensures each request has its own isolated
 * connection and closes it cleanly upon completion.
 */
export async function withEcSql<T>(
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>
): Promise<T> {
  const sql = getEcSql();
  try {
    return await fn(sql);
  } finally {
    sql.end({ timeout: 1 }).catch(() => {});
  }
}
