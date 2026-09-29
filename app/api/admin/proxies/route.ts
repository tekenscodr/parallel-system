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

    // List all proxy assignments
    const items = await withEcSql(async (sql) => {
      return sql`
        SELECT *
        FROM proxy_voter_assignments
        ORDER BY updated_at DESC, id DESC
        LIMIT 500
      `;
    });

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
    const principalIdRaw = searchParams.get("principalId");
    const principalId = principalIdRaw ? parseInt(principalIdRaw, 10) : NaN;

    if (Number.isNaN(principalId) || principalId <= 0) {
      return NextResponse.json(
        { error: "Valid principalId query parameter is required." },
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
