import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { ensureMediaAccreditationTableExists } from "@/lib/media-accreditation";
import {
  resolveAccreditationImageBuffer,
  sanitizePersonNameForFile,
  formatMediaAccreditationTextReport,
  AccreditationPersonRecord,
  buildZipArchive,
  ZipEntryInput,
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
  return handleZipDownload(request, null);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((id: unknown) => String(id).trim()).filter(Boolean)
    : null;
  return handleZipDownload(request, ids);
}

async function handleZipDownload(
  request: NextRequest,
  explicitIds: string[] | null
): Promise<NextResponse> {
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
    const formatParam = (searchParams.get("format")?.trim().toLowerCase() || "jpg") as
      | "webp"
      | "jpg"
      | "jpeg"
      | "png"
      | "original";
    const idsParam = searchParams.get("ids")?.trim() || "";

    const selectedIds =
      explicitIds && explicitIds.length > 0
        ? explicitIds
        : idsParam
        ? idsParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : null;

    const categoryFilter =
      category && category.toUpperCase() !== "ALL" ? category.toUpperCase() : null;
    const statusFilter =
      status && status.toUpperCase() !== "ALL" ? status.toUpperCase() : null;
    const companyFilter = company && company !== "ALL" ? company : null;
    const regionFilter = region && region !== "ALL" ? region : null;
    const searchPattern = search ? `%${search.toLowerCase()}%` : null;

    const records = await withEcSql(async (sql) => {
      if (selectedIds && selectedIds.length > 0) {
        return await sql`
          SELECT
            id, category, name, gender, company, "roleTitle", "assignedZone",
            "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
            "idType", "idNumber", "voterId", "profileImage", phone, email, status,
            "accreditationCode", "createdAt"
          FROM media_accreditations
          WHERE id = ANY(${selectedIds})
          ORDER BY name ASC, "createdAt" ASC;
        `;
      }

      return await sql`
        SELECT
          id, category, name, gender, company, "roleTitle", "assignedZone",
          "serviceNumber", "emergencyContact", region, street, "ghanaPostAddress",
          "idType", "idNumber", "voterId", "profileImage", phone, email, status,
          "accreditationCode", "createdAt"
        FROM media_accreditations
        WHERE (${categoryFilter}::text IS NULL OR UPPER(category) = ${categoryFilter})
          AND (${statusFilter}::text IS NULL OR UPPER(status) = ${statusFilter})
          AND (${companyFilter}::text IS NULL OR LOWER(TRIM(company)) = LOWER(TRIM(${companyFilter})))
          AND (${regionFilter}::text IS NULL OR LOWER(TRIM(region)) = LOWER(TRIM(${regionFilter})))
          AND (
            ${searchPattern}::text IS NULL
            OR LOWER(name) LIKE ${searchPattern}
            OR LOWER("accreditationCode") LIKE ${searchPattern}
            OR LOWER(company) LIKE ${searchPattern}
            OR LOWER(COALESCE("roleTitle", '')) LIKE ${searchPattern}
            OR LOWER(region) LIKE ${searchPattern}
            OR LOWER("idNumber") LIKE ${searchPattern}
            OR LOWER(COALESCE(phone, '')) LIKE ${searchPattern}
            OR LOWER(COALESCE(email, '')) LIKE ${searchPattern}
          )
        ORDER BY name ASC, "createdAt" ASC;
      `;
    });

    const rootFolder = "media_accreditation_photos";
    const zipEntries: ZipEntryInput[] = [];
    const usedFilenames = new Set<string>();
    const enrichedRecords: AccreditationPersonRecord[] = [];
    const manifestRows: string[][] = [
      [
        "Image Filename",
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
        "Status",
        "Original Photo URL",
        "Submitted At",
      ],
    ];

    // Process images in parallel batches of 8 for high throughput
    const concurrency = 8;
    for (let i = 0; i < records.length; i += concurrency) {
      const batch = records.slice(i, i + concurrency);
      const resolvedBatch = await Promise.all(
        batch.map(async (rec: any) => {
          const resolved = rec.profileImage
            ? await resolveAccreditationImageBuffer(rec.profileImage, formatParam)
            : null;
          return { rec, resolved };
        })
      );

      for (const { rec, resolved } of resolvedBatch) {
        const personName = sanitizePersonNameForFile(rec.name, "Applicant");
        let imageFilename = "NO_PHOTO";

        if (resolved) {
          let candidateName = `${personName}.${resolved.extension}`;
          let counter = 2;
          while (usedFilenames.has(candidateName.toLowerCase())) {
            candidateName = `${personName} (${counter}).${resolved.extension}`;
            counter++;
          }
          usedFilenames.add(candidateName.toLowerCase());
          imageFilename = candidateName;

          zipEntries.push({
            filename: `${rootFolder}/${imageFilename}`,
            data: resolved.buffer,
            modifiedAt: rec.createdAt ? new Date(rec.createdAt) : new Date(),
          });
        } else if (rec.profileImage) {
          imageFilename = "MISSING_OR_UNREACHABLE";
        }

        enrichedRecords.push({
          ...rec,
          imageFilename,
        });

        manifestRows.push([
          imageFilename,
          rec.accreditationCode || "",
          rec.category || "",
          rec.name || "",
          rec.gender || "",
          rec.company || "",
          rec.roleTitle || "",
          rec.phone || "",
          rec.email || "",
          rec.idType || "",
          rec.idNumber || "",
          rec.voterId || "",
          rec.region || "",
          rec.street || "",
          rec.ghanaPostAddress || "",
          rec.assignedZone || "",
          rec.status || "",
          rec.profileImage && !String(rec.profileImage).startsWith("data:")
            ? String(rec.profileImage)
            : rec.profileImage
            ? "[Embedded Base64 Image]"
            : "",
          rec.createdAt ? new Date(rec.createdAt).toISOString() : "",
        ]);
      }
    }

    // 1. Add plain-text file containing all data of all people
    const txtReport = formatMediaAccreditationTextReport(enrichedRecords);
    zipEntries.unshift({
      filename: `${rootFolder}/media_accreditation_data.txt`,
      data: Buffer.from(txtReport, "utf8"),
      modifiedAt: new Date(),
    });

    // 2. Add CSV manifest inside the folder as well
    const csvContent =
      "\uFEFF" +
      manifestRows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    zipEntries.splice(1, 0, {
      filename: `${rootFolder}/media_accreditation_data.csv`,
      data: Buffer.from(csvContent, "utf8"),
      modifiedAt: new Date(),
    });

    const zipBuffer = buildZipArchive(zipEntries);
    const zipFilename = `media_accreditation_photos.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[ADMIN MEDIA ACCREDITATION ZIP] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate images ZIP archive." },
      { status: 500 }
    );
  }
}
