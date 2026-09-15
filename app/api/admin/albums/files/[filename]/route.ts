import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";

export const dynamic = "force-dynamic";

const albumFiles: Record<string, string> = {
  "ahafo_election_album.html": "text/html; charset=utf-8",
  "ahafo_album_data.json": "application/json",
  "NPP_Ahafo_Region_Election_Album_2026.pdf": "application/pdf",
  "NPP_National_Youth_Organiser_Election_Album_2026.pdf": "application/pdf",
  "NPP_National_Youth_Organiser_Electorate_Directory_2026.pdf": "application/pdf",
  "NPP_Regional_and_Wings_Statutory_Audit_Statistics_2026.xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const session = await getAuthenticatedAdmin(request);
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!canAccessAlbums(session.user)) return new Response("Forbidden", { status: 403 });
  const { filename } = await context.params;
  if (!Object.hasOwn(albumFiles, filename)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(path.join(process.cwd(), "exports", "albums", filename));
    const isAttachment = filename.endsWith(".xlsx") || filename.endsWith(".pdf");
    return new Response(file, {
      headers: {
        "Content-Type": albumFiles[filename],
        "Content-Disposition": isAttachment ? `attachment; filename="${filename}"` : "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Album not found", { status: 404 });
    throw error;
  }
}
