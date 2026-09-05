function getCloudflareEnv(): Record<string, unknown> {
  try {
    return eval('require("cloudflare:workers")')?.env || {};
  } catch {
    return ((globalThis as any)?.__CLOUDFLARE_ENV__ || {}) as Record<string, unknown>;
  }
}

type QueryResult<T> = { results: T[]; meta: { changes: number } };
type PreparedDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<QueryResult<T>>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<QueryResult<Record<string, unknown>>>;
    };
    all<T = Record<string, unknown>>(): Promise<QueryResult<T>>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<QueryResult<Record<string, unknown>>>;
  };
  batch(statements: Array<{ run(): Promise<QueryResult<Record<string, unknown>>> }>): Promise<Array<QueryResult<Record<string, unknown>>>>;
};

export function getD1(): PreparedDatabase {
  const workerEnv = getCloudflareEnv();
  const rawUrl = (workerEnv.DATABASE_URL || workerEnv.POSTGRES_URL || workerEnv.LOCAL_DATABASE_URL) as string | undefined;
  const dbUrl = typeof rawUrl === "string" ? rawUrl
    : typeof process !== "undefined" ? (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCAL_DATABASE_URL) : undefined;
  if (dbUrl) {
    const cleanUrl = dbUrl.replace(/\?.*$/, "");
    return createPostgresAdapter(cleanUrl);
  }
  const password = typeof workerEnv.PGPASSWORD === "string" ? workerEnv.PGPASSWORD
    : typeof process !== "undefined" ? (process.env.PGPASSWORD || "Jalabia123++") : "Jalabia123++";
  return createPostgresAdapter({
    host: String(workerEnv.PGHOST || process.env.PGHOST || "72.61.17.76"),
    port: Number(workerEnv.PGPORT || process.env.PGPORT || 5432),
    database: String(workerEnv.PGDATABASE || process.env.PGDATABASE || "ec-data"),
    username: String(workerEnv.PGUSER || process.env.PGUSER || "postgres"),
    password,
  });
  const dbBinding = (workerEnv as any).DB;
  if (!dbBinding) throw new Error("Database binding DB is not available.");
  return dbBinding;
}

function createPostgresAdapter(connection: string | { host: string; port: number; database: string; username: string; password: string }): PreparedDatabase {
  const clientPromise = import("postgres").then(({ default: postgres }) => postgres(connection as any, { max: 5 }));
  const prepare = (query: string) => {
    const execute = async (values: unknown[]) => {
      const client = await clientPromise;
      const postgresQuery = query.replace(/\?(\d+)/g, (_, position) => `$${position}`)
        .replace(/INSERT OR IGNORE INTO/i, "INSERT INTO");
      const finalQuery = /INSERT OR IGNORE INTO/i.test(query)
        ? `${postgresQuery.trim().replace(/;$/, "")} ON CONFLICT DO NOTHING`
        : postgresQuery;
      return client.unsafe(finalQuery, values as never[]);
    };
    const bound = (values: unknown[]) => ({
      async all<T = Record<string, unknown>>() { const rows = await execute(values); return { results: [...rows] as T[], meta: { changes: rows.count } }; },
      async first<T = Record<string, unknown>>() { const rows = await execute(values); return (rows[0] as T | undefined) ?? null; },
      async run() { const rows = await execute(values); return { results: [...rows] as Record<string, unknown>[], meta: { changes: rows.count } }; },
    });
    return { bind: (...values: unknown[]) => bound(values), ...bound([]) };
  };
  return { prepare, batch: (statements) => Promise.all(statements.map((statement) => statement.run())) };
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected database error";
  console.error(message);
  return Response.json({ error: message }, { status: 500 });
}

export function cleanPhone(value: string) {
  return value.replace(/[^+\d]/g, "");
}

export async function getOrCreateRequestUser(request: Request) {
  const db = getD1();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()
    || (new URL(request.url).hostname === "localhost" ? "local-admin@reach.local" : null);
  if (!email) return null;

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const fullName = encodedName
    && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
    ? safelyDecode(encodedName)
    : null;
  const existing = await db.prepare("SELECT id, email, full_name AS fullName FROM users WHERE email = ?1")
    .bind(email).first<{ id: string; email: string; fullName: string }>();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const displayName = fullName || email.split("@")[0];
  await db.prepare("INSERT INTO users (id, email, full_name) VALUES (?1, ?2, ?3)")
    .bind(id, email, displayName).run();
  return { id, email, fullName: displayName };
}

function safelyDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return null; }
}
