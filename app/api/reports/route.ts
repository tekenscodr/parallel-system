import { apiError, getD1 } from "@/db/runtime";

export async function GET() {
  try {
    const db = getD1();
    const [status, regions, totals] = await db.batch([
      db.prepare("SELECT delivery_status AS label, COUNT(*) AS value FROM campaign_recipients GROUP BY delivery_status"),
      db.prepare(`SELECT COALESCE(r.name, 'Unassigned') AS label, COUNT(c.id) AS value
        FROM contacts c LEFT JOIN polling_stations ps ON ps.id = c.polling_station_id
        LEFT JOIN electoral_areas ea ON ea.id = ps.electoral_area_id
        LEFT JOIN constituencies co ON co.id = COALESCE(ps.constituency_id, ea.constituency_id)
        LEFT JOIN regions r ON r.id = co.region_id GROUP BY r.name ORDER BY value DESC LIMIT 8`),
      db.prepare(`SELECT COUNT(*) AS campaigns,
        COALESCE(SUM(estimated_recipients), 0) AS recipients,
        COALESCE(SUM(estimated_cost_pesewas), 0) AS costPesewas FROM campaigns`),
    ]);
    return Response.json({ deliveryStatus: status.results, contactsByRegion: regions.results, totals: totals.results[0] });
  } catch (error) {
    return apiError(error);
  }
}
