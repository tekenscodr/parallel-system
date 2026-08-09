import { apiError, cleanPhone, getD1 } from "@/db/runtime";

export async function GET(request: Request) {
  try {
    const db = getD1();
    const url = new URL(request.url);
    const search = `%${url.searchParams.get("search")?.trim() ?? ""}%`;
    const pollingStationId = url.searchParams.get("pollingStationId");
    const statement = db.prepare(`
      SELECT c.id, c.first_name AS firstName, c.last_name AS lastName,
        c.phone_number AS phoneNumber, c.consent_status AS consentStatus,
        c.is_active AS isActive, ps.id AS pollingStationId,
        ps.name AS pollingStation, ea.name AS electoralArea,
        co.name AS constituency, r.name AS region
      FROM contacts c
      LEFT JOIN polling_stations ps ON ps.id = c.polling_station_id
      LEFT JOIN electoral_areas ea ON ea.id = ps.electoral_area_id
      LEFT JOIN constituencies co ON co.id = COALESCE(ps.constituency_id, ea.constituency_id)
      LEFT JOIN regions r ON r.id = co.region_id
      WHERE (c.first_name || ' ' || c.last_name LIKE ?1 OR c.phone_number LIKE ?1)
        AND (?2 IS NULL OR c.polling_station_id = ?2)
      ORDER BY c.created_at DESC
      LIMIT 250
    `).bind(search, pollingStationId);
    const result = await statement.all();
    return Response.json({ contacts: result.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    const firstName = body.firstName?.trim();
    const phoneNumber = cleanPhone(body.phoneNumber ?? "");
    if (!firstName || phoneNumber.length < 10) {
      return Response.json({ error: "First name and a valid phone number are required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await getD1().prepare(`
      INSERT INTO contacts (
        id, polling_station_id, first_name, last_name, phone_number,
        preferred_language, consent_status, consent_source, opted_in_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'dashboard', CASE WHEN ?7 = 'opted_in' THEN CURRENT_TIMESTAMP ELSE NULL END)
    `).bind(
      id,
      body.pollingStationId || null,
      firstName,
      body.lastName?.trim() ?? "",
      phoneNumber,
      body.preferredLanguage || "en",
      body.consentStatus || "pending",
    ).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
