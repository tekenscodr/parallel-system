import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent } from "@/lib/audit-logger";
import { mediaAccreditationService, ensureMediaAccreditationTableExists } from "@/lib/media-accreditation";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureMediaAccreditationTableExists();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

    const result = await withEcSql(async (sql) => {
      // 1. Overall stats
      const statsRows = await sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int as approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int as rejected,
          COUNT(*) FILTER (WHERE category = 'MEDIA')::int as media_count,
          COUNT(*) FILTER (WHERE category = 'SECURITY')::int as security_count,
          COUNT(*) FILTER (WHERE category = 'USHER')::int as usher_count,
          COUNT(*) FILTER (WHERE category = 'POLITICAL_PARTY')::int as party_count,
          COUNT(*) FILTER (WHERE category = 'CIVIL_SOCIETY')::int as civil_count,
          COUNT(*) FILTER (WHERE category = 'INTERNATIONAL_ORG')::int as international_count
        FROM media_accreditations;
      `;

      const categoryCountsRows = await sql`
        SELECT category, COUNT(*)::int as count
        FROM media_accreditations
        GROUP BY category
        ORDER BY count DESC;
      `;

      // 2. Query with filters
      const statusFilter = status && status !== "ALL" ? status : null;
      const categoryFilter = category && category !== "ALL" ? category : null;
      const searchFilter = search ? `%${search.toLowerCase()}%` : null;

      const items = await sql`
        SELECT 
          id, category, name, gender, company, "roleTitle", "assignedZone",
          "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
          "idType", "idNumber", "voterId", "profileImage", phone, email, status,
          "accreditationCode", "qrCodeData", "reviewedBy", "reviewedAt", notes,
          "createdAt", "updatedAt"
        FROM media_accreditations
        WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
          AND (${categoryFilter}::text IS NULL OR UPPER(category) = UPPER(${categoryFilter}))
          AND (${searchFilter}::text IS NULL OR (
            LOWER(name) LIKE ${searchFilter}
            OR LOWER("accreditationCode") LIKE ${searchFilter}
            OR LOWER(company) LIKE ${searchFilter}
            OR LOWER(region) LIKE ${searchFilter}
            OR LOWER("idNumber") LIKE ${searchFilter}
            OR LOWER(COALESCE("voterId", '')) LIKE ${searchFilter}
            OR LOWER(COALESCE(phone, '')) LIKE ${searchFilter}
            OR LOWER(COALESCE(email, '')) LIKE ${searchFilter}
          ))
        ORDER BY 
          CASE WHEN status = 'PENDING' THEN 1 ELSE 2 END,
          "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `;

      const countRows = await sql`
        SELECT COUNT(*)::int as total
        FROM media_accreditations
        WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
          AND (${categoryFilter}::text IS NULL OR UPPER(category) = UPPER(${categoryFilter}))
          AND (${searchFilter}::text IS NULL OR (
            LOWER(name) LIKE ${searchFilter}
            OR LOWER("accreditationCode") LIKE ${searchFilter}
            OR LOWER(company) LIKE ${searchFilter}
            OR LOWER(region) LIKE ${searchFilter}
            OR LOWER("idNumber") LIKE ${searchFilter}
            OR LOWER(COALESCE("voterId", '')) LIKE ${searchFilter}
            OR LOWER(COALESCE(phone, '')) LIKE ${searchFilter}
            OR LOWER(COALESCE(email, '')) LIKE ${searchFilter}
          ));
      `;

      return {
        items,
        total: Number(countRows[0]?.total || 0),
        stats: statsRows[0] || {},
        categoryBreakdown: categoryCountsRows || [],
      };
    });

    return NextResponse.json({
      success: true,
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      stats: result.stats,
      categoryBreakdown: result.categoryBreakdown,
    });
  } catch (error: any) {
    console.error("[ADMIN ACCREDITATION GET] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const {
      category = "MEDIA",
      name,
      gender,
      company,
      roleTitle,
      assignedZone,
      serviceNumber,
      emergencyContact,
      region,
      street,
      ghanaPostAddress,
      idType = "ghana-card",
      idNumber,
      profileImage,
      phone,
      email,
      voterId,
      status = "APPROVED",
      notes,
    } = body;

    if (!name || !gender || !company || !region || !idNumber) {
      return NextResponse.json({ error: "Name, gender, company, region, and ID number are required." }, { status: 400 });
    }

    const result = await mediaAccreditationService.submitAccreditation({
      category: String(category).toUpperCase(),
      name: String(name).trim(),
      gender: String(gender).trim(),
      company: String(company).trim(),
      roleTitle: roleTitle ? String(roleTitle).trim() : null,
      assignedZone: assignedZone ? String(assignedZone).trim() : null,
      serviceNumber: serviceNumber ? String(serviceNumber).trim() : null,
      emergencyContact: emergencyContact ? String(emergencyContact).trim() : null,
      region: String(region).trim(),
      street: street ? String(street).trim() : "Accreditation Center",
      ghanaPostAddress: ghanaPostAddress ? String(ghanaPostAddress).trim().toUpperCase() : "HQ-001-0000",
      idType: String(idType).trim(),
      idNumber: String(idNumber).trim(),
      profileImage: profileImage || null,
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      voterId: voterId ? String(voterId).trim() : null,
    });

    // If status should be directly APPROVED
    if (status === "APPROVED") {
      await withEcSql(async (sql) => {
        await sql`
          UPDATE media_accreditations
          SET status = 'APPROVED',
              "reviewedBy" = ${session.user.name || session.user.email},
              "reviewedAt" = CURRENT_TIMESTAMP,
              notes = ${notes || "Manually issued on-site by administrator."}
          WHERE id = ${result.accreditation.id};
        `;
      });
      result.accreditation.status = "APPROVED";
    }

    await logAuditEvent({
      actorId: session.user.id,
      action: "ACCREDITATION_ISSUED",
      resource: "media_accreditations",
      resourceId: result.accreditation.id,
      metadata: {
        code: result.accreditation.accreditationCode,
        category: result.accreditation.category,
        name: result.accreditation.name,
        company: result.accreditation.company,
      },
      req: request,
    });

    return NextResponse.json({
      success: true,
      accreditation: result.accreditation,
      message: "Accreditation issued successfully.",
    });
  } catch (error: any) {
    console.error("[ADMIN ACCREDITATION POST] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create accreditation" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.id || !body.status) {
      return NextResponse.json({ error: "Missing id or status in request." }, { status: 400 });
    }

    const { id, status, notes, assignedZone } = body;
    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    const updated = await withEcSql(async (sql) => {
      const rows = await sql`
        UPDATE media_accreditations
        SET 
          status = ${status},
          "reviewedBy" = ${session.user.name || session.user.email},
          "reviewedAt" = CURRENT_TIMESTAMP,
          notes = COALESCE(${notes !== undefined ? notes : null}, notes),
          "assignedZone" = COALESCE(${assignedZone !== undefined ? assignedZone : null}, "assignedZone"),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *;
      `;
      return rows[0] || null;
    });

    if (!updated) {
      return NextResponse.json({ error: "Accreditation record not found." }, { status: 404 });
    }

    await logAuditEvent({
      actorId: session.user.id,
      action: `ACCREDITATION_${status}`,
      resource: "media_accreditations",
      resourceId: id,
      metadata: {
        code: updated.accreditationCode,
        name: updated.name,
        status,
        notes,
      },
      req: request,
    });

    return NextResponse.json({
      success: true,
      accreditation: updated,
      message: `Accreditation status updated to ${status}.`,
    });
  } catch (error: any) {
    console.error("[ADMIN ACCREDITATION PATCH] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update accreditation." }, { status: 500 });
  }
}
