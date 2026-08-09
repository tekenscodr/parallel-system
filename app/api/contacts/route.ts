import { apiError, cleanPhone, getD1, getOrCreateRequestUser } from "@/db/runtime";

export async function GET(request: Request) {
  try {
    const db = getD1();
    const url = new URL(request.url);
    const search = `%${url.searchParams.get("search")?.trim() ?? ""}%`;
    const pollingStationId = url.searchParams.get("pollingStationId");
    const source = url.searchParams.get("source") || null;
    const currentUser = await getOrCreateRequestUser(request);
    const statement = db.prepare(`
      SELECT c.id, c.first_name AS firstName, c.last_name AS lastName,
        c.phone_number AS phoneNumber, c.consent_status AS consentStatus,
        c.email, c.date_of_birth AS dateOfBirth, c.voter_id AS voterId,
        c.ghana_card_number AS ghanaCardNumber, c.source,
        u.full_name AS uploadedByName, u.email AS uploadedByEmail,
        c.is_active AS isActive, ps.id AS pollingStationId,
        ps.name AS pollingStation, ea.name AS electoralArea,
        co.name AS constituency, r.name AS region
      FROM contacts c
      LEFT JOIN polling_stations ps ON ps.id = c.polling_station_id
      LEFT JOIN electoral_areas ea ON ea.id = ps.electoral_area_id
      LEFT JOIN constituencies co ON co.id = COALESCE(ps.constituency_id, ea.constituency_id)
      LEFT JOIN regions r ON r.id = co.region_id
      LEFT JOIN users u ON u.id = c.uploaded_by_id
      WHERE (c.first_name || ' ' || c.last_name LIKE ?1 OR c.phone_number LIKE ?1
        OR COALESCE(c.email, '') LIKE ?1 OR COALESCE(c.voter_id, '') LIKE ?1
        OR COALESCE(c.ghana_card_number, '') LIKE ?1)
        AND (?2 IS NULL OR c.polling_station_id = ?2)
        AND (?3 IS NULL OR c.source = ?3)
        AND (c.source = 'platform' OR ?4 IS NULL OR c.uploaded_by_id = ?4)
      ORDER BY c.created_at DESC
      LIMIT 250
    `).bind(search, pollingStationId, source, currentUser?.id ?? null);
    const result = await statement.all();
    return Response.json({ contacts: result.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    const currentUser = await getOrCreateRequestUser(request);
    if (!currentUser) return Response.json({ error: "Sign in to add contacts." }, { status: 401 });
    const firstName = body.firstName?.trim();
    const phoneNumber = cleanPhone(body.phoneNumber ?? "");
    if (!firstName || phoneNumber.length < 10) {
      return Response.json({ error: "First name and a valid phone number are required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await getD1().prepare(`
      INSERT INTO contacts (
        id, polling_station_id, first_name, last_name, phone_number,
        email, date_of_birth, voter_id, ghana_card_number, source, uploaded_by_id,
        preferred_language, consent_status, consent_source, opted_in_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'user_upload', ?10, ?11, ?12,
        'dashboard', CASE WHEN ?12 = 'opted_in' THEN CURRENT_TIMESTAMP ELSE NULL END)
    `).bind(
      id,
      body.pollingStationId || null,
      firstName,
      body.lastName?.trim() ?? "",
      phoneNumber,
      body.email?.trim() || null,
      body.dateOfBirth || null,
      body.voterId?.trim() || null,
      body.ghanaCardNumber?.trim() || null,
      currentUser.id,
      body.preferredLanguage || "en",
      body.consentStatus || "pending",
    ).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
