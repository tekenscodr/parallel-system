import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "public", "cdn", "executives");
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Saves an uploaded image file into public/cdn/executives and returns its public URL.
 */
export async function saveUploadedExecutiveImage(
  file: File | Blob,
  voterId?: string | null,
  prefix?: string
): Promise<{ imageUrl: string; filename: string; size: number }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image file size exceeds the 8MB limit.");
  }

  const mime = file.type?.toLowerCase() || "";
  let ext = ALLOWED_MIME_TYPES[mime];

  // If MIME type isn't recognized, check original filename extension
  if (!ext && "name" in file && typeof file.name === "string") {
    const originalExt = path.extname(file.name).toLowerCase().replace(".", "");
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(originalExt)) {
      ext = originalExt === "jpeg" ? "jpg" : originalExt;
    }
  }

  if (!ext) {
    throw new Error("Invalid image format. Supported formats: JPG, PNG, WEBP, GIF.");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const cleanVoterId = (voterId || "").replace(/[^a-zA-Z0-9]/g, "");
  const baseName = cleanVoterId || prefix || "voter";
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const filename = `${baseName}-${uniqueSuffix}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(filePath, buffer);

  const imageUrl = `/cdn/executives/${filename}`;
  return {
    imageUrl,
    filename,
    size: file.size,
  };
}
