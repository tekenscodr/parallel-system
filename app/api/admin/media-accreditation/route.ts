import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { ensureMediaAccreditationTableExists } from "@/lib/media-accreditation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureMediaAccreditationTableExists();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "MEDIA";
    const status = searchParams.get("status")?.trim() || "ALL";
    const company = searchParams.get("company")?.trim() || "ALL";
    const region = searchParams.get("region")?.trim() || "ALL";
    const hasPhoto = searchParams.get("hasPhoto")?.trim() || "ALL"; // ALL | WITH_PHOTO | MISSING_PHOTO
    const pageParam = searchParams.get("page") || "1";
    const limitParam = searchParams.get("limit") || "100";

    const isAllLimit = limitParam.toUpperCase() === "ALL" || limitParam === "0";
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = isAllLimit ? 10000 : Math.min(5000, Math.max(1, parseInt(limitParam, 10) || 100));
    const offset = isAllLimit ? 0 : (page - 1) * limit;

    const categoryFilter = category && category.toUpperCase() !== "ALL" ? category.toUpperCase() : null;
    const statusFilter = status && status.toUpperCase() !== "ALL" ? status.toUpperCase() : null;
    const companyFilter = company && company !== "ALL" ? company : null;
    const regionFilter = region && region !== "ALL" ? region : null;
    const photoMode =
      hasPhoto === "WITH_PHOTO"
        ? "WITH_PHOTO"
        : hasPhoto === "MISSING_PHOTO"
        ? "MISSING_PHOTO"
        : null;
    const searchPattern = search ? `%${search.toLowerCase()}%` : null;

    const result = await withEcSql(async (sql) => {
      // 1. Overall & Media-specific statistics
      const statsRows = await sql`
        SELECT
          COUNT(*)::int AS total_all,
          COUNT(*) FILTER (WHERE UPPER(category) = 'MEDIA')::int AS media_total,
          COUNT(*) FILTER (
            WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
          )::int AS scoped_total,
          COUNT(*) FILTER (
            WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
              AND "profileImage" IS NOT NULL AND TRIM("profileImage") <> ''
          )::int AS with_photo,
          COUNT(*) FILTER (
            WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
              AND ("profileImage" IS NULL OR TRIM("profileImage") = '')
          )::int AS missing_photo,
          COUNT(*) FILTER (
            WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
              AND status = 'APPROVED'
          )::int AS approved,
          COUNT(*) FILTER (
            WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
              AND status = 'PENDING'
          )::int AS pending,
          COUNT(*) FILTER (
            WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
              AND status = 'REJECTED'
          )::int AS rejected,
          COUNT(DISTINCT TRIM(company)) FILTER (
            WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
          )::int AS distinct_companies
        FROM media_accreditations;
      `;

      // 2. Breakdown by Media House / Organization (within selected category scope)
      const companyBreakdown = await sql`
        SELECT
          TRIM(company) AS company,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "profileImage" IS NOT NULL AND TRIM("profileImage") <> '')::int AS with_photo,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending
        FROM media_accreditations
        WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
        GROUP BY TRIM(company)
        ORDER BY total DESC, company ASC;
      `;

      // 3. Breakdown by Region
      const regionBreakdown = await sql`
        SELECT
          TRIM(region) AS region,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "profileImage" IS NOT NULL AND TRIM("profileImage") <> '')::int AS with_photo
        FROM media_accreditations
        WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
        GROUP BY TRIM(region)
        ORDER BY total DESC, region ASC;
      `;

      // 4. Breakdown by Category
      const categoryBreakdown = await sql`
        SELECT
          UPPER(category) AS category,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "profileImage" IS NOT NULL AND TRIM("profileImage") <> '')::int AS with_photo
        FROM media_accreditations
        GROUP BY UPPER(category)
        ORDER BY total DESC;
      `;

      // 5. Filtered rows query
      const items = await sql`
        SELECT
          id,
          category,
          name,
          gender,
          company,
          "roleTitle",
          "assignedZone",
          "serviceNumber",
          "emergencyContact",
          region,
          street,
          "ghanaPostAddress",
          "idType",
          "idNumber",
          "voterId",
          "profileImage",
          phone,
          email,
          status,
          "accreditationCode",
          "qrCodeData",
          "reviewedBy",
          "reviewedAt",
          notes,
          "createdAt",
          "updatedAt"
        FROM media_accreditations
        WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
          AND (${statusFilter}::text IS NULL OR UPPER(status) = ${statusFilter})
          AND (${companyFilter}::text IS NULL OR LOWER(TRIM(company)) = LOWER(TRIM(${companyFilter})))
          AND (${regionFilter}::text IS NULL OR LOWER(TRIM(region)) = LOWER(TRIM(${regionFilter})))
          AND (
            ${photoMode}::text IS NULL
            OR (${photoMode} = 'WITH_PHOTO' AND "profileImage" IS NOT NULL AND TRIM("profileImage") <> '')
            OR (${photoMode} = 'MISSING_PHOTO' AND ("profileImage" IS NULL OR TRIM("profileImage") = ''))
          )
          AND (
            ${searchPattern}::text IS NULL
            OR LOWER(name) LIKE ${searchPattern}
            OR LOWER("accreditationCode") LIKE ${searchPattern}
            OR LOWER(company) LIKE ${searchPattern}
            OR LOWER(COALESCE("roleTitle", '')) LIKE ${searchPattern}
            OR LOWER(region) LIKE ${searchPattern}
            OR LOWER(street) LIKE ${searchPattern}
            OR LOWER("ghanaPostAddress") LIKE ${searchPattern}
            OR LOWER("idNumber") LIKE ${searchPattern}
            OR LOWER(COALESCE("voterId", '')) LIKE ${searchPattern}
            OR LOWER(COALESCE(phone, '')) LIKE ${searchPattern}
            OR LOWER(COALESCE(email, '')) LIKE ${searchPattern}
          )
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `;

      const countRows = await sql`
        SELECT COUNT(*)::int AS total
        FROM media_accreditations
        WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
          AND (${statusFilter}::text IS NULL OR UPPER(status) = ${statusFilter})
          AND (${companyFilter}::text IS NULL OR LOWER(TRIM(company)) = LOWER(TRIM(${companyFilter})))
          AND (${regionFilter}::text IS NULL OR LOWER(TRIM(region)) = LOWER(TRIM(${regionFilter})))
          AND (
            ${photoMode}::text IS NULL
            OR (${photoMode} = 'WITH_PHOTO' AND "profileImage" IS NOT NULL AND TRIM("profileImage") <> '')
            OR (${photoMode} = 'MISSING_PHOTO' AND ("profileImage" IS NULL OR TRIM("profileImage") = ''))
          )
          AND (
            ${searchPattern}::text IS NULL
            OR LOWER(name) LIKE ${searchPattern}
            OR LOWER("accreditationCode") LIKE ${searchPattern}
            OR LOWER(company) LIKE ${searchPattern}
            OR LOWER(COALESCE("roleTitle", '')) LIKE ${searchPattern}
            OR LOWER(region) LIKE ${searchPattern}
            OR LOWER(street) LIKE ${searchPattern}
            OR LOWER("ghanaPostAddress") LIKE ${searchPattern}
            OR LOWER("idNumber") LIKE ${searchPattern}
            OR LOWER(COALESCE("voterId", '')) LIKE ${searchPattern}
            OR LOWER(COALESCE(phone, '')) LIKE ${searchPattern}
            OR LOWER(COALESCE(email, '')) LIKE ${searchPattern}
          );
      `;

      return {
        items,
        total: Number(countRows[0]?.total || 0),
        stats: statsRows[0] || {},
        companyBreakdown: companyBreakdown || [],
        regionBreakdown: regionBreakdown || [],
        categoryBreakdown: categoryBreakdown || [],
      };
    });

    return NextResponse.json({
      success: true,
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
      stats: result.stats,
      companyBreakdown: result.companyBreakdown,
      regionBreakdown: result.regionBreakdown,
      categoryBreakdown: result.categoryBreakdown,
    });
  } catch (error: any) {
    console.error("[ADMIN MEDIA ACCREDITATION GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
