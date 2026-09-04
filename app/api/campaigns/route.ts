import { apiError, getD1 } from "@/db/runtime";

export async function GET() {
  try {
    const result = await getD1().prepare(`
      SELECT c.id, c.name, c.message, c.status, c.audience_type AS "audienceType",
        c.estimated_recipients AS recipients, c.sms_parts AS "smsParts",
        c.estimated_cost_pesewas AS "costPesewas", c.scheduled_at AS "scheduledAt",
        c.created_at AS "createdAt",
        SUM(CASE WHEN cr.delivery_status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN cr.delivery_status = 'failed' THEN 1 ELSE 0 END) AS failed
      FROM campaigns c
      LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100
    `).all();
    return Response.json({ campaigns: result.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string | null>;
    const message = String(body.message ?? "").trim();
    const name = String(body.name ?? "").trim() || `Campaign ${new Date().toLocaleDateString("en-GB")}`;
    if (!message) return Response.json({ error: "A message is required." }, { status: 400 });

    const db = getD1();
    let query = `SELECT c.id, c.phone_number AS "phoneNumber", c.first_name AS "firstName", ps.name AS "pollingStation"
      FROM contacts c
      LEFT JOIN polling_stations ps ON ps.id = c.polling_station_id
      LEFT JOIN electoral_areas ea ON ea.id = ps.electoral_area_id
      LEFT JOIN constituencies co ON co.id = COALESCE(ps.constituency_id, ea.constituency_id)
      WHERE c.is_active = 1 AND c.consent_status = 'opted_in'`;
    const bindings: unknown[] = [];
    const filters: Array<[string, string]> = [
      ["contactId", "c.id"], ["pollingStationId", "ps.id"], ["electoralAreaId", "ea.id"],
      ["constituencyId", "co.id"], ["regionId", "co.region_id"],
    ];
    for (const [key, column] of filters) {
      if (body[key]) {
        bindings.push(body[key]);
        query += ` AND ${column} = ?${bindings.length}`;
        break;
      }
    }
    const audience = await db.prepare(query).bind(...bindings).all<{
      id: string; phoneNumber: string; firstName: string; pollingStation: string | null;
    }>();
    if (!audience.results.length) {
      return Response.json({ error: "No opted-in contacts match this audience." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const parts = Math.max(1, Math.ceil(message.length / 160));
    const costPesewas = audience.results.length * parts * 4;
    const scheduledAt = body.scheduledAt ? String(body.scheduledAt) : null;
    const status = scheduledAt ? "scheduled" : "sending";
    const audienceType = body.contactId ? "individual" : body.groupId ? "group" : "location";
    const statements = [
      db.prepare(`INSERT INTO campaigns (
        id, name, message, status, audience_type, contact_id, group_id, region_id,
        constituency_id, electoral_area_id, polling_station_id, scheduled_at,
        started_at, estimated_recipients, sms_parts, estimated_cost_pesewas
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
        CASE WHEN ?12 IS NULL THEN CURRENT_TIMESTAMP ELSE NULL END, ?13, ?14, ?15)`)
        .bind(id, name, message, status, audienceType, body.contactId ?? null, body.groupId ?? null,
          body.regionId ?? null, body.constituencyId ?? null, body.electoralAreaId ?? null,
          body.pollingStationId ?? null, scheduledAt, audience.results.length, parts, costPesewas),
      ...audience.results.map((contact: any) => {
        const personalized = message
          .replaceAll("{first_name}", contact.firstName)
          .replaceAll("{polling_station}", contact.pollingStation ?? "your polling station");
        return db.prepare(`INSERT INTO campaign_recipients (
          id, campaign_id, contact_id, phone_number, first_name, polling_station_name,
          personalized_message, delivery_status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'queued')`)
          .bind(crypto.randomUUID(), id, contact.id, contact.phoneNumber, contact.firstName,
            contact.pollingStation, personalized);
      }),
    ];
    await db.batch(statements);
    return Response.json({ id, recipients: audience.results.length, costPesewas }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
