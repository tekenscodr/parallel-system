import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";
import {
  ensureProxyAssignmentsTableExists,
  getProxyAssignmentForPrincipal,
  getProxyHolderStatus,
  searchProxyCandidates,
  assignProxyVoter,
  removeProxyAssignment,
  removeAllProxyAssignments,
} from "@/lib/proxy-voting";
import { withEcSql } from "@/lib/db-ec";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    await ensureProxyAssignmentsTableExists();

    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") || "").trim().toLowerCase();
    const principalIdRaw = searchParams.get("principalId");
    const principalId = principalIdRaw ? parseInt(principalIdRaw, 10) : null;

    if (mode === "search") {
      const search = searchParams.get("search")?.trim() || "";
      const region = searchParams.get("region")?.trim() || "";
      const constituency = searchParams.get("constituency")?.trim() || "";
      const level = searchParams.get("level")?.trim() || "";
      const limit = Math.min(60, Math.max(5, parseInt(searchParams.get("limit") || "30", 10)));

      const candidates = await searchProxyCandidates({
        search,
        region,
        constituency,
        level,
        excludeExecutiveId: principalId,
        limit,
      });

      return NextResponse.json({
        success: true,
        candidates,
      });
    }

    if (principalId && !Number.isNaN(principalId)) {
      const [assignment, actingAsProxyFor] = await Promise.all([
        getProxyAssignmentForPrincipal(principalId),
        getProxyHolderStatus(principalId),
      ]);

      return NextResponse.json({
        success: true,
        assignment,
        actingAsProxyFor,
      });
    }

    // List all proxy assignments (with optional search/region/wing filter and CSV export)
    const filterSearch = searchParams.get("search")?.trim() || "";
    const filterRegion = searchParams.get("region")?.trim() || "";
    const filterWing = searchParams.get("wing")?.trim().toLowerCase() || "";
    const format = (searchParams.get("format") || "").trim().toLowerCase();

    const items = await withEcSql(async (sql) => {
      const conds = [];
      if (filterRegion) {
        conds.push(
          sql`(TRIM(COALESCE(pr.region, p.principal_region, '')) ILIKE ${filterRegion} OR TRIM(COALESCE(px.region, p.proxy_region, '')) ILIKE ${filterRegion})`
        );
      }
      if (filterWing === "youth") {
        conds.push(
          sql`(COALESCE(pr.position, p.principal_position, '') ILIKE '%youth%' OR COALESCE(pr.position, p.principal_position, '') ILIKE '%tescon%')`
        );
      } else if (filterWing === "women") {
        conds.push(
          sql`(COALESCE(pr.position, p.principal_position, '') ILIKE '%women%' OR COALESCE(pr.position, p.principal_position, '') ILIKE '%wocom%')`
        );
      } else if (filterWing === "nasara") {
        conds.push(
          sql`COALESCE(pr.position, p.principal_position, '') ILIKE '%nasara%'`
        );
      }
      if (filterSearch) {
        const s = `%${filterSearch}%`;
        conds.push(
          sql`(
            COALESCE(pr.executive_name, p.principal_name, '') ILIKE ${s}
            OR COALESCE(pr.voter_id, p.principal_voter_id, '') ILIKE ${s}
            OR COALESCE(pr.phone, p.principal_phone, '') ILIKE ${s}
            OR COALESCE(pr.constituency, p.principal_constituency, '') ILIKE ${s}
            OR COALESCE(px.executive_name, p.proxy_name, '') ILIKE ${s}
            OR COALESCE(px.voter_id, p.proxy_voter_id, '') ILIKE ${s}
            OR COALESCE(px.phone, p.proxy_phone, '') ILIKE ${s}
            OR COALESCE(px.constituency, p.proxy_constituency, '') ILIKE ${s}
          )`
        );
      }
      const whereSql =
        conds.length > 0
          ? sql`WHERE ${conds.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
          : sql``;

      return sql`
        SELECT
          p.id,
          p.principal_executive_id,
          COALESCE(pr.executive_name, p.principal_name) AS principal_name,
          COALESCE(pr.voter_id, p.principal_voter_id) AS principal_voter_id,
          COALESCE(pr.phone, p.principal_phone) AS principal_phone,
          COALESCE(pr.position, p.principal_position) AS principal_position,
          COALESCE(pr.executive_level, p.principal_level) AS principal_level,
          COALESCE(pr.region, p.principal_region) AS principal_region,
          COALESCE(pr.constituency, p.principal_constituency) AS principal_constituency,
          p.proxy_executive_id,
          COALESCE(px.executive_name, p.proxy_name) AS proxy_name,
          COALESCE(px.voter_id, p.proxy_voter_id) AS proxy_voter_id,
          COALESCE(px.phone, p.proxy_phone) AS proxy_phone,
          COALESCE(px.position, p.proxy_position) AS proxy_position,
          COALESCE(px.executive_level, p.proxy_level) AS proxy_level,
          COALESCE(px.region, p.proxy_region) AS proxy_region,
          COALESCE(px.constituency, p.proxy_constituency) AS proxy_constituency,
          COALESCE(px.polling_station, p.proxy_polling_station) AS proxy_polling_station,
          COALESCE(px.gender, p.proxy_gender) AS proxy_gender,
          COALESCE(px.date_of_birth, p.proxy_date_of_birth) AS proxy_date_of_birth,
          COALESCE(px.age, p.proxy_age) AS proxy_age,
          COALESCE(px.image_url, p.proxy_image_url) AS proxy_image_url,
          p.notes,
          p.assigned_by_id,
          p.assigned_by_name,
          p.assigned_by_email,
          p.created_at,
          p.updated_at
        FROM proxy_voter_assignments p
        LEFT JOIN executives_all pr ON pr.id = p.principal_executive_id
        LEFT JOIN executives_all px ON px.id = p.proxy_executive_id
        ${whereSql}
        ORDER BY p.id ASC
        LIMIT 2000
      `;
    });

    if (format === "csv") {
      const headers = [
        "#",
        "Principal Name",
        "Principal Voter ID",
        "Principal Phone",
        "Principal Position",
        "Principal Level",
        "Principal Region",
        "Principal Constituency / Country",
        "Proxy Voter Name",
        "Proxy Voter ID",
        "Proxy Phone",
        "Proxy Position",
        "Proxy Level",
        "Proxy Region",
        "Proxy Constituency",
        "Proxy Polling Station / Institution",
        "Proxy Gender",
        "Proxy Age",
        "Assigned By",
        "Assigned Date",
        "Notes",
      ];

      const escapeCsv = (val: unknown) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      let csvContent = headers.map(escapeCsv).join(",") + "\n";
      items.forEach((r, idx) => {
        csvContent +=
          [
            idx + 1,
            r.principal_name,
            r.principal_voter_id,
            r.principal_phone,
            r.principal_position,
            r.principal_level,
            r.principal_region,
            r.principal_constituency,
            r.proxy_name,
            r.proxy_voter_id,
            r.proxy_phone,
            r.proxy_position,
            r.proxy_level,
            r.proxy_region,
            r.proxy_constituency,
            r.proxy_polling_station,
            r.proxy_gender,
            r.proxy_age,
            r.assigned_by_name || r.assigned_by_email,
            r.created_at ? new Date(String(r.created_at)).toISOString() : "",
            r.notes,
          ]
            .map(escapeCsv)
            .join(",") + "\n";
      });

      const clientIp = getClientIp(req);
      await logAuditEvent({
        req,
        actorId: session.user.id,
        action: "EXPORT_PROXIES_CSV",
        resource: "proxy_voter_assignments",
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent"),
        metadata: {
          rowsExported: items.length,
          filterRegion: filterRegion || "ALL",
          filterWing: filterWing || "ALL",
          filterSearch: filterSearch || null,
        },
      });

      const csvFilename = filterWing
        ? `proxy_for_${filterWing}_assignments_export.csv`
        : `proxy_voter_assignments_export.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${csvFilename}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.json({
      success: true,
      items,
      total: items.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to query proxy assignments.";
    console.error("[ADMIN PROXIES GET] Error:", msg);
    return NextResponse.json({ error: "Failed to query proxy assignments." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const principalExecutiveId = Number(body.principalExecutiveId);
    const proxyExecutiveId = Number(body.proxyExecutiveId);
    const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null;

    if (
      !Number.isFinite(principalExecutiveId) ||
      principalExecutiveId <= 0 ||
      !Number.isFinite(proxyExecutiveId) ||
      proxyExecutiveId <= 0
    ) {
      return NextResponse.json(
        { error: "Valid Principal Voter ID and Proxy Voter ID are required." },
        { status: 400 }
      );
    }

    const assignment = await assignProxyVoter({
      principalExecutiveId,
      proxyExecutiveId,
      notes,
      actor: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });

    const clientIp = getClientIp(req);
    await logAuditEvent({
      req,
      actorId: session.user.id,
      action: "PROXY_ASSIGN",
      resource: "proxy_voter_assignments",
      resourceId: String(assignment.id),
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        principalExecutiveId: assignment.principalExecutiveId,
        principalName: assignment.principalName,
        principalVoterId: assignment.principalVoterId,
        proxyExecutiveId: assignment.proxyExecutiveId,
        proxyName: assignment.proxyName,
        proxyVoterId: assignment.proxyVoterId,
        proxyRegion: assignment.proxyRegion,
        proxyConstituency: assignment.proxyConstituency,
        userEmail: session.user.email,
        userName: session.user.name,
        userRole: session.user.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${assignment.proxyName} has been assigned as proxy for ${assignment.principalName}.`,
      assignment,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to assign proxy voter.";
    console.error("[ADMIN PROXIES POST] Error:", msg);
    const status = /already assigned|cannot be assigned|not found/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    if (all) {
      const removedCount = await removeAllProxyAssignments();
      const clientIp = getClientIp(req);
      await logAuditEvent({
        req,
        actorId: session.user.id,
        action: "PROXY_REVOKE_ALL",
        resource: "proxy_voter_assignments",
        resourceId: "ALL",
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent"),
        metadata: {
          removedCount,
          userEmail: session.user.email,
          userName: session.user.name,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully removed all ${removedCount} proxy assignment(s).`,
        removedCount,
      });
    }

    const principalIdRaw = searchParams.get("principalId");
    const principalId = principalIdRaw ? parseInt(principalIdRaw, 10) : NaN;

    if (Number.isNaN(principalId) || principalId <= 0) {
      return NextResponse.json(
        { error: "Valid principalId query parameter or ?all=true is required." },
        { status: 400 }
      );
    }

    const removed = await removeProxyAssignment(principalId);
    if (!removed) {
      return NextResponse.json(
        { error: "No active proxy assignment found for this voter." },
        { status: 404 }
      );
    }

    const clientIp = getClientIp(req);
    await logAuditEvent({
      req,
      actorId: session.user.id,
      action: "PROXY_REVOKE",
      resource: "proxy_voter_assignments",
      resourceId: String(removed.id),
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        principalExecutiveId: removed.principalExecutiveId,
        principalName: removed.principalName,
        proxyExecutiveId: removed.proxyExecutiveId,
        proxyName: removed.proxyName,
        userEmail: session.user.email,
        userName: session.user.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Removed proxy assignment for ${removed.principalName}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to remove proxy assignment.";
    console.error("[ADMIN PROXIES DELETE] Error:", msg);
    return NextResponse.json({ error: "Failed to remove proxy assignment." }, { status: 500 });
  }
}
