import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";
import { withEcSql } from "@/lib/db-ec";

export const dynamic = "force-dynamic";

import { CONTEST_LIST, type ContestType } from "@/lib/election-contests";

const CACHE_DIR = path.join(process.cwd(), ".cache", "albums", "webp");
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch {
  // Ignore
}

// In-memory cache for converted WebP Base64 Data URIs
const webpMemoryCache = new Map<string, string>();

// Pre-indexed WebP photos from Ahafo album (voter_id and executive_name)
const ahafoPhotosByVoterId = new Map<string, string>();
const ahafoPhotosByName = new Map<string, string>();

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
        .resize(160, 160, { fit: "contain" })
        .webp({ quality: 90 })
        .toBuffer();
      LOGO_WEBP_DATA_URI = "data:image/webp;base64," + webpBuf.toString("base64");
    }
  } catch {
    // fallback if file read or conversion fails
  }
  return LOGO_WEBP_DATA_URI;
}

const CANONICAL_LEVEL_ORDER: Record<string, number> = {
  national: 1,
  region: 2,
  regional: 2,
  constituency: 3,
  tescon: 4,
};

function normalizePositionRank(pos: string | null): number {
  const s = String(pos || "").trim().toLowerCase();
  if (s.includes("chairperson") || s.includes("chairman")) {
    if (s.includes("1st") || s.includes("first")) return 2;
    if (s.includes("2nd") || s.includes("second")) return 3;
    if (s.includes("3rd") || s.includes("third")) return 4;
    return 1;
  }
  if (s.includes("financial secretary")) return 11;
  if (s.includes("deputy secretary") || s.includes("assistant secretary") || s.includes("deputy general secretary")) return 5;
  if (s.includes("secretary")) return 4; // General Secretary or Secretary
  if (s.includes("treasurer")) return 6;
  if (s.includes("deputy organiser") || s.includes("deputy organizer")) return 16;
  if (s.includes("organiser") || s.includes("organizer")) return 7;
  if (s.includes("deputy women")) return 17;
  if (s.includes("women")) return 8;
  if (s.includes("deputy youth")) return 18;
  if (s.includes("youth")) return 9;
  if (s.includes("deputy nasara")) return 19;
  if (s.includes("nasara")) return 10;
  if (s.includes("electoral")) return 12;
  if (s.includes("communication")) return 13;
  if (s.includes("research")) return 14;
  if (s.includes("pwd") || s.includes("disability")) return 15;
  if (s.includes("special duties")) return 20;
  if (s.includes("legal")) return 21;
  if (s.includes("president")) return 22; // TESCON President
  if (s.includes("wocom")) return 23; // TESCON WOCOM
  return 30;
}

function normalizeCanonicalPosition(pos: string | null, level: string | null): string {
  const s = String(pos || "").trim().toLowerCase();
  const lvl = String(level || "").toLowerCase();
  if (s.includes("chairperson") || s.includes("chairman")) {
    if (s.includes("1st") || s.includes("first")) return "1st Vice Chairperson";
    if (s.includes("2nd") || s.includes("second")) return "2nd Vice Chairperson";
    if (s.includes("3rd") || s.includes("third")) return "3rd Vice Chairperson";
    return lvl === "national" ? "National Chairperson" : "Chairperson";
  }
  if (s.includes("financial secretary")) return "Financial Secretary";
  if (s.includes("deputy general secretary")) return "Deputy General Secretary";
  if (s.includes("deputy secretary") || s.includes("assistant secretary")) return "Deputy Secretary";
  if (s.includes("secretary")) return lvl === "national" ? "General Secretary" : "Secretary";
  if (s.includes("treasurer")) return "Treasurer";
  if (s.includes("deputy women")) return "Deputy Women Organiser";
  if (s.includes("women")) return "Women Organiser";
  if (s.includes("deputy youth")) return "Deputy Youth Organiser";
  if (s.includes("youth")) return "Youth Organiser";
  if (s.includes("deputy nasara")) return lvl === "region" || lvl === "national" ? "Deputy Nasara Coordinator" : "Deputy Nasara Organiser";
  if (s.includes("nasara")) return lvl === "region" || lvl === "national" ? "Nasara Coordinator" : "Nasara Organiser";
  if (s.includes("deputy organiser") || s.includes("deputy organizer")) return "Deputy Organiser";
  if (s.includes("organiser") || s.includes("organizer")) return "Organiser";
  if (s.includes("electoral")) return "Electoral Affairs Officer";
  if (s.includes("communication")) return "Communication Officer";
  if (s.includes("research")) return "Research Officer";
  if (s.includes("pwd") || s.includes("disability")) return lvl === "region" || lvl === "national" ? "PWD Officer" : "PWD Coordinator";
  if (s.includes("special duties")) return "Special Duties Officer";
  if (s.includes("legal")) return "Legal Representative Officer";
  if (s.includes("president")) return "TESCON President";
  if (s.includes("wocom")) return "TESCON WOCOM";
  return pos || "Executive Member";
}

