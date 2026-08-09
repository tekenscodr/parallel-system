import { env } from "cloudflare:workers";

export function getD1(): D1Database {
  if (!env.DB) throw new Error("Database binding DB is not available.");
  return env.DB;
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
