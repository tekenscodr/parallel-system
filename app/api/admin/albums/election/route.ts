import fs from "fs";
import path from "path";
import sharp from "sharp";
import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";
import {
  CANONICAL_LEVEL_ORDER,
  compareAlbumDelegates,
  compareRegionalAlbumDelegates,
  getRegionalSectionRank,
  getTesconInstitution,
  normalizePositionRank,
} from "@/lib/album-hierarchy";
import { resolveAlbumImage } from "@/lib/album-images";
import { ALBUM_PRINT_SCRIPT } from "@/lib/album-print";
import { withEcSql } from "@/lib/db-ec";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import {
  CONTEST_LIST,
  GENERAL_CONTEST_LIST,
  CUSTOM_CONTEST,
  getCanonicalPositionsForSelection,
  normalizeCanonicalPosition,
  isElectedConstituencyPosition,
  CONSTITUENCY_POSITION_IDS,
  REGIONAL_POSITION_IDS,
  type ContestType,
  parseVoterDetails,
  DEFAULT_VOTER_DETAILS,
  type VoterDetailField,
} from "@/lib/election-contests";
import {
  getConstituenciesForRegion,
  normalizeConstituency,
} from "@/lib/constituency-normalizer";
import { getConstituencyCapital } from "@/lib/constituency-capitals";

// Pre-indexed WebP photos from Ahafo album (voter_id and executive_name)
const ahafoPhotosByVoterId = new Map<string, string>();
const ahafoPhotosByName = new Map<string, string>();

// Local disk photo index: voter_id -> full file path, and filename -> full file path
const localPhotosByVoterId = new Map<string, string>();
const localPhotosByFilename = new Map<string, string>();
const base64PhotoCache = new Map<string, string>();

function indexLocalPhotos(dir: string) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        indexLocalPhotos(fullPath);
      } else if (/\.(webp|jpg|jpeg|png)$/i.test(entry.name)) {
        const ext = path.extname(entry.name);
        const base = path.basename(entry.name, ext);
        localPhotosByFilename.set(entry.name.toLowerCase(), fullPath);
        const digits = base.match(/\b\d{8,10}\b/);
        if (digits) {
          localPhotosByVoterId.set(digits[0], fullPath);
        }
      }
    }
  } catch {
    // Non-fatal
  }
}

try {
  indexLocalPhotos(path.join(process.cwd(), "public", "cdn"));
} catch {
  // Non-fatal
}

try {
  const candidatePaths = [
    path.join(process.cwd(), "exports/albums/ahafo_album_data.json"),
    path.join(process.cwd(), "public/exports/ahafo_album_data.json"),
    path.join(process.cwd(), "outputs/albums/ahafo_album_data.json"),
  ];
  const ahafoJsonPath = candidatePaths.find((p) => fs.existsSync(p));
  if (ahafoJsonPath) {
    const ahafoData = JSON.parse(fs.readFileSync(ahafoJsonPath, "utf8"));
    const indexDelegate = (d: any) => {
      if (
        d &&
        d.photo_base64 &&
        typeof d.photo_base64 === "string" &&
        d.photo_base64.startsWith("data:image/webp")
      ) {
        if (d.voter_id && String(d.voter_id).trim().length > 3) {
          ahafoPhotosByVoterId.set(String(d.voter_id).trim(), d.photo_base64);
        }
        if (d.executive_name && String(d.executive_name).trim().length > 2) {
          const cleanName = String(d.executive_name).trim().toUpperCase();
          ahafoPhotosByName.set(cleanName, d.photo_base64);
        }
      }
    };

    if (Array.isArray(ahafoData.regionalExecutives)) {
      ahafoData.regionalExecutives.forEach(indexDelegate);
    }
    if (Array.isArray(ahafoData.constituencies)) {
      ahafoData.constituencies.forEach((c: any) => {
        if (Array.isArray(c.executives)) {
          c.executives.forEach(indexDelegate);
        }
      });
    }
  }
} catch {
  // Non-fatal
}

const GHANA_REGIONS_ORDER = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

const REGIONAL_CONSTITUENCY_COUNTS: Record<string, number> = {
  "Ahafo": 6,
  "Ashanti": 47,
  "Bono": 12,
  "Bono East": 11,
  "Central": 23,
  "Eastern": 33,
  "Greater Accra": 34,
  "North East": 6,
  "Northern": 18,
  "Oti": 9,
  "Savannah": 7,
  "Upper East": 15,
  "Upper West": 11,
  "Volta": 18,
  "Western": 17,
  "Western North": 9,
};

const WOMEN_REGIONAL_STATUTORY_QUOTAS: Record<string, number> = {
  "Ahafo": 32,
  "Ashanti": 217, // Baseline regional target tested in statutory audit suites (217 + 26 = 243)
  "Bono": 67,
  "Bono East": 51,
  "Central": 106,
  "Eastern": 125,
  "Greater Accra": 193,
  "North East": 21,
  "Northern": 69,
  "Oti": 26,
  "Savannah": 25,
  "Upper East": 56,
  "Upper West": 44,
  "Volta": 66,
  "Western": 82,
  "Western North": 31,
  "External Branch": 130,
  "National Headquarters": 26,
};

const ALL_MEN_REGIONAL_STATUTORY_QUOTAS: Record<string, number> = {
  "Ahafo": 129,
  "Ashanti": 826,
  "Bono": 238,
  "Bono East": 206,
  "Central": 398,
  "Eastern": 612,
  "Greater Accra": 585,
  "North East": 128,
  "Northern": 354,
  "Oti": 165,
  "Savannah": 168,
  "Upper East": 284,
  "Upper West": 226,
  "Volta": 240,
  "Western": 296,
  "Western North": 161,
  "External Branch": 451,
  "National Headquarters": 139,
};

const GENERAL_OFFICERS_REGIONAL_STATUTORY_QUOTAS: Record<string, number> = {
  "Ahafo": 147,
  "Ashanti": 973,
  "Bono": 266,
  "Bono East": 241,
  "Central": 473,
  "Eastern": 696,
  "Greater Accra": 708,
  "North East": 141,
  "Northern": 385,
  "Oti": 197,
  "Savannah": 180,
  "Upper East": 320,
  "Upper West": 244,
  "Volta": 292,
  "Western": 355,
  "Western North": 181,
  "External Branch": 580,
  "National Headquarters": 165,
};

const YOUTH_WING_REGIONAL_STATUTORY_QUOTAS: Record<string, number> = {
  "Ahafo": 40,
  "Ashanti": 242,
  "Bono": 81,
  "Bono East": 50,
  "Central": 96,
  "Eastern": 141,
  "Greater Accra": 180,
  "North East": 27,
  "Northern": 98,
  "Oti": 30,
  "Savannah": 41,
  "Upper East": 66,
  "Upper West": 64,
  "Volta": 72,
  "Western": 74,
  "Western North": 37,
  "External Branch": 60,
};

const YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS: Record<string, number> = {
  "Ahafo": 73,
  "Ashanti": 452,
  "Bono": 136,
  "Bono East": 107,
  "Central": 186,
  "Eastern": 271,
  "Greater Accra": 330,
  "North East": 61,
  "Northern": 209,
  "Oti": 86,
  "Savannah": 100,
  "Upper East": 139,
  "Upper West": 114,
  "Volta": 159,
  "Western": 169,
  "Western North": 77,
  "External Branch": 177,
  "National Headquarters": 4,
};

const NASARA_REGIONAL_STATUTORY_QUOTAS: Record<string, number> = {
  "Ahafo": 22,
  "Ashanti": 139,
  "Bono": 42,
  "Bono East": 32,
  "Central": 63,
  "Eastern": 92,
  "Greater Accra": 107,
  "North East": 18,
  "Northern": 58,
  "Oti": 22,
  "Savannah": 25,
  "Upper East": 42,
  "Upper West": 37,
  "Volta": 43,
  "Western": 46,
  "Western North": 24,
  "External Branch": 52,
  "National Headquarters": 3,
};

const FULL_DIRECTORY_REGIONAL_STATUTORY_QUOTAS: Record<string, number> = {
  "Ahafo": 163,
  "Ashanti": 1069,
  "Bono": 305,
  "Bono East": 257,
  "Central": 504,
  "Eastern": 743,
  "Greater Accra": 781,
  "North East": 149,
  "Northern": 425,
  "Oti": 202,
  "Savannah": 194,
  "Upper East": 340,
  "Upper West": 270,
  "Volta": 320,
  "Western": 379,
  "Western North": 193,
  "External Branch": 580,
  "National Headquarters": 165,
};

