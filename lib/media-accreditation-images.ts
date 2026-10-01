import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { getSafeSharp } from "./safe-sharp";

const WP_CDN_BASE = (
  process.env.WORDPRESS_CDN_BASE_URL ||
  "https://cms.newpatrioticparty.org/wp-content/uploads"
).replace(/\/+$/, "");

export interface ResolvedAccreditationImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

/**
 * Sanitizes a string for safe use in filenames or ZIP folder paths.
 */
export function sanitizeFilenamePart(input: string | null | undefined, fallback = "item"): string {
  if (!input) return fallback;
  const cleaned = input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

/**
 * Sanitizes a person's full name for use as an image filename while preserving natural spacing.
 * Example: "Nana Ama Mensah" -> "Nana Ama Mensah"
 */
export function sanitizePersonNameForFile(input: string | null | undefined, fallback = "Applicant"): string {
  if (!input) return fallback;
  const cleaned = input
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

export interface AccreditationPersonRecord {
  id: string;
  category?: string | null;
  name?: string | null;
  gender?: string | null;
  company?: string | null;
  roleTitle?: string | null;
  assignedZone?: string | null;
  serviceNumber?: string | null;
  emergencyContact?: string | null;
  region?: string | null;
  street?: string | null;
  ghanaPostAddress?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  voterId?: string | null;
  profileImage?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  accreditationCode?: string | null;
  createdAt?: string | Date | null;
  imageFilename?: string | null;
}

/**
 * Generates a complete, structured plain-text (.txt) report containing all data of all people.
 */
export function formatMediaAccreditationTextReport(
  records: AccreditationPersonRecord[],
  title = "NPP MEDIA ACCREDITATION — COMPLETE PERSONNEL DATA & PHOTO DIRECTORY"
): string {
  const lines: string[] = [];
  const sep = "=".repeat(88);
  const subSep = "-".repeat(88);

  const withPhotos = records.filter(
    (r) => r.imageFilename && r.imageFilename !== "NO_PHOTO" && r.imageFilename !== "MISSING_OR_UNREACHABLE"
  ).length;

  const byCompany = new Map<string, number>();
  for (const r of records) {
    const comp = (r.company || "Unspecified Organization").trim() || "Unspecified Organization";
    byCompany.set(comp, (byCompany.get(comp) || 0) + 1);
  }
  const sortedCompanies = Array.from(byCompany.entries()).sort((a, b) => b[1] - a[1]);

  lines.push(sep);
  lines.push(title);
  lines.push(sep);
  lines.push(`Generated At       : ${new Date().toISOString()}`);
  lines.push(`Total People       : ${records.length}`);
  lines.push(`Photos Extracted   : ${withPhotos}`);
  lines.push(`Media Houses       : ${sortedCompanies.length}`);
  lines.push(sep);
  lines.push("");

  lines.push("SUMMARY BY MEDIA HOUSE / ORGANIZATION:");
  lines.push(subSep);
  for (const [comp, count] of sortedCompanies) {
    lines.push(`  • ${comp.padEnd(55, " ")} : ${count}`);
  }
  lines.push("");
  lines.push(sep);
  lines.push("DETAILED PERSONNEL RECORDS");
  lines.push(sep);
  lines.push("");

  records.forEach((rec, idx) => {
    const createdStr = rec.createdAt ? new Date(rec.createdAt).toISOString() : "N/A";
    const photoUrlStr =
      rec.profileImage && !String(rec.profileImage).startsWith("data:")
        ? String(rec.profileImage)
        : rec.profileImage
        ? "[Embedded Base64 Photo]"
        : "None";

    lines.push(`[#${idx + 1}] ${rec.name || "Unnamed Applicant"}`);
    lines.push(subSep);
    lines.push(`  Full Name            : ${rec.name || "N/A"}`);
    lines.push(`  Image File           : ${rec.imageFilename || "NO_PHOTO"}`);
    lines.push(`  Accreditation Code   : ${rec.accreditationCode || "N/A"}`);
    lines.push(`  Category             : ${rec.category || "N/A"}`);
    lines.push(`  Gender               : ${rec.gender || "N/A"}`);
    lines.push(`  Media House / Org    : ${rec.company || "N/A"}`);
    lines.push(`  Designation / Role   : ${rec.roleTitle || "N/A"}`);
    lines.push(`  Phone Number         : ${rec.phone || "N/A"}`);
    lines.push(`  Email Address        : ${rec.email || "N/A"}`);
    lines.push(`  ID Type              : ${rec.idType || "N/A"}`);
    lines.push(`  ID Number            : ${rec.idNumber || "N/A"}`);
    lines.push(`  Voter ID             : ${rec.voterId || "N/A"}`);
    lines.push(`  Region               : ${rec.region || "N/A"}`);
    lines.push(`  Constituency/Address : ${rec.street || "N/A"}`);
    lines.push(`  GhanaPost GPS        : ${rec.ghanaPostAddress || "N/A"}`);
    lines.push(`  Assigned Zone        : ${rec.assignedZone || "N/A"}`);
    lines.push(`  Service Number       : ${rec.serviceNumber || "N/A"}`);
    lines.push(`  Emergency Contact    : ${rec.emergencyContact || "N/A"}`);
    lines.push(`  Accreditation Status : ${rec.status || "N/A"}`);
    lines.push(`  Submitted Timestamp  : ${createdStr}`);
    lines.push(`  Photo Source URL     : ${photoUrlStr}`);
    lines.push("");
  });

  lines.push(sep);
  lines.push("TAB-SEPARATED DATA TABLE (FOR SPREADSHEET IMPORT)");
  lines.push(sep);
  const headers = [
    "No",
    "Full Name",
    "Image Filename",
    "Accreditation Code",
    "Category",
    "Gender",
    "Media House / Organization",
    "Designation / Role",
    "Phone",
    "Email",
    "ID Type",
    "ID Number",
    "Voter ID",
    "Region",
    "Constituency / Street",
    "GhanaPost GPS",
    "Assigned Zone",
    "Service Number",
    "Emergency Contact",
    "Status",
    "Submitted At",
  ];
  lines.push(headers.join("\t"));
  records.forEach((rec, idx) => {
    const cleanField = (val: unknown) =>
      val == null ? "" : String(val).replace(/[\t\r\n]+/g, " ").trim();
    lines.push(
      [
        idx + 1,
        cleanField(rec.name),
        cleanField(rec.imageFilename || "NO_PHOTO"),
        cleanField(rec.accreditationCode),
        cleanField(rec.category),
        cleanField(rec.gender),
        cleanField(rec.company),
        cleanField(rec.roleTitle),
        cleanField(rec.phone),
        cleanField(rec.email),
        cleanField(rec.idType),
        cleanField(rec.idNumber),
        cleanField(rec.voterId),
        cleanField(rec.region),
        cleanField(rec.street),
        cleanField(rec.ghanaPostAddress),
        cleanField(rec.assignedZone),
        cleanField(rec.serviceNumber),
        cleanField(rec.emergencyContact),
        cleanField(rec.status),
        rec.createdAt ? new Date(rec.createdAt).toISOString() : "",
      ].join("\t")
    );
  });
  lines.push("");

  return lines.join("\r\n");
}

/**
 * Resolves a profileImage value (data URL, remote http/https URL, or relative /wp-content/... path)
 * into a binary Buffer and converts it to the requested format if specified.
 */
export async function resolveAccreditationImageBuffer(
  rawUrl: string | null | undefined,
  targetFormat?: "webp" | "jpg" | "jpeg" | "png" | "original"
): Promise<ResolvedAccreditationImage | null> {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let sourceBuffer: Buffer | null = null;
  let detectedMime = "image/webp";

  // 1. Base64 Data URL
  if (trimmed.startsWith("data:image/")) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      detectedMime = match[1].toLowerCase();
      sourceBuffer = Buffer.from(match[2], "base64");
    } else {
      const commaIdx = trimmed.indexOf(",");
      if (commaIdx >= 0) {
        sourceBuffer = Buffer.from(trimmed.slice(commaIdx + 1), "base64");
      }
    }
  }

  // 2. Local file check if URL is relative (/wp-content/uploads/...) or has a filename in public/
  if (!sourceBuffer) {
    const cleanPathname = decodeURIComponent(trimmed.split(/[?#]/, 1)[0]);
    const relativePath = cleanPathname.replace(/^https?:\/\/[^/]+\//i, "").replace(/^\/+/, "");

    const candidatePaths = [
      path.join(process.cwd(), "public", relativePath),
      path.join(process.cwd(), "public", "wp-content", "uploads", path.basename(cleanPathname)),
    ];

    for (const candidate of candidatePaths) {
      if (fsSync.existsSync(candidate)) {
        try {
          sourceBuffer = await fs.readFile(candidate);
          break;
        } catch {
          // continue
        }
      }
    }
  }

  // 3. Remote HTTP/HTTPS fetch (or relative /wp-content/uploads resolved against WordPress CDN)
  if (!sourceBuffer) {
    let fetchUrl = trimmed;
    if (trimmed.startsWith("/wp-content/uploads/")) {
      fetchUrl = `https://cms.newpatrioticparty.org${trimmed}`;
    } else if (trimmed.startsWith("wp-content/uploads/")) {
      fetchUrl = `https://cms.newpatrioticparty.org/${trimmed}`;
    } else if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
      fetchUrl = `${WP_CDN_BASE}/${trimmed}`;
    }

    if (/^https?:\/\//i.test(fetchUrl)) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const res = await fetch(fetchUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (NPP-Accreditation-Exporter/1.0)",
              Accept: "image/*,*/*;q=0.8",
            },
          });
          if (res.ok) {
            const ct = res.headers.get("content-type");
            if (ct && ct.startsWith("image/")) {
              detectedMime = ct.split(";")[0].trim().toLowerCase();
            }
            sourceBuffer = Buffer.from(await res.arrayBuffer());
            break;
          }
          await res.body?.cancel();
          if (res.status !== 408 && res.status !== 429 && res.status < 500) break;
        } catch {
          // retry
        } finally {
          clearTimeout(timeout);
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        }
      }
    }
  }

  if (!sourceBuffer || sourceBuffer.length === 0) {
    return null;
  }

  const fmt = (targetFormat || "original").toLowerCase();
  try {
    const sharp = await getSafeSharp();
    if (sharp) {
      if (fmt === "jpg" || fmt === "jpeg") {
        const converted = await sharp(sourceBuffer)
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 92 })
          .toBuffer();
        return {
          buffer: converted,
          contentType: "image/jpeg",
          extension: "jpg",
        };
      }
      if (fmt === "png") {
        const converted = await sharp(sourceBuffer).png({ compressionLevel: 8 }).toBuffer();
        return {
          buffer: converted,
          contentType: "image/png",
          extension: "png",
        };
      }
      if (fmt === "webp") {
        const converted = await sharp(sourceBuffer).webp({ quality: 90 }).toBuffer();
        return {
          buffer: converted,
          contentType: "image/webp",
          extension: "webp",
        };
      }
    }
  } catch {
    // Fall through to original buffer if sharp conversion fails
  }

  let ext = "webp";
  if (detectedMime.includes("jpeg") || detectedMime.includes("jpg")) ext = "jpg";
  else if (detectedMime.includes("png")) ext = "png";
  else if (detectedMime.includes("gif")) ext = "gif";

  return {
    buffer: sourceBuffer,
    contentType: detectedMime || "image/webp",
    extension: ext,
  };
}

