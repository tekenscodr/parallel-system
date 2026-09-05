import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const roleUpper = String(session.user?.role || "").toUpperCase();
    if (roleUpper !== "ADMIN_NATIONAL" && roleUpper !== "ADMIN") {
      const clientIp = getClientIp(req);
      await logAuditEvent({
        actorId: session.user.id,
        action: "EXPORT_REJECTED",
        resource: "executives_all",
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent"),
        metadata: {
          reason: "Role unauthorized for CSV export",
          attemptedRole: session.user.role,
        },
      });
      return new Response(
        JSON.stringify({ error: "Access denied. Only national administrators can export filtered CSV data." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const level = url.searchParams.get("level")?.trim() || "";
    const region = url.searchParams.get("region")?.trim() || "";
    const constituency = url.searchParams.get("constituency")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const cohort = url.searchParams.get("cohort")?.trim() || "";
    const slot = url.searchParams.get("slot")?.trim() || "";

    const rows = await withEcSql(async (sql) => {
      const conditions = [];

      if (level) conditions.push(sql`executive_level = ${level}`);
      if (region) conditions.push(sql`region ILIKE ${region}`);
      if (constituency) conditions.push(sql`constituency ILIKE ${constituency}`);
      if (search) {
        const s = `%${search}%`;
        conditions.push(
          sql`(executive_name ILIKE ${s} OR voter_id ILIKE ${s} OR position ILIKE ${s} OR constituency ILIKE ${s})`
        );
      }
      if (slot === "elected") {
        conditions.push(sql`slot_status NOT ILIKE '%Appointed%' AND status NOT ILIKE '%Appointed%'`);
      } else if (slot === "appointed") {
        conditions.push(sql`(slot_status ILIKE '%Appointed%' OR status ILIKE '%Appointed%')`);
      }

      if (cohort === "women") {
        conditions.push(sql`gender = 'Female'`);
      } else if (cohort === "nasara") {
        conditions.push(sql`position ILIKE '%nasara%'`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

      return await sql`
        SELECT 
          executive_level,
          slot_status,
          region,
          constituency,
          electoral_area,
          polling_station,
          position,
          executive_name,
          gender,
          voter_id,
          membership_id,
          status
        FROM executives_all
        ${whereClause}
        ORDER BY id ASC
        LIMIT 10000
      `;
    });

    const headers = [
      "Executive Level", "Slot Status", "Region", "Constituency", "Electoral Area",
      "Polling Station / Institution", "Position", "Executive Name", "Gender",
      "Voter ID", "Membership ID", "Status"
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = headers.map(escapeCsv).join(",") + "\n";
    for (const r of rows) {
      csvContent += [
        r.executive_level,
        r.slot_status,
        r.region,
        r.constituency,
        r.electoral_area,
        r.polling_station,
        r.position,
        r.executive_name,
        r.gender,
        r.voter_id,
        r.membership_id,
        r.status
      ].map(escapeCsv).join(",") + "\n";
    }

    const filename = `national_executives_${level ? level.toLowerCase().replace(/\s+/g, "_") : "all"}_export.csv`;

    const clientIp = getClientIp(req);
    await logAuditEvent({
      actorId: session.user.id,
      action: "EXPORT_CSV",
      resource: "executives_all",
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        filterLevel: level || "ALL",
        filterRegion: region || "ALL",
        filterConstituency: constituency || "ALL",
        filterCohort: cohort || "ALL",
        filterSlot: slot || "ALL",
        filterSearch: search || null,
        rowsExported: rows.length,
      },
    });

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Export failed";
    console.error("Export API error:", msg);
    return new Response("Export failed", { status: 500 });
  }
}
