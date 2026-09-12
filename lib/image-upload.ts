import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const UPLOAD_DIR = path.resolve(process.cwd(), "public", "cdn", "executives");
const MAX_FILE_SIZE = 8 * 1024 * 1024;

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ExecutiveImageUpload = {
  imageUrl: string;
  filename: string;
  size: number;
  storage: "wordpress" | "local";
  wordpressMediaId?: number;
};

function getImageExtension(file: File | Blob): string {
  const extension = ALLOWED_MIME_TYPES[file.type?.toLowerCase() || ""];
  if (!extension) {
    throw new Error("Invalid image format. Supported formats: JPG, PNG and WEBP.");
  }
  return extension;
}

function verifyImageSignature(buffer: Buffer, extension: string): void {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  const valid = extension === "jpg" ? isJpeg : extension === "png" ? isPng : isWebp;
  if (!valid) throw new Error("The uploaded file content does not match its image format.");
}

function buildFilename(voterId: string | null | undefined, extension: string, prefix?: string): string {
  const cleanVoterId = (voterId || "").replace(/[^a-zA-Z0-9]/g, "");
  const cleanPrefix = (prefix || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const baseName = cleanVoterId || cleanPrefix || "executive";
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return `${baseName}-${uniqueSuffix}.${extension}`;
}

function getWordPressConfig() {
  const siteUrl = process.env.WORDPRESS_URL?.trim().replace(/\/+$/, "");
  const username = process.env.WORDPRESS_USERNAME?.trim();
  const applicationPassword = process.env.WORDPRESS_APPLICATION_PASSWORD?.replace(/\s/g, "");

  if (!siteUrl || !username || !applicationPassword) {
    throw new Error(
      "WordPress image storage is not configured. Set WORDPRESS_URL, WORDPRESS_USERNAME and WORDPRESS_APPLICATION_PASSWORD."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    throw new Error("WORDPRESS_URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("WORDPRESS_URL must use HTTPS.");

  return { siteUrl, username, applicationPassword };
}

type WordPressMediaPayload = {
  id?: unknown;
  source_url?: unknown;
  url?: unknown;
  message?: unknown;
  guid?: { rendered?: unknown };
  media_details?: { sizes?: { full?: { source_url?: unknown } } };
  data?: unknown;
};

function unwrapMediaPayload(payload: unknown): WordPressMediaPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as WordPressMediaPayload;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as WordPressMediaPayload;
  }
  return root;
}

function validPublicUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function extractMediaUrl(media: WordPressMediaPayload | null): string | null {
  if (!media) return null;
  return (
    validPublicUrl(media.source_url) ||
    validPublicUrl(media.media_details?.sizes?.full?.source_url) ||
    validPublicUrl(media.guid?.rendered) ||
    validPublicUrl(media.url)
  );
}

function extractMediaId(media: WordPressMediaPayload | null, location: string | null): number | null {
  const parsedId = typeof media?.id === "number" ? media.id : Number(media?.id);
  if (Number.isSafeInteger(parsedId) && parsedId > 0) return parsedId;
  const locationMatch = location?.match(/\/media\/(\d+)(?:[/?#]|$)/);
  return locationMatch ? Number(locationMatch[1]) : null;
}

async function fetchMediaDetails(
  endpoint: string,
  authorization: string
): Promise<WordPressMediaPayload | null> {
  try {
    const separator = endpoint.includes("?") ? "&" : "?";
    const response = await fetch(
      `${endpoint}${separator}_fields=id,source_url,guid,media_details`,
      {
        headers: { Authorization: `Basic ${authorization}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!response.ok) return null;
    return unwrapMediaPayload(await response.json());
  } catch {
    return null;
  }
}

async function uploadToWordPress(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  fileSize: number
): Promise<ExecutiveImageUpload> {
  const { siteUrl, username, applicationPassword } = getWordPressConfig();
  const authorization = Buffer.from(`${username}:${applicationPassword}`).toString("base64");
  const requestBody = new Uint8Array(buffer.byteLength);
  requestBody.set(buffer);

  let response: Response;
  try {
    response = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: "application/json",
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: requestBody,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network error";
    throw new Error(`Unable to reach WordPress media storage: ${detail}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  let media = unwrapMediaPayload(payload);
  if (!response.ok) {
    const detail = typeof media?.message === "string" ? media.message : `HTTP ${response.status}`;
    throw new Error(`WordPress image upload failed: ${detail}`);
  }

  const location = response.headers.get("location");
  const mediaId = extractMediaId(media, location);
  let imageUrl = extractMediaUrl(media);

  // Some WordPress hosts and CDN plugins return only an attachment ID or a
  // Location header from the create request. Fetch the completed attachment
  // once so its generated source URL can be resolved.
  if (!imageUrl && (mediaId || location)) {
    const detailEndpoint = mediaId
      ? `${siteUrl}/wp-json/wp/v2/media/${mediaId}`
      : location!;
    const details = await fetchMediaDetails(detailEndpoint, authorization);
    if (details) {
      media = details;
      imageUrl = extractMediaUrl(details);
    }
  }

  if (!imageUrl) {
    const keys = media ? Object.keys(media).slice(0, 12).join(", ") : "non-JSON response";
    throw new Error(
      `WordPress created the media item but no public image URL could be resolved. Response fields: ${keys}. Check that the REST API exposes source_url and that the attachment is public.`
    );
  }

  return {
    imageUrl,
    filename,
    size: fileSize,
    storage: "wordpress",
    ...(mediaId ? { wordpressMediaId: mediaId } : {}),
  };
}

async function saveLocally(buffer: Buffer, filename: string, fileSize: number): Promise<ExecutiveImageUpload> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return {
    imageUrl: `/cdn/executives/${filename}`,
    filename,
    size: fileSize,
    storage: "local",
  };
}

/**
 * Uploads executive images to WordPress by default. Local storage is available
 * only as an explicit development override and is rejected on Vercel.
 * All uploaded images are converted to optimized .webp before storage.
 */
export async function saveUploadedExecutiveImage(
  file: File | Blob,
  voterId?: string | null,
  prefix?: string
): Promise<ExecutiveImageUpload> {
  if (file.size <= 0) throw new Error("The image file is empty.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Image file size exceeds the 8MB limit.");

  const extension = getImageExtension(file);
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  verifyImageSignature(rawBuffer, extension);

  // Convert image to optimized WebP, respecting EXIF orientation
  const webpBuffer = await sharp(rawBuffer)
    .rotate()
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const filename = buildFilename(voterId, "webp", prefix);
  const fileSize = webpBuffer.byteLength;

  if (process.env.EXECUTIVE_IMAGE_STORAGE?.toLowerCase() === "local") {
    if (process.env.VERCEL) {
      throw new Error("Local executive image storage cannot be used on Vercel. Configure WordPress storage instead.");
    }
    return saveLocally(webpBuffer, filename, fileSize);
  }

  return uploadToWordPress(webpBuffer, filename, "image/webp", fileSize);
}