export interface ZipEntryInput {
  filename: string;
  data: Buffer;
  modifiedAt?: Date;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Builds a standard-compliant ZIP archive Buffer in memory (STORE mode for fast packaging of images/CSVs).
 */
export function buildZipArchive(entries: ZipEntryInput[]): Buffer {
  const localFileChunks: Buffer[] = [];
  const centralDirectoryChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.filename.replace(/\\/g, "/"), "utf8");
    const dataBuf = entry.data;
    const crc = zlib.crc32(dataBuf) >>> 0;
    const { dosTime, dosDate } = toDosDateTime(entry.modifiedAt || new Date());

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // general purpose bit flag (UTF-8 filenames)
    localHeader.writeUInt16LE(0, 8); // compression method: 0 (STORE)
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18); // compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28); // extra field length

    localFileChunks.push(localHeader, nameBuf, dataBuf);

    // Central Directory File Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(0, 10); // compression method: 0 (STORE)
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

    centralDirectoryChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirectoryChunks);
  const endOfCentralDir = Buffer.alloc(22);
  endOfCentralDir.writeUInt32LE(0x06054b50, 0); // EOCD signature
  endOfCentralDir.writeUInt16LE(0, 4); // number of this disk
  endOfCentralDir.writeUInt16LE(0, 6); // disk where central directory starts
  endOfCentralDir.writeUInt16LE(entries.length, 8); // total entries on this disk
  endOfCentralDir.writeUInt16LE(entries.length, 10); // total entries
  endOfCentralDir.writeUInt32LE(centralDirBuffer.length, 12); // size of central directory
  endOfCentralDir.writeUInt32LE(offset, 16); // offset of start of central directory
  endOfCentralDir.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localFileChunks, centralDirBuffer, endOfCentralDir]);
}
