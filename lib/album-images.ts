import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getSafeSharp } from "./safe-sharp.ts";

const cacheDir = path.join(process.cwd(), ".cache", "albums", "webp");
const pending = new Map<string, Promise<Buffer | null>>();
const failedRemoteUrls = new Set<string>();

let _indexesLoaded = false;
const syncUrlByVoterId = new Map<string, string>();
const ahafoBase64ByVoterId = new Map<string, string>();
const ahafoBase64ByName = new Map<string, string>();
const localFileByVoterId = new Map<string, string>();
const localFileByExecId = new Map<number, string>();
const localFileByName = new Map<string, string>();
const localFileByFilename = new Map<string, string>();
const wocomUrlByExecId = new Map<number, string>();
const altUrlByVoterId = new Map<string, string>();
const altUrlByName = new Map<string, string>();

export function normalizeNameForPhotoMatch(name: string): string {
  return String(name || "")
    .trim()
    .toUpperCase()
    .replace(/^(MR|MRS|MS|HON|DR|ALHAJI|HAJIA|MADAM)\.?\s+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^A-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVoterIdFromText(text: string): string | null {
  const m = text.match(/(?:^|[^0-9])(\d{8,10})(?:[^0-9]|$)/);
  return m ? m[1] : null;
}

function extractExecutiveIdFromText(text: string): number | null {
  const m = text.match(/^wocom-(\d+)/i) || text.match(/^(\d{5,7})[_-]/);
  return m ? Number(m[1]) : null;
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
        const ext = path.extname(entry.name);
        const base = path.basename(entry.name, ext);
        localFileByFilename.set(entry.name.toLowerCase(), fullPath);

        const execId = extractExecutiveIdFromText(base);
        if (execId) {
          localFileByExecId.set(execId, fullPath);
        }

        const vid = extractVoterIdFromText(base);
        if (vid) {
          localFileByVoterId.set(vid, fullPath);
          localFileByVoterId.set(vid.replace(/^0+/, ""), fullPath);
          if (vid.length < 10) {
            localFileByVoterId.set(vid.padStart(10, "0"), fullPath);
          }
        }

        const cleanName = base
          .replace(/^wocom-\d+-?/i, "")
          .replace(/^\d+_/i, "")
          .replace(/_page\d+$/i, "")
          .replace(/_GHA_.*$/i, "")
          .replace(/_\d{8,10}$/i, "")
          .replace(/[_-]+/g, " ")
          .trim();
        const normName = normalizeNameForPhotoMatch(cleanName);
        if (normName.length > 5) {
          localFileByName.set(normName, fullPath);
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

  // 1. Index local files
  indexDirectorySync(path.join(process.cwd(), "public", "cdn"));
  indexDirectorySync(path.join(process.cwd(), "outputs", "wocom_2026", "portraits"));

  // 2. WOCOM manifest (maps wocom-<id> to local URL)
  try {
    const wocomManifestPath = path.join(process.cwd(), "public", "cdn", "delegates", "manifest.json");
    if (fsSync.existsSync(wocomManifestPath)) {
      const manifest = JSON.parse(fsSync.readFileSync(wocomManifestPath, "utf8"));
      for (const [key, val] of Object.entries(manifest)) {
        const idMatch = key.match(/\d+/);
        if (idMatch && val && typeof val === "object" && (val as any).url) {
          wocomUrlByExecId.set(Number(idMatch[0]), String((val as any).url).trim());
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // 3. Sync progress CDN URLs
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

  // 4. Scratch extracted executive JSON files with live CDN URLs
  const scratchCandidateFiles = [
    "scratch/greater_accra_wocom_executives.json",
    "scratch/national_executives.json",
    "scratch/greater_accra_tescon_presidents.json",
    "scratch/tescon_nasara_executives.json",
  ];
  for (const rel of scratchCandidateFiles) {
    try {
      const full = path.join(process.cwd(), rel);
      if (fsSync.existsSync(full)) {
        const items = JSON.parse(fsSync.readFileSync(full, "utf8"));
        if (Array.isArray(items)) {
          for (const item of items) {
            const cdnUrl = item.cdnImageUrl ? String(item.cdnImageUrl).trim() : null;
            if (cdnUrl && /^https?:\/\//i.test(cdnUrl)) {
              const vId = item.voterId ? String(item.voterId).trim() : "";
              if (vId.length >= 6) {
                altUrlByVoterId.set(vId, cdnUrl);
                altUrlByVoterId.set(vId.replace(/^0+/, ""), cdnUrl);
              }
              const name = item.fullName ? String(item.fullName).trim() : "";
              if (name) {
                const normName = normalizeNameForPhotoMatch(name);
                if (normName.length > 5) {
                  altUrlByName.set(normName, cdnUrl);
                }
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // 5. Ahafo album base64 portraits
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
          const name = d.executive_name ? String(d.executive_name).trim() : "";
          if (name) {
            const normName = normalizeNameForPhotoMatch(name);
            if (normName.length > 5) {
              ahafoBase64ByName.set(normName, d.photo_base64);
            }
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

function parseDataUri(uri: string): Buffer | null {
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  return /;base64/i.test(uri.slice(0, comma))
    ? Buffer.from(uri.slice(comma + 1), "base64")
    : Buffer.from(decodeURIComponent(uri.slice(comma + 1)));
}

async function readSource(
  url: string,
  hints?: { voterId?: string | null; execId?: number | null; name?: string | null }
): Promise<Buffer | null> {
  ensureAuxiliaryIndexes();

  if (url && url.startsWith("data:image/")) {
    return parseDataUri(url);
  }

  // 1. Executive ID lookups
  const execId = hints?.execId != null ? Number(hints.execId) : null;
  if (execId) {
    const localById = localFileByExecId.get(execId);
    if (localById) {
      try { return await fs.readFile(localById); } catch { /* continue */ }
    }
    const wocomUrl = wocomUrlByExecId.get(execId);
    if (wocomUrl) {
      const publicPath = path.join(process.cwd(), "public", wocomUrl.replace(/^\/+/, ""));
      try { return await fs.readFile(publicPath); } catch { /* continue */ }
    }
  }

  // 2. Voter ID lookups
  const voterId = hints?.voterId && hints.voterId !== "—" ? hints.voterId.trim() : null;
  if (voterId) {
    const vNoZero = voterId.replace(/^0+/, "");
    const localByVid = localFileByVoterId.get(voterId) || localFileByVoterId.get(vNoZero);
    if (localByVid) {
      try { return await fs.readFile(localByVid); } catch { /* continue */ }
    }
    const ahafoB64 = ahafoBase64ByVoterId.get(voterId) || ahafoBase64ByVoterId.get(vNoZero);
    if (ahafoB64) {
      const buf = parseDataUri(ahafoB64);
      if (buf) return buf;
    }
    const syncAltUrl = syncUrlByVoterId.get(voterId) || syncUrlByVoterId.get(vNoZero) || altUrlByVoterId.get(voterId) || altUrlByVoterId.get(vNoZero);
    if (syncAltUrl) {
      const syncKey = crypto.createHash("sha256").update(`v2_${syncAltUrl}_240_300_80`).digest("hex");
      try {
        const cached = await fs.readFile(path.join(cacheDir, `${syncKey}.webp`));
        if (cached) return cached;
      } catch { /* proceed to fetch below */ }
    }
  }

  // 3. Name lookups
  const name = hints?.name?.trim() ? normalizeNameForPhotoMatch(hints.name) : null;
  if (name && name.length > 5) {
    const localByName = localFileByName.get(name);
    if (localByName) {
      try { return await fs.readFile(localByName); } catch { /* continue */ }
    }
    const ahafoByName = ahafoBase64ByName.get(name);
    if (ahafoByName) {
      const buf = parseDataUri(ahafoByName);
      if (buf) return buf;
    }
    const altByName = altUrlByName.get(name);
    if (altByName) {
      const altKey = crypto.createHash("sha256").update(`v2_${altByName}_240_300_80`).digest("hex");
      try {
        const cached = await fs.readFile(path.join(cacheDir, `${altKey}.webp`));
        if (cached) return cached;
      } catch { /* continue */ }
    }
  }

  // 4. URL filename / local file checks
  if (url) {
    const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
    const filename = path.basename(pathname);
    if (filename && filename.length > 3) {
      const indexedPath = localFileByFilename.get(filename.toLowerCase());
      if (indexedPath) {
        try { return await fs.readFile(indexedPath); } catch { /* continue */ }
      }
      const publicRoot = path.join(process.cwd(), "public");
      const candidateLocalPaths = [
        path.join(publicRoot, "cdn", "delegates", filename),
        path.join(publicRoot, "cdn", "executives", "volta", filename),
        path.join(publicRoot, "cdn", "executives", filename),
      ];
      for (const candidate of candidateLocalPaths) {
        try { return await fs.readFile(candidate); } catch { /* try next */ }
      }
    }

    // Check if voter ID is embedded in pathname
    const embeddedVid = extractVoterIdFromText(pathname);
    if (embeddedVid) {
      const localByVid = localFileByVoterId.get(embeddedVid) || localFileByVoterId.get(embeddedVid.replace(/^0+/, ""));
      if (localByVid) {
        try { return await fs.readFile(localByVid); } catch { /* continue */ }
      }
      const ahafoB64 = ahafoBase64ByVoterId.get(embeddedVid) || ahafoBase64ByVoterId.get(embeddedVid.replace(/^0+/, ""));
      if (ahafoB64) {
        const buf = parseDataUri(ahafoB64);
        if (buf) return buf;
      }
    }

    // Check if executive ID is embedded in pathname
    const embeddedExecId = extractExecutiveIdFromText(filename);
    if (embeddedExecId) {
      const localById = localFileByExecId.get(embeddedExecId);
      if (localById) {
        try { return await fs.readFile(localById); } catch { /* continue */ }
      }
    }

    // Remote HTTP / HTTPS fetches
    if (/^https?:\/\//i.test(url)) {
      // Legacy app.newpatrioticparty.org host is offline. Do NOT attempt network fetch!
      if (/app\.newpatrioticparty\.org/i.test(url)) {
        if (embeddedVid) {
          const altUrl = syncUrlByVoterId.get(embeddedVid) || syncUrlByVoterId.get(embeddedVid.replace(/^0+/, ""));
          if (altUrl && !/app\.newpatrioticparty\.org/i.test(altUrl)) {
            url = altUrl;
          } else {
            return null;
          }
        } else {
          return null;
        }
      }

      // Live host fetch (e.g. cms.newpatrioticparty.org)
      if (failedRemoteUrls.has(url)) return null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
          });
          if (response.ok) return Buffer.from(await response.arrayBuffer());
          await response.body?.cancel();
          if (response.status !== 408 && response.status !== 429 && response.status < 500) {
            failedRemoteUrls.add(url);
            break;
          }
        } catch {
          // Retry temporary failure
        } finally {
          clearTimeout(timeout);
        }
        if (attempt < 1) await new Promise((resolve) => setTimeout(resolve, 150));
      }
      failedRemoteUrls.add(url);
      return null;
    }

    // Local file paths in public or cwd
    const publicRoot = path.join(process.cwd(), "public");
    const relative = pathname.replace(/^\/+/, "");
    const roots = pathname.startsWith("/") ? [publicRoot] : [publicRoot, process.cwd()];
    for (const root of roots) {
      const filenamePath = path.resolve(root, relative);
      if (!filenamePath.startsWith(root + path.sep)) continue;
      try { return await fs.readFile(filenamePath); } catch { /* next */ }
    }
  }

  // 5. Final fallback to live sync progress URL if we had hints
  const fallbackSyncUrl = voterId ? (syncUrlByVoterId.get(voterId) || syncUrlByVoterId.get(voterId.replace(/^0+/, "")) || altUrlByVoterId.get(voterId)) : (name ? altUrlByName.get(name) : null);
  if (fallbackSyncUrl && fallbackSyncUrl !== url && !/app\.newpatrioticparty\.org/i.test(fallbackSyncUrl)) {
    if (failedRemoteUrls.has(fallbackSyncUrl)) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(fallbackSyncUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
        });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        failedRemoteUrls.add(fallbackSyncUrl);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      failedRemoteUrls.add(fallbackSyncUrl);
    }
  }

  return null;
}

export async function resolveAlbumImage(
  imageUrl: string | null,
  width = 240,
  height = 300,
  quality = 80,
  hints?: { voterId?: string | null; execId?: number | null; name?: string | null }
): Promise<Buffer | null> {
  const url = imageUrl?.trim() || "";
  const cleanVid = hints?.voterId && hints.voterId !== "—" ? hints.voterId.trim() : "";
  const cleanId = hints?.execId != null ? String(hints.execId) : "";
  const cleanName = hints?.name?.trim() ? normalizeNameForPhotoMatch(hints.name) : "";

  const cacheTarget = url || `vid_${cleanVid}_id_${cleanId}_name_${cleanName}`;
  if (!cacheTarget || cacheTarget === "vid__id__name_") return null;

  if (![width, height, quality].every(Number.isFinite) || width < 1 || height < 1 || width > 2000 || height > 2000) return null;
  quality = Math.min(100, Math.max(20, quality));

  const key = crypto.createHash("sha256").update(`v3_${cacheTarget}_${width}_${height}_${quality}`).digest("hex");
  const existing = pending.get(key);
  if (existing) return existing;

  const conversion = (async () => {
    const filename = path.join(cacheDir, `${key}.webp`);
    try {
      const cached = await fs.readFile(filename);
      const sharp = await getSafeSharp();
      if (sharp) {
        await sharp(cached).raw().toBuffer();
      }
      return cached;
    } catch { /* Rebuild */ }

    try {
      const input = await readSource(url, hints);
      if (!input?.length) return null;
      const sharp = await getSafeSharp();
      if (!sharp) {
        return input;
      }
      const output = await sharp(input)
        .rotate()
        .resize(width, height, { fit: "cover", position: "top" })
        .webp({ quality, effort: 4 })
        .toBuffer();

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
