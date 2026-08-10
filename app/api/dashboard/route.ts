import { apiError, getD1 } from "@/db/runtime";

export async function GET() {
  try {
    const db = getD1();
    const [contacts, campaigns, delivered, balance, recent, readiness, regions, constituencies] = await db.batch([
      db.prepare("SELECT COUNT(*) AS value FROM contacts WHERE is_active = 1"),
      db.prepare("SELECT COUNT(*) AS value FROM campaigns"),
      db.prepare("SELECT COUNT(*) AS value FROM campaign_recipients WHERE delivery_status = 'delivered'"),
      db.prepare("SELECT COALESCE((SELECT balance_after FROM sms_credit_transactions ORDER BY created_at DESC LIMIT 1), 0) AS value"),
      db.prepare(`SELECT id, name, status, estimated_recipients AS recipients, created_at AS "createdAt"
        FROM campaigns ORDER BY created_at DESC LIMIT 5`),
      db.prepare(`SELECT
        COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL) AS "withDob",
        COUNT(*) FILTER (WHERE polling_station_id IS NOT NULL) AS mapped,
        COUNT(*) FILTER (WHERE consent_status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE consent_status = 'opted_in') AS "optedIn"
        FROM contacts WHERE is_active = 1`),
      db.prepare(`SELECT COALESCE(r.name, 'Unassigned') AS label, COUNT(c.id) AS value
        FROM contacts c
        LEFT JOIN polling_stations ps ON ps.id = c.polling_station_id
        LEFT JOIN electoral_areas ea ON ea.id = ps.electoral_area_id
        LEFT JOIN constituencies co ON co.id = COALESCE(ps.constituency_id, ea.constituency_id)
        LEFT JOIN regions r ON r.id = co.region_id
        WHERE c.is_active = 1
        GROUP BY r.name ORDER BY value DESC LIMIT 8`),
      db.prepare(`SELECT COALESCE(co.name, 'Unassigned') AS label,
        COALESCE(r.name, 'No region') AS region, COUNT(c.id) AS value
        FROM contacts c
        LEFT JOIN polling_stations ps ON ps.id = c.polling_station_id
        LEFT JOIN electoral_areas ea ON ea.id = ps.electoral_area_id
        LEFT JOIN constituencies co ON co.id = COALESCE(ps.constituency_id, ea.constituency_id)
        LEFT JOIN regions r ON r.id = co.region_id
        WHERE c.is_active = 1
        GROUP BY co.name, r.name ORDER BY value DESC LIMIT 6`),
    ]);
    return Response.json({
      totals: {
        contacts: Number(contacts.results[0]?.value ?? 0),
        campaigns: Number(campaigns.results[0]?.value ?? 0),
        delivered: Number(delivered.results[0]?.value ?? 0),
        balance: Number(balance.results[0]?.value ?? 0),
      },
      recent: recent.results,
      readiness: readiness.results[0] ?? { withDob: 0, mapped: 0, pending: 0, optedIn: 0 },
      contactsByRegion: regions.results,
      topConstituencies: constituencies.results,
    });
  } catch (error) {
    return apiError(error);
  }
}
