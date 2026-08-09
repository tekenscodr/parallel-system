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
