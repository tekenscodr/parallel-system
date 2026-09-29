import { NextRequest, NextResponse } from "next/server";
import { resolveAlbumImage } from "@/lib/album-images";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url")?.trim() || "";
    const voterId = searchParams.get("vid")?.trim() || "";
    const width = parseInt(searchParams.get("w") || "240", 10);
    const height = parseInt(searchParams.get("h") || "300", 10);
    const quality = parseInt(searchParams.get("q") || "80", 10);

    const effectiveTarget =
      imageUrl.length >= 5
        ? imageUrl
        : voterId.length >= 5
        ? `voter_${voterId}.webp`
        : "";

    if (!effectiveTarget) {
      return new NextResponse("Missing or invalid image URL", { status: 400 });
    }

    let webpBuffer = await resolveAlbumImage(effectiveTarget, width, height, quality);
    if (!webpBuffer && voterId && voterId.length >= 5 && effectiveTarget !== `voter_${voterId}.webp`) {
      webpBuffer = await resolveAlbumImage(`voter_${voterId}.webp`, width, height, quality);
    }
    if (!webpBuffer) {
      return new NextResponse("Image could not be retrieved", { status: 404 });
    }

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("WebP image optimization error:", error);
    return new NextResponse("Image conversion failed", { status: 500 });
  }
}
