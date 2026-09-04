import { apiError, cleanPhone, getD1, getOrCreateRequestUser } from "@/db/runtime";

type ImportRow = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string;
  voterId?: string;
  ghanaCardNumber?: string;
  pollingStationCode?: string;
  consentStatus?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getOrCreateRequestUser(request);
    if (!user) return Response.json({ error: "Sign in to upload contacts." }, { status: 401 });

    const body = await request.json() as { fileName?: string; rows?: ImportRow[] };
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];
    if (!rows.length) return Response.json({ error: "The CSV does not contain any contacts." }, { status: 400 });

    const db = getD1();
    const batchId = crypto.randomUUID();
    let imported = 0;
    let skipped = 0;
    const statements: any[] = [];

    for (const row of rows) {
      const firstName = row.firstName?.trim();
      const phone = cleanPhone(row.phoneNumber ?? "");
      if (!firstName || phone.length < 10) { skipped += 1; continue; }
      const consent = ["pending", "opted_in", "opted_out"].includes(row.consentStatus ?? "")
        ? row.consentStatus : "pending";
      statements.push(db.prepare(`
        INSERT OR IGNORE INTO contacts (
          id, polling_station_id, first_name, last_name, phone_number, email,
          date_of_birth, voter_id, ghana_card_number, source, uploaded_by_id,
          upload_batch_id, consent_status, consent_source, opted_in_at
        ) VALUES (?1, (SELECT id FROM polling_stations WHERE code = ?2), ?3, ?4, ?5,
          ?6, ?7, ?8, ?9, 'user_upload', ?10, ?11, ?12, 'csv_upload',
          CASE WHEN ?12 = 'opted_in' THEN CURRENT_TIMESTAMP ELSE NULL END)
      `).bind(
        crypto.randomUUID(), row.pollingStationCode?.trim() || null, firstName,
        row.lastName?.trim() || "", phone, row.email?.trim() || null,
        row.dateOfBirth?.trim() || null, row.voterId?.trim() || null,
        row.ghanaCardNumber?.trim() || null, user.id, batchId, consent,
      ));
    }

    for (let index = 0; index < statements.length; index += 100) {
      const results = await db.batch(statements.slice(index, index + 100));
      for (const result of results) {
        if (result.meta.changes > 0) imported += 1; else skipped += 1;
      }
    }

    await db.prepare(`
      INSERT INTO contact_uploads (id, uploaded_by_id, file_name, imported_count, skipped_count)
      VALUES (?1, ?2, ?3, ?4, ?5)
    `).bind(batchId, user.id, body.fileName?.trim() || "contacts.csv", imported, skipped).run();

    return Response.json({ batchId, imported, skipped }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