let LOGO_WEBP_DATA_URI = "";
async function getLogoWebpDataUri(): Promise<string> {
  if (LOGO_WEBP_DATA_URI) return LOGO_WEBP_DATA_URI;
  try {
    const logoPath = path.join(process.cwd(), "public/npp-logo.png");
    const altLogoPath = path.join(process.cwd(), "outputs/assets/npp_logo.png");
    const filePath = fs.existsSync(logoPath) ? logoPath : fs.existsSync(altLogoPath) ? altLogoPath : null;
    if (filePath) {
      const rawBuf = fs.readFileSync(filePath);
      const webpBuf = await sharp(rawBuf)
        .resize(240, 240, {
          fit: "inside",
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .webp({ quality: 95, alphaQuality: 100 })
        .toBuffer();
      LOGO_WEBP_DATA_URI = "data:image/webp;base64," + webpBuf.toString("base64");
    }
  } catch {
    // fallback if file read or conversion fails
  }
  return LOGO_WEBP_DATA_URI;
}

let ELEPHANT_SEAL_DATA_URI = "";
function getElephantSealDataUriSync(): string {
  if (ELEPHANT_SEAL_DATA_URI) return ELEPHANT_SEAL_DATA_URI;
  try {
    const candidatePaths = [
      path.join(process.cwd(), "public/assets/npp_elephant_circle.png"),
      path.join(process.cwd(), "outputs/assets/npp_elephant_circle.png"),
    ];
    const filePath = candidatePaths.find((p) => fs.existsSync(p));
    if (filePath) {
      const rawBuf = fs.readFileSync(filePath);
      ELEPHANT_SEAL_DATA_URI = "data:image/png;base64," + rawBuf.toString("base64");
    }
  } catch {
    // fallback if file read fails
  }
  return ELEPHANT_SEAL_DATA_URI;
}

async function getElephantSealDataUri(): Promise<string> {
  if (ELEPHANT_SEAL_DATA_URI) return ELEPHANT_SEAL_DATA_URI;
  try {
    const candidatePaths = [
      path.join(process.cwd(), "public/assets/npp_elephant_circle.png"),
      path.join(process.cwd(), "outputs/assets/npp_elephant_circle.png"),
    ];
    const filePath = candidatePaths.find((p) => fs.existsSync(p));
    if (filePath) {
      const rawBuf = fs.readFileSync(filePath);
      const pngBuf = await sharp(rawBuf)
        .resize(160, 160, {
          fit: "inside",
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png({ quality: 95 })
        .toBuffer();
      ELEPHANT_SEAL_DATA_URI = "data:image/png;base64," + pngBuf.toString("base64");
    }
  } catch {
    return getElephantSealDataUriSync();
  }
  return ELEPHANT_SEAL_DATA_URI;
}

function renderCurvedText(
  text: string,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  color: string,
  fontSize: number,
  isBottom = false
): string {
  const chars = text.split("");
  const totalAngle = endAngle - startAngle;
  const step = totalAngle / (chars.length - 1);
  return chars
    .map((ch, i) => {
      if (ch === " ") return "";
      const angle = startAngle + i * step;
      const rot = isBottom ? angle - 90 : angle + 90;
      const rad = (angle * Math.PI) / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="${color}" font-size="${fontSize}" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" text-anchor="middle" dominant-baseline="central" transform="rotate(${rot.toFixed(2)}, ${x.toFixed(2)}, ${y.toFixed(2)})">${ch}</text>`;
    })
    .filter(Boolean)
    .join("\n              ");
}


function calculateAgeIn2026(dob: string | null, ageCol: number | null | undefined, asOfDate: Date = new Date()): number | null {
  if (dob) {
    const s = String(dob).trim();
    let year: number | null = null;
    let month: number | null = null;
    let day: number | null = null;

    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
    } else {
      const slashMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (slashMatch) {
        day = parseInt(slashMatch[1], 10);
        month = parseInt(slashMatch[2], 10);
        year = parseInt(slashMatch[3], 10);
      } else {
        const match = s.match(/\b(19\d\d|20[0-2]\d)\b/);
        if (match) {
          year = parseInt(match[1], 10);
        }
      }
    }

    if (year && year >= 1906 && year <= asOfDate.getFullYear() + 1) {
      if (month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        let age = asOfDate.getFullYear() - year;
        const curMonth = asOfDate.getMonth() + 1;
        const curDay = asOfDate.getDate();
        if (curMonth < month || (curMonth === month && curDay < day)) {
          age--;
        }
        return age;
      }
      return asOfDate.getFullYear() - year;
    }
  }
  if (ageCol !== null && ageCol !== undefined) {
    const num = Number(ageCol);
    if (Number.isFinite(num) && num > 0 && num <= 120) {
      return num;
    }
  }
  return null;
}

const DEFAULT_ALBUM_YOUTH_CUTOFF = new Date("2026-08-21T00:00:00Z");

function isUnder40AsOfCutoff(
  dob: string | null,
  ageCol: number | null | undefined,
  cutoffDate: Date = DEFAULT_ALBUM_YOUTH_CUTOFF
): boolean {
  if (dob) {
    const ageAtCutoff = calculateAgeIn2026(dob, null, cutoffDate);
    if (ageAtCutoff !== null) {
      return ageAtCutoff < 40;
    }
  }
  if (ageCol !== null && ageCol !== undefined) {
    const num = Number(ageCol);
    if (Number.isFinite(num)) return num < 40;
  }
  return false;
}

const isUnder40AsOf3MonthsAgo = isUnder40AsOfCutoff;

function generateSvgAvatar(name: string, role: string): string {
  const cleanName = String(name || "")
    .replace(/^(MR\.?|MRS\.?|MS\.?|MISS|HON\.?|ALHAJI|DR\.?|LAWYER)\s+/i, "")
    .trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0]
      ? parts[0].slice(0, 2).toUpperCase()
      : "NP";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" width="120" height="150">
    <defs>
      <linearGradient id="avGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#003399"/>
        <stop offset="100%" stop-color="#001845"/>
      </linearGradient>
    </defs>
    <rect width="120" height="150" fill="url(#avGrad)"/>
    <circle cx="60" cy="52" r="32" fill="#FFFFFF" fill-opacity="0.14" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity="0.25"/>
    <text x="60" y="62" fill="#FFFFFF" font-size="24" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle">${initials}</text>
    <rect x="0" y="112" width="120" height="38" fill="#DC2626"/>
    <text x="60" y="127" fill="#FFFFFF" font-size="7.5" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle" letter-spacing="0.5">NPP DELEGATE</text>
    <text x="60" y="139" fill="#FEF08A" font-size="6.5" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle">VOTER DIRECTORY</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function resolveLocalPhotoAsWebpDataUri(localPath: string): Promise<string | null> {
  const cached = base64PhotoCache.get(localPath);
  if (cached) return cached;
  try {
    const ext = path.extname(localPath).toLowerCase();
    if (ext === ".webp") {
      const buf = await fs.promises.readFile(localPath);
      const dataUri = "data:image/webp;base64," + buf.toString("base64");
      base64PhotoCache.set(localPath, dataUri);
      return dataUri;
    } else {
      const buf = await fs.promises.readFile(localPath);
      const webpBuf = await sharp(buf)
        .rotate()
        .resize(240, 300, { fit: "cover", position: "top" })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
      const dataUri = "data:image/webp;base64," + webpBuf.toString("base64");
      base64PhotoCache.set(localPath, dataUri);
      return dataUri;
    }
  } catch {
    return null;
  }
}

async function resolveDelegateWebpImage(
  imageUrl: string | null,
  voterId?: string | null,
  name?: string | null
): Promise<string | null> {
  const cleanVoterId = voterId && voterId !== "—" ? voterId.trim() : null;

  // 1. Instant check: Ahafo pre-indexed WebP portraits (by voter ID or executive name)
  if (cleanVoterId) {
    const cachedByVoterId = ahafoPhotosByVoterId.get(cleanVoterId);
    if (cachedByVoterId && cachedByVoterId.startsWith("data:image/webp")) {
      return cachedByVoterId;
    }
  }
  if (name) {
    const cleanName = name.trim().toUpperCase();
    const cachedByName = ahafoPhotosByName.get(cleanName);
    if (cachedByName && cachedByName.startsWith("data:image/webp")) {
      return cachedByName;
    }
  }

  // 2. Direct data URI
  if (imageUrl && imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  // 3. Local disk lookup by Voter ID (e.g. public/cdn/executives/volta/<voter_id>.webp)
  if (cleanVoterId) {
    const localPath = localPhotosByVoterId.get(cleanVoterId);
    if (localPath) {
      const dataUri = await resolveLocalPhotoAsWebpDataUri(localPath);
      if (dataUri) return dataUri;
    }
  }

  // 4. Local disk lookup by imageUrl (matching filename or embedded voter ID)
  if (imageUrl) {
    const cleanUrl = imageUrl.trim();

    // Check if filename in imageUrl matches any local file
    const urlFilename = path.basename(cleanUrl.split(/[?#]/, 1)[0]).toLowerCase();
    const localPath = localPhotosByFilename.get(urlFilename);
    if (localPath) {
      const dataUri = await resolveLocalPhotoAsWebpDataUri(localPath);
      if (dataUri) return dataUri;
    }

    // Check if voter ID is embedded in imageUrl (e.g. /volta/2481017881.webp)
    const urlVoterMatch = cleanUrl.match(/\b\d{8,10}\b/);
    if (urlVoterMatch) {
      const matchedLocalPath = localPhotosByVoterId.get(urlVoterMatch[0]);
      if (matchedLocalPath) {
        const dataUri = await resolveLocalPhotoAsWebpDataUri(matchedLocalPath);
        if (dataUri) return dataUri;
      }
    }

    // 5. Local file portrait (e.g. in public/ directory)
    if (!/^https?:\/\//i.test(cleanUrl)) {
      try {
        const buffer = await resolveAlbumImage(cleanUrl);
        if (buffer) return "data:image/webp;base64," + buffer.toString("base64");
      } catch {
        // ignore local file read failure
      }
    }

    // 6. Skip unreachable legacy domain immediately without blocking
    if (/app\.newpatrioticparty\.org/i.test(cleanUrl)) {
      return null;
    }

    // 7. Resolve remote URL through resolveAlbumImage
    try {
      const buffer = await resolveAlbumImage(cleanUrl);
      if (buffer) return "data:image/webp;base64," + buffer.toString("base64");
    } catch {
      // ignore
    }

    // If resolveAlbumImage didn't return a buffer, return the remote URL as fallback
    if (/^https?:\/\//i.test(cleanUrl)) {
      return cleanUrl;
    }
  }

  return null;
}

async function convertDelegatesImagesToWebp(delegates: any[]): Promise<void> {
  const chunkSize = 50;
  for (let i = 0; i < delegates.length; i += chunkSize) {
    const chunk = delegates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (d) => {
        const webpUri = await resolveDelegateWebpImage(d.image_url, d.voter_id, d.executive_name);
        d.webp_base64 = webpUri || d.avatar_svg;
        d.photo_unavailable = !webpUri;
      })
    );
  }
}

export async function GET(req: NextRequest) {
  const admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  if (!canAccessAlbums(admin.user)) {
    return NextResponse.json(
      { error: "Access denied: Election albums require ADMIN_NATIONAL." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const positionQuery = (searchParams.get("position") || "Youth Organisers & Deputies").trim();
  const positionsParam = (searchParams.get("positions") || "").trim();
  const regionQuery = (searchParams.get("region") || "all").trim();
  const regionsParam = (searchParams.get("regions") || searchParams.get("region") || "all").trim();
  const rawRegionsList =
    regionsParam.toLowerCase() !== "all" && regionsParam !== ""
      ? regionsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const isAllRegions =
    rawRegionsList.length === 0 ||
    rawRegionsList.length >= 18 ||
    rawRegionsList.some((r) => r.toLowerCase() === "all");
  const scopeQuery = (searchParams.get("scope") || "").trim().toLowerCase();
  const format = (searchParams.get("format") || "json").toLowerCase();
  const albumType = (searchParams.get("album_type") || searchParams.get("type") || "provisional").trim().toLowerCase();
  const isDownload =
    searchParams.get("download") === "1" || searchParams.get("download") === "true";

  const genderQuery = (searchParams.get("gender") || searchParams.get("sex") || "").trim().toLowerCase();
  const filterGender =
    genderQuery === "male" || genderQuery === "men" || genderQuery === "man"
      ? "male"
      : genderQuery === "female" || genderQuery === "women" || genderQuery === "woman"
      ? "female"
      : null;

  const under40Query = (searchParams.get("under40") || searchParams.get("cohort") || searchParams.get("age") || "").trim().toLowerCase();
  const filterUnder40 = under40Query === "true" || under40Query === "1" || under40Query === "under_40" || under40Query === "youth";

  const levelsParam = (searchParams.get("levels") || searchParams.get("level") || "all").trim();
  const selectedLevels =
    levelsParam.toLowerCase() !== "all" && levelsParam !== ""
      ? levelsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [];

  const detailsParam = searchParams.get("details") ?? searchParams.get("fields");
  const visibleDetails = parseVoterDetails(detailsParam);

  const customPositionKeys = positionsParam
    ? positionsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const isCustomContest =
    positionQuery.toLowerCase() === "custom" ||
    customPositionKeys.length > 0;

  const customResolved = isCustomContest
    ? getCanonicalPositionsForSelection(customPositionKeys)
    : null;

  // Match valid contest with robust synonym handling
  const normalizedPositionQuery = positionQuery.toLowerCase().trim();
  let matchedContest: ContestType = "Youth Organisers & Deputies";
  if (isCustomContest) {
    matchedContest = "Custom";
  } else if (/^all\s+men|^men\b|^male\b/i.test(normalizedPositionQuery)) {
    matchedContest = "All Men";
  } else if (/^all\s+women/i.test(normalizedPositionQuery)) {
    matchedContest = "All Women";
  } else if (/national\s+chairperson|general\s+officers/i.test(normalizedPositionQuery)) {
    matchedContest = "National Chairperson & General Officers";
  } else if (/women/i.test(normalizedPositionQuery)) {
    matchedContest = "Women Organiser";
  } else if (/youth.*organisers?\s*&\s*deput/i.test(normalizedPositionQuery)) {
    matchedContest = "Youth Organisers & Deputies";
  } else if (/youth.*organi[sz]er/i.test(normalizedPositionQuery)) {
    matchedContest = "Youth Organiser";
  } else if (/nasara.*coordinators?\s*&\s*deput/i.test(normalizedPositionQuery)) {
    matchedContest = "Nasara Coordinators & Deputies";
  } else if (/nasara/i.test(normalizedPositionQuery)) {
    matchedContest = "Nasara Organiser";
  } else {
    matchedContest =
      CONTEST_LIST.find((c) => c.toLowerCase() === normalizedPositionQuery) ||
      "Youth Organisers & Deputies";
  }

  let effectiveContestName: string = matchedContest;
  if (matchedContest === "All Men") {
    effectiveContestName = "National Electoral College · All Men";
  } else if (matchedContest === "All Women") {
    effectiveContestName = "National Electoral College · All Women";
  } else if (isCustomContest) {
    if (customPositionKeys.length === 0) {
      effectiveContestName = "Custom Selection";
    } else {
      const labels = customResolved?.displayLabels || [];
      if (labels.length === 1) {
        effectiveContestName = `${labels[0]} Roll`;
      } else if (labels.length === 2) {
        effectiveContestName = `${labels[0]} & ${labels[1]}`;
      } else if (labels.length === 3) {
        effectiveContestName = `${labels[0]}, ${labels[1]} & ${labels[2]}`;
      } else {
        effectiveContestName = `Custom Selection (${labels.length} Positions)`;
      }
    }
  }

  // Append level suffix to title if specific level(s) selected
  if (selectedLevels.length === 1) {
    const singleLevelLabel =
      selectedLevels[0] === "regional" || selectedLevels[0] === "region"
        ? "Regional Level"
        : selectedLevels[0] === "constituency"
        ? "Constituency Level"
        : selectedLevels[0] === "external branch" || selectedLevels[0] === "external"
        ? "External Branches"
        : selectedLevels[0] === "tescon"
        ? "TESCON Institutions"
        : selectedLevels[0] === "national"
        ? "National Level"
        : selectedLevels[0];

    if (!effectiveContestName.toLowerCase().includes(singleLevelLabel.toLowerCase())) {
      effectiveContestName = `${effectiveContestName} (${singleLevelLabel})`;
    }
  } else if (selectedLevels.length > 1 && selectedLevels.length < 5) {
    const countLabel = `${selectedLevels.length} Levels`;
    if (!effectiveContestName.includes(countLabel)) {
      effectiveContestName = `${effectiveContestName} (${countLabel})`;
    }
  }

  if (filterGender === "male" && !/all men|male/i.test(effectiveContestName)) {
    effectiveContestName = `${effectiveContestName} (All Men)`;
  } else if (filterGender === "female" && !/all women|female|women organiser/i.test(effectiveContestName)) {
    effectiveContestName = `${effectiveContestName} (All Women)`;
  }

  if (filterUnder40 && !/youth/i.test(effectiveContestName)) {
    effectiveContestName = `${effectiveContestName} (Under 40)`;
  }

  const isWingOrganisers =
    !isCustomContest &&
    matchedContest !== "All Men" &&
    matchedContest !== "All Women" &&
    matchedContest !== "Women Organiser" &&
    matchedContest !== "Women Organisers & Deputies" &&
    (matchedContest === "Youth Organisers & Deputies" ||
      matchedContest === "Nasara Coordinators & Deputies" ||
      scopeQuery === "organisers_only");


  return withEcSql(async (sql) => {
    // 1. Fetch certified pool
    const rawRows = await sql`
      SELECT
        id,
        executive_level,
        region,
        constituency,
        polling_station,
        position,
        executive_name,
        voter_id,
        phone,
        gender,
        date_of_birth,
        age,
        image_url
      FROM executives_all
      WHERE lower(trim(executive_level)) IN ('national', 'region', 'regional', 'constituency', 'tescon', 'external branch')
      ORDER BY id
    `;

    // 2. Filter valid (non-vacant)
    const validRows = rawRows.filter((r) => {
      const name = String(r.executive_name || "").trim();
      return (
        name &&
        !/^(vacant|vacancy|unknown|not available)\b/i.test(name) &&
        !/^n\/?a$/i.test(name)
      );
    });

    // 3. Apply contest eligibility rules (Decoupled position eligibility vs. administrative/regional scope)
    const isRowEligibleForContest = (r: (typeof validRows)[0]) => {
      const rawLvl = String(r.executive_level || "").toLowerCase().trim();
      const lvl = rawLvl === "external branch" ? "constituency" : rawLvl;
      const pos = String(r.position || "").trim();
      const posLower = pos.toLowerCase();
      const g = String(r.gender || "").toLowerCase().trim();

      // Rule: TESCON Patrons NEVER vote
      if (lvl === "tescon" && /patron/i.test(pos)) {
        return false;
      }

      // Universal Gender Filter (if gender query param is provided)
      if (filterGender && g !== filterGender) {
        return false;
      }

      // Universal Under 40 (Youth) Filter (if under40 query param is provided)
      if (filterUnder40 && !isUnder40AsOfCutoff(r.date_of_birth, r.age)) {
        return false;
      }

      // Custom Position Filter
      if (isCustomContest) {
        if (!customResolved || customResolved.canonicalSet.size === 0) {
          return false;
        }
        const canonPos = normalizeCanonicalPosition(r.position, r.executive_level);
        if (customResolved.canonicalSet.has(canonPos)) {
          return true;
        }
        if (customResolved.isTesconNasaraIncluded && lvl === "tescon" && /nasara/i.test(posLower)) {
          return true;
        }
        for (const target of customResolved.canonicalSet) {
          if (posLower === target.toLowerCase()) return true;
        }
        return false;
      }

      // Wing-specific extraction (Organisers & Deputies Only):
      if (isWingOrganisers) {
        if (matchedContest === "Youth Organisers & Deputies") {
          // TESCON Level: all TESCON tertiary executives except patrons
          if (lvl === "tescon") {
            return (
              !posLower.includes("patron") &&
              !posLower.includes("former")
            );
          }

          // Core & External Levels: Youth Organisers and Deputies
          return (
            (posLower.includes("youth organiser") ||
              posLower.includes("youth organizer") ||
              posLower === "youth" ||
              posLower.includes("deputy youth") ||
              posLower.includes("assistant youth")) &&
            !posLower.includes("former") &&
            !posLower.includes("patron")
          );
        }

        if (matchedContest === "Women Organisers & Deputies") {
          if (g !== "female") return false;
          if (
            ["national", "region", "regional", "constituency"].includes(lvl) ||
            rawLvl === "external branch" ||
            rawLvl === "external" ||
            rawLvl.includes("external") ||
            String(r.region || "").toLowerCase().includes("external")
          ) {
            return true;
          }
          if (lvl === "tescon") {
            if (posLower.includes("patron")) return false;
            return /wocom|women|president|nasara/i.test(posLower);
          }
          return false;
        }

        if (
          matchedContest === "Nasara Coordinators & Deputies" ||
          matchedContest === "Nasara Organiser"
        ) {
          return (
            posLower.includes("nasara") &&
            !posLower.includes("former") &&
            !posLower.includes("patron")
          );
        }
      }

      // Standard Election Contests:
      if (
        matchedContest === "National Chairperson & General Officers" ||
        matchedContest === "Chairperson" ||
        matchedContest === "Vice Chairperson" ||
        matchedContest === "General Secretary" ||
        matchedContest === "Treasurer" ||
        matchedContest === "Communication Officer" ||
        matchedContest === "Organiser"
      ) {
        // Core levels vote
        if (["national", "region", "regional", "constituency"].includes(lvl)) {
          return true;
        }
        // TESCON: only Presidents
        if (lvl === "tescon" && /president/i.test(pos)) {
          return true;
        }
        return false;
      }

      if (matchedContest === "Youth Organiser") {
        // TESCON Level: All TESCON tertiary executives qualify (patrons strictly excluded)
        if (lvl === "tescon") {
          return !posLower.includes("patron") && !posLower.includes("former");
        }
        // Region, National, Constituency, and External Branch levels:
        const isCoreOrExt =
          ["national", "region", "regional", "constituency"].includes(lvl) ||
          rawLvl === "external branch" ||
          rawLvl === "external" ||
          rawLvl.includes("external") ||
          String(r.region || "").toLowerCase().includes("external");

        if (isCoreOrExt) {
          // Former officers are excluded
          if (posLower.includes("former")) return false;
          // Youth organisers & deputies vote ex-officio (regardless of age)
          if (/youth/i.test(posLower)) return true;
          // Anyone under 40 (all those who were not 40 as at 21st August 2026)
          if (isUnder40AsOfCutoff(r.date_of_birth, r.age)) return true;
        }
        return false;
      }

      if (matchedContest === "All Men") {
        if (g !== "male") {
          return false;
        }

        // All males in National, Regional, Constituency, and External Branch levels
        if (
          ["national", "region", "regional", "constituency"].includes(lvl) ||
          rawLvl === "external branch" ||
          rawLvl === "external" ||
          rawLvl.includes("external") ||
          String(r.region || "").toLowerCase().includes("external")
        ) {
          return true;
        }

        // TESCON: male tertiary executives (patrons strictly excluded)
        if (lvl === "tescon") {
          if (posLower.includes("patron") || posLower.includes("former")) return false;
          return true;
        }

        return false;
      }

      if (
        matchedContest === "All Women" ||
        matchedContest === "Women Organiser" ||
        matchedContest === "Women Organisers & Deputies"
      ) {
        // For women organiser position we strictly only want all females across the electoral college
        if (g !== "female") {
          return false;
        }

        // All females in National, Regional, Constituency, and External Branch levels
        if (
          ["national", "region", "regional", "constituency"].includes(lvl) ||
          rawLvl === "external branch" ||
          rawLvl === "external" ||
          rawLvl.includes("external") ||
          String(r.region || "").toLowerCase().includes("external")
        ) {
          return true;
        }

        // TESCON: strictly female executives (Presidents, WOCOMs, and Nasara Coordinators; patrons strictly excluded)
        if (lvl === "tescon") {
          if (posLower.includes("patron")) return false;
          return /wocom|women|president|nasara/i.test(posLower);
        }

        return false;
      }

      if (matchedContest === "Nasara Organiser") {
        // All Nasara executives in core levels
        if (["national", "region", "regional", "constituency"].includes(lvl)) {
          return /nasara/i.test(posLower);
        }
        // TESCON Nasara
        if (lvl === "tescon") {
          return /nasara/i.test(posLower);
        }
        return false;
      }

      return false;
    };

    // Full nationwide pool of certified delegates for this contest position
    const positionNationwideRows = validRows.filter(isRowEligibleForContest);

    // Active subset constrained by selected administrative levels and regional jurisdictions
    const contestFiltered = positionNationwideRows.filter((r) => {
      const rawLvl = String(r.executive_level || "").toLowerCase().trim();
      const lvl = rawLvl === "external branch" ? "constituency" : rawLvl;

      // Optional Administrative Level Filter
      if (selectedLevels.length > 0) {
        const isExtBranch =
          rawLvl === "external branch" ||
          String(r.region || "").toLowerCase().trim() === "external branch";

        const matchesLevel = selectedLevels.some((target) => {
          if (target === "external branch" || target === "external" || target === "diaspora") {
            return isExtBranch;
          }
          if (target === "regional" || target === "region") {
            return (rawLvl === "region" || rawLvl === "regional") && !isExtBranch;
          }
          if (target === "constituency") {
            return rawLvl === "constituency" && !isExtBranch;
          }
          if (target === "tescon") {
            return rawLvl === "tescon";
          }
          if (target === "national") {
            return rawLvl === "national";
          }
          return rawLvl === target;
        });

        if (!matchesLevel) {
          return false;
        }
      }

      // Optional Region / Multi-Region & Jurisdiction Filter
      if (!isAllRegions && rawRegionsList.length > 0) {
        const rowRegion = String(r.region || "").toLowerCase().trim();
        const isRowExternal = rawLvl.includes("external") || rowRegion.includes("external");
        const isRowNational = rawLvl === "national" || rowRegion.includes("national");

        const matchesRegion = rawRegionsList.some((target) => {
          const tLower = target.toLowerCase().trim();
          if (tLower === "external branch" || tLower === "external" || tLower === "diaspora") {
            return isRowExternal;
          }
          if (tLower === "national headquarters" || tLower === "national" || tLower === "hq") {
            return isRowNational;
          }
          if (!isRowExternal && rowRegion === tLower) {
            return true;
          }
          if (rawRegionsList.length === 1 && searchParams.get("region") && !searchParams.get("regions")) {
            if (rawLvl === "national" && !tLower.includes("external")) {
              return true;
            }
          }
          return false;
        });

        if (!matchesRegion) {
          return false;
        }
      } else if (regionQuery !== "all" && regionQuery !== "") {
        const rowRegion = String(r.region || "").toLowerCase().trim();
        const isQueryExternal = regionQuery.toLowerCase().includes("external");
        const isRowExternal = rawLvl.includes("external") || rowRegion.includes("external");

        if (isQueryExternal) {
          if (!isRowExternal) return false;
        } else {
          if (!isRowExternal && rowRegion === regionQuery.toLowerCase()) {
            // matches region directly
          } else if (lvl === "national" && (!rowRegion || rowRegion === "national" || rowRegion === "hq")) {
            // matches national level
          } else {
            return false;
          }
        }
      }

      return true;
    });

    // 4. Sort strictly by 2-Stage Hierarchy:
    // Stage 1: Level (National -> Regional -> Constituency, including External Branch -> TESCON)
    // Stage 2: Positional Rank within each level
    const isExternalScope =
      (rawRegionsList.length === 1 &&
        (rawRegionsList[0].toLowerCase().includes("external") ||
          rawRegionsList[0].toLowerCase().includes("diaspora"))) ||
      (regionQuery.toLowerCase().includes("external") && rawRegionsList.length <= 1) ||
      (selectedLevels.length === 1 &&
        (selectedLevels[0].toLowerCase().includes("external") ||
          selectedLevels[0].toLowerCase().includes("diaspora")));

    const isSingleRegion =
      (!isAllRegions &&
        rawRegionsList.length === 1 &&
        !rawRegionsList[0].toLowerCase().includes("external") &&
        !rawRegionsList[0].toLowerCase().includes("national")) ||
      (rawRegionsList.length === 0 && regionQuery !== "all" && regionQuery !== "") ||
      isExternalScope;

    const delegates = contestFiltered
      .map((r) => {
        const lvl = String(r.executive_level || "").toLowerCase().trim();
        const rawReg = String(r.region || "").toLowerCase().trim();
        const isExternal =
          lvl === "external branch" ||
          lvl === "external" ||
          lvl.includes("external") ||
          rawReg.includes("external");
        const levelGroup =
          lvl === "national"
            ? "National"
            : lvl === "region" || lvl === "regional"
            ? "Regional"
            : isExternal
            ? "External Branch"
            : lvl === "constituency"
            ? "Constituency"
            : "TESCON";

        const canonPos = normalizeCanonicalPosition(r.position, r.executive_level);
        const posRank = normalizePositionRank(r.position);
        const levelRank = CANONICAL_LEVEL_ORDER[isExternal ? "external branch" : lvl] || 99;
        const regName = isExternal ? "External Branches" : String(r.region || "Unassigned").trim();
        const conName = String(r.constituency || "").trim();
        const age = calculateAgeIn2026(r.date_of_birth, r.age);
        const hasVoterId = Boolean(r.voter_id && String(r.voter_id).trim().length === 10);
        const isTescon = lvl === "tescon";
        const institution = isTescon ? getTesconInstitution(r as any) : "";
        const photoUrl = r.image_url && String(r.image_url).trim().length > 5 ? r.image_url.trim() : null;
        const avatarSvg = generateSvgAvatar(r.executive_name, canonPos);

        return {
          id: r.id,
          executive_name: String(r.executive_name).trim().toUpperCase(),
          position: r.position,
          canonical_position: canonPos,
          executive_level: levelGroup,
          region: regName,
          constituency: conName,
          institution,
          polling_station: r.polling_station ? String(r.polling_station).trim() : "",
          voter_id: r.voter_id ? String(r.voter_id).trim() : "—",
          has_voter_id: hasVoterId,
          phone: r.phone && String(r.phone).trim() !== "None" ? String(r.phone).trim() : "—",
          gender: r.gender ? String(r.gender).trim() : "Unknown",
          age,
          is_under_40: isUnder40AsOfCutoff(r.date_of_birth, r.age),
          image_url: photoUrl,
          webp_image_url: photoUrl
            ? `/api/admin/albums/image?url=${encodeURIComponent(photoUrl)}&w=240&h=300`
            : null,
          avatar_svg: avatarSvg,
          level_rank: levelRank,
          position_rank: posRank,
        };
      })
      .sort(isSingleRegion ? compareRegionalAlbumDelegates : compareAlbumDelegates);

    // 5. Compute Comprehensive Metrics
    const isCustom = isCustomContest && customPositionKeys.length > 0;

    // Constitutional Quotas: Regional is 21, Constituency is 19 (11 Elected + 8 Appointed)
    const constituencyPositionsSelected = isCustom
      ? customPositionKeys.filter((id) => CONSTITUENCY_POSITION_IDS.has(id)).length
      : 19;
    const regionalPositionsSelected = isCustom
      ? customPositionKeys.filter((id) => REGIONAL_POSITION_IDS.has(id)).length
      : 21;

    // Quotas: When all party portfolios are selected, regional is 21 and constituency is strictly 19!
    const regionalTargetPerUnit = isCustom
      ? Math.min(21, regionalPositionsSelected || customPositionKeys.length)
      : 21;
    const constituencyTargetPerUnit = isCustom
      ? Math.min(19, constituencyPositionsSelected || Math.min(19, customPositionKeys.length))
      : 19;

    const hasRegional =
      selectedLevels.length === 0 ||
      selectedLevels.includes("regional") ||
      selectedLevels.includes("region");
    const hasConstituency =
      selectedLevels.length === 0 || selectedLevels.includes("constituency");
    const hasNational =
      selectedLevels.length === 0 || selectedLevels.includes("national");
    const hasTescon =
      selectedLevels.length === 0 || selectedLevels.includes("tescon");
    const hasExternal =
      selectedLevels.length === 0 ||
      selectedLevels.includes("external branch") ||
      selectedLevels.includes("external") ||
      selectedLevels.includes("diaspora");

    const isRegionalOnly = hasRegional && !hasConstituency && selectedLevels.length === 1;
    const isConstituencyOnly = hasConstituency && !hasRegional && selectedLevels.length === 1;
    const isTesconOnly = hasTescon && selectedLevels.length === 1 && selectedLevels[0] === "tescon";

    const totalActual = delegates.length;
    let expectedCount = 0;

    // External target per chapter (30 external branch chapters)
    const externalTargetPerUnit = isWingOrganisers
      ? 2
      : isCustomContest
      ? Math.min(customPositionKeys.length, constituencyTargetPerUnit)
      : [
          "National Chairperson & General Officers",
          "Chairperson",
          "Vice Chairperson",
          "General Secretary",
          "Treasurer",
          "Communication Officer",
          "Organiser",
          "Youth Organiser",
          "Women Organiser",
          "Nasara Organiser",
        ].includes(matchedContest)
      ? 1
      : constituencyTargetPerUnit;

    if (isExternalScope) {
      if (
        matchedContest === "Women Organiser" ||
        matchedContest === "Women Organisers & Deputies" ||
        matchedContest === "All Women"
      ) {
        expectedCount = WOMEN_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 130;
      } else if (matchedContest === "All Men") {
        expectedCount = ALL_MEN_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 451;
      } else if (
        matchedContest === "National Chairperson & General Officers" ||
        matchedContest === "Chairperson" ||
        matchedContest === "Vice Chairperson" ||
        matchedContest === "General Secretary" ||
        matchedContest === "Treasurer" ||
        matchedContest === "Communication Officer" ||
        matchedContest === "Organiser"
      ) {
        expectedCount = filterGender === "male" ? 451 : filterGender === "female" ? 129 : 570;
      } else if (matchedContest === "Youth Organisers & Deputies") {
        expectedCount = 60;
      } else if (matchedContest === "Youth Organiser") {
        expectedCount = filterGender === "male" ? 138 : filterGender === "female" ? 39 : 175;
      } else if (
        matchedContest === "Nasara Organiser" ||
        matchedContest === "Nasara Coordinators & Deputies"
      ) {
        expectedCount = filterGender === "male" ? 40 : filterGender === "female" ? 12 : 60;
      } else if (isCustomContest) {
        expectedCount = 30 * externalTargetPerUnit;
      } else {
        expectedCount = filterGender === "male" ? 451 : filterGender === "female" ? 129 : 570;
      }
    } else if (
      (!isAllRegions && rawRegionsList.length === 1 && !rawRegionsList[0].toLowerCase().includes("national")) ||
      (rawRegionsList.length === 0 && regionQuery !== "all" && regionQuery !== "")
    ) {
      const singleReg = rawRegionsList.length === 1 ? rawRegionsList[0] : regionQuery;
      const regConCount =
        REGIONAL_CONSTITUENCY_COUNTS[singleReg] ||
        (getConstituenciesForRegion(singleReg).length || 0);

      const regKey = Object.keys(REGIONAL_CONSTITUENCY_COUNTS).find(
        (k) => k.toLowerCase() === singleReg.toLowerCase().trim()
      ) || singleReg;

      if (isCustomContest) {
        expectedCount =
          (hasRegional ? regionalTargetPerUnit : 0) +
          (hasConstituency ? regConCount * constituencyTargetPerUnit : 0);
      } else if (isRegionalOnly) {
        if (
          matchedContest === "Youth Organisers & Deputies" ||
          matchedContest === "Nasara Coordinators & Deputies"
        ) {
          expectedCount = 3;
        } else if (
          matchedContest === "Women Organiser" ||
          matchedContest === "Women Organisers & Deputies" ||
          matchedContest === "All Women"
        ) {
          expectedCount = 4;
        } else if (matchedContest === "All Men") {
          expectedCount = 17;
        } else {
          expectedCount = regionalTargetPerUnit;
        }
      } else if (isConstituencyOnly) {
        if (
          matchedContest === "Youth Organisers & Deputies" ||
          matchedContest === "Nasara Coordinators & Deputies"
        ) {
          expectedCount = regConCount * 2;
        } else if (
          matchedContest === "Women Organiser" ||
          matchedContest === "Women Organisers & Deputies" ||
          matchedContest === "All Women"
        ) {
          expectedCount = regConCount * 4;
        } else if (matchedContest === "All Men") {
          expectedCount = regConCount * 15;
        } else {
          expectedCount = regConCount * constituencyTargetPerUnit;
        }
      } else if (isTesconOnly) {
        expectedCount = totalActual;
      } else if (
        matchedContest === "Women Organiser" ||
        matchedContest === "Women Organisers & Deputies" ||
        matchedContest === "All Women"
      ) {
        const regTarget = WOMEN_REGIONAL_STATUTORY_QUOTAS[regKey] || regConCount * 4;
        expectedCount = regTarget + (hasNational ? 26 : 0);
      } else if (matchedContest === "All Men") {
        const regTarget = ALL_MEN_REGIONAL_STATUTORY_QUOTAS[regKey] || Math.round(regConCount * 15 + 17);
        expectedCount = regTarget + (hasNational ? 139 : 0);
      } else if (matchedContest === "Youth Organisers & Deputies") {
        const regTarget = YOUTH_WING_REGIONAL_STATUTORY_QUOTAS[regKey] || (regConCount * 2 + 3);
        expectedCount = regTarget + (hasNational ? 3 : 0);
      } else if (matchedContest === "Youth Organiser") {
        const regTarget = YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS[regKey] || (regConCount * 7 + 5);
        expectedCount = regTarget + (hasNational ? 7 : 0);
      } else if (
        matchedContest === "Nasara Organiser" ||
        matchedContest === "Nasara Coordinators & Deputies"
      ) {
        const regTarget = NASARA_REGIONAL_STATUTORY_QUOTAS[regKey] || (regConCount * 2 + 3);
        expectedCount = regTarget + (hasNational ? 4 : 0);
      } else if (
        matchedContest === "National Chairperson & General Officers" ||
        matchedContest === "Chairperson" ||
        matchedContest === "Vice Chairperson" ||
        matchedContest === "General Secretary" ||
        matchedContest === "Treasurer" ||
        matchedContest === "Communication Officer" ||
        matchedContest === "Organiser"
      ) {
        const regTarget = GENERAL_OFFICERS_REGIONAL_STATUTORY_QUOTAS[regKey] || (regConCount * 19 + 21);
        expectedCount = regTarget + (hasNational ? 174 : 0);
      } else {
        // Full Directory / Standard Single Region:
        // Regional Quota = 21, Constituency Quota = 19 (11 elected + 8 appointed)
        const regQuota = hasRegional ? regionalTargetPerUnit : 0;
        const conQuota = hasConstituency ? regConCount * constituencyTargetPerUnit : 0;
        const regBase = FULL_DIRECTORY_REGIONAL_STATUTORY_QUOTAS[regKey];
        expectedCount = regBase ? regBase + (hasNational ? 174 : 0) : regQuota + conQuota;
      }
    } else if (!isAllRegions && rawRegionsList.length > 1) {
      let multiExpected = 0;
      const hasNationalInRegions = rawRegionsList.some((r) => r.toLowerCase().includes("national") || r.toLowerCase() === "hq");
      const hasExternalInRegions = rawRegionsList.some((r) => r.toLowerCase().includes("external") || r.toLowerCase() === "diaspora");

      for (const rawR of rawRegionsList) {
        const rKey = Object.keys(REGIONAL_CONSTITUENCY_COUNTS).find(
          (k) => k.toLowerCase() === rawR.toLowerCase().trim()
        );
        if (!rKey) continue;
        const regConCount = REGIONAL_CONSTITUENCY_COUNTS[rKey] || 0;

        if (isCustomContest) {
          multiExpected +=
            (hasRegional ? regionalTargetPerUnit : 0) +
            (hasConstituency ? regConCount * constituencyTargetPerUnit : 0);
        } else if (isRegionalOnly) {
          multiExpected += filterGender === "male" ? 17 : filterGender === "female" ? 4 : regionalTargetPerUnit;
        } else if (isConstituencyOnly) {
          multiExpected += regConCount * (filterGender === "male" ? 15 : filterGender === "female" ? 4 : constituencyTargetPerUnit);
        } else if (
          matchedContest === "Women Organiser" ||
          matchedContest === "Women Organisers & Deputies" ||
          matchedContest === "All Women"
        ) {
          multiExpected += WOMEN_REGIONAL_STATUTORY_QUOTAS[rKey] || regConCount * 4;
        } else if (matchedContest === "All Men") {
          multiExpected += ALL_MEN_REGIONAL_STATUTORY_QUOTAS[rKey] || Math.round(regConCount * 15 + 17);
        } else if (matchedContest === "Youth Organisers & Deputies") {
          multiExpected += YOUTH_WING_REGIONAL_STATUTORY_QUOTAS[rKey] || (regConCount * 2 + 3);
        } else if (matchedContest === "Youth Organiser") {
          multiExpected += YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS[rKey] || (regConCount * 7 + 5);
        } else if (
          matchedContest === "Nasara Organiser" ||
          matchedContest === "Nasara Coordinators & Deputies"
        ) {
          multiExpected += NASARA_REGIONAL_STATUTORY_QUOTAS[rKey] || (regConCount * 2 + 3);
        } else if (
          matchedContest === "National Chairperson & General Officers" ||
          matchedContest === "Chairperson" ||
          matchedContest === "Vice Chairperson" ||
          matchedContest === "General Secretary" ||
          matchedContest === "Treasurer" ||
          matchedContest === "Communication Officer" ||
          matchedContest === "Organiser"
        ) {
          multiExpected += GENERAL_OFFICERS_REGIONAL_STATUTORY_QUOTAS[rKey] || (regConCount * 19 + 21);
        } else {
          multiExpected += FULL_DIRECTORY_REGIONAL_STATUTORY_QUOTAS[rKey] || ((hasRegional ? 21 : 0) + (hasConstituency ? regConCount * 19 : 0));
        }
      }

      if (hasExternalInRegions && hasExternal) {
        if (matchedContest === "Women Organiser" || matchedContest === "Women Organisers & Deputies" || matchedContest === "All Women") {
          multiExpected += WOMEN_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 130;
        } else if (matchedContest === "All Men") {
          multiExpected += ALL_MEN_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 451;
        } else if (matchedContest === "Youth Organisers & Deputies") {
          multiExpected += YOUTH_WING_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 60;
        } else if (matchedContest === "Youth Organiser") {
          multiExpected += YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 177;
        } else if (matchedContest === "Nasara Organiser" || matchedContest === "Nasara Coordinators & Deputies") {
          multiExpected += NASARA_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 52;
        } else if (isCustomContest) {
          multiExpected += 30 * externalTargetPerUnit;
        } else {
          multiExpected += filterGender === "male" ? 451 : filterGender === "female" ? 129 : 580;
        }
      }

      if (hasNationalInRegions && hasNational) {
        if (matchedContest === "Women Organiser" || matchedContest === "Women Organisers & Deputies" || matchedContest === "All Women") {
          multiExpected += WOMEN_REGIONAL_STATUTORY_QUOTAS["National Headquarters"] || 26;
        } else if (matchedContest === "All Men") {
          multiExpected += ALL_MEN_REGIONAL_STATUTORY_QUOTAS["National Headquarters"] || 139;
        } else if (matchedContest === "Youth Organisers & Deputies") {
          multiExpected += 3;
        } else if (matchedContest === "Youth Organiser") {
          multiExpected += YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS["National Headquarters"] || 4;
        } else if (matchedContest === "Nasara Organiser" || matchedContest === "Nasara Coordinators & Deputies") {
          multiExpected += NASARA_REGIONAL_STATUTORY_QUOTAS["National Headquarters"] || 3;
        } else {
          multiExpected += filterGender === "male" ? 139 : filterGender === "female" ? 26 : 165;
        }
      }

      if (hasTescon && (matchedContest === "Youth Organiser" || matchedContest === "Youth Organisers & Deputies" || matchedContest === "Women Organiser" || matchedContest === "Women Organisers & Deputies" || matchedContest === "All Women" || matchedContest === "Nasara Organiser" || matchedContest === "Nasara Coordinators & Deputies")) {
        const tesconActualInMulti = delegates.filter((d) => String(d.executive_level || "").toLowerCase() === "tescon").length;
        multiExpected += tesconActualInMulti;
      }

      expectedCount = multiExpected;
    } else {
      // Nationwide (all regions)
      if (isWingOrganisers) {
        if (selectedLevels.length === 0 || selectedLevels.length === 5) {
          if (
            matchedContest === "Youth Organisers & Deputies" ||
            matchedContest === "Youth Organiser"
          ) {
            expectedCount = 1400;
          } else if (matchedContest === "Women Organisers & Deputies") {
            expectedCount = 1390;
          } else if (
            matchedContest === "Nasara Coordinators & Deputies" ||
            matchedContest === "Nasara Organiser"
          ) {
            expectedCount = 867;
          } else {
            expectedCount =
              (hasConstituency ? 276 * 2 : 0) +
              (hasRegional ? 16 * 3 : 0) +
              (hasNational ? 3 : 0) +
              (hasExternal ? 30 * 2 : 0);
          }
        } else {
          const tesconWingTarget =
            hasTescon
              ? matchedContest === "Youth Organisers & Deputies" ||
                matchedContest === "Youth Organiser"
                ? 746
                : matchedContest === "Women Organisers & Deputies"
                ? 247
                : matchedContest === "Nasara Coordinators & Deputies" ||
                  matchedContest === "Nasara Organiser"
                ? 244
                : 0
              : 0;
          expectedCount =
            (hasConstituency ? 276 * 2 : 0) +
            (hasRegional ? 16 * 3 : 0) +
            (hasNational ? 3 : 0) +
            (hasExternal ? 30 * 2 : 0) +
            tesconWingTarget;
        }
      } else if (isCustomContest) {
        expectedCount =
          (hasRegional ? 16 * regionalTargetPerUnit : 0) +
          (hasConstituency ? 276 * constituencyTargetPerUnit : 0) +
          (hasNational ? Math.min(30, customPositionKeys.length) : 0) +
          (hasExternal ? 30 * externalTargetPerUnit : 0);
      } else if (isRegionalOnly) {
        expectedCount = 16 * 21; // 336
        if (filterGender === "male") expectedCount = 266;
        else if (filterGender === "female") expectedCount = 71;
      } else if (isConstituencyOnly) {
        expectedCount = 276 * 19; // 5,244
        if (filterGender === "male") expectedCount = 4144;
        else if (filterGender === "female") expectedCount = 1061;
      } else if (
        matchedContest === "National Chairperson & General Officers" ||
        matchedContest === "Chairperson" ||
        matchedContest === "Vice Chairperson" ||
        matchedContest === "General Secretary" ||
        matchedContest === "Treasurer" ||
        matchedContest === "Communication Officer" ||
        matchedContest === "Organiser"
      ) {
        expectedCount = filterGender === "male" ? 5201 : filterGender === "female" ? 1309 : 6544;
      } else if (matchedContest === "Youth Organiser") {
        expectedCount = filterGender === "male" ? 2292 : filterGender === "female" ? 558 : 2850;
      } else if (
        matchedContest === "Women Organiser" ||
        matchedContest === "Women Organisers & Deputies" ||
        matchedContest === "All Women"
      ) {
        expectedCount = 1390;
      } else if (
        matchedContest === "Nasara Organiser" ||
        matchedContest === "Nasara Coordinators & Deputies"
      ) {
        expectedCount = filterGender === "male" ? 784 : filterGender === "female" ? 83 : 867;
      } else if (matchedContest === "Youth Organisers & Deputies") {
        expectedCount = 1400;
      } else if (matchedContest === "All Men") {
        expectedCount = 5606;
      } else {
        // Full Directory (All Executives) Nationwide:
        expectedCount = filterGender === "male" ? 5606 : filterGender === "female" ? 1390 : 7039;
      }
    }

    const levelCounts = delegates.reduce(
      (acc, d) => {
        acc[d.executive_level] = (acc[d.executive_level] || 0) + 1;
        return acc;
      },
      { National: 0, Regional: 0, "External Branch": 0, Constituency: 0, TESCON: 0 } as Record<string, number>
    );

    const genderCounts = delegates.reduce(
      (acc, d) => {
        const g = d.gender.toLowerCase();
        if (g === "female") acc.female++;
        else if (g === "male") acc.male++;
        else acc.unknown++;
        return acc;
      },
      { male: 0, female: 0, unknown: 0 }
    );

    const ageCounts = delegates.reduce(
      (acc, d) => {
        if (d.is_under_40) acc.under40++;
        else if (d.age === null) acc.pending++;
        else acc.fortyPlus++;
        return acc;
      },
      { under40: 0, fortyPlus: 0, pending: 0 }
    );

    const verifiedVoterIds = delegates.filter((d) => d.has_voter_id).length;

    // Regional breakdown table
    const regionalMap = new Map<string, number>();
    for (const d of delegates) {
      const regLower = String(d.region || "").toLowerCase().trim();
      const lvlLower = String(d.executive_level || "").toLowerCase().trim();
      const reg =
        lvlLower === "national" || regLower === "national"
          ? "National Headquarters"
          : lvlLower === "external branch" || regLower.includes("external")
          ? "External Branches"
          : d.region;
      regionalMap.set(reg, (regionalMap.get(reg) || 0) + 1);
    }
    const regionalBreakdown = Array.from(regionalMap.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    // Statutory Audit Calculations for Administrative Levels
    // Regional Executives Statutory Target: 21 per Region
    // Constituency Executives Statutory Target: 19 per Constituency (11 Elected + 8 Appointed)
    const activeRegions =
      !isAllRegions && rawRegionsList.length > 0
        ? GHANA_REGIONS_ORDER.filter((r) =>
            rawRegionsList.some((sel) => sel.toLowerCase().trim() === r.toLowerCase().trim())
          )
        : regionQuery !== "all" && regionQuery !== ""
        ? GHANA_REGIONS_ORDER.filter((r) => r.toLowerCase() === regionQuery.toLowerCase())
        : GHANA_REGIONS_ORDER;

    if (activeRegions.length === 0 && !isAllRegions && !isExternalScope) {
      if (rawRegionsList.length > 0) {
        activeRegions.push(
          ...rawRegionsList.filter(
            (r) => !r.toLowerCase().includes("external") && !r.toLowerCase().includes("national")
          )
        );
      } else if (regionQuery !== "all") {
        activeRegions.push(regionQuery);
      }
    }

    const isWomenContest =
      matchedContest === "All Women" ||
      matchedContest === "Women Organiser" ||
      matchedContest === "Women Organisers & Deputies" ||
      filterGender === "female";

    const isMenContest =
      matchedContest === "All Men" ||
      filterGender === "male";

    // Authoritative Position National Benchmark (Full Electoral College Baseline)
    let positionNationalExpected = 0;
    if (isWingOrganisers) {
      if (
        matchedContest === "Youth Organisers & Deputies" ||
        matchedContest === "Youth Organiser"
      ) {
        positionNationalExpected = 1400;
      } else if (matchedContest === "Women Organisers & Deputies") {
        positionNationalExpected = 1390;
      } else if (
        matchedContest === "Nasara Coordinators & Deputies" ||
        matchedContest === "Nasara Organiser"
      ) {
        positionNationalExpected = 867;
      } else {
        positionNationalExpected = 276 * 2 + 16 * 3 + 3 + 30 * 2;
      }
    } else if (isCustomContest) {
      positionNationalExpected =
        16 * regionalTargetPerUnit +
        276 * constituencyTargetPerUnit +
        Math.min(30, customPositionKeys.length) +
        30 * externalTargetPerUnit;
    } else if (isRegionalOnly) {
      positionNationalExpected = filterGender === "male" ? 266 : filterGender === "female" ? 71 : 16 * 21;
    } else if (isConstituencyOnly) {
      positionNationalExpected = filterGender === "male" ? 4144 : filterGender === "female" ? 1061 : 276 * 19;
    } else if (
      matchedContest === "National Chairperson & General Officers" ||
      matchedContest === "Chairperson" ||
      matchedContest === "Vice Chairperson" ||
      matchedContest === "General Secretary" ||
      matchedContest === "Treasurer" ||
      matchedContest === "Communication Officer" ||
      matchedContest === "Organiser"
    ) {
      positionNationalExpected = filterGender === "male" ? 5201 : filterGender === "female" ? 1309 : 6544;
    } else if (matchedContest === "Youth Organiser") {
      positionNationalExpected = filterGender === "male" ? 2292 : filterGender === "female" ? 558 : 2850;
    } else if (
      matchedContest === "Women Organiser" ||
      matchedContest === "Women Organisers & Deputies" ||
      matchedContest === "All Women"
    ) {
      positionNationalExpected = 1390;
    } else if (
      matchedContest === "Nasara Organiser" ||
      matchedContest === "Nasara Coordinators & Deputies"
    ) {
      positionNationalExpected = filterGender === "male" ? 784 : filterGender === "female" ? 83 : 867;
    } else if (matchedContest === "Youth Organisers & Deputies") {
      positionNationalExpected = 1400;
    } else if (matchedContest === "All Men") {
      positionNationalExpected = 5606;
    } else {
      positionNationalExpected = filterGender === "male" ? 5606 : filterGender === "female" ? 1390 : 7039;
    }

    const positionNationalConfirmed = positionNationwideRows.length;
    const positionNationalRate = positionNationalExpected > 0 ? Math.min(100, Math.max(0, (positionNationalConfirmed / positionNationalExpected) * 100)).toFixed(1) + "%" : "100%";

    // Comprehensive breakdown across all 16 Ghanaian regions with Active vs Left-Out status
    const allRegionalRows = GHANA_REGIONS_ORDER.map((reg) => {
      const isIncluded = activeRegions.some((r) => r.toLowerCase().trim() === reg.toLowerCase().trim());
      const numConstituencies = REGIONAL_CONSTITUENCY_COUNTS[reg] || 0;

      const regNationwideConfirmed = positionNationwideRows.filter(
        (d) =>
          String(d.region || "").toLowerCase().trim() === reg.toLowerCase().trim() &&
          (String(d.executive_level || "").toLowerCase().trim() === "regional" ||
            String(d.executive_level || "").toLowerCase().trim() === "region")
      ).length;

      const conNationwideConfirmed = positionNationwideRows.filter(
        (d) =>
          String(d.region || "").toLowerCase().trim() === reg.toLowerCase().trim() &&
          String(d.executive_level || "").toLowerCase().trim() === "constituency"
      ).length;

      const totalNationwideConfirmed = regNationwideConfirmed + conNationwideConfirmed;

      const regActiveConfirmed = delegates.filter(
        (d) =>
          String(d.region || "").toLowerCase().trim() === reg.toLowerCase().trim() &&
          (String(d.executive_level || "").toLowerCase().trim() === "regional" ||
            String(d.executive_level || "").toLowerCase().trim() === "region")
      ).length;

      const conActiveConfirmed = delegates.filter(
        (d) =>
          String(d.region || "").toLowerCase().trim() === reg.toLowerCase().trim() &&
          String(d.executive_level || "").toLowerCase().trim() === "constituency"
      ).length;

      const totalActiveConfirmed = regActiveConfirmed + conActiveConfirmed;

      const regTarget = isWomenContest ? 4 : isMenContest ? 17 : regionalTargetPerUnit;
      const conTarget = isWomenContest
        ? (WOMEN_REGIONAL_STATUTORY_QUOTAS[reg] ? Math.max(0, WOMEN_REGIONAL_STATUTORY_QUOTAS[reg] - regTarget) : numConstituencies * 4)
        : isMenContest
        ? (ALL_MEN_REGIONAL_STATUTORY_QUOTAS[reg] ? Math.max(0, ALL_MEN_REGIONAL_STATUTORY_QUOTAS[reg] - regTarget) : numConstituencies * 15)
        : matchedContest === "Youth Organiser"
        ? (YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS[reg] ? Math.max(0, YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS[reg] - regTarget) : numConstituencies * 7)
        : matchedContest === "Youth Organisers & Deputies"
        ? (YOUTH_WING_REGIONAL_STATUTORY_QUOTAS[reg] ? Math.max(0, YOUTH_WING_REGIONAL_STATUTORY_QUOTAS[reg] - regTarget) : numConstituencies * 2)
        : (matchedContest === "Nasara Organiser" || matchedContest === "Nasara Coordinators & Deputies")
        ? (NASARA_REGIONAL_STATUTORY_QUOTAS[reg] ? Math.max(0, NASARA_REGIONAL_STATUTORY_QUOTAS[reg] - regTarget) : numConstituencies * 2)
        : numConstituencies * constituencyTargetPerUnit;

      const totalTarget = isWomenContest
        ? (WOMEN_REGIONAL_STATUTORY_QUOTAS[reg] || (regTarget + conTarget))
        : isMenContest
        ? (ALL_MEN_REGIONAL_STATUTORY_QUOTAS[reg] || (regTarget + conTarget))
        : matchedContest === "Youth Organiser"
        ? (YOUTH_GENERAL_REGIONAL_STATUTORY_QUOTAS[reg] || (regTarget + conTarget))
        : matchedContest === "Youth Organisers & Deputies"
        ? (YOUTH_WING_REGIONAL_STATUTORY_QUOTAS[reg] || (regTarget + conTarget))
        : (matchedContest === "Nasara Organiser" || matchedContest === "Nasara Coordinators & Deputies")
        ? (NASARA_REGIONAL_STATUTORY_QUOTAS[reg] || (regTarget + conTarget))
        : (regTarget + conTarget);

      return {
        region: reg,
        numConstituencies,
        isIncluded,
        regConfirmed: isIncluded ? regActiveConfirmed : regNationwideConfirmed,
        conConfirmed: isIncluded ? conActiveConfirmed : conNationwideConfirmed,
        totalConfirmed: isIncluded ? totalActiveConfirmed : totalNationwideConfirmed,
        regNationwideConfirmed,
        conNationwideConfirmed,
        totalNationwideConfirmed,
        regTarget,
        conTarget,
        totalTarget,
      };
    });

    const selectedRegion = isSingleRegion ? (isExternalScope ? "External Branch" : (activeRegions[0] || regionQuery)) : "";
    const regionDisplayName = isExternalScope
      ? "EXTERNAL BRANCHES"
      : isSingleRegion
      ? selectedRegion.toUpperCase()
      : `${activeRegions.length} REGIONS`;

    const extCount = delegates.filter((d) => String(d.executive_level || "").toLowerCase().trim() === "external branch").length;
    const tesconCount = delegates.filter((d) => String(d.executive_level || "").toLowerCase().trim() === "tescon").length;
    const natCount = delegates.filter((d) => String(d.executive_level || "").toLowerCase().trim() === "national").length;

    const extNationwideCount = positionNationwideRows.filter(
      (d) =>
        String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
        String(d.region || "").toLowerCase().includes("external")
    ).length;
    const isExtIncluded =
      hasExternal &&
      (isAllRegions ||
        rawRegionsList.some(
          (r) => r.toLowerCase().includes("external") || r.toLowerCase().includes("diaspora")
        ));
    const extNumConstituencies = 30;
    const extConstituencyTarget = isWomenContest
      ? (WOMEN_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 130)
      : isMenContest
      ? (ALL_MEN_REGIONAL_STATUTORY_QUOTAS["External Branch"] || 451)
      : extNumConstituencies * 19;

    const natNationwideCount = positionNationwideRows.filter(
      (d) => String(d.executive_level || "").toLowerCase().trim() === "national"
    ).length;
    const isNatIncluded =
      hasNational &&
      (isAllRegions ||
        rawRegionsList.some(
          (r) => r.toLowerCase().includes("national") || r.toLowerCase() === "hq"
        ));
    const natTarget = isWomenContest
      ? (WOMEN_REGIONAL_STATUTORY_QUOTAS["National Headquarters"] || 26)
      : isMenContest
      ? (ALL_MEN_REGIONAL_STATUTORY_QUOTAS["National Headquarters"] || 139)
      : (natNationwideCount || 165);

    const tesconNationwideCount = positionNationwideRows.filter(
      (d) => String(d.executive_level || "").toLowerCase().trim() === "tescon"
    ).length;
    const isTesconIncluded = hasTescon;

    const includedRows = allRegionalRows.filter((r) => r.isIncluded);
    const excludedRows = allRegionalRows.filter((r) => !r.isIncluded);

    const sumIncludedRegConfirmed = includedRows.reduce((a, b) => a + b.regConfirmed, 0);
    const sumIncludedRegTarget = includedRows.reduce((a, b) => a + b.regTarget, 0);
    const sumIncludedConConfirmed = includedRows.reduce((a, b) => a + b.conConfirmed, 0) + (isExtIncluded ? extCount : 0);
    const sumIncludedConTarget = includedRows.reduce((a, b) => a + b.conTarget, 0) + (isExtIncluded ? extConstituencyTarget : 0);
    const sumIncludedTotalConfirmed = includedRows.reduce((a, b) => a + b.totalConfirmed, 0) + (isExtIncluded ? extCount : 0) + (isNatIncluded ? natCount : 0) + (isTesconIncluded ? tesconCount : 0);
    const sumIncludedTotalTarget = includedRows.reduce((a, b) => a + b.totalTarget, 0) + (isExtIncluded ? extConstituencyTarget : 0) + (isNatIncluded ? natTarget : 0) + (isTesconIncluded ? tesconCount : 0);
    const sumIncludedConstituencies = includedRows.reduce((a, b) => a + b.numConstituencies, 0) + (isExtIncluded ? extNumConstituencies : 0);

    const sumExcludedRegConfirmed = excludedRows.reduce((a, b) => a + b.regNationwideConfirmed, 0);
    const sumExcludedRegTarget = excludedRows.reduce((a, b) => a + b.regTarget, 0);
    const sumExcludedConConfirmed = excludedRows.reduce((a, b) => a + b.conNationwideConfirmed, 0) + (!isExtIncluded && extNationwideCount > 0 ? extNationwideCount : 0);
    const sumExcludedConTarget = excludedRows.reduce((a, b) => a + b.conTarget, 0) + (!isExtIncluded ? extConstituencyTarget : 0);
    const sumExcludedTotalConfirmed = excludedRows.reduce((a, b) => a + b.totalNationwideConfirmed, 0) + (!isExtIncluded ? extNationwideCount : 0) + (!isNatIncluded ? natNationwideCount : 0) + (!isTesconIncluded ? tesconNationwideCount : 0);
    const sumExcludedTotalTarget = excludedRows.reduce((a, b) => a + b.totalTarget, 0) + (!isExtIncluded ? extConstituencyTarget : 0) + (!isNatIncluded ? natTarget : 0) + (!isTesconIncluded ? tesconNationwideCount : 0);
    const sumExcludedConstituencies = excludedRows.reduce((a, b) => a + b.numConstituencies, 0) + (!isExtIncluded ? extNumConstituencies : 0);

    const sumAllConstituencies = 276 + extNumConstituencies;
    const sumAllRegConfirmed = allRegionalRows.reduce((a, b) => a + b.regNationwideConfirmed, 0);
    const sumAllRegTarget = allRegionalRows.reduce((a, b) => a + b.regTarget, 0);
    const sumAllConConfirmed = allRegionalRows.reduce((a, b) => a + b.conNationwideConfirmed, 0) + extNationwideCount;
    const sumAllConTarget = allRegionalRows.reduce((a, b) => a + b.conTarget, 0) + extConstituencyTarget;
    const sumAllTotalConfirmed = positionNationwideRows.length;
    const sumAllTotalTarget = positionNationalExpected;

    const isRegionalSubset = !isAllRegions || isSingleRegion || activeRegions.length < 16 || !isExtIncluded;
    const includedJurisdictionsCount = includedRows.length + (isExtIncluded ? 1 : 0) + (isNatIncluded ? 1 : 0);
    const excludedJurisdictionsCount = excludedRows.length + (!isExtIncluded ? 1 : 0) + (!isNatIncluded ? 1 : 0);

    const regionalRows = activeRegions.map((reg) => {
      const regConfirmed = delegates.filter(
        (d) =>
          String(d.region || "").toLowerCase().trim() === reg.toLowerCase().trim() &&
          (String(d.executive_level || "").toLowerCase().trim() === "regional" ||
            String(d.executive_level || "").toLowerCase().trim() === "region")
      ).length;

      const conConfirmed = delegates.filter(
        (d) =>
          String(d.region || "").toLowerCase().trim() === reg.toLowerCase().trim() &&
          String(d.executive_level || "").toLowerCase().trim() === "constituency"
      ).length;

      const numConstituencies = REGIONAL_CONSTITUENCY_COUNTS[reg] || 0;
      const regTarget = isWomenContest ? 4 : isMenContest ? 17 : regionalTargetPerUnit;
      const conTarget = isWomenContest ? numConstituencies * 4 : isMenContest ? numConstituencies * 15 : numConstituencies * constituencyTargetPerUnit;
      const totalConfirmed = regConfirmed + conConfirmed;
      const totalTarget = regTarget + conTarget;

      return {
        region: reg,
        numConstituencies,
        regConfirmed,
        regTarget,
        conConfirmed,
        conTarget,
        totalConfirmed,
        totalTarget,
      };
    });

    let sumConstituencies = 0;
    let sumRegConfirmed = 0;
    let sumRegTarget = 0;
    let sumConConfirmed = 0;
    let sumConTarget = 0;
    let sumTotalConfirmed = 0;
    let sumTotalTarget = 0;

    for (const row of regionalRows) {
      sumConstituencies += row.numConstituencies;
      sumRegConfirmed += row.regConfirmed;
      sumRegTarget += row.regTarget;
      sumConConfirmed += row.conConfirmed;
      sumConTarget += row.conTarget;
      sumTotalConfirmed += row.totalConfirmed;
      sumTotalTarget += row.totalTarget;
    }

    let levelAudit: {
      tableTitle: string;
      tableSub: string;
      footerLabel: string;
      headersHtml: string;
      rowsHtml: string;
      footerHtml: string;
      contentHtml?: string;
      auditRows: any[];
    } | null = null;

    if (isSingleRegion) {
      // Build detailed constituency-level breakdown for this specific region / diaspora jurisdiction
      const conList = getConstituenciesForRegion(selectedRegion);
      const conNames =
        conList.length > 0
          ? conList
          : Array.from(
              new Set(
                delegates
                  .filter(
                    (d) =>
                      (String(d.executive_level || "").toLowerCase().trim() === "constituency" ||
                        (isExternalScope &&
                          (String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
                            String(d.region || "").toLowerCase().includes("external")))) &&
                      String(d.region || "").toLowerCase().trim() === selectedRegion.toLowerCase().trim()
                  )
                  .map((d) => d.constituency)
                  .filter(Boolean)
              )
            );

      const auditItems: Array<{
        isRegional: boolean;
        num: string;
        name: string;
        level: string;
        confirmed: number;
        target: number;
        variance: string;
        rate: string;
      }> = [];

      const includeRegional = !isExternalScope && (hasRegional || (!isRegionalOnly && !isConstituencyOnly));
      const includeConstituency = isExternalScope || hasConstituency || (!isRegionalOnly && !isConstituencyOnly);
      const includeTescon = !isExternalScope && (hasTescon || (!isRegionalOnly && !isConstituencyOnly));

      if (includeRegional) {
        const regConfirmed = delegates.filter(
          (d) =>
            getRegionalSectionRank(d) === 1 &&
            (String(d.region || "").toLowerCase().trim() === selectedRegion.toLowerCase().trim() ||
              selectedRegion.toLowerCase().includes(String(d.region || "").toLowerCase().trim()))
        ).length;
        const regTarget = isWomenContest ? 4 : regionalTargetPerUnit;
        const regVariance = regTarget - regConfirmed;
        auditItems.push({
          isRegional: true,
          num: "★",
          name: `${selectedRegion} Regional Executive Committee`,
          level: "Regional",
          confirmed: regConfirmed,
          target: regTarget,
          variance: regVariance > 0 ? `-${regVariance}` : "0",
          rate: regTarget > 0 ? Math.min(100, Math.max(0, (regConfirmed / regTarget) * 100)).toFixed(1) + "%" : "100%",
        });

        // National Council Representatives in this region
        const ncCouncilInReg = delegates.filter(
          (d) =>
            getRegionalSectionRank(d) === 2 &&
            (String(d.region || "").toLowerCase().trim() === selectedRegion.toLowerCase().trim() ||
              selectedRegion.toLowerCase().includes(String(d.region || "").toLowerCase().trim()))
        );
        if (ncCouncilInReg.length > 0) {
          auditItems.push({
            isRegional: true,
            num: "NC",
            name: `${selectedRegion} National Council Representatives`,
            level: "National Council",
            confirmed: ncCouncilInReg.length,
            target: ncCouncilInReg.length,
            variance: "0",
            rate: "100%",
          });
        }

        // Foundation Members in this region
        const foundationInReg = delegates.filter(
          (d) =>
            getRegionalSectionRank(d) === 3 &&
            (String(d.region || "").toLowerCase().trim() === selectedRegion.toLowerCase().trim() ||
              selectedRegion.toLowerCase().includes(String(d.region || "").toLowerCase().trim()))
        );
        if (foundationInReg.length > 0) {
          auditItems.push({
            isRegional: true,
            num: "FM",
            name: `${selectedRegion} Foundation Members`,
            level: "Foundation",
            confirmed: foundationInReg.length,
            target: foundationInReg.length,
            variance: "0",
            rate: "100%",
          });
        }

        // Members of Parliament (MPs) in this region
        const mpsInReg = delegates.filter(
          (d) =>
            getRegionalSectionRank(d) === 4 &&
            (String(d.region || "").toLowerCase().trim() === selectedRegion.toLowerCase().trim() ||
              selectedRegion.toLowerCase().includes(String(d.region || "").toLowerCase().trim()))
        );
        if (mpsInReg.length > 0) {
          auditItems.push({
            isRegional: true,
            num: "MP",
            name: `${selectedRegion} Members of Parliament (MPs)`,
            level: "Parliament",
            confirmed: mpsInReg.length,
            target: mpsInReg.length,
            variance: "0",
            rate: "100%",
          });
        }
      }

      if (includeConstituency) {
        for (let i = 0; i < conNames.length; i++) {
          const cName = conNames[i];
          const norm = normalizeConstituency(cName);
          const confirmed = delegates.filter(
            (d) =>
              (String(d.executive_level || "").toLowerCase().trim() === "constituency" ||
                (isExternalScope &&
                  (String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
                    String(d.region || "").toLowerCase().includes("external")))) &&
              getRegionalSectionRank(d) !== 2 &&
              getRegionalSectionRank(d) !== 3 &&
              getRegionalSectionRank(d) !== 4 &&
              (normalizeConstituency(d.constituency) === norm ||
                d.constituency.toLowerCase().trim() === cName.toLowerCase().trim()) &&
              (!d.region ||
                selectedRegion.toLowerCase().trim() === "external branch" ||
                String(d.region).toLowerCase().trim() === selectedRegion.toLowerCase().trim())
          ).length;
          const target = isExternalScope
            ? (isWomenContest ? 4 : externalTargetPerUnit)
            : (isWomenContest ? 4 : constituencyTargetPerUnit);
          const variance = target - confirmed;
          auditItems.push({
            isRegional: false,
            num: String(i + 1),
            name: isExternalScope ? `${cName} External Branch` : `${cName} Constituency`,
            level: isExternalScope ? "External Branch" : "Constituency",
            confirmed,
            target,
            variance: variance > 0 ? `-${variance}` : "0",
            rate: target > 0 ? Math.min(100, Math.max(0, (confirmed / target) * 100)).toFixed(1) + "%" : "100%",
          });
        }
      }

      if (includeTescon) {
        const tesconInReg = delegates.filter(
          (d) =>
            String(d.executive_level || "").toLowerCase().trim() === "tescon" &&
            (!d.region ||
              String(d.region).toLowerCase().trim() === selectedRegion.toLowerCase().trim() ||
              selectedRegion.toLowerCase().includes(String(d.region || "").toLowerCase().trim()))
        );
        if (tesconInReg.length > 0) {
          const instCount = new Set(
            tesconInReg.map((td) => (td.polling_station || td.constituency || "").trim()).filter(Boolean)
          ).size;
          auditItems.push({
            isRegional: false,
            num: "T",
            name: `${selectedRegion} TESCON Executives (${instCount} Accredited Institutions)`,
            level: "TESCON",
            confirmed: tesconInReg.length,
            target: tesconInReg.length,
            variance: "0",
            rate: "100%",
          });
        }
      }

      const sumItemConfirmed = auditItems.reduce((acc, it) => acc + it.confirmed, 0);
      const sumItemTarget = auditItems.reduce((acc, it) => acc + it.target, 0);
      const sumItemVariance = sumItemTarget - sumItemConfirmed;
      const sumItemRate = sumItemTarget > 0 ? Math.min(100, Math.max(0, (sumItemConfirmed / sumItemTarget) * 100)).toFixed(1) + "%" : "100%";

      const numConstituenciesInAudit = auditItems.filter((it) => it.level === "Constituency" || it.level === "External Branch").length;
      const numTesconInAudit = auditItems.filter((it) => it.level === "TESCON").length;
      const hasMpsInAudit = auditItems.some((it) => it.level === "Parliament");
      const summaryUnitsLabel = isExternalScope
        ? "30 EXTERNAL BRANCHES / COUNTRIES"
        : `${numConstituenciesInAudit} CONSTITUENCIES${includeRegional ? " + REGIONAL EXEC" : ""}${hasMpsInAudit ? " + MPS" : ""}${numTesconInAudit > 0 ? " + TESCON EXECUTIVES" : ""}`;

      const titleSuffix = isExternalScope
        ? "STATUTORY AUDIT & SIGN-OFF"
        : includeRegional && includeConstituency
        ? "REGIONAL & CONSTITUENCY"
        : includeRegional
        ? "REGIONAL LEADERSHIP"
        : "CONSTITUENCY LEADERSHIP";

      const subDetail = isExternalScope
        ? (isWomenContest
            ? `30 External Chapters / Countries · Female Electoral College Statutory Distribution`
            : isMenContest
            ? `30 External Chapters / Countries · Male Electoral College Statutory Distribution`
            : `30 External Chapters / Countries · Statutory Quota Distribution (@ ${externalTargetPerUnit} per Chapter)`)
        : isWomenContest
        ? `Female Electoral College Statutory Distribution (Regional Quota: 4 · Constituency Quotas: 4 per Constituency)`
        : isMenContest
        ? `Male Electoral College Statutory Distribution (Regional Quota: 17 · Constituency Quotas: 15 per Constituency)`
        : includeRegional && includeConstituency
        ? `Regional Executive Quota (${regionalTargetPerUnit}) & Constituency Quotas (${constituencyTargetPerUnit} per Constituency: 11 Elected + 8 Appointed)`
        : includeRegional
        ? `Regional Executive Committee Quota (${regionalTargetPerUnit})`
        : `Constituency Statutory Quota (${constituencyTargetPerUnit} per Constituency: 11 Elected + 8 Appointed)`;

      // If more than 22 rows (e.g. Ashanti with 47+1, Greater Accra with 34+1, Eastern with 33+1, Central with 23+1, or External Branch with 30),
      // render a 2-column side-by-side compact grid so it strictly fits on 1 single page!
      let contentHtml = "";
      if (auditItems.length > 22) {
        const mid = Math.ceil(auditItems.length / 2);
        const col1 = auditItems.slice(0, mid);
        const col2 = auditItems.slice(mid);

        const renderColRows = (items: typeof auditItems) =>
          items
            .map(
              (it) => `
            <tr${it.isRegional ? ' style="background: #EFF6FF; font-weight: 700;"' : ''}>
              <td style="text-align: center;">${it.num}</td>
              <td><strong>${it.name}</strong></td>
              <td style="text-align: center;">${it.confirmed.toLocaleString()}</td>
              <td style="text-align: center;">${it.target}</td>
              <td style="text-align: center;">${it.rate}</td>
            </tr>
          `
            )
            .join("\n");

        contentHtml = `
          <div class="two-col-audit-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>
              <table class="stats-table compact" style="margin-bottom: 0;">
                <thead>
                  <tr>
                    <th style="width: 7%; text-align: center;">#</th>
                    <th style="width: 47%;">Jurisdiction</th>
                    <th style="width: 16%; text-align: center;">Confirmed</th>
                    <th style="width: 14%; text-align: center;">Quota</th>
                    <th style="width: 16%; text-align: center;">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderColRows(col1)}
                </tbody>
              </table>
            </div>
            <div>
              <table class="stats-table compact" style="margin-bottom: 0;">
                <thead>
                  <tr>
                    <th style="width: 7%; text-align: center;">#</th>
                    <th style="width: 47%;">Jurisdiction</th>
                    <th style="width: 16%; text-align: center;">Confirmed</th>
                    <th style="width: 14%; text-align: center;">Quota</th>
                    <th style="width: 16%; text-align: center;">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderColRows(col2)}
                </tbody>
              </table>
            </div>
          </div>
          <table class="stats-table compact" style="margin-top: 4px;">
            <tfoot>
              <tr>
                <td style="width: 54%; text-align: right;"><strong>TOTAL (${regionDisplayName} · ${summaryUnitsLabel}):</strong></td>
                <td style="width: 16%; text-align: center;"><strong>${sumItemConfirmed.toLocaleString()}</strong></td>
                <td style="width: 14%; text-align: center;"><strong>${sumItemTarget.toLocaleString()}</strong></td>
                <td style="width: 16%; text-align: center;"><strong>${sumItemRate}</strong></td>
              </tr>
              <tr style="background: #0F172A; color: #FFFFFF; font-weight: 800;">
                <td style="width: 54%; text-align: right; color: #FFFFFF;"><strong>REAL POSITION TOTAL (${effectiveContestName.toUpperCase()} · ALL 18 JURISDICTIONS):</strong></td>
                <td style="width: 16%; text-align: center; color: #38BDF8;"><strong>${positionNationalConfirmed.toLocaleString()}</strong></td>
                <td style="width: 14%; text-align: center; color: #38BDF8;"><strong>${positionNationalExpected.toLocaleString()}</strong></td>
                <td style="width: 16%; text-align: center; color: #38BDF8;"><strong>${positionNationalRate}</strong></td>
              </tr>
            </tfoot>
          </table>
        `;
      } else {
        contentHtml = `
          <table class="stats-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 35%;">Jurisdiction / Executive Body</th>
                <th style="width: 15%; text-align: center;">Tier</th>
                <th style="width: 15%; text-align: center;">Confirmed Voters</th>
                <th style="width: 15%; text-align: center;">Statutory Quota</th>
                <th style="width: 15%; text-align: center;">Compliance Rate</th>
              </tr>
            </thead>
            <tbody>
              ${auditItems
                .map(
                  (it) => `
                <tr${it.isRegional ? ' style="background: #EFF6FF; font-weight: 700;"' : ''}>
                  <td style="text-align: center;">${it.num}</td>
                  <td><strong>${it.name}</strong></td>
                  <td style="text-align: center;"><span class="val" style="background:${it.isRegional ? '#EFF6FF; color:#1E40AF' : '#F1F5F9; color:#334155'}; padding:1px 5px; border-radius:3px;">${it.level}</span></td>
                  <td style="text-align: center;"><strong>${it.confirmed.toLocaleString()}</strong></td>
                  <td style="text-align: center;">${it.target}</td>
                  <td style="text-align: center;"><strong>${it.rate}</strong></td>
                </tr>
              `
                )
                .join("\n")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align: right;"><strong>TOTAL (${regionDisplayName} · ${summaryUnitsLabel}):</strong></td>
                <td style="text-align: center;"><strong>${sumItemConfirmed.toLocaleString()}</strong></td>
                <td style="text-align: center;"><strong>${sumItemTarget.toLocaleString()}</strong></td>
                <td style="text-align: center;"><strong>${sumItemRate}</strong></td>
              </tr>
              <tr style="background: #0F172A; color: #FFFFFF; font-weight: 800;">
                <td colspan="3" style="text-align: right; color: #FFFFFF;"><strong>REAL POSITION TOTAL (${effectiveContestName.toUpperCase()} · ALL 18 JURISDICTIONS):</strong></td>
                <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalConfirmed.toLocaleString()}</strong></td>
                <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalExpected.toLocaleString()}</strong></td>
                <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalRate}</strong></td>
              </tr>
            </tfoot>
          </table>
        `;
      }

      levelAudit = {
        tableTitle: isExternalScope
          ? "EXTERNAL BRANCHES (DIASPORA) STATUTORY AUDIT & SIGN-OFF"
          : `${selectedRegion.toUpperCase()} ${titleSuffix} STATUTORY AUDIT & SIGN-OFF`,
        tableSub: `${subDetail} · ${effectiveContestName}`,
        footerLabel: isExternalScope
          ? "EXTERNAL BRANCHES STATUTORY AUDIT"
          : `${selectedRegion.toUpperCase()} STATUTORY AUDIT`,
        headersHtml: `
          <tr>
            <th style="width: 5%; text-align: center;">#</th>
            <th style="width: 35%;">Jurisdiction / Executive Body</th>
            <th style="width: 15%; text-align: center;">Tier</th>
            <th style="width: 15%; text-align: center;">Confirmed Voters</th>
            <th style="width: 15%; text-align: center;">Statutory Quota</th>
            <th style="width: 15%; text-align: center;">Compliance Rate</th>
          </tr>
        `,
        rowsHtml: auditItems
          .map(
            (it) => `
          <tr${it.isRegional ? ' style="background: #EFF6FF; font-weight: 700;"' : ''}>
            <td style="text-align: center;">${it.num}</td>
            <td><strong>${it.name}</strong></td>
            <td style="text-align: center;"><span class="val" style="background:${it.isRegional ? '#EFF6FF; color:#1E40AF' : '#F1F5F9; color:#334155'}; padding:1px 5px; border-radius:3px;">${it.level}</span></td>
            <td style="text-align: center;"><strong>${it.confirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;">${it.target}</td>
            <td style="text-align: center;"><strong>${it.rate}</strong></td>
          </tr>
        `
          )
          .join("\n"),
        footerHtml: `
          <tr>
            <td colspan="3" style="text-align: right;"><strong>TOTAL (${regionDisplayName} · ${summaryUnitsLabel}):</strong></td>
            <td style="text-align: center;"><strong>${sumItemConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumItemTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumItemRate}</strong></td>
          </tr>
          <tr style="background: #0F172A; color: #FFFFFF; font-weight: 800;">
            <td colspan="3" style="text-align: right; color: #FFFFFF;"><strong>REAL POSITION TOTAL (${effectiveContestName.toUpperCase()} · ALL 18 JURISDICTIONS):</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalExpected.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalRate}</strong></td>
          </tr>
        `,
        contentHtml,
        auditRows: auditItems.map((it) => ({
          region: it.name,
          confirmed: it.confirmed,
          target: it.target,
          complianceRate: it.rate,
        })),
      };
    } else if (isRegionalOnly) {
      levelAudit = {
        tableTitle: "REGIONAL LEADERSHIP STATUTORY AUDIT & SIGN-OFF",
        tableSub: `Regional Executive Committee Quota Distribution (Target: ${regionalTargetPerUnit} per Region) · ${effectiveContestName}`,
        footerLabel: "REGIONAL STATUTORY AUDIT",
        headersHtml: `
          <tr>
            <th style="width: 5%; text-align: center;">#</th>
            <th style="width: 33%;">Jurisdiction / Region</th>
            <th style="width: 18%; text-align: center;">Confirmed Voters</th>
            <th style="width: 14%; text-align: center;">Statutory Quota</th>
            <th style="width: 14%; text-align: center;">Variance</th>
            <th style="width: 16%; text-align: center;">Compliance Rate</th>
          </tr>
        `,
        rowsHtml: isAllRegions
          ? regionalRows
              .map(
                (r, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${r.region} Region</strong></td>
                <td style="text-align: center;">${r.regConfirmed.toLocaleString()}</td>
                <td style="text-align: center;">${r.regTarget}</td>
                <td style="text-align: center;">${r.regTarget - r.regConfirmed > 0 ? `-${r.regTarget - r.regConfirmed}` : "0"}</td>
                <td style="text-align: center;">${r.regTarget > 0 ? Math.min(100, Math.max(0, (r.regConfirmed / r.regTarget) * 100)).toFixed(1) + "%" : "100%"}</td>
              </tr>
            `
              )
              .join("\n")
          : allRegionalRows
              .map(
                (r, idx) => `
              <tr${!r.isIncluded ? ' style="background: #FFFBEB; opacity: 0.85;"' : ""}>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${r.region} Region</strong>${!r.isIncluded ? ' <span style="display:inline-block; font-size: 7.5pt; font-weight: 700; color: #B45309; background: #FEF3C7; padding: 1px 6px; border-radius: 4px; margin-left: 6px; border: 1px solid #FDE68A;">[Left Out]</span>' : ""}</td>
                <td style="text-align: center;${!r.isIncluded ? ' color: #B45309;' : ""}">${(r.isIncluded ? r.regConfirmed : r.regNationwideConfirmed).toLocaleString()}</td>
                <td style="text-align: center;">${r.regTarget}</td>
                <td style="text-align: center;">${r.regTarget - (r.isIncluded ? r.regConfirmed : r.regNationwideConfirmed) > 0 ? `-${r.regTarget - (r.isIncluded ? r.regConfirmed : r.regNationwideConfirmed)}` : "0"}</td>
                <td style="text-align: center;">${r.regTarget > 0 ? Math.min(100, Math.max(0, ((r.isIncluded ? r.regConfirmed : r.regNationwideConfirmed) / r.regTarget) * 100)).toFixed(1) + "%" : "100%"}</td>
              </tr>
            `
              )
              .join("\n"),
        footerHtml: isAllRegions
          ? `
          <tr>
            <td colspan="2" style="text-align: right;"><strong>TOTAL (${regionalRows.length} REGIONS):</strong></td>
            <td style="text-align: center;"><strong>${sumRegConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumRegTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumRegTarget - sumRegConfirmed > 0 ? `-${sumRegTarget - sumRegConfirmed}` : "0"}</strong></td>
            <td style="text-align: center;"><strong>${sumRegTarget > 0 ? Math.min(100, Math.max(0, (sumRegConfirmed / sumRegTarget) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
        `
          : `
          <tr style="background: #F8FAFC; font-weight: 700;">
            <td colspan="2" style="text-align: right;"><strong>ALBUM SUB-TOTAL (${includedRows.length} REGIONS INCLUDED):</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedRegConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedRegTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedRegTarget - sumIncludedRegConfirmed > 0 ? `-${sumIncludedRegTarget - sumIncludedRegConfirmed}` : "0"}</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedRegTarget > 0 ? Math.min(100, Math.max(0, (sumIncludedRegConfirmed / sumIncludedRegTarget) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
          <tr style="background: #FFFBEB; font-weight: 700; color: #B45309;">
            <td colspan="2" style="text-align: right;"><strong>EXCLUDED JURISDICTIONS (${excludedRows.length} LEFT OUT):</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedRegConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedRegTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedRegTarget - sumExcludedRegConfirmed > 0 ? `-${sumExcludedRegTarget - sumExcludedRegConfirmed}` : "0"}</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedRegTarget > 0 ? Math.min(100, Math.max(0, (sumExcludedRegConfirmed / sumExcludedRegTarget) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
          <tr style="background: #0F172A; color: #FFFFFF; font-weight: 800;">
            <td colspan="2" style="text-align: right; color: #FFFFFF;"><strong>REAL POSITION TOTAL (${effectiveContestName.toUpperCase()} · ALL 16 REGIONS):</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${sumAllRegConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${sumAllRegTarget.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${sumAllRegTarget - sumAllRegConfirmed > 0 ? `-${sumAllRegTarget - sumAllRegConfirmed}` : "0"}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${sumAllRegTarget > 0 ? Math.min(100, Math.max(0, (sumAllRegConfirmed / sumAllRegTarget) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
        `,
        auditRows: isAllRegions
          ? regionalRows.map((r) => ({
              region: `${r.region} Region`,
              confirmed: r.regConfirmed,
              target: r.regTarget,
              complianceRate: r.regTarget > 0 ? Math.min(100, Math.max(0, (r.regConfirmed / r.regTarget) * 100)).toFixed(1) + "%" : "100%",
            }))
          : allRegionalRows.map((r) => ({
              region: `${r.region} Region`,
              confirmed: r.isIncluded ? r.regConfirmed : r.regNationwideConfirmed,
              target: r.regTarget,
              complianceRate: r.regTarget > 0 ? Math.min(100, Math.max(0, ((r.isIncluded ? r.regConfirmed : r.regNationwideConfirmed) / r.regTarget) * 100)).toFixed(1) + "%" : "100%",
            })),
      };
    } else if (isConstituencyOnly) {
      levelAudit = {
        tableTitle: "CONSTITUENCY LEADERSHIP STATUTORY AUDIT & SIGN-OFF",
        tableSub: `Constituency Regional Roll-up (Statutory Target: ${constituencyTargetPerUnit} per Constituency) · ${effectiveContestName}`,
        footerLabel: "CONSTITUENCY STATUTORY AUDIT",
        headersHtml: `
          <tr>
            <th style="width: 5%; text-align: center;">#</th>
            <th style="width: 31%;">Region</th>
            <th style="width: 14%; text-align: center;">Constituencies</th>
            <th style="width: 18%; text-align: center;">Confirmed Voters</th>
            <th style="width: 16%; text-align: center;">Statutory Quota (@ ${constituencyTargetPerUnit})</th>
            <th style="width: 16%; text-align: center;">Compliance Rate</th>
          </tr>
        `,
        rowsHtml: isAllRegions
          ? regionalRows
              .map(
                (r, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${r.region}</strong></td>
                <td style="text-align: center;">${r.numConstituencies}</td>
                <td style="text-align: center;">${r.conConfirmed.toLocaleString()}</td>
                <td style="text-align: center;">${r.conTarget.toLocaleString()}</td>
                <td style="text-align: center;">${r.conTarget > 0 ? Math.min(100, Math.max(0, (r.conConfirmed / r.conTarget) * 100)).toFixed(1) + "%" : "100%"}</td>
              </tr>
            `
              )
              .join("\n")
          : allRegionalRows
              .map(
                (r, idx) => `
              <tr${!r.isIncluded ? ' style="background: #FFFBEB; opacity: 0.85;"' : ""}>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${r.region}</strong>${!r.isIncluded ? ' <span style="display:inline-block; font-size: 7.5pt; font-weight: 700; color: #B45309; background: #FEF3C7; padding: 1px 6px; border-radius: 4px; margin-left: 6px; border: 1px solid #FDE68A;">[Left Out]</span>' : ""}</td>
                <td style="text-align: center;">${r.numConstituencies}</td>
                <td style="text-align: center;${!r.isIncluded ? ' color: #B45309;' : ""}">${(r.isIncluded ? r.conConfirmed : r.conNationwideConfirmed).toLocaleString()}</td>
                <td style="text-align: center;">${r.conTarget.toLocaleString()}</td>
                <td style="text-align: center;">${r.conTarget > 0 ? Math.min(100, Math.max(0, ((r.isIncluded ? r.conConfirmed : r.conNationwideConfirmed) / r.conTarget) * 100)).toFixed(1) + "%" : "100%"}</td>
              </tr>
            `
              )
              .join("\n"),
        footerHtml: isAllRegions
          ? `
          <tr>
            <td colspan="2" style="text-align: right;"><strong>TOTAL (${regionalRows.length} REGIONS):</strong></td>
            <td style="text-align: center;"><strong>${sumConstituencies}</strong></td>
            <td style="text-align: center;"><strong>${sumConConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumConTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumConTarget > 0 ? Math.min(100, Math.max(0, (sumConConfirmed / sumConTarget) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
        `
          : `
          <tr style="background: #F8FAFC; font-weight: 700;">
            <td colspan="2" style="text-align: right;"><strong>ALBUM SUB-TOTAL (${includedRows.length} REGIONS INCLUDED):</strong></td>
            <td style="text-align: center;"><strong>${includedRows.reduce((a, b) => a + b.numConstituencies, 0)}</strong></td>
            <td style="text-align: center;"><strong>${includedRows.reduce((a, b) => a + b.conConfirmed, 0).toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${includedRows.reduce((a, b) => a + b.conTarget, 0).toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${includedRows.reduce((a, b) => a + b.conTarget, 0) > 0 ? Math.min(100, Math.max(0, (includedRows.reduce((a, b) => a + b.conConfirmed, 0) / includedRows.reduce((a, b) => a + b.conTarget, 0)) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
          <tr style="background: #FFFBEB; font-weight: 700; color: #B45309;">
            <td colspan="2" style="text-align: right;"><strong>EXCLUDED JURISDICTIONS (${excludedRows.length} LEFT OUT):</strong></td>
            <td style="text-align: center;"><strong>${excludedRows.reduce((a, b) => a + b.numConstituencies, 0)}</strong></td>
            <td style="text-align: center;"><strong>${excludedRows.reduce((a, b) => a + b.conNationwideConfirmed, 0).toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${excludedRows.reduce((a, b) => a + b.conTarget, 0).toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${excludedRows.reduce((a, b) => a + b.conTarget, 0) > 0 ? Math.min(100, Math.max(0, (excludedRows.reduce((a, b) => a + b.conNationwideConfirmed, 0) / excludedRows.reduce((a, b) => a + b.conTarget, 0)) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
          <tr style="background: #0F172A; color: #FFFFFF; font-weight: 800;">
            <td colspan="2" style="text-align: right; color: #FFFFFF;"><strong>REAL POSITION TOTAL (${effectiveContestName.toUpperCase()} · ALL 16 REGIONS):</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>276</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${allRegionalRows.reduce((a, b) => a + b.conNationwideConfirmed, 0).toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${allRegionalRows.reduce((a, b) => a + b.conTarget, 0).toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${allRegionalRows.reduce((a, b) => a + b.conTarget, 0) > 0 ? Math.min(100, Math.max(0, (allRegionalRows.reduce((a, b) => a + b.conNationwideConfirmed, 0) / allRegionalRows.reduce((a, b) => a + b.conTarget, 0)) * 100)).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
        `,
        auditRows: isAllRegions
          ? regionalRows.map((r) => ({
              region: r.region,
              confirmed: r.conConfirmed,
              target: r.conTarget,
              complianceRate: r.conTarget > 0 ? Math.min(100, Math.max(0, (r.conConfirmed / r.conTarget) * 100)).toFixed(1) + "%" : "100%",
            }))
          : allRegionalRows.map((r) => ({
              region: r.region,
              confirmed: r.isIncluded ? r.conConfirmed : r.conNationwideConfirmed,
              target: r.conTarget,
              complianceRate: r.conTarget > 0 ? Math.min(100, Math.max(0, ((r.isIncluded ? r.conConfirmed : r.conNationwideConfirmed) / r.conTarget) * 100)).toFixed(1) + "%" : "100%",
            })),
      };
    } else if (isTesconOnly) {
      const tesconByReg = new Map<string, { institutions: Set<string>; count: number }>();
      for (const td of delegates) {
        const rName = String(td.region || "Unassigned").trim();
        if (!tesconByReg.has(rName)) {
          tesconByReg.set(rName, { institutions: new Set(), count: 0 });
        }
        const entry = tesconByReg.get(rName)!;
        entry.count++;
        const inst = (td.polling_station || td.constituency || "").trim();
        if (inst) entry.institutions.add(inst);
      }

      const tRows = Array.from(tesconByReg.entries()).map(([reg, val], idx) => ({
        idx: idx + 1,
        region: reg,
        instCount: val.institutions.size > 0 ? val.institutions.size : val.count,
        confirmed: val.count,
      }));

      const sumInstitutions = tRows.reduce((acc, r) => acc + r.instCount, 0);
      const sumTesconConfirmed = tRows.reduce((acc, r) => acc + r.confirmed, 0);

      levelAudit = {
        tableTitle: "TESCON ACCREDITED TERTIARY INSTITUTIONS STATUTORY AUDIT & SIGN-OFF",
        tableSub: `Accredited Tertiary Institutions & Confirmed Voter Roll · Patrons Strictly Excluded · ${effectiveContestName}`,
        footerLabel: "TESCON STATUTORY AUDIT",
        headersHtml: `
          <tr>
            <th style="width: 6%; text-align: center;">#</th>
            <th style="width: 38%;">Region</th>
            <th style="width: 20%; text-align: center;">Accredited Institutions</th>
            <th style="width: 18%; text-align: center;">Confirmed Voters</th>
            <th style="width: 18%; text-align: center;">Status</th>
          </tr>
        `,
        rowsHtml: tRows
          .map(
            (r) => `
          <tr>
            <td style="text-align: center;">${r.idx}</td>
            <td><strong>${r.region} Region</strong></td>
            <td style="text-align: center;">${r.instCount.toLocaleString()}</td>
            <td style="text-align: center;"><strong>${r.confirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;">Accredited Roll</td>
          </tr>
        `
          )
          .join("\n"),
        footerHtml: `
          <tr>
            <td colspan="2" style="text-align: right;"><strong>TOTAL (${tRows.length} REGIONS):</strong></td>
            <td style="text-align: center;"><strong>${sumInstitutions.toLocaleString()} Institutions</strong></td>
            <td style="text-align: center;"><strong>${sumTesconConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>100%</strong></td>
          </tr>
        `,
        auditRows: tRows.map((r) => ({
          region: r.region,
          confirmed: r.confirmed,
          target: r.confirmed,
          complianceRate: "100%",
        })),
      };
    } else {
      // Both or All
      const extraRowsHtml: string[] = [];
      const extNumConstituencies = 30;
      const extConstituencyTarget = extNumConstituencies * 19;

      if (extCount > 0) {
        extraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>External Branches (Diaspora)</strong></td>
            <td style="text-align: center;">${extNumConstituencies}</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">${extCount.toLocaleString()} / ${extConstituencyTarget.toLocaleString()}</td>
            <td style="text-align: center;"><strong>${extCount.toLocaleString()}</strong></td>
            <td style="text-align: center;">${extConstituencyTarget.toLocaleString()}</td>
          </tr>
        `);
      }
      const tesconDelegates = delegates.filter(
        (d) => String(d.executive_level || "").toLowerCase().trim() === "tescon"
      );
      const tesconInstitutions = new Set(
        tesconDelegates
          .map((d) => {
            const s = (d.polling_station || d.constituency || "").trim();
            return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
          })
          .filter(Boolean)
      );
      const tesconInstitutionsCount = tesconInstitutions.size > 0 ? tesconInstitutions.size : tesconCount;

      if (tesconCount > 0) {
        extraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>TESCON Tertiary Institutions</strong></td>
            <td style="text-align: center;">${tesconInstitutionsCount.toLocaleString()}</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;"><strong>${tesconCount.toLocaleString()}</strong></td>
            <td style="text-align: center;">${tesconCount.toLocaleString()}</td>
          </tr>
        `);
      }
      if (natCount > 0) {
        extraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>National Council / Headquarters</strong></td>
            <td style="text-align: center;">HQ</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;"><strong>${natCount.toLocaleString()}</strong></td>
            <td style="text-align: center;">${natTarget.toLocaleString()}</td>
          </tr>
        `);
      }

      const subsetExtraRowsHtml: string[] = [];
      if (isExtIncluded || extCount > 0) {
        subsetExtraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>External Branches (Diaspora)</strong></td>
            <td style="text-align: center;">${extNumConstituencies}</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">${extCount.toLocaleString()} / ${extConstituencyTarget.toLocaleString()}</td>
            <td style="text-align: center;"><strong>${extCount.toLocaleString()}</strong></td>
            <td style="text-align: center;">${extConstituencyTarget.toLocaleString()}</td>
          </tr>
        `);
      } else if (!isExtIncluded && extNationwideCount > 0) {
        subsetExtraRowsHtml.push(`
          <tr style="background: #FFFBEB; opacity: 0.85;">
            <td style="text-align: center;">•</td>
            <td><strong>External Branches (Diaspora)</strong> <span style="display:inline-block; font-size: 7.5pt; font-weight: 700; color: #B45309; background: #FEF3C7; padding: 1px 6px; border-radius: 4px; margin-left: 6px; border: 1px solid #FDE68A;">[Left Out]</span></td>
            <td style="text-align: center;">${extNumConstituencies}</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center; color: #64748B;">${extNationwideCount.toLocaleString()} / ${extConstituencyTarget.toLocaleString()}</td>
            <td style="text-align: center; color: #B45309;"><strong>${extNationwideCount.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #64748B;">${extConstituencyTarget.toLocaleString()}</td>
          </tr>
        `);
      }

      if (tesconCount > 0) {
        subsetExtraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>TESCON Tertiary Institutions</strong></td>
            <td style="text-align: center;">${tesconInstitutionsCount.toLocaleString()}</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;"><strong>${tesconCount.toLocaleString()}</strong></td>
            <td style="text-align: center;">${tesconCount.toLocaleString()}</td>
          </tr>
        `);
      }

      if (isNatIncluded || natCount > 0) {
        subsetExtraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>National Council / Headquarters</strong></td>
            <td style="text-align: center;">HQ</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;"><strong>${natCount.toLocaleString()}</strong></td>
            <td style="text-align: center;">${natTarget.toLocaleString()}</td>
          </tr>
        `);
      } else if (!isNatIncluded && natNationwideCount > 0) {
        subsetExtraRowsHtml.push(`
          <tr style="background: #FFFBEB; opacity: 0.85;">
            <td style="text-align: center;">•</td>
            <td><strong>National Council / Headquarters</strong> <span style="display:inline-block; font-size: 7.5pt; font-weight: 700; color: #B45309; background: #FEF3C7; padding: 1px 6px; border-radius: 4px; margin-left: 6px; border: 1px solid #FDE68A;">[Left Out]</span></td>
            <td style="text-align: center;">HQ</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center; color: #B45309;"><strong>${natNationwideCount.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #64748B;">${natTarget.toLocaleString()}</td>
          </tr>
        `);
      }

      levelAudit = {
        tableTitle: isMenContest
          ? "MALE ELECTORAL ROLL STATUTORY AUDIT & SIGN-OFF"
          : isWomenContest
          ? "FEMALE ELECTORAL ROLL STATUTORY AUDIT & SIGN-OFF"
          : "REGIONAL & CONSTITUENCY STATUTORY AUDIT & SIGN-OFF",
        tableSub: isMenContest
          ? `Male Electoral College Distribution · All Non-Patron Male Officers · ${effectiveContestName}`
          : isWomenContest
          ? `Female Electoral College Distribution · All Non-Patron Female Officers · ${effectiveContestName}`
          : `Statutory Quota Distribution (Regional: ${regionalTargetPerUnit} per Region · Constituency: ${constituencyTargetPerUnit} per Constituency [11 Elected + 8 Appointed]) · ${effectiveContestName}`,
        footerLabel: isMenContest
          ? "MALE ELECTORAL ROLL AUDIT"
          : isWomenContest
          ? "FEMALE ELECTORAL ROLL AUDIT"
          : "ELECTORAL ROLL AUDIT",
        headersHtml: `
          <tr>
            <th style="width: 4%; text-align: center;">#</th>
            <th style="width: 25%;">Region</th>
            <th style="width: 7%; text-align: center;">Const.</th>
            <th style="width: 16%; text-align: center;">Regional (Quota ${regionalTargetPerUnit})</th>
            <th style="width: 16%; text-align: center;">Constituency (@ ${constituencyTargetPerUnit})</th>
            <th style="width: 16%; text-align: center;">Total Confirmed</th>
            <th style="width: 16%; text-align: center;">Statutory Quota</th>
          </tr>
        `,
        rowsHtml: isAllRegions
          ? regionalRows
              .map(
                (r, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${r.region}</strong></td>
                <td style="text-align: center;">${r.numConstituencies}</td>
                <td style="text-align: center;">${r.regConfirmed} / ${r.regTarget}</td>
                <td style="text-align: center;">${r.conConfirmed} / ${r.conTarget}</td>
                <td style="text-align: center;"><strong>${r.totalConfirmed.toLocaleString()}</strong></td>
                <td style="text-align: center;">${r.totalTarget.toLocaleString()}</td>
              </tr>
            `
              )
              .concat(extraRowsHtml)
              .join("\n")
          : allRegionalRows
              .map((r, idx) => {
                if (r.isIncluded) {
                  return `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${r.region}</strong></td>
                <td style="text-align: center;">${r.numConstituencies}</td>
                <td style="text-align: center;">${r.regConfirmed} / ${r.regTarget}</td>
                <td style="text-align: center;">${r.conConfirmed} / ${r.conTarget}</td>
                <td style="text-align: center;"><strong>${r.totalConfirmed.toLocaleString()}</strong></td>
                <td style="text-align: center;">${r.totalTarget.toLocaleString()}</td>
              </tr>
                  `;
                } else {
                  return `
              <tr style="background: #FFFBEB; opacity: 0.85;">
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${r.region}</strong> <span style="display:inline-block; font-size: 7.5pt; font-weight: 700; color: #B45309; background: #FEF3C7; padding: 1px 6px; border-radius: 4px; margin-left: 6px; border: 1px solid #FDE68A;">[Left Out]</span></td>
                <td style="text-align: center;">${r.numConstituencies}</td>
                <td style="text-align: center; color: #64748B;">${r.regNationwideConfirmed} / ${r.regTarget}</td>
                <td style="text-align: center; color: #64748B;">${r.conNationwideConfirmed} / ${r.conTarget}</td>
                <td style="text-align: center; color: #B45309;"><strong>${r.totalNationwideConfirmed.toLocaleString()}</strong></td>
                <td style="text-align: center; color: #64748B;">${r.totalTarget.toLocaleString()}</td>
              </tr>
                  `;
                }
              })
              .concat(subsetExtraRowsHtml)
              .join("\n"),
        footerHtml: isAllRegions
          ? `
          <tr>
            <td colspan="2" style="text-align: right;"><strong>TOTAL:</strong></td>
            <td style="text-align: center;"><strong>${sumConstituencies + (extCount > 0 ? extNumConstituencies : 0)}</strong></td>
            <td style="text-align: center;"><strong>${sumRegConfirmed} / ${sumRegTarget}</strong></td>
            <td style="text-align: center;"><strong>${(sumConConfirmed + (extCount > 0 ? extCount : 0)).toLocaleString()} / ${(sumConTarget + (extCount > 0 ? extConstituencyTarget : 0)).toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${(sumTotalConfirmed + extCount + tesconCount + natCount).toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${(sumTotalTarget + (extCount > 0 ? extConstituencyTarget : 0) + tesconCount + natCount).toLocaleString()}</strong></td>
          </tr>
        `
          : `
          <tr style="background: #F8FAFC; font-weight: 700;">
            <td colspan="2" style="text-align: right;"><strong>ALBUM SUB-TOTAL (${includedJurisdictionsCount} JURISDICTIONS INCLUDED):</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedConstituencies}</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedRegConfirmed} / ${sumIncludedRegTarget}</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedConConfirmed.toLocaleString()} / ${sumIncludedConTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedTotalConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumIncludedTotalTarget.toLocaleString()}</strong></td>
          </tr>
          <tr style="background: #FFFBEB; font-weight: 700; color: #B45309;">
            <td colspan="2" style="text-align: right;"><strong>EXCLUDED JURISDICTIONS (${excludedJurisdictionsCount} LEFT OUT):</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedConstituencies}</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedRegConfirmed} / ${sumExcludedRegTarget}</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedConConfirmed.toLocaleString()} / ${sumExcludedConTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedTotalConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumExcludedTotalTarget.toLocaleString()}</strong></td>
          </tr>
          <tr style="background: #0F172A; color: #FFFFFF; font-weight: 800;">
            <td colspan="2" style="text-align: right; color: #FFFFFF;"><strong>REAL POSITION TOTAL (${effectiveContestName.toUpperCase()} · ALL 18 JURISDICTIONS):</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${sumAllConstituencies}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${sumAllRegConfirmed} / ${sumAllRegTarget}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${sumAllConConfirmed.toLocaleString()} / ${sumAllConTarget.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center; color: #38BDF8;"><strong>${positionNationalExpected.toLocaleString()}</strong></td>
          </tr>
        `,
        auditRows: (isAllRegions
          ? regionalRows.map((r) => ({
              region: r.region,
              confirmed: r.totalConfirmed,
              target: r.totalTarget,
              complianceRate: r.totalTarget > 0 ? Math.min(100, Math.max(0, (r.totalConfirmed / r.totalTarget) * 100)).toFixed(1) + "%" : "100%",
            }))
          : allRegionalRows.map((r) => ({
              region: r.region,
              confirmed: r.isIncluded ? r.totalConfirmed : r.totalNationwideConfirmed,
              target: r.totalTarget,
              complianceRate: r.totalTarget > 0 ? Math.min(100, Math.max(0, ((r.isIncluded ? r.totalConfirmed : r.totalNationwideConfirmed) / r.totalTarget) * 100)).toFixed(1) + "%" : "100%",
            }))
        )
          .concat(
            (isAllRegions ? extCount > 0 : (isExtIncluded || extNationwideCount > 0))
              ? [
                  {
                    region: "External Branches (Diaspora)",
                    confirmed: isAllRegions ? extCount : (isExtIncluded ? extCount : extNationwideCount),
                    target: extConstituencyTarget,
                    complianceRate:
                      extConstituencyTarget > 0
                        ? Math.min(100, Math.max(0, ((isAllRegions ? extCount : (isExtIncluded ? extCount : extNationwideCount)) / extConstituencyTarget) * 100)).toFixed(1) + "%"
                        : "100%",
                  },
                ]
              : []
          )
          .concat(
            (isAllRegions ? tesconCount > 0 : (isTesconIncluded ? tesconCount > 0 : tesconNationwideCount > 0))
              ? [
                  {
                    region: "TESCON Tertiary Institutions",
                    confirmed: isAllRegions ? tesconCount : (isTesconIncluded ? tesconCount : tesconNationwideCount),
                    target: isAllRegions ? tesconCount : (isTesconIncluded ? tesconCount : tesconNationwideCount),
                    complianceRate: "100%",
                  },
                ]
              : []
          )
          .concat(
            (isAllRegions ? natCount > 0 : (isNatIncluded || natNationwideCount > 0))
              ? [
                  {
                    region: "National Council / Headquarters",
                    confirmed: isAllRegions ? natCount : (isNatIncluded ? natCount : natNationwideCount),
                    target: natTarget,
                    complianceRate: "100%",
                  },
                ]
              : []
          ),
      };
    }

    const tesconDelegatesList = delegates.filter(
      (d) => String(d.executive_level || "").toLowerCase().trim() === "tescon"
    );
    const tesconInstitutionsSet = new Set(
      tesconDelegatesList
        .map((d) => {
          const s = (d.polling_station || d.constituency || "").trim();
          return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
        })
        .filter(Boolean)
    );
    const tesconInstitutionsCount =
      tesconInstitutionsSet.size > 0 ? tesconInstitutionsSet.size : tesconDelegatesList.length;

    const metrics = {
      contest: effectiveContestName,
      scope: isExternalScope
        ? "External Branches (Diaspora Chapters)"
        : regionQuery === "all"
        ? "Nationwide (All 16 Regions + External Branches + National + TESCON)"
        : `${regionQuery} Region`,
      expectedFigures: expectedCount,
      actualFigures: totalActual,
      variance: Math.max(0, expectedCount - totalActual),
      complianceRate: expectedCount > 0 ? Math.min(100, Math.max(0, (totalActual / expectedCount) * 100)).toFixed(1) + "%" : "100%",
      quorumRequirement: Math.ceil(totalActual * (2 / 3)), // 2/3 constitutional quorum
      levelBreakdown: levelCounts,
      genderBreakdown: {
        male: genderCounts.male,
        female: genderCounts.female,
        unknown: genderCounts.unknown,
        femalePercentage: totalActual > 0 ? Math.min(100, Math.max(0, (genderCounts.female / totalActual) * 100)).toFixed(1) + "%" : "0%",
      },
      ageBreakdown: {
        under40: ageCounts.under40,
        fortyPlus: ageCounts.fortyPlus,
        pending: ageCounts.pending,
        under40Percentage: totalActual > 0 ? Math.min(100, Math.max(0, (ageCounts.under40 / totalActual) * 100)).toFixed(1) + "%" : "0%",
      },
      biometricVerification: {
        verified: verifiedVoterIds,
        pending: totalActual - verifiedVoterIds,
        verificationRate: totalActual > 0 ? Math.min(100, Math.max(0, (verifiedVoterIds / totalActual) * 100)).toFixed(1) + "%" : "0%",
      },
      regionalQuota: regionalTargetPerUnit,
      constituencyQuota: constituencyTargetPerUnit,
      constituencyElectedQuota: isCustom ? undefined : 11,
      constituencyAppointedQuota: isCustom ? undefined : 8,
      tesconInstitutionsCount,
      positionNational: {
        statutoryBenchmark: positionNationalExpected,
        confirmedTotal: positionNationalConfirmed,
        complianceRate: positionNationalRate,
        isRegionalSubset,
        includedJurisdictionsCount,
        excludedJurisdictionsCount,
        includedFigures: sumIncludedTotalConfirmed,
        includedTarget: sumIncludedTotalTarget,
        excludedFigures: sumExcludedTotalConfirmed,
        excludedTarget: sumExcludedTotalTarget,
        excludedRegions: excludedRows.map((r) => r.region).concat(!isExtIncluded && extNationwideCount > 0 ? ["External Branches"] : []),
      },
    };

    const targetRegions = isExternalScope
      ? ["External Branch"]
      : regionQuery !== "all" && regionQuery !== ""
      ? [regionQuery]
      : hasExternal
      ? [...GHANA_REGIONS_ORDER, "External Branch"]
      : GHANA_REGIONS_ORDER;

    const constituencyAudit: Array<{
      region: string;
      constituency: string;
      confirmed: number;
      target: number;
      confirmedElected: number;
      targetElected: number;
      confirmedAppointed: number;
      targetAppointed: number;
      variance: number;
      complianceRate: string;
      status: "Compliant" | "Under Quota" | "Over Quota";
    }> = [];

    for (const reg of targetRegions) {
      const cList = getConstituenciesForRegion(reg);
      const isRegExternal = reg.toLowerCase().includes("external");
      const conNames =
        cList.length > 0
          ? cList
          : Array.from(
              new Set(
                delegates
                  .filter(
                    (d) =>
                      (String(d.executive_level || "").toLowerCase().trim() === "constituency" ||
                        (isRegExternal &&
                          (String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
                            String(d.region || "").toLowerCase().includes("external")))) &&
                      String(d.region || "").toLowerCase().trim() === reg.toLowerCase().trim()
                  )
                  .map((d) => d.constituency)
                  .filter(Boolean)
              )
            );

      for (const cName of conNames) {
        const norm = normalizeConstituency(cName);
        const conDelegates = delegates.filter(
          (d) =>
            (String(d.executive_level || "").toLowerCase().trim() === "constituency" ||
              (isRegExternal &&
                (String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
                  String(d.region || "").toLowerCase().includes("external")))) &&
            getRegionalSectionRank(d) !== 2 &&
            getRegionalSectionRank(d) !== 3 &&
            getRegionalSectionRank(d) !== 4 &&
            (normalizeConstituency(d.constituency) === norm ||
              d.constituency.toLowerCase().trim() === cName.toLowerCase().trim()) &&
            (!d.region ||
              isRegExternal ||
              String(d.region).toLowerCase().trim() === reg.toLowerCase().trim())
        );

        const conConfirmed = conDelegates.length;
        const target = isRegExternal ? externalTargetPerUnit : constituencyTargetPerUnit;
        const confirmedElected = conDelegates.filter((d) =>
          isElectedConstituencyPosition(d.canonical_position || d.position)
        ).length;
        const targetElected = isCustom || isRegExternal ? Math.min(target, confirmedElected) : 11;
        const confirmedAppointed = Math.max(0, conConfirmed - confirmedElected);
        const targetAppointed = isCustom || isRegExternal ? Math.max(0, target - targetElected) : 8;

        const variance = target - conConfirmed;
        const complianceRate = target > 0 ? Math.min(100, Math.max(0, (conConfirmed / target) * 100)).toFixed(1) + "%" : "100%";
        const status: "Compliant" | "Under Quota" | "Over Quota" =
          conConfirmed === target
            ? "Compliant"
            : conConfirmed < target
            ? "Under Quota"
            : "Over Quota";

        constituencyAudit.push({
          region: reg,
          constituency: cName,
          confirmed: conConfirmed,
          target,
          confirmedElected,
          targetElected,
          confirmedAppointed,
          targetAppointed,
          variance,
          complianceRate,
          status,
        });
      }
    }

    const effectiveRegionQuery =
      !isAllRegions && rawRegionsList.length > 0
        ? rawRegionsList.length === 1
          ? rawRegionsList[0]
          : rawRegionsList.join(",")
        : regionQuery;

    // Excel export format
    if (format === "excel" || format === "xlsx") {
      const excelBuffer = await generateAlbumExcel(
        effectiveContestName,
        effectiveRegionQuery,
        metrics,
        delegates,
        regionalBreakdown,
        levelAudit,
        constituencyAudit,
        albumType
      );

      const safeContest = effectiveContestName.replace(/[\s&]+/g, "_");
      const safeRegion = effectiveRegionQuery !== "all" ? `_${effectiveRegionQuery.replace(/[\s&,]+/g, "_")}` : "";
      const filename = `NPP_${safeContest}${safeRegion}_Voter_Directory_2026.xlsx`;

      return new NextResponse(excelBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (format === "html") {
      // Pre-convert logo to WebP
      const logoDataUri = await getLogoWebpDataUri();
      const elephantSealDataUri = await getElephantSealDataUri();

      // Pre-convert all delegate images to WebP data URIs before rendering (only if photos are visible)
      if (visibleDetails.has("photo")) {
        await convertDelegatesImagesToWebp(delegates);
      }

      // Return renderable HTML directly
      const html = generateAlbumHtml(
        effectiveContestName,
        effectiveRegionQuery,
        metrics,
        delegates,
        regionalBreakdown,
        logoDataUri,
        levelAudit,
        albumType,
        elephantSealDataUri,
        visibleDetails
      );

      const headers: Record<string, string> = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      };

      if (isDownload) {
        const safeContest = effectiveContestName.replace(/[\s&]+/g, "_");
        const safeRegion = regionQuery !== "all" ? `_${regionQuery.replace(/[\s&]+/g, "_")}` : "";
        headers["Content-Disposition"] = `attachment; filename="NPP_${safeContest}${safeRegion}_Election_Album_2026.html"`;
      }

      return new NextResponse(html, { headers });
    }


    return NextResponse.json({
      metrics,
      regionalBreakdown,
      delegates,
      constituencyAudit,
      levelAudit,
      visibleDetails: Array.from(visibleDetails),
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

async function generateAlbumExcel(
  contest: string,
  regionQuery: string,
  metrics: any,
  delegates: any[],
  regionalBreakdown: any[],
  levelAudit?: any,
  constituencyAudit?: any[],
  albumType: string = "provisional"
): Promise<Buffer> {
  const isFinalAlbum = albumType === "final";
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "New Patriotic Party (NPP)";
  workbook.lastModifiedBy = "National IT Directorate";
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Voter Directory Sheet
  const sheet = workbook.addWorksheet("Voter Directory", {
    views: [{ showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: "portrait" },
  });

  // Title Row 1
  sheet.mergeCells("A1:N1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = isFinalAlbum
    ? "NEW PATRIOTIC PARTY (NPP) — FINAL CERTIFIED ELECTORAL COLLEGE ALBUM & DELEGATE REGISTER"
    : "NEW PATRIOTIC PARTY (NPP) — PROVISIONAL ELECTORAL COLLEGE ALBUM & VOTER DIRECTORY";
  titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003399" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 36;

  // Subtitle Row 2
  sheet.mergeCells("A2:N2");
  const subCell = sheet.getCell("A2");
  const isMultiJurisdiction = regionQuery.includes(",");
  const scopeLabel =
    regionQuery === "all"
      ? "NATIONWIDE (ALL 16 REGIONS + EXTERNAL BRANCHES + TESCON)"
      : isMultiJurisdiction
      ? `${regionQuery.split(",").length} ELECTORAL JURISDICTIONS`
      : `${regionQuery.toUpperCase()} REGION`;
  subCell.value = `PORTFOLIO: ${contest.toUpperCase()}  |  SCOPE: ${scopeLabel}  |  TOTAL VOTERS: ${delegates.length.toLocaleString()}  |  GENERATED: ${new Date().toLocaleString("en-GB")}`;
  subCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF334155" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  // Row 3 blank
  sheet.getRow(3).height = 10;

  // Header Row 4
  const headers = [
    "#",
    "Voter ID",
    "Executive Name",
    "Executive Level",
    "Region",
    "Constituency / Jurisdiction",
    "Position Held",
    "Canonical Position",
    "Gender",
    "Age",
    "Date of Birth",
    "Phone Number",
    "Biometric Status",
    "Photo Available",
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003399" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF002266" } },
      bottom: { style: "medium", color: { argb: "FF001845" } },
      left: { style: "thin", color: { argb: "FF002266" } },
      right: { style: "thin", color: { argb: "FF002266" } },
    };
  });

  // Set explicit column widths
  sheet.columns = [
    { key: "no", width: 7 },
    { key: "voter_id", width: 16 },
    { key: "name", width: 34 },
    { key: "level", width: 18 },
    { key: "region", width: 22 },
    { key: "jurisdiction", width: 30 },
    { key: "position", width: 30 },
    { key: "canon_pos", width: 28 },
    { key: "gender", width: 12 },
    { key: "age", width: 10 },
    { key: "dob", width: 15 },
    { key: "phone", width: 17 },
    { key: "biometric", width: 18 },
    { key: "photo", width: 16 },
  ];

  // Delegate Rows
  delegates.forEach((d, idx) => {
    const rowNum = idx + 1;
    const isEven = rowNum % 2 === 0;
    const row = sheet.addRow([
      rowNum,
      d.voter_id && d.voter_id !== "—" ? String(d.voter_id).trim() : "—",
      d.executive_name,
      d.executive_level,
      d.region,
      d.constituency || "—",
      d.position || "—",
      d.canonical_position,
      d.gender || "Unknown",
      d.age !== null && d.age !== undefined ? d.age : "—",
      d.date_of_birth || "—",
      d.phone || "—",
      d.has_voter_id ? "Verified" : "Pending",
      d.image_url ? "Yes" : "No",
    ]);

    row.height = 21;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 9.5 };
      if (isEven) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      // Alignment
      if ([1, 2, 4, 9, 10, 11, 12, 13, 14].includes(colNumber)) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }

      // Biometric status styling
      if (colNumber === 13) {
        if (d.has_voter_id) {
          cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF166534" } };
        } else {
          cell.font = { name: "Arial", size: 9.5, color: { argb: "FF991B1B" } };
        }
      }
    });
  });

  // 2. Summary & Metrics Sheet
  const metricsSheet = workbook.addWorksheet("Summary & Metrics", {
    views: [{ showGridLines: true }],
  });

  metricsSheet.mergeCells("A1:D1");
  const mTitle = metricsSheet.getCell("A1");
  mTitle.value = isFinalAlbum
    ? "FINAL CERTIFIED ELECTORAL COLLEGE METRICS & COMPLIANCE"
    : "PROVISIONAL ELECTORAL COLLEGE METRICS & COMPLIANCE";
  mTitle.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  mTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003399" } };
  mTitle.alignment = { horizontal: "center", vertical: "middle" };
  metricsSheet.getRow(1).height = 30;

  metricsSheet.columns = [
    { width: 30 },
    { width: 22 },
    { width: 30 },
    { width: 22 },
  ];

  metricsSheet.addRow(["Portfolio / Wing", contest, "Confirmed Voters", metrics.actualFigures]);
  metricsSheet.addRow(["Electoral Scope", metrics.scope, "Expected Roll Figures", metrics.expectedFigures]);
  metricsSheet.addRow(["Compliance Coverage", metrics.complianceRate, "2/3 Quorum Requirement", metrics.quorumRequirement]);
  metricsSheet.addRow([
    "Verified Voter IDs",
    metrics.biometricVerification?.verified ?? 0,
    "Pending Voter IDs",
    metrics.biometricVerification?.pending ?? 0,
  ]);
  metricsSheet.addRow([
    "Biometric Verification Rate",
    metrics.biometricVerification?.verificationRate ?? "0%",
    "Under 40 Proportion (Cutoff: 21 Aug 2026)",
    metrics.ageBreakdown?.under40Percentage ?? "0%",
  ]);

  metricsSheet.addRow([]);
  metricsSheet.addRow(["REGIONAL BREAKDOWN", "VOTER COUNT", "ADMINISTRATIVE LEVEL", "VOTER COUNT"]);
  const mHeader = metricsSheet.getRow(8);
  mHeader.height = 24;
  mHeader.eachCell((c) => {
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  const levelEntries = Object.entries(metrics.levelBreakdown || {});
  const maxRows = Math.max(regionalBreakdown.length, levelEntries.length);
  for (let i = 0; i < maxRows; i++) {
    const reg = regionalBreakdown[i];
    const lvl = levelEntries[i];
    metricsSheet.addRow([
      reg ? reg.region : "",
      reg ? reg.count : "",
      lvl ? lvl[0] : "",
      lvl ? lvl[1] : "",
    ]);
  }

  if (levelAudit?.auditRows && levelAudit.auditRows.length > 0) {
    metricsSheet.addRow([]);
    metricsSheet.addRow([`STATUTORY AUDIT (${levelAudit.tableTitle})`, "", "", ""]);
    const auditHeader = metricsSheet.addRow(["Region / Jurisdiction", "Confirmed Voters", "Statutory Quota", "Compliance Rate"]);
    auditHeader.height = 22;
    auditHeader.eachCell((c) => {
      c.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003399" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
    });
    for (const r of levelAudit.auditRows) {
      metricsSheet.addRow([r.region, r.confirmed, r.target, r.complianceRate]);
    }
  }

  if (constituencyAudit && constituencyAudit.length > 0) {
    const conSheet = workbook.addWorksheet("Constituency Statistics", {
      views: [{ showGridLines: true }],
      pageSetup: { paperSize: 9, orientation: "portrait" },
    });

    conSheet.mergeCells("A1:J1");
    const tCell = conSheet.getCell("A1");
    tCell.value = `NPP CONSTITUENCY STATUTORY AUDIT & SIGN-OFF · STATUTORY QUOTA: ${metrics.constituencyQuota || 19} PER CONSTITUENCY (11 ELECTED + 8 APPOINTED)`;
    tCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003399" } };
    tCell.alignment = { horizontal: "center", vertical: "middle" };
    conSheet.getRow(1).height = 28;

    const cHeader = conSheet.addRow([
      "#",
      "Region",
      "Constituency Name",
      "Total Confirmed",
      "Elected (x/11)",
      "Appointed (x/8)",
      "Statutory Quota",
      "Variance",
      "Compliance Rate",
      "Status",
    ]);
    cHeader.height = 22;
    cHeader.eachCell((c) => {
      c.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
    });

    constituencyAudit.forEach((item, idx) => {
      const row = conSheet.addRow([
        idx + 1,
        item.region,
        item.constituency,
        item.confirmed,
        item.confirmedElected !== undefined ? `${item.confirmedElected} / ${item.targetElected ?? 11}` : "—",
        item.confirmedAppointed !== undefined ? `${item.confirmedAppointed} / ${item.targetAppointed ?? 8}` : "—",
        item.target,
        item.variance,
        item.complianceRate,
        item.status,
      ]);
      row.height = 19;
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(5).alignment = { horizontal: "center" };
      row.getCell(6).alignment = { horizontal: "center" };
      row.getCell(7).alignment = { horizontal: "center" };
      row.getCell(8).alignment = { horizontal: "center" };
      row.getCell(9).alignment = { horizontal: "center" };
      row.getCell(10).alignment = { horizontal: "center" };
    });

    conSheet.columns = [
      { width: 6 },
      { width: 18 },
      { width: 30 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
    ];
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(rawBuffer);
}

function generateAlbumHtml(
  contest: string,
  region: string,
  metrics: any,
  delegates: any[],
  regionalBreakdown: any[],
  logoDataUri?: string,
  levelAudit?: any,
  albumType: string = "provisional",
  elephantSealDataUri?: string,
  visibleDetails?: Set<VoterDetailField>
): string {
  const effectiveElephantSealUri = elephantSealDataUri || getElephantSealDataUriSync();
  const sealTopSvg = renderCurvedText("NATIONAL ELECTIONS COMMITTEE", 60, 60, 42.5, -156, -24, "#003399", 5.6, false);
  const sealBottomSvg = renderCurvedText("OFFICIAL SEAL · ELECTIONS 2026", 60, 60, 42.5, 156, 24, "#C8102E", 5.1, true);

  const isWingAlbum =
    /(?:youth|women|nasara)/i.test(contest) ||
    (delegates.length > 0 &&
      delegates.every((d) =>
        /(?:youth|women|nasara|wocom)/i.test(String(d.position || d.canonical_position || ""))
      ));

  const details = visibleDetails || new Set(DEFAULT_VOTER_DETAILS);
  const showPhoto = details.has("photo");
  const showName = details.has("name");
  const showPosition = details.has("position");
  const showLevel = details.has("level");
  const showVoterId = details.has("voter_id");
  const showPhone = details.has("phone");
  const showInstitution = details.has("institution");
  const showDemographics = details.has("demographics");
  const showPollingStation = details.has("polling_station");

  const isRegionalSubset = Boolean(metrics?.positionNational?.isRegionalSubset);
  const positionStatsBannerHtml = isRegionalSubset && metrics?.positionNational
    ? `
    <div class="position-stats-banner" style="background: #0F172A; color: #FFFFFF; border: 1px solid #1E293B; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #94A3B8; margin-bottom: 2px;">AUTHORITATIVE STATUTORY POSITION BENCHMARK (${contest.toUpperCase()})</div>
        <div style="font-size: 12pt; font-weight: 800; color: #38BDF8;">
          ${(metrics.positionNational.confirmedTotal || 0).toLocaleString()} <span style="font-size: 8.5pt; color: #94A3B8; font-weight: normal;">confirmed nationwide across all 18 jurisdictions</span> / <span style="color: #F8FAFC;">${(metrics.positionNational.statutoryBenchmark || 0).toLocaleString()} Statutory Quota</span>
          <span style="font-size: 8.5pt; font-weight: 700; color: #34D399; margin-left: 8px;">(${metrics.positionNational.complianceRate || "100%"})</span>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #94A3B8; margin-bottom: 2px;">ALBUM SELECTION SCOPE</div>
        <div style="font-size: 9.5pt; font-weight: 700; color: #F59E0B;">
          ${metrics.positionNational.includedJurisdictionsCount || 0} Jurisdictions Included · ${metrics.positionNational.excludedJurisdictionsCount || 0} Left Out
        </div>
      </div>
    </div>
    `
    : "";

  // Render individual voter card
  function renderVoterCard(d: any): string {
    const photoSrc = d.webp_base64 || d.avatar_svg;
    // When there is no image or when we filter no image, use the initial abbreviation SVG avatar
    const effectivePhotoSrc = showPhoto ? photoSrc : d.avatar_svg;
    const isTescon = String(d.executive_level || "").toLowerCase().trim() === "tescon";
    const institution = isTescon
      ? String(d.institution || getTesconInstitution(d) || "").trim()
      : "";
    const isConstituency = String(d.executive_level || "").toLowerCase().trim() === "constituency";
    const isExtBranch = String(d.executive_level || "").toLowerCase().trim() === "external branch";

    // For Nasara, Women and Youth: constituency cards display jurisdiction beside Level; For MPs, display constituency
    const isMp = getRegionalSectionRank(d) === 4;
    const jurisdictionSuffix =
      (isWingAlbum && (isConstituency || isExtBranch) && d.constituency) || (isMp && d.constituency)
        ? ` (${String(d.constituency).trim()})`
        : "";

    const demographicText = [
      d.gender && d.gender !== "Unknown" ? d.gender : null,
      d.age !== null && d.age !== undefined ? `${d.age} yrs` : null,
    ].filter(Boolean).join(" · ");

    return `
        <div class="voter-card">
          <div class="card-details">
            ${showPosition && (d.canonical_position || d.position) ? `<div class="pos-badge">${d.canonical_position || d.position}</div>` : ""}
            ${showName ? `<div class="exec-name">${d.executive_name}</div>` : ""}
            ${showLevel ? `
            <div class="detail-line">
              <span class="lbl">Level:</span> <span class="val">${d.executive_level}${jurisdictionSuffix}</span>
            </div>
            ` : ""}
            ${showInstitution && isTescon && institution ? `
            <div class="detail-line" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${institution}">
              <span class="lbl">Institution:</span> <span class="val" style="font-weight: 700;">${institution}</span>
            </div>
            ` : ""}
            ${showVoterId ? `
            <div class="detail-line">
              <span class="lbl">Voter ID:</span> <span class="val mono">${d.voter_id}</span>
            </div>
            ` : ""}
            ${showPhone ? `
            <div class="detail-line">
              <span class="lbl">Phone:</span> <span class="val">${d.phone}</span>
            </div>
            ` : ""}
            ${showDemographics && demographicText ? `
            <div class="detail-line">
              <span class="lbl">Demographics:</span> <span class="val">${demographicText}</span>
            </div>
            ` : ""}
            ${showPollingStation && d.polling_station ? `
            <div class="detail-line" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${d.polling_station}">
              <span class="lbl">Station:</span> <span class="val">${d.polling_station}</span>
            </div>
            ` : ""}
          </div>
          <div class="card-photo">
            <img class="voter-img" src="${effectivePhotoSrc}" alt="${d.executive_name}" loading="eager" decoding="sync" data-fallback="${d.avatar_svg}" onerror="this.onerror=null; this.src='${d.avatar_svg}';" />
          </div>
        </div>
      `;
  }

  interface CardPageSpec {
    headerSubTitle: string;
    footerLabel: string;
    cards: any[];
    isConstituencyPart2?: boolean;
    constituencyName?: string;
    constituencyCapital?: string;
    totalConstituencyExecutives?: number;
  }

  const cardPages: CardPageSpec[] = [];
  let currentCardPageNum = 3; // Page 1: Cover, Page 2: Metrics, Pages 3..N: Cards

  // Partition delegates into administrative levels
  const nationalDelegates = delegates.filter((d) => {
    const lvl = String(d.executive_level || "").toLowerCase().trim();
    if (lvl !== "national") return false;
    const rank = getRegionalSectionRank(d);
    if (rank === 2 || rank === 3 || rank === 4) {
      const reg = String(d.region || "").trim().toLowerCase();
      if (reg && reg !== "national" && reg !== "national headquarters" && reg !== "hq") {
        return false;
      }
    }
    return true;
  });
  const regionalDelegates = delegates.filter((d) => {
    const lvl = String(d.executive_level || "").toLowerCase().trim();
    return (lvl === "regional" || lvl === "region") && getRegionalSectionRank(d) === 1;
  });
  const constituencyDelegates = delegates.filter((d) => {
    const lvl = String(d.executive_level || "").toLowerCase().trim();
    return lvl === "constituency" && getRegionalSectionRank(d) === 5;
  });
  const tesconDelegates = delegates.filter(
    (d) => String(d.executive_level || "").toLowerCase().trim() === "tescon"
  );
  const otherDelegates = delegates.filter((d) => {
    const lvl = String(d.executive_level || "").toLowerCase().trim();
    const rank = getRegionalSectionRank(d);
    return (
      !["national", "regional", "region", "constituency", "tescon"].includes(lvl) &&
      rank !== 1 &&
      rank !== 2 &&
      rank !== 3 &&
      rank !== 4
    );
  });

  // 1. National Level Pages (if present)
  if (nationalDelegates.length > 0) {
    for (let i = 0; i < nationalDelegates.length; i += 10) {
      const chunk = nationalDelegates.slice(i, i + 10);
      const partIdx = Math.floor(i / 10) + 1;
      chunk.forEach((d) => {
        d.page_number = currentCardPageNum;
      });
      cardPages.push({
        headerSubTitle: `NATIONAL LEVEL · ${contest.toUpperCase()} (PART ${partIdx})`,
        footerLabel: `NATIONAL EXECUTIVES`,
        cards: chunk,
      });
      currentCardPageNum++;
    }
  }

  if (isWingAlbum) {
    // When loading for Nasara, Women, and Youth only:
    // After loading National, each region must start on a new page,
    // and then followed by its constituencies!
    const presentRegions: string[] = [];
    for (const r of GHANA_REGIONS_ORDER) {
      const has = delegates.some(
        (d) =>
          String(d.executive_level || "").toLowerCase().trim() !== "national" &&
          String(d.region || "").toLowerCase().trim() === r.toLowerCase()
      );
      if (has) presentRegions.push(r);
    }
    for (const d of delegates) {
      const lvl = String(d.executive_level || "").toLowerCase().trim();
      if (lvl === "national" || lvl === "external branch") continue;
      const reg = String(d.region || "").trim();
      if (
        reg &&
        !reg.toLowerCase().includes("external") &&
        !presentRegions.some((r) => r.toLowerCase() === reg.toLowerCase())
      ) {
        presentRegions.push(reg);
      }
    }

    for (const regionName of presentRegions) {
      // 1. Regional executives for this region
      const regExecs = delegates.filter(
        (d) =>
          (String(d.executive_level || "").toLowerCase().trim() === "regional" ||
            String(d.executive_level || "").toLowerCase().trim() === "region") &&
          String(d.region || "").toLowerCase().trim() === regionName.toLowerCase()
      );
      regExecs.sort((a, b) => {
        if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
        return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
      });

      // 2. Constituency executives for this region
      const constExecs = delegates.filter(
        (d) =>
          String(d.executive_level || "").toLowerCase().trim() === "constituency" &&
          String(d.region || "").toLowerCase().trim() === regionName.toLowerCase()
      );
      constExecs.sort((a, b) => {
        const cA = String(a.constituency || "").trim();
        const cB = String(b.constituency || "").trim();
        const cComp = cA.localeCompare(cB);
        if (cComp !== 0) return cComp;
        if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
        return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
      });

      // 3. TESCON executives for this region (if any)
      const tesconExecs = delegates.filter(
        (d) =>
          String(d.executive_level || "").toLowerCase().trim() === "tescon" &&
          String(d.region || "").toLowerCase().trim() === regionName.toLowerCase()
      );
      tesconExecs.sort((a, b) => {
        const instA = getTesconInstitution(a);
        const instB = getTesconInstitution(b);
        const iComp = instA.localeCompare(instB);
        if (iComp !== 0) return iComp;
        return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
      });

      const regionList = [...regExecs, ...constExecs, ...tesconExecs];
      if (regionList.length === 0) continue;

      // Each region starts on a new page!
      for (let i = 0; i < regionList.length; i += 10) {
        const chunk = regionList.slice(i, i + 10);
        const partIdx = Math.floor(i / 10) + 1;
        chunk.forEach((d) => {
          d.page_number = currentCardPageNum;
        });
        cardPages.push({
          headerSubTitle: `${regionName.toUpperCase()} REGION · ${contest.toUpperCase()} (PART ${partIdx})`,
          footerLabel: `${regionName.toUpperCase()} REGION ELECTORATE`,
          cards: chunk,
        });
        currentCardPageNum++;
      }
    }

    // External Branches (if any)
    const extBranchDelegates = delegates.filter(
      (d) =>
        String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
        String(d.region || "").toLowerCase().includes("external")
    );
    if (extBranchDelegates.length > 0) {
      extBranchDelegates.sort((a, b) => {
        const cA = String(a.constituency || "").trim();
        const cB = String(b.constituency || "").trim();
        const cComp = cA.localeCompare(cB);
        if (cComp !== 0) return cComp;
        if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
        return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
      });
      for (let i = 0; i < extBranchDelegates.length; i += 10) {
        const chunk = extBranchDelegates.slice(i, i + 10);
        const partIdx = Math.floor(i / 10) + 1;
        chunk.forEach((d) => {
          d.page_number = currentCardPageNum;
        });
        cardPages.push({
          headerSubTitle: `EXTERNAL BRANCHES · ${contest.toUpperCase()} (PART ${partIdx})`,
          footerLabel: `EXTERNAL BRANCHES ELECTORATE`,
          cards: chunk,
        });
        currentCardPageNum++;
      }
    }
  } else {
    // 2. Regional Level Pages (Separated from Constituency)
    const hasRegionalOrCouncilOrMp =
      regionalDelegates.length > 0 ||
      delegates.some((d) => [2, 3, 4].includes(getRegionalSectionRank(d)));

    if (hasRegionalOrCouncilOrMp) {
      const regionalGroups = new Map<string, any[]>();
      for (const delegate of regionalDelegates) {
        const regionName = String(delegate.region || "Unassigned").trim();
        if (!regionalGroups.has(regionName)) regionalGroups.set(regionName, []);
        regionalGroups.get(regionName)!.push(delegate);
      }
      for (const d of delegates) {
        const rank = getRegionalSectionRank(d);
        if (rank === 2 || rank === 3 || rank === 4) {
          const reg = String(d.region || "").trim();
          if (reg && !reg.toLowerCase().includes("external") && reg.toLowerCase() !== "national" && !regionalGroups.has(reg)) {
            regionalGroups.set(reg, []);
          }
        }
      }
      for (const [regionName, regionDelegates] of regionalGroups) {
        // 2a. Regional Executives
        for (let i = 0; i < regionDelegates.length; i += 10) {
          const chunk = regionDelegates.slice(i, i + 10);
          const partIdx = Math.floor(i / 10) + 1;
          chunk.forEach((d) => {
            d.page_number = currentCardPageNum;
          });
          cardPages.push({
            headerSubTitle: `${regionName.toUpperCase()} REGION · REGIONAL EXECUTIVES (PART ${partIdx})`,
            footerLabel: `${regionName.toUpperCase()} REGIONAL EXECUTIVES`,
            cards: chunk,
          });
          currentCardPageNum++;
        }

        // 2b. National Council Representatives in this region
        const ncReps = delegates.filter(
          (d) =>
            getRegionalSectionRank(d) === 2 &&
            String(d.region || "").toLowerCase().trim() === regionName.toLowerCase().trim()
        );
        if (ncReps.length > 0) {
          for (let i = 0; i < ncReps.length; i += 10) {
            const chunk = ncReps.slice(i, i + 10);
            const partIdx = Math.floor(i / 10) + 1;
            chunk.forEach((d) => {
              d.page_number = currentCardPageNum;
            });
            cardPages.push({
              headerSubTitle: `${regionName.toUpperCase()} REGION · NATIONAL COUNCIL REPRESENTATIVES (PART ${partIdx})`,
              footerLabel: `${regionName.toUpperCase()} NATIONAL COUNCIL REPS`,
              cards: chunk,
            });
            currentCardPageNum++;
          }
        }

        // 2c. Foundation Members in this region
        const foundationMems = delegates.filter(
          (d) =>
            getRegionalSectionRank(d) === 3 &&
            String(d.region || "").toLowerCase().trim() === regionName.toLowerCase().trim()
        );
        if (foundationMems.length > 0) {
          for (let i = 0; i < foundationMems.length; i += 10) {
            const chunk = foundationMems.slice(i, i + 10);
            const partIdx = Math.floor(i / 10) + 1;
            chunk.forEach((d) => {
              d.page_number = currentCardPageNum;
            });
            cardPages.push({
              headerSubTitle: `${regionName.toUpperCase()} REGION · FOUNDATION MEMBERS (PART ${partIdx})`,
              footerLabel: `${regionName.toUpperCase()} FOUNDATION MEMBERS`,
              cards: chunk,
            });
            currentCardPageNum++;
          }
        }

        // 2d. Members of Parliament (MPs) for this region
        const mps = delegates.filter(
          (d) =>
            getRegionalSectionRank(d) === 4 &&
            String(d.region || "").toLowerCase().trim() === regionName.toLowerCase().trim()
        );
        if (mps.length > 0) {
          mps.sort((a, b) => {
            const cComp = String(a.constituency || "").localeCompare(String(b.constituency || ""));
            if (cComp !== 0) return cComp;
            return String(a.executive_name || "").localeCompare(String(b.executive_name || ""));
          });
          for (let i = 0; i < mps.length; i += 10) {
            const chunk = mps.slice(i, i + 10);
            const partIdx = Math.floor(i / 10) + 1;
            chunk.forEach((d) => {
              d.page_number = currentCardPageNum;
            });
            cardPages.push({
              headerSubTitle: `${regionName.toUpperCase()} REGION · MEMBERS OF PARLIAMENT (PART ${partIdx})`,
              footerLabel: `${regionName.toUpperCase()} MEMBERS OF PARLIAMENT`,
              cards: chunk,
            });
            currentCardPageNum++;
          }
        }
      }
    }

    // 3. Constituency Level Pages (Dedicated 2 Pages per Constituency)
    if (constituencyDelegates.length > 0) {
      const constituencyMap = new Map<string, { name: string; region: string; delegates: any[] }>();
      for (const d of constituencyDelegates) {
        const cName = d.constituency?.trim() || "Unknown Constituency";
        const regionName = d.region?.trim() || "Unassigned";
        const key = `${regionName.toLowerCase()}\u0000${cName.toLowerCase()}`;
        if (!constituencyMap.has(key)) {
          constituencyMap.set(key, { name: cName, region: regionName, delegates: [] });
        }
        constituencyMap.get(key)!.delegates.push(d);
      }

      for (const { name: cName, region: constituencyRegion, delegates: cList } of constituencyMap.values()) {
        const capital = getConstituencyCapital(cName);
        const regLabel = constituencyRegion.toUpperCase();
        const regionPrefix = regLabel ? `${regLabel} REGION · ` : "";

        // Dedicated Page 1: Up to 10 cards
        const part1Cards = cList.slice(0, 10);
        part1Cards.forEach((d) => {
          d.page_number = currentCardPageNum;
        });
        cardPages.push({
          headerSubTitle: `${regionPrefix}CONSTITUENCY EXECUTIVES · ${cName.toUpperCase()} (PART 1)`,
          footerLabel: `${cName.toUpperCase()}`,
          cards: part1Cards,
        });
        currentCardPageNum++;

        // Dedicated Page 2: Up to 9 cards + 10th slot validation / QR code box
        const part2Cards = cList.slice(10, 19);
        part2Cards.forEach((d) => {
          d.page_number = currentCardPageNum;
        });
        cardPages.push({
          headerSubTitle: `${regionPrefix}CONSTITUENCY EXECUTIVES · ${cName.toUpperCase()} (PART 2)`,
          footerLabel: `${cName.toUpperCase()}`,
          cards: part2Cards,
          isConstituencyPart2: true,
          constituencyName: cName,
          constituencyCapital: capital,
          totalConstituencyExecutives: cList.length,
        });
        currentCardPageNum++;
      }
    }

    // 3b. External Branches retain constituency status and follow domestic constituencies.
    if (otherDelegates.length > 0) {
      const branchGroups = new Map<string, any[]>();
      for (const delegate of otherDelegates) {
        const branchName = String(delegate.constituency || "Unassigned External Branch").trim();
        if (!branchGroups.has(branchName)) branchGroups.set(branchName, []);
        branchGroups.get(branchName)!.push(delegate);
      }
      for (const [branchName, branchDelegates] of branchGroups) {
        for (let i = 0; i < branchDelegates.length; i += 10) {
          const chunk = branchDelegates.slice(i, i + 10);
          const partIdx = Math.floor(i / 10) + 1;
          chunk.forEach((d) => {
            d.page_number = currentCardPageNum;
          });
          cardPages.push({
            headerSubTitle: `EXTERNAL BRANCH · ${branchName.toUpperCase()} (PART ${partIdx})`,
            footerLabel: `${branchName.toUpperCase()} EXTERNAL BRANCH`,
            cards: chunk,
          });
          currentCardPageNum++;
        }
      }
    }

    // 4. TESCON Level Pages (Grouped together contiguously, 10 per page, not split per school)
    if (tesconDelegates.length > 0) {
      const institutionGroups = new Map<string, { region: string; delegates: any[] }>();
      for (const delegate of tesconDelegates) {
        const regionName = String(delegate.region || "Unassigned").trim();
        const institution = getTesconInstitution(delegate);
        delegate.institution = institution;
        if (!institutionGroups.has(regionName)) {
          institutionGroups.set(regionName, { region: regionName, delegates: [] });
        }
        institutionGroups.get(regionName)!.delegates.push(delegate);
      }
      for (const { region: regionName, delegates: regTesconDelegates } of institutionGroups.values()) {
        const regPrefix =
          regionName && regionName.toLowerCase() !== "unassigned" && regionName.toLowerCase() !== "national"
            ? `${regionName.toUpperCase()} REGION · `
            : "";
        const regFooter =
          regionName && regionName.toLowerCase() !== "unassigned" && regionName.toLowerCase() !== "national"
            ? `${regionName.toUpperCase()} `
            : "";
        for (let i = 0; i < regTesconDelegates.length; i += 10) {
          const chunk = regTesconDelegates.slice(i, i + 10);
          const partIdx = Math.floor(i / 10) + 1;
          chunk.forEach((d) => {
            d.page_number = currentCardPageNum;
          });
          cardPages.push({
            headerSubTitle: `${regPrefix}TESCON EXECUTIVES (PART ${partIdx})`,
            footerLabel: `${regFooter}TESCON EXECUTIVES`,
            cards: chunk,
          });
          currentCardPageNum++;
        }
      }
    }
  }

  // Page calculation: Cover + Metrics + Card Pages + Final Audit
  const delegatePages = cardPages;
  const totalPages = 2 + delegatePages.length + 1; // Page 1: Cover, Page 2: Metrics, Pages 3..N: Cards, Final: Stats

  const isFinalAlbum = albumType === "final";
  const isExtScope =
    region.toLowerCase().includes("external") ||
    (delegates.length > 0 &&
      delegates.every(
        (d) =>
          String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
          String(d.region || "").toLowerCase().includes("external")
      ));
  const isMultiJurisdiction = region.includes(",");
  const scopeText = region === "all"
    ? (isExtScope ? "EXTERNAL BRANCHES (DIASPORA CHAPTERS)" : "NATIONWIDE ELECTORAL ROLL")
    : isExtScope
    ? "EXTERNAL BRANCHES (DIASPORA CHAPTERS)"
    : isMultiJurisdiction
    ? `${region.split(",").length} ELECTORAL JURISDICTIONS`
    : `${region.toUpperCase()} REGION`;
  const badgeText = region === "all"
    ? (isExtScope ? `EXTERNAL BRANCHES · ${contest.toUpperCase()}` : `${contest.toUpperCase()} ELECTION`)
    : isExtScope
    ? `EXTERNAL BRANCHES · ${contest.toUpperCase()}`
    : isMultiJurisdiction
    ? `${region.split(",").length} JURISDICTIONS · ${contest.toUpperCase()}`
    : `${region.toUpperCase()} REGION · ${contest.toUpperCase()}`;

  const delegatePagesHtml = cardPages
    .map((spec, pageIdx) => {
      const pageNum = pageIdx + 3;
      const cardsHtml = spec.cards.map(renderVoterCard).join("\n");

      let slot10Html = "";
      if (spec.isConstituencyPart2) {
        if (albumType === "provisional") {
          slot10Html = `
          <div class="cert-card">
            <div class="cert-shield">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#003399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div class="cert-text">
              <div class="cert-title">CONSTITUENCY VALIDATED</div>
              <div class="cert-sub">${(spec.constituencyName || "").toUpperCase()} · CAPITAL: ${spec.constituencyCapital || ""}</div>
              <div class="cert-count">${spec.totalConstituencyExecutives || spec.cards.length} EXECUTIVE OFFICERS CONFIRMED</div>
            </div>
          </div>
          `;
        } else {
          slot10Html = `
          <div class="cert-card official-qr-card">
            <div class="cert-shield">
              <svg width="42" height="42" viewBox="0 0 100 100" fill="#003399">
                <rect x="10" y="10" width="25" height="25" fill="none" stroke="#003399" stroke-width="5"/>
                <rect x="17.5" y="17.5" width="10" height="10" fill="#003399"/>
                <rect x="65" y="10" width="25" height="25" fill="none" stroke="#003399" stroke-width="5"/>
                <rect x="72.5" y="17.5" width="10" height="10" fill="#003399"/>
                <rect x="10" y="65" width="25" height="25" fill="none" stroke="#003399" stroke-width="5"/>
                <rect x="17.5" y="72.5" width="10" height="10" fill="#003399"/>
                <rect x="42" y="15" width="6" height="15" fill="#003399"/>
                <rect x="42" y="38" width="16" height="6" fill="#003399"/>
                <rect x="15" y="42" width="15" height="6" fill="#003399"/>
                <rect x="68" y="42" width="18" height="6" fill="#003399"/>
                <rect x="42" y="55" width="10" height="18" fill="#003399"/>
                <rect x="60" y="60" width="12" height="12" fill="#003399"/>
                <rect x="78" y="75" width="12" height="15" fill="#003399"/>
              </svg>
            </div>
            <div class="cert-text">
              <div class="cert-title">CONSTITUENCY AUDIT QR</div>
              <div class="cert-sub">${(spec.constituencyName || "").toUpperCase()} · CAPITAL: ${spec.constituencyCapital || ""}</div>
              <div class="cert-count">${spec.totalConstituencyExecutives || spec.cards.length} EXECUTIVES · OFFICIAL REGISTER</div>
            </div>
          </div>
          `;
        }
      }

      return `
      <div class="album-page">
        <header class="page-header">
          <div class="header-content">
            ${logoDataUri ? `<img class="npp-logo header-npp-logo" src="${logoDataUri}" alt="NPP" />` : `<div class="party-seal-mini">NPP</div>`}
            <div class="header-text">
              <h1>NEW PATRIOTIC PARTY</h1>
              <h2>${spec.headerSubTitle}</h2>
            </div>
          </div>
          <div class="header-rule"></div>
        </header>

        <main class="grid-10">
          ${cardsHtml}
          ${slot10Html}
        </main>

        <footer class="page-footer">
          <div class="footer-rule"></div>
          <div class="footer-content">
            <span>${isFinalAlbum ? "FINAL CERTIFIED" : "PROVISIONAL"} ELECTORAL COLLEGE ALBUM · ${spec.footerLabel}</span>
            <span class="footer-page-pill">${pageNum}</span>
            <span>NATIONAL ELECTIONS COMMITTEE</span>
          </div>
        </footer>
      </div>
    `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${isFinalAlbum ? "Final Certified Album" : "Provisional Album"} · ${contest} Election · NPP</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 210mm 297mm; margin: 0; }
    body {
      background: #475569;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0F172A;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: flex; }
    @media print {
      html, body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: auto !important;
      }
      .no-print { display: none !important; }
      .album-page {
        margin: 0 !important;
        box-shadow: none !important;
        width: 210mm !important;
        max-width: 210mm !important;
        height: 268mm !important;
        max-height: 268mm !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        padding: 5mm 10mm 4mm 10mm !important;
      }
      .album-page:last-child { page-break-after: auto !important; break-after: auto !important; }
    }
    .web-nav {
      position: sticky; top: 0; z-index: 1000;
      background: #003399; color: white;
      padding: 10px 24px;
      display: flex; align-items: center; justify-content: space-between;
      font-weight: 700; font-size: 14px;
    }
    .print-btn {
      background: #DC2626; color: white; border: none;
      padding: 7px 18px; border-radius: 6px; font-weight: 800; cursor: pointer;
    }
    .album-page {
      width: 210mm; height: 285mm; max-height: 297mm;
      margin: 15px auto; padding: 5mm 10mm 4mm 10mm;
      background: #FFFFFF; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      position: relative; display: flex; flex-direction: column; justify-content: space-between;
      overflow: hidden; box-sizing: border-box;
      page-break-inside: avoid; break-inside: avoid;
    }

    /* Cover Page Styles */
    .cover-page {
      padding: 5mm 10mm 4mm 10mm;
    }

    .cover-inner-border {
      border: 2.5px double #003399;
      padding: 5mm 8mm;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      justify-content: space-between;
      box-sizing: border-box;
      margin-bottom: 2mm;
    }

    .cover-header {
      text-align: center;
    }

    .cover-logo-center {
      display: flex;
      justify-content: center;
      margin-bottom: 6px;
    }

    .cover-npp-logo {
      width: auto;
      height: 48px;
      max-width: 72px;
      object-fit: contain;
    }

    .cover-main-title {
      font-size: 20pt;
      font-weight: 900;
      color: #003399;
      letter-spacing: 1.5px;
      margin-bottom: 1px;
      line-height: 1.15;
    }

    .cover-sub-title {
      font-size: 11pt;
      font-weight: 800;
      color: #DC2626;
      letter-spacing: 0.8px;
      margin-bottom: 5px;
      line-height: 1.15;
    }

    .cover-tri-bar {
      display: flex;
      height: 4px;
      width: 120px;
      margin: 0 auto 6px auto;
      border-radius: 2px;
      overflow: hidden;
    }

    .bar-red { flex: 1; background: #DC2626; }
    .bar-white { flex: 1; background: #FFFFFF; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; }
    .bar-blue { flex: 1; background: #003399; }

    .cover-doc-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: 0.6px;
      margin-bottom: 5px;
    }

    .cover-region-badge {
      display: inline-block;
      background: #003399;
      color: #FFFFFF;
      font-size: 12pt;
      font-weight: 900;
      padding: 3px 16px;
      border-radius: 16px;
      letter-spacing: 1.2px;
    }

    .cover-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    }

    .formal-proclamation {
      background: #F8FAFC;
      border-left: 3.5px solid #003399;
      padding: 6px 10px;
      border-radius: 0 5px 5px 0;
    }

    .proclamation-title {
      font-size: 8.8pt;
      font-weight: 900;
      color: #003399;
      margin-bottom: 2px;
      letter-spacing: 0.4px;
    }

    .proclamation-p {
      font-size: 7.4pt;
      line-height: 1.3;
      color: #334155;
      margin-bottom: 2.5px;
      text-align: justify;
    }

    .certification-metadata-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
      background: #F1F5F9;
      padding: 6px 10px;
      border-radius: 5px;
      border: 1px solid #CBD5E1;
    }

    .meta-cell {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .m-lbl {
      font-size: 6.5pt;
      font-weight: 800;
      color: #64748B;
      letter-spacing: 0.4px;
    }

    .m-val {
      font-size: 8pt;
      font-weight: 800;
      color: #003399;
    }

    .signature-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 8px 0 8px;
    }

    .seal-container {
      flex-shrink: 0;
    }

    .sig-block {
      text-align: right;
    }

    .sig-line-img {
      display: block;
    }

    .signature-line {
      width: 150px;
      height: 1.5px;
      background: #003399;
      margin-left: auto;
      margin-bottom: 3px;
    }

    .sig-name {
      font-size: 9.5pt;
      font-weight: 900;
      color: #003399;
      letter-spacing: 0.4px;
    }

    .sig-title {
      font-size: 7pt;
      font-weight: 800;
      color: #1E293B;
      font-style: italic;
    }

    .sig-org {
      font-size: 6.5pt;
      font-weight: 600;
      color: #64748B;
    }

    /* Page 2 & 3: Metrics & Directory */
    .metrics-page { padding: 5mm 10mm 4mm 10mm; }
    .page-title { font-size: 14pt; font-weight: 900; color: #003399; margin-bottom: 2px; }
    .page-sub { font-size: 8.5pt; font-weight: 700; color: #64748B; margin-bottom: 8px; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
    .kpi-card { background: #F8FAFC; border: 1px solid #CBD5E1; padding: 8px 6px; border-radius: 6px; text-align: center; }
    .kpi-num { font-size: 16pt; font-weight: 900; color: #003399; }
    .kpi-lbl { font-size: 7pt; font-weight: 800; color: #64748B; text-transform: uppercase; margin-top: 2px; }
    .table-container { margin-top: 6px; }
    .stats-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 8px; }
    .stats-table th { background: #003399; color: white; padding: 4px 8px; text-align: left; font-weight: 800; font-size: 7.5pt; }
    .stats-table td { padding: 3.5px 8px; border-bottom: 1px solid #E2E8F0; font-size: 7.5pt; }
    .stats-table tr:nth-child(even) { background: #F8FAFC; }
    .stats-table tfoot tr { background: #E2E8F0; font-weight: 800; border-top: 1.5px solid #003399; }
    .stats-table tfoot td { padding: 3.5px 8px; font-weight: 800; font-size: 7.5pt; color: #003399; }
    .two-col-audit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .stats-table.compact { font-size: 6.5pt; margin-bottom: 0; }
    .stats-table.compact th { padding: 2px 5px; font-size: 6.5pt; }
    .stats-table.compact td { padding: 1.5px 5px; font-size: 6.5pt; line-height: 1.15; }
    .stats-table.compact tfoot td { padding: 2.5px 5px; font-size: 6.8pt; }

    /* Directory Table Tags */
    .page-range-tag {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      color: #003399;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 800;
    }
    .status-verified-pill {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      color: #003399;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 6.8pt;
      font-weight: 800;
      text-transform: uppercase;
    }

    /* Cards Grid (Pages 4+) */
    .grid-10 {
      display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(5, 1fr);
      gap: 4px; flex: 1; min-height: 0; margin: 2px 0;
    }
    .voter-card {
      border: 1px solid #E2E8F0; border-radius: 4px; display: flex; justify-content: space-between;
      overflow: hidden; height: 42.5mm; max-height: 42.5mm; background: white; box-sizing: border-box;
      break-inside: avoid !important; page-break-inside: avoid !important;
    }
    .card-details { flex: 1; padding: 3px 6px; display: flex; flex-direction: column; justify-content: center; gap: 1.5px; overflow: hidden; }
    .pos-badge {
      background: #003399; color: white; font-size: 6.2pt; font-weight: 800; padding: 1px 4px;
      border-radius: 2.5px; display: inline-block; width: fit-content; text-transform: uppercase;
      line-height: 1.1;
    }
    .exec-name { font-size: 8.2pt; font-weight: 800; color: #0F172A; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; }
    .detail-line { font-size: 6.8pt; color: #334155; line-height: 1.15; }
    .lbl { font-weight: 800; color: #64748B; font-size: 6.2pt; }
    .val { font-weight: 700; color: #0F172A; }
    .val.mono { font-family: monospace; background: #F1F5F9; padding: 0.5px 3px; border-radius: 2px; }
    .card-photo { width: 31mm; min-width: 31mm; height: 100%; background: #F1F5F9; border-left: 1px solid #CBD5E1; }
    .voter-img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }

    /* Constituency Validation Box & Official QR Card (10th Slot on Page 2) */
    .cert-card {
      grid-column: 2;
      grid-row: 5;
      border: 2.5px dashed #003399;
      border-radius: 6px;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 4px 12px;
      height: 42.5mm;
      max-height: 42.5mm;
      box-sizing: border-box;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .cert-shield {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cert-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .cert-title {
      font-size: 10pt;
      font-weight: 900;
      color: #003399;
      letter-spacing: 0.5px;
      line-height: 1.15;
    }
    .cert-sub {
      font-size: 8pt;
      font-weight: 800;
      color: #1E293B;
      line-height: 1.15;
    }
    .cert-count {
      font-size: 7.6pt;
      font-weight: 800;
      color: #475569;
      letter-spacing: 0.3px;
      line-height: 1.15;
    }
    .official-qr-card {
      border: 2px solid #003399;
    }

    /* Header & Footer */
    .page-header { margin-bottom: 2px; }
    .header-content { display: flex; align-items: center; gap: 8px; }
    .header-npp-logo { width: auto; height: 28px; max-width: 38px; object-fit: contain; }
    .party-seal-mini { background: #003399; color: white; font-size: 9pt; font-weight: 900; padding: 2px 5px; border-radius: 3px; }
    .header-text h1 { font-size: 12pt; font-weight: 900; color: #003399; line-height: 1.1; letter-spacing: 0.5px; }
    .header-text h2 { font-size: 8pt; font-weight: 800; color: #1E293B; line-height: 1.1; letter-spacing: 0.2px; }
    .header-rule { height: 1.5px; background: #003399; margin-top: 2px; }
    .page-footer {
      flex: 0 0 7mm;
      min-height: 7mm;
      margin-top: auto;
      padding-top: 1px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden;
    }
    .footer-rule { height: 1px; background: #CBD5E1; margin-bottom: 1.5px; }
    .footer-content {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      column-gap: 5mm;
      font-size: 6.8pt;
      font-weight: 700;
      color: #475569;
      white-space: nowrap;
    }
    .footer-content > span:first-child { overflow: hidden; text-overflow: ellipsis; }
    .footer-content > span:last-child { overflow: hidden; text-overflow: ellipsis; text-align: right; }
    .footer-page-pill {
      display: inline-block;
      font-size: 8pt;
      line-height: 1.1;
      font-weight: 900;
      color: #003399;
      background: #F1F5F9;
      padding: 0.5px 7px;
      border-radius: 6px;
      border: 1px solid #CBD5E1;
      break-inside: avoid !important;
    }

    /* Final Page Proclamation */
    .proclamation-box {
      background: #F8FAFC;
      border-left: 4px solid #003399;
      padding: 6px 10px;
      border-radius: 0 4px 4px 0;
      margin-top: auto;
      margin-bottom: 5px;
    }
    .proclamation-box h3 {
      font-size: 8pt;
      font-weight: 900;
      color: #003399;
      margin-bottom: 2px;
      letter-spacing: 0.4px;
    }
    .proclamation-box p {
      font-size: 7pt;
      line-height: 1.35;
      color: #334155;
      text-align: justify;
    }
  </style>
</head>
<body>

  <div class="web-nav no-print">
    <span>NPP · ${contest.toUpperCase()} ${isFinalAlbum ? "FINAL CERTIFIED" : "PROVISIONAL"} ELECTION ALBUM (${totalPages} PAGES · ${delegates.length} VOTERS)</span>
    <button id="album-print" class="print-btn" disabled onclick="window.printAlbum()">PREPARING IMAGES…</button>
    ${delegates.some((d) => d.photo_unavailable) ? `<span role="status">${delegates.filter((d) => d.photo_unavailable).length} portrait(s) unavailable; initials shown. Reload to retry unavailable photos.</span>` : ""}
  </div>

  <!-- PAGE 1: COVER (Elephant Emblem Seal & Frederick Opare-Ansah) -->
  <div class="album-page cover-page">
    <div class="cover-inner-border">
      <div class="cover-header">
        <div class="cover-logo-center">
          ${logoDataUri ? `<img class="npp-logo cover-npp-logo" src="${logoDataUri}" alt="New Patriotic Party" />` : `<div class="party-seal-mini">NPP</div>`}
        </div>
        <h1 class="cover-main-title">NEW PATRIOTIC PARTY</h1>
        <h2 class="cover-sub-title">NATIONAL ELECTIONS COMMITTEE</h2>
        <div class="cover-tri-bar">
          <div class="bar-red"></div>
          <div class="bar-white"></div>
          <div class="bar-blue"></div>
        </div>
        <h3 class="cover-doc-title">${isFinalAlbum ? "FINAL ELECTORAL COLLEGE ALBUM &amp; DELEGATE REGISTER" : "PROVISIONAL ELECTORAL COLLEGE ALBUM &amp; VOTER DIRECTORY"}</h3>
        <div class="cover-region-badge">${isFinalAlbum ? `OFFICIAL FINAL CERTIFIED REGISTER · ${badgeText}` : badgeText}</div>
      </div>

      <div class="cover-body">
        <div class="formal-proclamation">
          <h4 class="proclamation-title">ACKNOWLEDGEMENT &amp; CERTIFICATION</h4>
          <p class="proclamation-p">
            The <strong>National Elections Committee</strong> of the <strong>New Patriotic Party (NPP)</strong>, acting in accordance with the powers conferred under Article 10 and Article 17 of the Party's Constitution and the General Regulations governing internal party primaries and elections, hereby officially certifies${isFinalAlbum ? ", seals," : ""} and promulgates this <strong>${isFinalAlbum ? "Final Certified Electoral College Photo Album and Delegate Register" : "Official Electoral College Photo Album and Delegate Register"}</strong> for the <strong>${scopeText}</strong> (${contest} Election).
          </p>
          <p class="proclamation-p">
            This authoritative publication constitutes the complete photographic and biographical roll of certified party executives and delegates eligible to vote in the election of the <strong>${contest}</strong>. The electoral college is established in accordance with statutory constitutional regulations across National, Regional, Constituency, and accredited TESCON institutions. TESCON Patrons are strictly excluded.
          </p>
          <p class="proclamation-p">
            All executive records contained herein have undergone comprehensive audit, biometric voter ID cross-verification, and official jurisdiction alignment by the National Secretariat. No substitution, omission, or alteration shall be valid without the express written seal of the National Elections Committee.
          </p>
        </div>

        <div class="certification-metadata-grid">
          <div class="meta-cell">
            <span class="m-lbl">CONTEST PORTFOLIO:</span>
            <span class="m-val">${contest}</span>
          </div>
          <div class="meta-cell">
            <span class="m-lbl">CANONICAL JURISDICTION:</span>
            <span class="m-val">${scopeText}</span>
          </div>
          <div class="meta-cell">
            <span class="m-lbl">CONFIRMED VOTER DELEGATES:</span>
            <span class="m-val">${metrics.actualFigures.toLocaleString()} Delegates</span>
          </div>
          <div class="meta-cell">
            <span class="m-lbl">STATUTORY 2/3 QUORUM:</span>
            <span class="m-val">${metrics.quorumRequirement.toLocaleString()} Delegates</span>
          </div>
        </div>

        <div class="signature-section">
          <div class="seal-container">
            <svg width="74" height="74" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="60" cy="60" r="56" fill="#FFFFFF" stroke="#003399" stroke-width="4.5" stroke-dasharray="6,3"/>
              <circle cx="60" cy="60" r="48" fill="#FFFFFF" stroke="#C8102E" stroke-width="2"/>
              ${sealTopSvg}
              ${sealBottomSvg}
              ${effectiveElephantSealUri ? `<image href="${effectiveElephantSealUri}" x="37.5" y="27.5" width="45" height="45" />` : `
              <g transform="translate(46, 38) scale(0.65)">
                <path d="M20,2 C15,2 10,6 8,11 C6,16 6,24 6,28 C6,30 4,32 2,33 C1,33.5 0,35 0,37 C0,39 2,40 4,39 C7,38 9,35 10,31 C11,31 12,32 13,32 L13,42 L17,42 L17,31 C19,31 22,31 24,31 L24,42 L28,42 L28,29 C34,28 38,24 38,18 C38,8 30,2 20,2 Z" fill="#003399"/>
                <circle cx="12" cy="11" r="1.5" fill="#FFFFFF"/>
                <path d="M10,22 C13,22 15,19 16,16" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/>
              </g>`}
              <text x="60" y="77" fill="#003399" font-size="7" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" letter-spacing="0.8" text-anchor="middle">CERTIFIED</text>
            </svg>
          </div>
          <div class="sig-block">
            <div class="sig-line-img">
              <div class="signature-line"></div>
            </div>
            <div class="sig-name">HON. FREDERICK OPARE-ANSAH</div>
            <div class="sig-title">Chairperson, National Elections Committee</div>
            <div class="sig-org">National Elections Committee · NPP IT Directorate</div>
          </div>
        </div>
      </div>
    </div>
    
    <footer class="page-footer">
      <div class="footer-rule"></div>
      <div class="footer-content">
        <span>NPP ${isFinalAlbum ? "FINAL CERTIFIED" : "PROVISIONAL"} ELECTORAL COLLEGE ALBUM · ${contest.toUpperCase()}</span>
        <span class="footer-page-pill">1</span>
        <span>NATIONAL ELECTIONS COMMITTEE</span>
      </div>
    </footer>
  </div>

  <!-- PAGE 2: EXECUTIVE SUMMARY & METRICS -->
  <div class="album-page metrics-page">
    <header class="page-header">
      <h1 class="page-title">EXECUTIVE SUMMARY &amp; ELECTORATE METRICS</h1>
      <h2 class="page-sub">Comprehensive Electoral Statistics · ${contest} Contest</h2>
      <div class="header-rule"></div>
    </header>

    <div class="kpi-row">
      <div class="kpi-card"><div class="kpi-num">${metrics.actualFigures.toLocaleString()}</div><div class="kpi-lbl">Confirmed Electorate</div></div>
      <div class="kpi-card"><div class="kpi-num">${metrics.expectedFigures.toLocaleString()}</div><div class="kpi-lbl">Expected Seats</div></div>
      <div class="kpi-card"><div class="kpi-num">${metrics.complianceRate}</div><div class="kpi-lbl">Electoral Coverage</div></div>
      <div class="kpi-card"><div class="kpi-num">${metrics.quorumRequirement.toLocaleString()}</div><div class="kpi-lbl">2/3 Quorum Threshold</div></div>
    </div>

    <div class="table-container">
      <table class="stats-table">
        <thead><tr><th>Administrative Level</th><th>Certified Delegates</th><th>Share of Electorate</th><th>Verification Status</th></tr></thead>
        <tbody>
          <tr><td><strong>National Level</strong></td><td>${metrics.levelBreakdown.National || 0}</td><td>${(((metrics.levelBreakdown.National || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>National Council</td></tr>
          <tr><td><strong>Regional Level (16 Regions)</strong></td><td>${metrics.levelBreakdown.Regional || 0}</td><td>${(((metrics.levelBreakdown.Regional || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Statutory Quota: 21 per Region</td></tr>
          <tr><td><strong>Constituency Level (276 Constituencies)</strong></td><td>${metrics.levelBreakdown.Constituency || 0}</td><td>${(((metrics.levelBreakdown.Constituency || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Statutory Quota: 19 (11 Elected + 8 Appointed)</td></tr>
          ${(metrics.levelBreakdown["External Branch"] || 0) > 0 ? `<tr><td><strong>External Branches (Diaspora)</strong></td><td>${metrics.levelBreakdown["External Branch"]}</td><td>${(((metrics.levelBreakdown["External Branch"] || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>` : ""}
          <tr><td><strong>TESCON Level (${metrics.tesconInstitutionsCount || 0} Accredited Institutions)</strong></td><td>${metrics.levelBreakdown.TESCON || 0}</td><td>${(((metrics.levelBreakdown.TESCON || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Patrons Excluded</td></tr>
        </tbody>
      </table>

      <table class="stats-table">
        <thead><tr><th>Demographic Dimension</th><th>Headcount</th><th>Percentage</th><th>Statutory Notes</th></tr></thead>
        <tbody>
          <tr><td><strong>Male Electorate</strong></td><td>${metrics.genderBreakdown.male}</td><td>${((metrics.genderBreakdown.male / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Verified Gender</td></tr>
          <tr><td><strong>Female Electorate</strong></td><td>${metrics.genderBreakdown.female}</td><td>${metrics.genderBreakdown.femalePercentage}</td><td>Verified Gender</td></tr>
          <tr><td><strong>Youth Ratio (Under 40 as at 21 Aug 2026)</strong></td><td>${metrics.ageBreakdown.under40}</td><td>${metrics.ageBreakdown.under40Percentage}</td><td>Statutory Cutoff (21 Aug 2026)</td></tr>
          <tr><td><strong>Biometric Voter ID Verified</strong></td><td>${metrics.biometricVerification.verified}</td><td>${metrics.biometricVerification.verificationRate}</td><td>Matched to EC Register</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="page-footer">
      <div class="footer-rule"></div>
      <div class="footer-content">
        <span>${isFinalAlbum ? "FINAL CERTIFIED" : "PROVISIONAL"} ELECTORAL COLLEGE ALBUM · METRICS</span>
        <span class="footer-page-pill">2</span>
        <span>NATIONAL ELECTIONS COMMITTEE</span>
      </div>
    </footer>
  </div>

  <!-- PAGES 3+: VOTER CARDS -->
  ${delegatePagesHtml}

  <!-- FINAL PAGE: DEEP DIVE REGIONAL STATS -->
  <div class="album-page metrics-page">
    <header class="page-header">
      <h1 class="page-title">${levelAudit ? levelAudit.tableTitle : "REGIONAL DISTRIBUTION &amp; AUDIT SIGN-OFF"}</h1>
      <h2 class="page-sub">${levelAudit ? levelAudit.tableSub : `Jurisdictional Breakdown &amp; Gazette Closure · ${contest}`}</h2>
      <div class="header-rule"></div>
    </header>

    ${positionStatsBannerHtml}

    <div class="table-container">
      ${levelAudit?.contentHtml ? levelAudit.contentHtml : `
        <table class="stats-table">
          ${levelAudit ? `
            <thead>
              ${levelAudit.headersHtml}
            </thead>
            <tbody>
              ${levelAudit.rowsHtml}
            </tbody>
            ${levelAudit.footerHtml ? `<tfoot>${levelAudit.footerHtml}</tfoot>` : ""}
          ` : `
            <thead><tr><th>Jurisdiction / Region</th><th>Confirmed Voters</th><th>Percentage Share</th><th>Status</th></tr></thead>
            <tbody>
              ${regionalBreakdown
                .map(
                  (r) => `
                <tr><td><strong>${r.region}</strong></td><td>${r.count.toLocaleString()}</td><td>${((r.count / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Active Electorate</td></tr>
              `
                )
                .join("\n")}
            </tbody>
          `}
        </table>
      `}
    </div>

    <div class="proclamation-box" style="margin-top: auto; margin-bottom: 10px;">
      <h3>NATIONAL ELECTIONS COMMITTEE DECLARATION</h3>
      <p>
        This document represents the official ${isFinalAlbum ? "final certified" : "provisional"} compilation of the electoral roll for the ${contest} election. ${isFinalAlbum ? "Promulgated and sealed under the authority of the National Elections Committee." : "Any petition, objection, or substitution must be lodged in writing with the National Secretariat within five (5) working days of publication."}
      </p>
    </div>

    <footer class="page-footer">
      <div class="footer-rule"></div>
      <div class="footer-content">
        <span>${isFinalAlbum ? "FINAL CERTIFIED" : "PROVISIONAL"} ELECTORAL COLLEGE ALBUM · ${levelAudit ? levelAudit.footerLabel : "REGIONAL AUDIT"}</span>
        <span class="footer-page-pill">${totalPages}</span>
        <span>NATIONAL ELECTIONS COMMITTEE</span>
      </div>
    </footer>
  </div>

<script>${ALBUM_PRINT_SCRIPT}</script>
</body>
</html>`;
}
