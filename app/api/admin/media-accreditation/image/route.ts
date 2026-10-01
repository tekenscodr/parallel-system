import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { ensureMediaAccreditationTableExists } from "@/lib/media-accreditation";
import {
  resolveAccreditationImageBuffer,
  sanitizePersonNameForFile,
} from "@/lib/media-accreditation-images";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() || "";
    const directUrl = searchParams.get("url")?.trim() || "";
    const formatParam = (searchParams.get("format")?.trim().toLowerCase() || "original") as
      | "webp"
      | "jpg"
      | "jpeg"
      | "png"
      | "original";
    const isInline = searchParams.get("inline") === "1" || searchParams.get("download") === "0";

    let imageUrl = directUrl;
    let applicantName = searchParams.get("name")?.trim() || "Applicant";

    if (id) {
      await ensureMediaAccreditationTableExists();
      const rows = await withEcSql(async (sql) => {
        return await sql`
          SELECT id, name, company, "accreditationCode", "profileImage"
          FROM media_accreditations
          WHERE id = ${id}
          LIMIT 1
        `;
      });

      if (rows && rows.length > 0) {
        const rec = rows[0];
        if (rec.profileImage) imageUrl = rec.profileImage;
        if (rec.name) applicantName = rec.name;
      }
    }

    if (!imageUrl) {
      return new NextResponse("No profile image found for this record.", { status: 404 });
    }

    const resolved = await resolveAccreditationImageBuffer(imageUrl, formatParam);
    if (!resolved) {
      return new NextResponse("Could not retrieve or decode profile image.", { status: 404 });
    }

    const personName = sanitizePersonNameForFile(applicantName, "Applicant");
    const filename = `${personName}.${resolved.extension}`;

    const headers: Record<string, string> = {
      "Content-Type": resolved.contentType,
      "Content-Length": String(resolved.buffer.length),
    };

    const encodedFilename = encodeURIComponent(filename);
    if (isInline) {
      headers["Content-Disposition"] = `inline; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodedFilename}`;
      headers["Cache-Control"] = "private, max-age=3600, stale-while-revalidate=86400";
    } else {
      headers["Content-Disposition"] = `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodedFilename}`;
      headers["Cache-Control"] = "no-store";
    }

    return new NextResponse(new Uint8Array(resolved.buffer), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[ADMIN MEDIA ACCREDITATION IMAGE] Error:", error);
    return new NextResponse("Failed to process accreditation image", { status: 500 });
  }
}
