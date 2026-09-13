import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";

export const dynamic = "force-dynamic";

const CACHE_DIR = path.join(process.cwd(), ".cache", "albums", "webp");

// Ensure cache directory exists
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch {
  // Ignore
}

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

    const cleanUrl = imageUrl.trim();

    // Generate unique SHA256 cache key
    const hash = crypto
      .createHash("sha256")
      .update(`${cleanUrl}_${width}_${height}_${quality}`)
      .digest("hex");

    const cacheFilePath = path.join(CACHE_DIR, `${hash}.webp`);

    // 1. Return from disk cache if already converted
    if (fs.existsSync(cacheFilePath)) {
      const cachedBuffer = fs.readFileSync(cacheFilePath);
      return new NextResponse(new Uint8Array(cachedBuffer), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
          "X-Album-Image-Cache": "HIT",
        },
      });
    }

    // 2. Fetch or read source image buffer
    let inputBuffer: Buffer | null = null;

    if (cleanUrl.startsWith("data:image/")) {
      // Base64 data URI
      const commaIdx = cleanUrl.indexOf(",");
      if (commaIdx !== -1) {
        inputBuffer = Buffer.from(cleanUrl.slice(commaIdx + 1), "base64");
      }
    } else if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      // Remote image over HTTP
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(cleanUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
          },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const ab = await res.arrayBuffer();
          inputBuffer = Buffer.from(ab);
        }
      } catch {
        clearTimeout(timeoutId);
      }
    } else {
      // Local file path
      const localPath = cleanUrl.startsWith("/")
        ? path.join(process.cwd(), "public", cleanUrl)
        : path.join(process.cwd(), cleanUrl);

      if (fs.existsSync(localPath)) {
        inputBuffer = fs.readFileSync(localPath);
      }
    }

    if (!inputBuffer || inputBuffer.length < 100) {
      return new NextResponse("Image could not be retrieved", { status: 404 });
    }

    // 3. Convert to WebP using Sharp
    const webpBuffer = await sharp(inputBuffer)
      .resize(width, height, {
        fit: "cover",
        position: "top",
        withoutEnlargement: false,
      })
      .webp({
        quality: Math.min(100, Math.max(20, quality)),
        effort: 4,
      })
      .toBuffer();

    // Save to disk cache asynchronously
    try {
      fs.writeFileSync(cacheFilePath, webpBuffer);
    } catch {
      // Non-fatal if writing to cache fails
    }

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Album-Image-Cache": "MISS",
      },
    });
  } catch (error: any) {
    console.error("WebP image optimization error:", error);
    return new NextResponse("Image conversion failed", { status: 500 });
  }
}
