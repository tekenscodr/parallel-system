import { NextRequest, NextResponse } from "next/server";
import { resolveAlbumImage } from "@/lib/album-images";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    if (!canAccessAlbums(session.user)) return new NextResponse("Forbidden", { status: 403 });

    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");
    const width = parseInt(searchParams.get("w") || "240", 10);
    const height = parseInt(searchParams.get("h") || "300", 10);
    const quality = parseInt(searchParams.get("q") || "80", 10);

    if (!imageUrl || imageUrl.trim().length < 5) {
      return new NextResponse("Missing or invalid image URL", { status: 400 });
    }

    const webpBuffer = await resolveAlbumImage(imageUrl, width, height, quality);
    if (!webpBuffer) {
      return new NextResponse("Image could not be retrieved", { status: 404 });
    }

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("WebP image optimization error:", error);
    return new NextResponse("Image conversion failed", { status: 500 });
  }
}
