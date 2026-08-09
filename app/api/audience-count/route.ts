import { apiError, getD1 } from "@/db/runtime";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const values: unknown[] = [];
    let query = `SELECT COUNT(*) AS value FROM contacts c
      LEFT JOIN polling_stations ps ON ps.id = c.polling_station_id
      LEFT JOIN electoral_areas ea ON ea.id = ps.electoral_area_id
      LEFT JOIN constituencies co ON co.id = COALESCE(ps.constituency_id, ea.constituency_id)
      WHERE c.is_active = 1 AND c.consent_status = 'opted_in'`;
    const filters: Array<[string, string]> = [["contactId", "c.id"], ["pollingStationId", "ps.id"], ["electoralAreaId", "ea.id"], ["constituencyId", "co.id"], ["regionId", "co.region_id"]];
    for (const [key, column] of filters) { const value = url.searchParams.get(key); if (value) { values.push(value); query += ` AND ${column} = ?${values.length}`; break; } }
    const result = await getD1().prepare(query).bind(...values).first<{ value: number }>();
    return Response.json({ count: Number(result?.value ?? 0) });
  } catch (error) { return apiError(error); }
}
