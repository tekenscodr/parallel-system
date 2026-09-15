import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthenticatedAdmin(request);
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!canAccessAlbums(session.user)) return new Response("Forbidden", { status: 403 });

  const exportPath = path.join(process.cwd(), "exports", "albums", "NPP_Regional_and_Wings_Statutory_Audit_Statistics_2026.xlsx");
  const rootPath = path.join(process.cwd(), "NPP_Regional_and_Wings_Statutory_Audit_Statistics_2026.xlsx");

  const targetFile = existsSync(exportPath) ? exportPath : existsSync(rootPath) ? rootPath : null;

  if (!targetFile) {
    return new Response(JSON.stringify({ error: "Audit spreadsheet not found. Please run the generation script first." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const fileBuffer = await readFile(targetFile);
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="NPP_Regional_and_Wings_Statutory_Audit_Statistics_2026.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to read audit spreadsheet", details: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
