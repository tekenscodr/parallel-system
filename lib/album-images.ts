import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const cacheDir = path.join(process.cwd(), ".cache", "albums", "webp");
const pending = new Map<string, Promise<Buffer | null>>();

async function readSource(url: string): Promise<Buffer | null> {
  if (url.startsWith("data:image/")) {
    const comma = url.indexOf(",");
    if (comma < 0) return null;
    return /;base64/i.test(url.slice(0, comma))
      ? Buffer.from(url.slice(comma + 1), "base64")
      : Buffer.from(decodeURIComponent(url.slice(comma + 1)));
  }

  if (/^https?:\/\//i.test(url)) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      // Keep the timeout active until the response body finishes downloading.
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
        });
        if (response.ok) return Buffer.from(await response.arrayBuffer());
        await response.body?.cancel();
        if (response.status !== 408 && response.status !== 429 && response.status < 500) return null;
      } catch {
        // Retry temporary connection failures and incomplete downloads.
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    return null;
  }

  // Public URLs may contain escaped spaces, cache-busting queries or fragments.
  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  const publicRoot = path.join(process.cwd(), "public");
  const relative = pathname.replace(/^\/+/, "");
  const roots = pathname.startsWith("/") ? [publicRoot] : [publicRoot, process.cwd()];
  for (const root of roots) {
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep)) continue;
    try { return await fs.readFile(filename); } catch { /* try the next local source */ }
  }
  return null;
}

export async function resolveAlbumImage(
  imageUrl: string | null,
  width = 240,
  height = 300,
  quality = 80,
): Promise<Buffer | null> {
  const url = imageUrl?.trim();
  if (!url) return null;
  if (![width, height, quality].every(Number.isFinite) || width < 1 || height < 1 || width > 2000 || height > 2000) return null;
  quality = Math.min(100, Math.max(20, quality));
  const key = crypto.createHash("sha256").update(`v2_${url}_${width}_${height}_${quality}`).digest("hex");
  const existing = pending.get(key);
  if (existing) return existing;

  const conversion = (async () => {
    const filename = path.join(cacheDir, `${key}.webp`);
    try {
      const cached = await fs.readFile(filename);
      // Fully decode the cache: metadata alone does not detect truncated pixels.
      await sharp(cached).raw().toBuffer();
      return cached;
    } catch { /* Missing or corrupt cache: rebuild from the source. */ }
    try {
      const input = await readSource(url);
      if (!input?.length) return null;
      const output = await sharp(input)
        .rotate()
        .resize(width, height, { fit: "cover", position: "top" })
        .webp({ quality, effort: 4 })
        .toBuffer();
      // Atomic replacement prevents concurrent requests from seeing partial files.
      const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
      try {
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.writeFile(temporary, output);
        await fs.rename(temporary, filename);
      } catch {
        await fs.unlink(temporary).catch(() => {});
      }
      return output;
    } catch {
      return null;
    }
  })();
  pending.set(key, conversion);
  try { return await conversion; } finally { pending.delete(key); }
}
