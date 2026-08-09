import { apiError, getD1 } from "@/db/runtime";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { consentStatus?: string; isActive?: boolean };
    await getD1().prepare(`
      UPDATE contacts SET
        consent_status = COALESCE(?2, consent_status),
        is_active = COALESCE(?3, is_active),
        opted_out_at = CASE WHEN ?2 = 'opted_out' THEN CURRENT_TIMESTAMP ELSE opted_out_at END,
        opted_in_at = CASE WHEN ?2 = 'opted_in' THEN CURRENT_TIMESTAMP ELSE opted_in_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?1
    `).bind(id, body.consentStatus ?? null, body.isActive === undefined ? null : Number(body.isActive)).run();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
