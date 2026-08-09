import { apiError, getD1 } from "@/db/runtime";

export async function GET() {
  try {
    const result = await getD1().prepare("SELECT key, value FROM system_settings").all<{ key: string; value: string }>();
    return Response.json({ settings: Object.fromEntries(result.results.map((row) => [row.key, row.value])) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    const db = getD1();
    const allowed = ["sender_id", "cost_per_sms_pesewas", "default_country_code"];
    const statements = allowed.filter((key) => body[key] !== undefined).map((key) =>
      db.prepare(`INSERT INTO system_settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
        .bind(key, String(body[key])),
    );
    if (statements.length) await db.batch(statements);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
