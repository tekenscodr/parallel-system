import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { ensureMediaAccreditationTableExists } from "@/lib/media-accreditation";
import {
  formatMediaAccreditationTextReport,
  sanitizePersonNameForFile,
} from "@/lib/media-accreditation-images";

export const dynamic = "force-dynamic";

function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureMediaAccreditationTableExists();

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "xlsx").trim().toLowerCase();
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "MEDIA";
    const status = searchParams.get("status")?.trim() || "ALL";
    const company = searchParams.get("company")?.trim() || "ALL";
    const region = searchParams.get("region")?.trim() || "ALL";
    const hasPhoto = searchParams.get("hasPhoto")?.trim() || "ALL";

    const categoryFilter =
      category && category.toUpperCase() !== "ALL" ? category.toUpperCase() : null;
    const statusFilter =
      status && status.toUpperCase() !== "ALL" ? status.toUpperCase() : null;
    const companyFilter = company && company !== "ALL" ? company : null;
    const regionFilter = region && region !== "ALL" ? region : null;
    const photoMode =
      hasPhoto === "WITH_PHOTO"
        ? "WITH_PHOTO"
        : hasPhoto === "MISSING_PHOTO"
        ? "MISSING_PHOTO"
        : null;
    const searchPattern = search ? `%${search.toLowerCase()}%` : null;

    const rows = await withEcSql(async (sql) => {
      return await sql`
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
        ORDER BY name ASC, "createdAt" ASC;
      `;
    });

    const catTag = categoryFilter || "All_Categories";

    if (format === "txt") {
      const usedNames = new Set<string>();
      const enriched = rows.map((r: any) => {
        const hasImg = Boolean(r.profileImage && String(r.profileImage).trim());
        let imageFilename = "NO_PHOTO";
        if (hasImg) {
          const personName = sanitizePersonNameForFile(r.name, "Applicant");
          let candidate = `${personName}.jpg`;
          let counter = 2;
          while (usedNames.has(candidate.toLowerCase())) {
            candidate = `${personName} (${counter}).jpg`;
            counter++;
          }
          usedNames.add(candidate.toLowerCase());
          imageFilename = candidate;
        }
        return {
          ...r,
          imageFilename,
        };
      });

      const txtBody = formatMediaAccreditationTextReport(enriched);
      return new NextResponse(txtBody, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="media_accreditation_data.txt"`,
        },
      });
    }

    if (format === "json") {
      return new NextResponse(JSON.stringify({ count: rows.length, records: rows }, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="NPP_${catTag}_Accreditation_Data_2026.json"`,
        },
      });
    }

    if (format === "csv") {
      const headers = [
        "No.",
        "Accreditation Code",
        "Category",
        "Full Name",
        "Gender",
        "Media House / Organization",
        "Role / Designation",
        "Phone",
        "Email",
        "ID Type",
        "ID Number",
        "Voter ID",
        "Region",
        "Street Address",
        "GhanaPost GPS",
        "Assigned Zone",
        "Service Number",
        "Emergency Contact",
        "Status",
        "Has Photo",
        "Photo URL",
        "Reviewed By",
        "Notes",
        "Submitted At",
      ];

      const csvLines = [
        headers.map(escapeCsvCell).join(","),
        ...rows.map((r: any, idx: number) => {
          const hasImg = Boolean(r.profileImage && String(r.profileImage).trim());
          const photoUrlDisplay = !hasImg
            ? ""
            : String(r.profileImage).startsWith("data:")
            ? `[Base64 Embedded Image - ID: ${r.id}]`
            : String(r.profileImage);

          return [
            idx + 1,
            r.accreditationCode || "",
            r.category || "",
            r.name || "",
            r.gender || "",
            r.company || "",
            r.roleTitle || "",
            r.phone || "",
            r.email || "",
            r.idType || "",
            r.idNumber || "",
            r.voterId || "",
            r.region || "",
            r.street || "",
            r.ghanaPostAddress || "",
            r.assignedZone || "",
            r.serviceNumber || "",
            r.emergencyContact || "",
            r.status || "",
            hasImg ? "YES" : "NO",
            photoUrlDisplay,
            r.reviewedBy || "",
            r.notes || "",
            r.createdAt ? new Date(r.createdAt).toISOString() : "",
          ]
            .map(escapeCsvCell)
            .join(",");
        }),
      ];

      const csvBody = "\uFEFF" + csvLines.join("\r\n");
      return new NextResponse(csvBody, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="NPP_${catTag}_Accreditation_Data_2026.csv"`,
        },
      });
    }

    // Default: Rich Excel (.xlsx) export
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NPP National Secretariat • Accreditation Directorate";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Media Accreditation Registry", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "No.", key: "no", width: 7 },
      { header: "Accreditation Code", key: "accreditationCode", width: 20 },
      { header: "Category", key: "category", width: 16 },
      { header: "Full Name", key: "name", width: 28 },
      { header: "Gender", key: "gender", width: 11 },
      { header: "Media House / Organization", key: "company", width: 32 },
      { header: "Role / Designation", key: "roleTitle", width: 24 },
      { header: "Phone Number", key: "phone", width: 16 },
      { header: "Email Address", key: "email", width: 28 },
      { header: "ID Type", key: "idType", width: 15 },
      { header: "ID Number", key: "idNumber", width: 22 },
      { header: "Voter ID", key: "voterId", width: 16 },
      { header: "Region", key: "region", width: 18 },
      { header: "Street Address", key: "street", width: 26 },
      { header: "GhanaPost GPS", key: "ghanaPostAddress", width: 18 },
      { header: "Assigned Zone", key: "assignedZone", width: 22 },
      { header: "Service No.", key: "serviceNumber", width: 16 },
      { header: "Emergency Contact", key: "emergencyContact", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Photo Uploaded", key: "hasPhoto", width: 15 },
      { header: "Photo URL", key: "photoUrl", width: 45 },
      { header: "Submitted At", key: "createdAt", width: 22 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "left" };
    headerRow.height = 26;

    rows.forEach((r: any, idx: number) => {
      const hasImg = Boolean(r.profileImage && String(r.profileImage).trim());
      const photoUrlDisplay = !hasImg
        ? ""
        : String(r.profileImage).startsWith("data:")
        ? "[Embedded Base64 Photo]"
        : String(r.profileImage);

      const row = sheet.addRow({
        no: idx + 1,
        accreditationCode: r.accreditationCode || "",
        category: r.category || "",
        name: r.name || "",
        gender: r.gender || "",
        company: r.company || "",
        roleTitle: r.roleTitle || "",
        phone: r.phone || "",
        email: r.email || "",
        idType: r.idType || "",
        idNumber: r.idNumber || "",
        voterId: r.voterId || "",
        region: r.region || "",
        street: r.street || "",
        ghanaPostAddress: r.ghanaPostAddress || "",
        assignedZone: r.assignedZone || "",
        serviceNumber: r.serviceNumber || "",
        emergencyContact: r.emergencyContact || "",
        status: r.status || "",
        hasPhoto: hasImg ? "YES" : "NO",
        photoUrl: photoUrlDisplay,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19) : "",
      });

      if (hasImg && /^https?:\/\//i.test(photoUrlDisplay)) {
        const cell = row.getCell("photoUrl");
        cell.value = {
          text: photoUrlDisplay,
          hyperlink: photoUrlDisplay,
        };
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }
    });

    // Summary sheet by Media House
    const summarySheet = workbook.addWorksheet("By Media House");
    summarySheet.columns = [
      { header: "No.", key: "no", width: 8 },
      { header: "Media House / Organization", key: "company", width: 38 },
      { header: "Total Applicants", key: "total", width: 18 },
      { header: "With Photos", key: "withPhoto", width: 16 },
      { header: "Missing Photos", key: "missingPhoto", width: 16 },
      { header: "Approved", key: "approved", width: 14 },
      { header: "Pending", key: "pending", width: 14 },
    ];
    const sumHeader = summarySheet.getRow(1);
    sumHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    sumHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    sumHeader.height = 24;

    const byCompany = new Map<
      string,
      { total: number; withPhoto: number; approved: number; pending: number }
    >();
    for (const r of rows as any[]) {
      const comp = (r.company || "Unspecified").trim();
      const entry = byCompany.get(comp) || {
        total: 0,
        withPhoto: 0,
        approved: 0,
        pending: 0,
      };
      entry.total++;
      if (r.profileImage && String(r.profileImage).trim()) entry.withPhoto++;
      if (r.status === "APPROVED") entry.approved++;
      if (r.status === "PENDING") entry.pending++;
      byCompany.set(comp, entry);
    }

    Array.from(byCompany.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([comp, st], i) => {
        summarySheet.addRow({
          no: i + 1,
          company: comp,
          total: st.total,
          withPhoto: st.withPhoto,
          missingPhoto: st.total - st.withPhoto,
          approved: st.approved,
          pending: st.pending,
        });
      });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="NPP_${catTag}_Accreditation_Data_2026.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[ADMIN MEDIA ACCREDITATION EXPORT] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export media accreditation data." },
      { status: 500 }
    );
  }
}
