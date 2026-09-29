import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const cacheDir = path.join(process.cwd(), ".cache", "albums", "webp");
const pending = new Map<string, Promise<Buffer | null>>();

let _indexesLoaded = false;
const syncUrlByVoterId = new Map<string, string>();
const ahafoBase64ByVoterId = new Map<string, string>();
const localFileByVoterId = new Map<string, string>();
const localFileByFilename = new Map<string, string>();

function extractVoterIdFromText(text: string): string | null {
  const m = text.match(/(?:^|[^0-9])(\d{8,10})(?:[^0-9]|$)/);
  return m ? m[1] : null;
}

function indexDirectorySync(dir: string) {
  if (!fsSync.existsSync(dir)) return;
  try {
    const entries = fsSync.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        indexDirectorySync(fullPath);
      } else if (/\.(webp|jpg|jpeg|png)$/i.test(entry.name)) {
        localFileByFilename.set(entry.name.toLowerCase(), fullPath);
        const vid = extractVoterIdFromText(entry.name);
        if (vid) {
          localFileByVoterId.set(vid, fullPath);
          localFileByVoterId.set(vid.replace(/^0+/, ""), fullPath);
        }
      }
    }
  } catch {
    // Non-fatal
  }
}

function ensureAuxiliaryIndexes() {
  if (_indexesLoaded) return;
  _indexesLoaded = true;

  indexDirectorySync(path.join(process.cwd(), "public", "cdn"));
  indexDirectorySync(path.join(process.cwd(), "outputs", "wocom_2026", "portraits"));

  try {
    const syncPath = path.join(process.cwd(), "scratch", "sync_progress.json");
    if (fsSync.existsSync(syncPath)) {
      const data = JSON.parse(fsSync.readFileSync(syncPath, "utf8"));
      for (const [rawVid, url] of Object.entries(data)) {
        if (typeof url === "string" && url.startsWith("http")) {
          const cleanVid = String(rawVid).trim();
          syncUrlByVoterId.set(cleanVid, url.trim());
          syncUrlByVoterId.set(cleanVid.replace(/^0+/, ""), url.trim());
          if (cleanVid.length < 10) {
            syncUrlByVoterId.set(cleanVid.padStart(10, "0"), url.trim());
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    const candidatePaths = [
      path.join(process.cwd(), "exports/albums/ahafo_album_data.json"),
      path.join(process.cwd(), "public/exports/ahafo_album_data.json"),
      path.join(process.cwd(), "outputs/albums/ahafo_album_data.json"),
    ];
    const ahafoPath = candidatePaths.find((p) => fsSync.existsSync(p));
    if (ahafoPath) {
      const ahafoData = JSON.parse(fsSync.readFileSync(ahafoPath, "utf8"));
      const indexItem = (d: any) => {
        if (d?.photo_base64 && typeof d.photo_base64 === "string" && d.photo_base64.startsWith("data:image/")) {
          const vid = d.voter_id ? String(d.voter_id).trim() : "";
          if (vid.length > 3) {
            ahafoBase64ByVoterId.set(vid, d.photo_base64);
            ahafoBase64ByVoterId.set(vid.replace(/^0+/, ""), d.photo_base64);
          }
        }
      };
      if (Array.isArray(ahafoData.regionalExecutives)) ahafoData.regionalExecutives.forEach(indexItem);
      if (Array.isArray(ahafoData.constituencies)) {
        ahafoData.constituencies.forEach((c: any) => {
          if (Array.isArray(c.executives)) c.executives.forEach(indexItem);
        });
      }
    }
  } catch {
    // Non-fatal
  }
}

async function readSource(url: string): Promise<Buffer | null> {
  ensureAuxiliaryIndexes();

  if (url.startsWith("data:image/")) {
    const comma = url.indexOf(",");
    if (comma < 0) return null;
    return /;base64/i.test(url.slice(0, comma))
      ? Buffer.from(url.slice(comma + 1), "base64")
      : Buffer.from(decodeURIComponent(url.slice(comma + 1)));
  }

  // Check if this URL corresponds to a local file in public/ or outputs/ before hitting the network
  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
  const filename = path.basename(pathname);
  if (filename && filename.length > 3) {
    const indexedPath = localFileByFilename.get(filename.toLowerCase());
    if (indexedPath) {
      try { return await fs.readFile(indexedPath); } catch { /* continue */ }
    }
    const publicRoot = path.join(process.cwd(), "public");
    const candidateLocalPaths = [
      path.join(publicRoot, "cdn", "executives", "volta", filename),
      path.join(publicRoot, "cdn", "executives", filename),
      path.join(publicRoot, "cdn", "delegates", filename),
    ];
    for (const candidate of candidateLocalPaths) {
      try { return await fs.readFile(candidate); } catch { /* try next candidate */ }
    }
  }

  // Check if a voter ID is embedded in the URL and matches a local file or Ahafo base64 or cached sync_progress URL
  const embeddedVid = extractVoterIdFromText(pathname);
  if (embeddedVid) {
    const localByVid = localFileByVoterId.get(embeddedVid) || localFileByVoterId.get(embeddedVid.replace(/^0+/, ""));
    if (localByVid) {
      try { return await fs.readFile(localByVid); } catch { /* continue */ }
    }
    const ahafoB64 = ahafoBase64ByVoterId.get(embeddedVid) || ahafoBase64ByVoterId.get(embeddedVid.replace(/^0+/, ""));
    if (ahafoB64) {
      const comma = ahafoB64.indexOf(",");
      if (comma >= 0) return Buffer.from(ahafoB64.slice(comma + 1), "base64");
    }
    const syncAltUrl = syncUrlByVoterId.get(embeddedVid) || syncUrlByVoterId.get(embeddedVid.replace(/^0+/, ""));
    if (syncAltUrl) {
      const syncKey = crypto.createHash("sha256").update(`v2_${syncAltUrl}_240_300_80`).digest("hex");
      try { return await fs.readFile(path.join(cacheDir, `${syncKey}.webp`)); } catch { /* continue */ }
    }
  }

  if (/^https?:\/\//i.test(url)) {
    if (/app\.newpatrioticparty\.org/i.test(url)) {
      // Before giving up on legacy app.newpatrioticparty.org URL, check if sync_progress has a valid CMS URL for this voter ID
      if (embeddedVid) {
        const altUrl = syncUrlByVoterId.get(embeddedVid) || syncUrlByVoterId.get(embeddedVid.replace(/^0+/, ""));
        if (altUrl && !/app\.newpatrioticparty\.org/i.test(altUrl)) {
          const altKey = crypto.createHash("sha256").update(`v2_${altUrl}_240_300_80`).digest("hex");
          try {
            return await fs.readFile(path.join(cacheDir, `${altKey}.webp`));
          } catch {
            url = altUrl;
          }
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
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
        if (response.status !== 408 && response.status !== 429 && response.status < 500) break;
      } catch {
        // Retry temporary connection failures and incomplete downloads.
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    // If network fetch failed, check if sync_progress has an alternative cached URL for the same voter ID
    if (embeddedVid) {
      const altUrl = syncUrlByVoterId.get(embeddedVid) || syncUrlByVoterId.get(embeddedVid.replace(/^0+/, ""));
      if (altUrl && altUrl !== url) {
        const altKey = crypto.createHash("sha256").update(`v2_${altUrl}_240_300_80`).digest("hex");
        try { return await fs.readFile(path.join(cacheDir, `${altKey}.webp`)); } catch { /* ignore */ }
      }
    }
    return null;
  }

  // Public URLs may contain escaped spaces, cache-busting queries or fragments.
  const publicRoot = path.join(process.cwd(), "public");
  const relative = pathname.replace(/^\/+/, "");
  const roots = pathname.startsWith("/") ? [publicRoot] : [publicRoot, process.cwd()];
  for (const root of roots) {
    const filenamePath = path.resolve(root, relative);
    if (!filenamePath.startsWith(root + path.sep)) continue;
    try { return await fs.readFile(filenamePath); } catch { /* try the next local source */ }
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