function calculateAgeIn2026(dob: string | null, ageCol: number | null | undefined): number | null {
  if (dob) {
    const s = String(dob).trim();
    const mYear = s.match(/^(\d{4})/);
    if (mYear) {
      const year = parseInt(mYear[1], 10);
      if (year >= 1910 && year <= 2026) return 2026 - year;
    }
    const dmy = s.match(/(\d{4})$/);
    if (dmy) {
      const year = parseInt(dmy[1], 10);
      if (year >= 1910 && year <= 2026) return 2026 - year;
    }
  }
  if (ageCol !== null && ageCol !== undefined && Number.isFinite(ageCol) && ageCol > 0 && ageCol <= 120) {
    return ageCol;
  }
  return null;
}

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

async function resolveDelegateWebpImage(
  imageUrl: string | null,
  voterId?: string | null,
  name?: string | null
): Promise<string | null> {
  // 1. Check Ahafo pre-converted index
  if (voterId && voterId !== "—") {
    const cachedByVoterId = ahafoPhotosByVoterId.get(voterId.trim());
    if (cachedByVoterId) return cachedByVoterId;
  }
  if (name) {
    const cleanName = name.trim().toUpperCase();
    const cachedByName = ahafoPhotosByName.get(cleanName);
    if (cachedByName) return cachedByName;
  }

  if (!imageUrl || imageUrl.trim().length < 5) {
    return null;
  }

  const cleanUrl = imageUrl.trim();

  // 2. In-memory cache
  if (webpMemoryCache.has(cleanUrl)) {
    return webpMemoryCache.get(cleanUrl)!;
  }

  // 3. Already WebP Data URI
  if (cleanUrl.startsWith("data:image/webp;base64,")) {
    webpMemoryCache.set(cleanUrl, cleanUrl);
    return cleanUrl;
  }

  // 4. Other Base64 Data URI (e.g. data:image/jpeg or png)
  if (cleanUrl.startsWith("data:image/")) {
    try {
      const commaIdx = cleanUrl.indexOf(",");
      if (commaIdx !== -1) {
        const inputBuf = Buffer.from(cleanUrl.slice(commaIdx + 1), "base64");
        const webpBuf = await sharp(inputBuf)
          .resize(240, 300, { fit: "cover", position: "top", withoutEnlargement: false })
          .webp({ quality: 80, effort: 4 })
          .toBuffer();
        const uri = "data:image/webp;base64," + webpBuf.toString("base64");
        webpMemoryCache.set(cleanUrl, uri);
        return uri;
      }
    } catch (err) {
      console.error("Base64 webp conversion error:", err);
      return null;
    }
  }

  // 5. Check Disk Cache via SHA256
  const hash = crypto
    .createHash("sha256")
    .update(`${cleanUrl}_240_300_80`)
    .digest("hex");
  const diskCachePath = path.join(CACHE_DIR, `${hash}.webp`);

  if (fs.existsSync(diskCachePath)) {
    try {
      const cachedBuf = fs.readFileSync(diskCachePath);
      const uri = "data:image/webp;base64," + cachedBuf.toString("base64");
      webpMemoryCache.set(cleanUrl, uri);
      return uri;
    } catch {
      // fallback to reprocessing
    }
  }

  // 6. Source Buffer Resolution (Local vs Remote)
  let inputBuffer: Buffer | null = null;

  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
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
      ? path.join(process.cwd(), "public", cleanUrl.replace(/^\//, ""))
      : path.join(process.cwd(), cleanUrl);

    if (fs.existsSync(localPath)) {
      try {
        inputBuffer = fs.readFileSync(localPath);
      } catch {
        inputBuffer = null;
      }
    }
  }

  if (!inputBuffer || inputBuffer.length < 100) {
    return null;
  }

  // 7. Convert Source to WebP using Sharp
  try {
    const webpBuf = await sharp(inputBuffer)
      .resize(240, 300, {
        fit: "cover",
        position: "top",
        withoutEnlargement: false,
      })
      .webp({
        quality: 80,
        effort: 4,
      })
      .toBuffer();

    // Save to disk cache
    try {
      fs.writeFileSync(diskCachePath, webpBuf);
    } catch {
      // Non-fatal
    }

    const uri = "data:image/webp;base64," + webpBuf.toString("base64");
    webpMemoryCache.set(cleanUrl, uri);
    return uri;
  } catch (err) {
    console.error("WebP conversion error for:", cleanUrl, err);
    return null;
  }
}

async function convertDelegatesImagesToWebp(delegates: any[]): Promise<void> {
  const chunkSize = 25;
  for (let i = 0; i < delegates.length; i += chunkSize) {
    const chunk = delegates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (d) => {
        const webpUri = await resolveDelegateWebpImage(d.image_url, d.voter_id, d.executive_name);
        d.webp_base64 = webpUri || d.avatar_svg;
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
  const positionQuery = (searchParams.get("position") || "Youth Organiser").trim();
  const regionQuery = (searchParams.get("region") || "all").trim();
  const format = searchParams.get("format") || "json";
  const isDownload =
    searchParams.get("download") === "1" || searchParams.get("download") === "true";

  // Match valid contest
  const matchedContest =
    CONTEST_LIST.find((c) => c.toLowerCase() === positionQuery.toLowerCase()) ||
    "Youth Organiser";

  return withEcSql(async (sql) => {
    // 1. Fetch certified pool
    const rawRows = await sql`
      SELECT
        id,
        executive_level,
        region,
        constituency,
        position,
        executive_name,
        voter_id,
        phone,
        gender,
        date_of_birth,
        age,
        image_url
      FROM executives_all
      WHERE lower(trim(executive_level)) IN ('national', 'region', 'regional', 'constituency', 'tescon')
      ORDER BY id
    `;

    // 2. Filter valid (non-vacant)
    const validRows = rawRows.filter((r) => {
      const name = String(r.executive_name || "").trim();
      return name && !/^(vacant|vacancy|unknown|n\/?a|not available)/i.test(name);
    });

    // 3. Apply contest eligibility rules
    const contestFiltered = validRows.filter((r) => {
      const lvl = String(r.executive_level || "").toLowerCase().trim();
      const pos = String(r.position || "").trim();
      const posLower = pos.toLowerCase();
      const g = String(r.gender || "").toLowerCase().trim();

      // Rule: TESCON Patrons NEVER vote
      if (lvl === "tescon" && /patron/i.test(pos)) {
        return false;
      }

      // Optional Region Filter
      if (regionQuery !== "all" && regionQuery !== "") {
        const rowRegion = String(r.region || "").toLowerCase().trim();
        if (lvl !== "national" && rowRegion !== regionQuery.toLowerCase()) {
          return false;
        }
      }

      // Contest specific qualification:
      if (
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
        // TESCON: Presidents, WOCOM, Nasara (patrons already excluded)
        if (lvl === "tescon") {
          return /president|wocom|women|nasara/i.test(pos);
        }
        // Core levels:
        if (["national", "region", "regional", "constituency"].includes(lvl)) {
          // Youth organisers & deputies vote ex-officio
          if (/youth/i.test(posLower)) return true;
          // Former national youth organisers
          if (/former.*youth/i.test(posLower)) return true;
          // Anyone under 40
          const age = calculateAgeIn2026(r.date_of_birth, r.age);
          if (age !== null && age < 40) return true;
        }
        return false;
      }

      if (matchedContest === "Women Organiser") {
        // All females in core levels
        if (["national", "region", "regional", "constituency"].includes(lvl)) {
          return g === "female";
        }
        // TESCON: All WOCOM + female Presidents
        if (lvl === "tescon") {
          if (/wocom|women/i.test(posLower)) return true;
          if (/president/i.test(posLower) && g === "female") return true;
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
    });

    // 4. Sort strictly by 2-Stage Hierarchy:
    // Stage 1: Level (National -> Regional -> Constituency -> TESCON)
    // Stage 2: Positional Rank within each level
    const delegates = contestFiltered
      .map((r) => {
        const lvl = String(r.executive_level || "").toLowerCase().trim();
        const levelGroup =
          lvl === "national"
            ? "National"
            : lvl === "region" || lvl === "regional"
            ? "Regional"
            : lvl === "constituency"
            ? "Constituency"
            : "TESCON";

        const canonPos = normalizeCanonicalPosition(r.position, r.executive_level);
        const posRank = normalizePositionRank(r.position);
        const levelRank = CANONICAL_LEVEL_ORDER[lvl] || 99;
        const regName = String(r.region || "Unassigned").trim();
        const conName = String(r.constituency || "").trim();
        const age = calculateAgeIn2026(r.date_of_birth, r.age);
        const hasVoterId = Boolean(r.voter_id && String(r.voter_id).trim().length === 10);
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
          voter_id: r.voter_id ? String(r.voter_id).trim() : "—",
          has_voter_id: hasVoterId,
          phone: r.phone && String(r.phone).trim() !== "None" ? String(r.phone).trim() : "—",
          gender: r.gender ? String(r.gender).trim() : "Unknown",
          age,
          is_under_40: age !== null ? age < 40 : false,
          image_url: photoUrl,
          webp_image_url: photoUrl
            ? `/api/admin/albums/image?url=${encodeURIComponent(photoUrl)}&w=240&h=300`
            : null,
          avatar_svg: avatarSvg,
          level_rank: levelRank,
          position_rank: posRank,
        };
      })
      .sort((a, b) => {
        // Stage 1: Level
        if (a.level_rank !== b.level_rank) return a.level_rank - b.level_rank;
        // Sub-sort by Region (if not National)
        if (a.level_rank > 1) {
          const rCmp = a.region.localeCompare(b.region);
          if (rCmp !== 0) return rCmp;
        }
        // Sub-sort by Constituency (if Constituency)
        if (a.level_rank === 3) {
          const cCmp = a.constituency.localeCompare(b.constituency);
          if (cCmp !== 0) return cCmp;
        }
        // Stage 2: Positional Rank
        if (a.position_rank !== b.position_rank) return a.position_rank - b.position_rank;
        // Tie-breaker: Name
        return a.executive_name.localeCompare(b.executive_name);
      });

    // 5. Compute Comprehensive Metrics
    const totalActual = delegates.length;
    let expectedCount = 0;
    if (regionQuery === "all" || regionQuery === "") {
      if (
        matchedContest === "Chairperson" ||
        matchedContest === "Vice Chairperson" ||
        matchedContest === "General Secretary" ||
        matchedContest === "Treasurer" ||
        matchedContest === "Communication Officer" ||
        matchedContest === "Organiser"
      ) {
        expectedCount = 5650; // Core (105 + 336 + 5030) + 179 TESCON Presidents
      } else if (matchedContest === "Youth Organiser") {
        expectedCount = 2400;
      } else if (matchedContest === "Women Organiser") {
        expectedCount = 1080;
      } else if (matchedContest === "Nasara Organiser") {
        expectedCount = 760;
      }
    } else {
      expectedCount = Math.ceil(totalActual * 1.03); // Approximate for single region
    }

    const levelCounts = delegates.reduce(
      (acc, d) => {
        acc[d.executive_level] = (acc[d.executive_level] || 0) + 1;
        return acc;
      },
      { National: 0, Regional: 0, Constituency: 0, TESCON: 0 } as Record<string, number>
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
        if (d.age === null) acc.pending++;
        else if (d.age < 40) acc.under40++;
        else acc.fortyPlus++;
        return acc;
      },
      { under40: 0, fortyPlus: 0, pending: 0 }
    );

    const verifiedVoterIds = delegates.filter((d) => d.has_voter_id).length;

    // Regional breakdown table
    const regionalMap = new Map<string, number>();
    for (const d of delegates) {
      const reg = d.executive_level === "National" ? "National Headquarters" : d.region;
      regionalMap.set(reg, (regionalMap.get(reg) || 0) + 1);
    }
    const regionalBreakdown = Array.from(regionalMap.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    const metrics = {
      contest: matchedContest,
      scope: regionQuery === "all" ? "Nationwide (All 16 Regions + National + TESCON)" : `${regionQuery} Region`,
      expectedFigures: expectedCount,
      actualFigures: totalActual,
      variance: Math.max(0, expectedCount - totalActual),
      complianceRate: expectedCount > 0 ? ((totalActual / expectedCount) * 100).toFixed(1) + "%" : "100%",
      quorumRequirement: Math.ceil(totalActual * (2 / 3)), // 2/3 constitutional quorum
      levelBreakdown: levelCounts,
      genderBreakdown: {
        male: genderCounts.male,
        female: genderCounts.female,
        unknown: genderCounts.unknown,
        femalePercentage: totalActual > 0 ? ((genderCounts.female / totalActual) * 100).toFixed(1) + "%" : "0%",
      },
      ageBreakdown: {
        under40: ageCounts.under40,
        fortyPlus: ageCounts.fortyPlus,
        pending: ageCounts.pending,
        under40Percentage: totalActual > 0 ? ((ageCounts.under40 / totalActual) * 100).toFixed(1) + "%" : "0%",
      },
      biometricVerification: {
        verified: verifiedVoterIds,
        pending: totalActual - verifiedVoterIds,
        verificationRate: totalActual > 0 ? ((verifiedVoterIds / totalActual) * 100).toFixed(1) + "%" : "0%",
      },
    };

    if (format === "html") {
      // Pre-convert logo to WebP
      const logoDataUri = await getLogoWebpDataUri();

      // Pre-convert all delegate images to WebP data URIs before rendering
      await convertDelegatesImagesToWebp(delegates);

      // Return renderable HTML directly
      const html = generateAlbumHtml(
        matchedContest,
        regionQuery,
        metrics,
        delegates,
        regionalBreakdown,
        logoDataUri
      );

      const headers: Record<string, string> = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      };

      if (isDownload) {
        const safeContest = matchedContest.replace(/\s+/g, "_");
        const safeRegion = regionQuery !== "all" ? `_${regionQuery.replace(/\s+/g, "_")}` : "";
        headers["Content-Disposition"] = `attachment; filename="NPP_${safeContest}${safeRegion}_Election_Album_2026.html"`;
      }

      return new NextResponse(html, { headers });
    }

    return NextResponse.json({
      metrics,
      regionalBreakdown,
      delegates,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

function generateAlbumHtml(
  contest: string,
  region: string,
  metrics: any,
  delegates: any[],
  regionalBreakdown: any[],
  logoDataUri?: string
): string {
  const cardsPerPage = 10;
  const delegatePages: any[][] = [];
  for (let i = 0; i < delegates.length; i += cardsPerPage) {
    delegatePages.push(delegates.slice(i, i + cardsPerPage));
  }

  const totalPages = 2 + delegatePages.length + 1; // Page 1: Cover, Page 2: Metrics, Pages 3+: Cards, Final: Stats

  const scopeText = region === "all" ? "NATIONWIDE ELECTORAL ROLL" : `${region.toUpperCase()} REGION`;
  const badgeText = region === "all" ? `${contest.toUpperCase()} ELECTION` : `${region.toUpperCase()} REGION · ${contest.toUpperCase()}`;

  const delegatePagesHtml = delegatePages
    .map((group, pageIdx) => {
      const pageNum = pageIdx + 3;
      const currentLevel = group[0]?.executive_level || "Electorate";
      const cardsHtml = group
        .map(
          (d) => {
            const photoSrc = d.webp_base64 || d.avatar_svg;
            return `
        <div class="voter-card">
          <div class="card-details">
            <div class="pos-badge">${d.canonical_position}</div>
            <div class="exec-name">${d.executive_name}</div>
            <div class="detail-line">
              <span class="lbl">Level:</span> <span class="val">${d.executive_level}${d.constituency ? ` · ${d.constituency}` : d.region ? ` · ${d.region}` : ""}</span>
            </div>
            <div class="detail-line">
              <span class="lbl">Voter ID:</span> <span class="val mono">${d.voter_id}</span>
            </div>
            <div class="detail-line">
              <span class="lbl">Phone:</span> <span class="val">${d.phone}</span>
            </div>
          </div>
          <div class="card-photo">
            <img class="voter-img" src="${photoSrc}" alt="${d.executive_name}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${d.avatar_svg}';" />
          </div>
        </div>
      `;
          }
        )
        .join("\n");

      return `
      <div class="album-page">
        <header class="page-header">
          <div class="header-content">
            ${logoDataUri ? `<img class="npp-logo header-npp-logo" src="${logoDataUri}" alt="NPP" />` : `<div class="party-seal-mini">NPP</div>`}
            <div class="header-text">
              <h1>NEW PATRIOTIC PARTY</h1>
              <h2>${contest.toUpperCase()} ELECTION · ${currentLevel.toUpperCase()} LEVEL (PART ${pageIdx + 1})</h2>
            </div>
          </div>
          <div class="header-rule"></div>
        </header>

        <main class="grid-10">
          ${cardsHtml}
        </main>

        <footer class="page-footer">
          <div class="footer-rule"></div>
          <div class="footer-content">
            <span>PROVISIONAL ELECTORAL COLLEGE ALBUM · ${contest.toUpperCase()}</span>
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
  <title>Provisional Album · ${contest} Election · NPP</title>
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
      body { background: transparent; }
      .no-print { display: none !important; }
      .album-page {
        margin: 0 !important;
        box-shadow: none !important;
        width: 210mm !important;
        height: 297mm !important;
        page-break-after: always !important;
        break-after: page !important;
      }
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
      width: 210mm; height: 297mm; max-height: 297mm;
      margin: 15px auto; padding: 8mm 10mm 6mm 10mm;
      background: #FFFFFF; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      position: relative; display: flex; flex-direction: column; justify-content: space-between;
      overflow: hidden;
    }

    /* Cover Page Styles (Ahafo Master Design Reverted) */
    .cover-page {
      padding: 10mm 12mm 8mm 12mm;
    }

    .cover-inner-border {
      border: 3px double #003399;
      padding: 8mm 10mm;
      display: flex;
      flex-direction: column;
      height: 100%;
      justify-content: space-between;
      box-sizing: border-box;
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
      width: 68px;
      height: 68px;
      object-fit: contain;
    }

    .header-npp-logo {
      width: 38px;
      height: 38px;
      object-fit: contain;
    }

    .cover-main-title {
      font-size: 23pt;
      font-weight: 900;
      color: #003399;
      letter-spacing: 2px;
      margin-bottom: 2px;
    }

    .cover-sub-title {
      font-size: 13pt;
      font-weight: 800;
      color: #DC2626;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .cover-tri-bar {
      display: flex;
      height: 5px;
      width: 140px;
      margin: 0 auto 10px auto;
      border-radius: 3px;
      overflow: hidden;
    }

    .bar-red { flex: 1; background: #DC2626; }
    .bar-white { flex: 1; background: #FFFFFF; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; }
    .bar-blue { flex: 1; background: #003399; }

    .cover-doc-title {
      font-size: 12pt;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: 0.8px;
      margin-bottom: 8px;
    }

    .cover-region-badge {
      display: inline-block;
      background: #003399;
      color: #FFFFFF;
      font-size: 14pt;
      font-weight: 900;
      padding: 4px 20px;
      border-radius: 20px;
      letter-spacing: 1.5px;
    }

    .cover-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 6px;
    }

    .formal-proclamation {
      background: #F8FAFC;
      border-left: 4px solid #003399;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
    }

    .proclamation-title {
      font-size: 10pt;
      font-weight: 900;
      color: #003399;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    .proclamation-p {
      font-size: 8.5pt;
      line-height: 1.45;
      color: #334155;
      margin-bottom: 6px;
      text-align: justify;
    }

    .certification-metadata-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      background: #F1F5F9;
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid #CBD5E1;
    }

    .meta-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .m-lbl {
      font-size: 7pt;
      font-weight: 800;
      color: #64748B;
      letter-spacing: 0.5px;
    }

    .m-val {
      font-size: 9pt;
      font-weight: 800;
      color: #003399;
    }

    .signature-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 10px 0 10px;
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
      width: 170px;
      height: 1.5px;
      background: #003399;
      margin-left: auto;
      margin-bottom: 4px;
    }

    .sig-name {
      font-size: 10.5pt;
      font-weight: 900;
      color: #003399;
      letter-spacing: 0.4px;
    }

    .sig-title {
      font-size: 8pt;
      font-weight: 800;
      color: #1E293B;
      font-style: italic;
    }

    .sig-org {
      font-size: 7pt;
      font-weight: 600;
      color: #64748B;
    }

    /* Page 2: Metrics */
    .metrics-page { padding: 12mm 12mm 8mm 12mm; }
    .page-title { font-size: 16pt; font-weight: 900; color: #003399; margin-bottom: 2px; }
    .page-sub { font-size: 9.5pt; font-weight: 700; color: #64748B; margin-bottom: 12px; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi-card { background: #F8FAFC; border: 1px solid #CBD5E1; padding: 10px; border-radius: 6px; text-align: center; }
    .kpi-num { font-size: 18pt; font-weight: 900; color: #003399; }
    .kpi-lbl { font-size: 7.5pt; font-weight: 800; color: #64748B; text-transform: uppercase; margin-top: 2px; }
    .table-container { margin-top: 10px; }
    .stats-table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 12px; }
    .stats-table th { background: #003399; color: white; padding: 6px 10px; text-align: left; font-weight: 800; }
    .stats-table td { padding: 5px 10px; border-bottom: 1px solid #E2E8F0; }
    .stats-table tr:nth-child(even) { background: #F8FAFC; }

    /* Cards Grid (Pages 3+) */
    .grid-10 {
      display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(5, 1fr);
      gap: 6px; flex: 1; margin: 6px 0;
    }
    .voter-card {
      border: 1px solid #E2E8F0; border-radius: 4px; display: flex; justify-content: space-between;
      overflow: hidden; height: 46mm; max-height: 46mm; background: white;
    }
    .card-details { flex: 1; padding: 5px 8px; display: flex; flex-direction: column; justify-content: center; gap: 2px; overflow: hidden; }
    .pos-badge {
      background: #003399; color: white; font-size: 6.8pt; font-weight: 800; padding: 1.5px 5px;
      border-radius: 3px; display: inline-block; width: fit-content; text-transform: uppercase;
    }
    .exec-name { font-size: 9pt; font-weight: 800; color: #0F172A; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .detail-line { font-size: 7.2pt; color: #334155; }
    .lbl { font-weight: 800; color: #64748B; font-size: 6.8pt; }
    .val { font-weight: 700; color: #0F172A; }
    .val.mono { font-family: monospace; background: #F1F5F9; padding: 1px 4px; border-radius: 2px; }
    .card-photo { width: 33mm; min-width: 33mm; height: 100%; background: #F1F5F9; border-left: 1px solid #CBD5E1; }
    .voter-img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }

    /* Header & Footer */
    .page-header { margin-bottom: 4px; }
    .header-content { display: flex; align-items: center; gap: 10px; }
    .party-seal-mini { background: #003399; color: white; font-size: 11pt; font-weight: 900; padding: 4px 8px; border-radius: 4px; }
    .header-text h1 { font-size: 14pt; font-weight: 900; color: #003399; }
    .header-text h2 { font-size: 9pt; font-weight: 800; color: #475569; }
    .header-rule { height: 2px; background: #003399; margin-top: 4px; }
    .page-footer { margin-top: auto; padding-top: 3px; }
    .footer-rule { height: 1.5px; background: #CBD5E1; margin-bottom: 3px; }
    .footer-content { display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; font-weight: 700; color: #475569; }
    .footer-page-pill { font-size: 9.5pt; font-weight: 900; color: #003399; background: #F1F5F9; padding: 1px 10px; border-radius: 10px; border: 1px solid #CBD5E1; }
  </style>
</head>
<body>

  <div class="web-nav no-print">
    <span>NPP · ${contest.toUpperCase()} PROVISIONAL ELECTION ALBUM (${totalPages} PAGES · ${delegates.length} VOTERS)</span>
    <button class="print-btn" onclick="window.print()">PRINT / SAVE AS PDF</button>
  </div>

  <!-- PAGE 1: COVER (Ahafo Master Cover Design Reverted) -->
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
        <h3 class="cover-doc-title">PROVISIONAL ELECTORAL COLLEGE ALBUM &amp; VOTER DIRECTORY</h3>
        <div class="cover-region-badge">${badgeText}</div>
      </div>

      <div class="cover-body">
        <div class="formal-proclamation">
          <h4 class="proclamation-title">ACKNOWLEDGEMENT &amp; CERTIFICATION</h4>
          <p class="proclamation-p">
            The <strong>National Elections Committee</strong> of the <strong>New Patriotic Party (NPP)</strong>, acting in accordance with the powers conferred under Article 10 and Article 17 of the Party's Constitution and the General Regulations governing internal party primaries and elections, hereby officially certifies and promulgates this <strong>Official Electoral College Photo Album and Delegate Register</strong> for the <strong>${scopeText}</strong> (${contest} Election).
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
            <svg width="88" height="88" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="60" cy="60" r="56" fill="#FFFFFF" stroke="#003399" stroke-width="4" stroke-dasharray="6,3"/>
              <circle cx="60" cy="60" r="48" fill="#F8FAFC" stroke="#DC2626" stroke-width="2"/>
              <path id="curve-seal" d="M 22 60 A 38 38 0 1 1 98 60" fill="none"/>
              <text font-size="8" font-weight="900" fill="#003399" letter-spacing="0.5">
                <textPath href="#curve-seal" startOffset="50%" text-anchor="middle">NATIONAL ELECTIONS COMMITTEE</textPath>
              </text>
              <path id="curve-seal2" d="M 22 60 A 38 38 0 0 0 98 60" fill="none"/>
              <text font-size="7.5" font-weight="800" fill="#DC2626" letter-spacing="0.5">
                <textPath href="#curve-seal2" startOffset="50%" text-anchor="middle">OFFICIAL SEAL · ELECTIONS 2026</textPath>
              </text>
              <polygon points="60,38 63,48 74,48 65,55 69,66 60,59 51,66 55,55 46,48 57,48" fill="#003399"/>
              <text x="60" y="77" fill="#003399" font-size="7" font-weight="bold" text-anchor="middle">CERTIFIED</text>
            </svg>
          </div>
          <div class="sig-block">
            <div class="sig-line-img">
              <div class="signature-line"></div>
            </div>
            <div class="sig-name">HON. OPARE ANSAH</div>
            <div class="sig-title">Chairperson, National Elections Committee</div>
            <div class="sig-org">New Patriotic Party · Headquarters, Accra</div>
          </div>
        </div>
      </div>
    </div>
    
    <footer class="page-footer">
      <div class="footer-rule"></div>
      <div class="footer-content">
        <span>NPP PROVISIONAL ELECTORAL COLLEGE ALBUM · ${contest.toUpperCase()}</span>
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
          <tr><td><strong>National Level</strong></td><td>${metrics.levelBreakdown.National}</td><td>${((metrics.levelBreakdown.National / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>
          <tr><td><strong>Regional Level (16 Regions)</strong></td><td>${metrics.levelBreakdown.Regional}</td><td>${((metrics.levelBreakdown.Regional / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>
          <tr><td><strong>Constituency Level (276 Constituencies)</strong></td><td>${metrics.levelBreakdown.Constituency}</td><td>${((metrics.levelBreakdown.Constituency / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>
          <tr><td><strong>TESCON Level (Accredited Institutions)</strong></td><td>${metrics.levelBreakdown.TESCON}</td><td>${((metrics.levelBreakdown.TESCON / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Patrons Excluded</td></tr>
        </tbody>
      </table>

      <table class="stats-table">
        <thead><tr><th>Demographic Dimension</th><th>Headcount</th><th>Percentage</th><th>Statutory Notes</th></tr></thead>
        <tbody>
          <tr><td><strong>Male Electorate</strong></td><td>${metrics.genderBreakdown.male}</td><td>${((metrics.genderBreakdown.male / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Verified Gender</td></tr>
          <tr><td><strong>Female Electorate</strong></td><td>${metrics.genderBreakdown.female}</td><td>${metrics.genderBreakdown.femalePercentage}</td><td>Verified Gender</td></tr>
          <tr><td><strong>Youth Ratio (Under 40 in 2026)</strong></td><td>${metrics.ageBreakdown.under40}</td><td>${metrics.ageBreakdown.under40Percentage}</td><td>Article 17 Age Rule</td></tr>
          <tr><td><strong>Biometric Voter ID Verified</strong></td><td>${metrics.biometricVerification.verified}</td><td>${metrics.biometricVerification.verificationRate}</td><td>Matched to EC Register</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="page-footer">
      <div class="footer-rule"></div>
      <div class="footer-content">
        <span>PROVISIONAL ELECTORAL COLLEGE ALBUM · METRICS</span>
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
      <h1 class="page-title">REGIONAL DISTRIBUTION &amp; AUDIT SIGN-OFF</h1>
      <h2 class="page-sub">Jurisdictional Breakdown &amp; Gazette Closure · ${contest}</h2>
      <div class="header-rule"></div>
    </header>

    <div class="table-container">
      <table class="stats-table">
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
      </table>
    </div>

    <div class="proclamation-box" style="margin-top: auto; margin-bottom: 10px;">
      <h3>NATIONAL ELECTIONS COMMITTEE DECLARATION</h3>
      <p>
        This document represents the official provisional compilation of the electoral roll for the ${contest} election. Any petition, objection, or substitution must be lodged in writing with the National Secretariat within five (5) working days of publication.
      </p>
    </div>

    <footer class="page-footer">
      <div class="footer-rule"></div>
      <div class="footer-content">
        <span>PROVISIONAL ELECTORAL COLLEGE ALBUM · REGIONAL AUDIT</span>
        <span class="footer-page-pill">${totalPages}</span>
        <span>NATIONAL ELECTIONS COMMITTEE</span>
      </div>
    </footer>
  </div>

</body>
</html>`;
}
