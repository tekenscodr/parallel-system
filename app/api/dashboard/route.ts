import { apiError, getD1 } from "@/db/runtime";

export async function GET() {
  try {
    const db = getD1();
    const [contacts, campaigns, delivered, balance, recent] = await db.batch([
      db.prepare("SELECT COUNT(*) AS value FROM contacts WHERE is_active = 1"),
      db.prepare("SELECT COUNT(*) AS value FROM campaigns"),
      db.prepare("SELECT COUNT(*) AS value FROM campaign_recipients WHERE delivery_status = 'delivered'"),
      db.prepare("SELECT COALESCE((SELECT balance_after FROM sms_credit_transactions ORDER BY created_at DESC LIMIT 1), 0) AS value"),
      db.prepare(`SELECT id, name, status, estimated_recipients AS recipients, created_at AS createdAt
        FROM campaigns ORDER BY created_at DESC LIMIT 5`),
    ]);
    return Response.json({
      totals: {
        contacts: Number(contacts.results[0]?.value ?? 0),
        campaigns: Number(campaigns.results[0]?.value ?? 0),
        delivered: Number(delivered.results[0]?.value ?? 0),
        balance: Number(balance.results[0]?.value ?? 0),
      },
      recent: recent.results,
    });
  } catch (error) {
    return apiError(error);
  }
}
