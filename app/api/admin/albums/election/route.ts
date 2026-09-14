import fs from "fs";
import path from "path";
import sharp from "sharp";
import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";
import { resolveAlbumImage } from "@/lib/album-images";
import { ALBUM_PRINT_SCRIPT } from "@/lib/album-print";
import { withEcSql } from "@/lib/db-ec";

export const dynamic = "force-dynamic";

import {
  CONTEST_LIST,
  CUSTOM_CONTEST,
  getCanonicalPositionsForSelection,
  type ContestType,
} from "@/lib/election-contests";

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

const CANONICAL_LEVEL_ORDER: Record<string, number> = {
  national: 1,
  region: 2,
  regional: 2,
  "external branch": 3,
  constituency: 4,
  tescon: 5,
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
  const candidates: string[] = [];
  if (voterId && voterId !== "—") {
    const cachedByVoterId = ahafoPhotosByVoterId.get(voterId.trim());
    if (cachedByVoterId) candidates.push(cachedByVoterId);
  }
  if (name) {
    const cleanName = name.trim().toUpperCase();
    const cachedByName = ahafoPhotosByName.get(cleanName);
    if (cachedByName) candidates.push(cachedByName);
  }
  if (imageUrl) candidates.push(imageUrl);
  // Validate embedded portraits too, and try the source if an old portrait is corrupt.
  for (const candidate of new Set(candidates)) {
    const buffer = await resolveAlbumImage(candidate);
    if (buffer) return "data:image/webp;base64," + buffer.toString("base64");
  }
  return null;
}

async function convertDelegatesImagesToWebp(delegates: any[]): Promise<void> {
  const chunkSize = 8;
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
  const scopeQuery = (searchParams.get("scope") || "").trim().toLowerCase();
  const format = (searchParams.get("format") || "json").toLowerCase();
  const isDownload =
    searchParams.get("download") === "1" || searchParams.get("download") === "true";

  const levelsParam = (searchParams.get("levels") || searchParams.get("level") || "all").trim();
  const selectedLevels =
    levelsParam.toLowerCase() !== "all" && levelsParam !== ""
      ? levelsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [];

  const customPositionKeys = positionsParam
    ? positionsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const isCustomContest =
    positionQuery.toLowerCase() === "custom" ||
    customPositionKeys.length > 0;

  const customResolved = isCustomContest
    ? getCanonicalPositionsForSelection(customPositionKeys)
    : null;

  // Match valid contest
  const matchedContest = isCustomContest
    ? "Custom"
    : CONTEST_LIST.find((c) => c.toLowerCase() === positionQuery.toLowerCase()) ||
      "Youth Organisers & Deputies";

  let effectiveContestName: string = matchedContest;
  if (isCustomContest) {
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

  const isWingOrganisers =
    !isCustomContest &&
    (matchedContest === "Youth Organisers & Deputies" ||
      matchedContest === "Women Organisers & Deputies" ||
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
      return name && !/^(vacant|vacancy|unknown|n\/?a|not available)/i.test(name);
    });

    // 3. Apply contest eligibility rules
    const contestFiltered = validRows.filter((r) => {
      const rawLvl = String(r.executive_level || "").toLowerCase().trim();
      const lvl = rawLvl === "external branch" ? "constituency" : rawLvl;
      const pos = String(r.position || "").trim();
      const posLower = pos.toLowerCase();
      const g = String(r.gender || "").toLowerCase().trim();

      // Rule: TESCON Patrons NEVER vote
      if (lvl === "tescon" && /patron/i.test(pos)) {
        return false;
      }

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

      // Optional Region Filter
      if (regionQuery !== "all" && regionQuery !== "") {
        const rowRegion = String(r.region || "").toLowerCase().trim();
        if (lvl !== "national" && rowRegion !== regionQuery.toLowerCase()) {
          return false;
        }
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
        if (
          matchedContest === "Youth Organisers & Deputies" ||
          matchedContest === "Youth Organiser"
        ) {
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

        if (
          matchedContest === "Women Organisers & Deputies" ||
          matchedContest === "Women Organiser"
        ) {
          return (
            (posLower.includes("women organiser") ||
              posLower.includes("women organizer") ||
              posLower === "women" ||
              posLower.includes("deputy women") ||
              posLower.includes("assistant women") ||
              posLower.includes("wocom")) &&
            !posLower.includes("former") &&
            !posLower.includes("patron")
          );
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
        const rawReg = String(r.region || "").toLowerCase().trim();
        const isExternal = lvl === "external branch" || rawReg.includes("external");
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
        if (a.level_rank === 4) {
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
      if (isWingOrganisers) {
        expectedCount = 663; // 276*2 (constituency) + 16*3 (regional) + 3 (national) + 30*2 (external branches)
      } else if (isCustomContest) {
        const numSelected = customPositionKeys.length || 1;
        expectedCount = numSelected * 322;
      } else if (
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
      if (isCustomContest) {
        const numSelected = customPositionKeys.length || 1;
        expectedCount = numSelected * 18;
      } else {
        expectedCount = isWingOrganisers ? 36 : Math.ceil(totalActual * 1.03); // Approximate for single region
      }
    }
    if (selectedLevels.length > 0 && selectedLevels.length < 5) {
      expectedCount = Math.max(totalActual, Math.ceil(totalActual * 1.02));
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
    // Constituency Executives Statutory Target: 19 per Constituency
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

    const isCustom = isCustomContest && customPositionKeys.length > 0;
    const regionalTargetPerUnit = isCustom ? customPositionKeys.length : 21;
    const constituencyTargetPerUnit = isCustom ? customPositionKeys.length : 19;

    const hasRegional =
      selectedLevels.includes("regional") || selectedLevels.includes("region");
    const hasConstituency = selectedLevels.includes("constituency");

    const isRegionalOnly = hasRegional && !hasConstituency && selectedLevels.length === 1;
    const isConstituencyOnly = hasConstituency && !hasRegional && selectedLevels.length === 1;

    const activeRegions =
      regionQuery !== "all" && regionQuery !== ""
        ? GHANA_REGIONS_ORDER.filter((r) => r.toLowerCase() === regionQuery.toLowerCase())
        : GHANA_REGIONS_ORDER;

    if (activeRegions.length === 0 && regionQuery !== "all") {
      activeRegions.push(regionQuery);
    }

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
      const regTarget = regionalTargetPerUnit;
      const conTarget = numConstituencies * constituencyTargetPerUnit;
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

    const extCount = delegates.filter((d) => String(d.executive_level || "").toLowerCase().trim() === "external branch").length;
    const tesconCount = delegates.filter((d) => String(d.executive_level || "").toLowerCase().trim() === "tescon").length;
    const natCount = delegates.filter((d) => String(d.executive_level || "").toLowerCase().trim() === "national").length;

    let levelAudit: {
      tableTitle: string;
      tableSub: string;
      footerLabel: string;
      headersHtml: string;
      rowsHtml: string;
      footerHtml: string;
      auditRows: any[];
    } | null = null;

    if (isRegionalOnly) {
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
        rowsHtml: regionalRows
          .map(
            (r, idx) => `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td><strong>${r.region} Region</strong></td>
            <td style="text-align: center;">${r.regConfirmed.toLocaleString()}</td>
            <td style="text-align: center;">${r.regTarget}</td>
            <td style="text-align: center;">${r.regTarget - r.regConfirmed > 0 ? `-${r.regTarget - r.regConfirmed}` : "0"}</td>
            <td style="text-align: center;">${r.regTarget > 0 ? ((r.regConfirmed / r.regTarget) * 100).toFixed(1) + "%" : "100%"}</td>
          </tr>
        `
          )
          .join("\n"),
        footerHtml: `
          <tr>
            <td colspan="2" style="text-align: right;"><strong>TOTAL (${regionalRows.length} REGIONS):</strong></td>
            <td style="text-align: center;"><strong>${sumRegConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumRegTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumRegTarget - sumRegConfirmed > 0 ? `-${sumRegTarget - sumRegConfirmed}` : "0"}</strong></td>
            <td style="text-align: center;"><strong>${sumRegTarget > 0 ? ((sumRegConfirmed / sumRegTarget) * 100).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
        `,
        auditRows: regionalRows.map((r) => ({
          region: `${r.region} Region`,
          confirmed: r.regConfirmed,
          target: r.regTarget,
          complianceRate: r.regTarget > 0 ? ((r.regConfirmed / r.regTarget) * 100).toFixed(1) + "%" : "100%",
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
        rowsHtml: regionalRows
          .map(
            (r, idx) => `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td><strong>${r.region}</strong></td>
            <td style="text-align: center;">${r.numConstituencies}</td>
            <td style="text-align: center;">${r.conConfirmed.toLocaleString()}</td>
            <td style="text-align: center;">${r.conTarget.toLocaleString()}</td>
            <td style="text-align: center;">${r.conTarget > 0 ? ((r.conConfirmed / r.conTarget) * 100).toFixed(1) + "%" : "100%"}</td>
          </tr>
        `
          )
          .join("\n"),
        footerHtml: `
          <tr>
            <td colspan="2" style="text-align: right;"><strong>TOTAL (${regionalRows.length} REGIONS):</strong></td>
            <td style="text-align: center;"><strong>${sumConstituencies}</strong></td>
            <td style="text-align: center;"><strong>${sumConConfirmed.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumConTarget.toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${sumConTarget > 0 ? ((sumConConfirmed / sumConTarget) * 100).toFixed(1) + "%" : "100%"}</strong></td>
          </tr>
        `,
        auditRows: regionalRows.map((r) => ({
          region: r.region,
          confirmed: r.conConfirmed,
          target: r.conTarget,
          complianceRate: r.conTarget > 0 ? ((r.conConfirmed / r.conTarget) * 100).toFixed(1) + "%" : "100%",
        })),
      };
    } else {
      // Both or All
      const extraRowsHtml: string[] = [];
      if (extCount > 0) {
        extraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>External Branches (Diaspora)</strong></td>
            <td style="text-align: center;">30</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: center;"><strong>${extCount.toLocaleString()}</strong></td>
            <td style="text-align: center;">${extCount.toLocaleString()}</td>
          </tr>
        `);
      }
      if (tesconCount > 0) {
        extraRowsHtml.push(`
          <tr>
            <td style="text-align: center;">•</td>
            <td><strong>TESCON Tertiary Institutions</strong></td>
            <td style="text-align: center;">Campus</td>
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
            <td style="text-align: center;">${natCount.toLocaleString()}</td>
          </tr>
        `);
      }

      levelAudit = {
        tableTitle: "REGIONAL & CONSTITUENCY STATUTORY AUDIT & SIGN-OFF",
        tableSub: `Statutory Quota Distribution (Regional: ${regionalTargetPerUnit} per Region · Constituency: ${constituencyTargetPerUnit} per Constituency) · ${effectiveContestName}`,
        footerLabel: "ELECTORAL ROLL AUDIT",
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
        rowsHtml: regionalRows
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
          .join("\n"),
        footerHtml: `
          <tr>
            <td colspan="2" style="text-align: right;"><strong>TOTAL:</strong></td>
            <td style="text-align: center;"><strong>${sumConstituencies}</strong></td>
            <td style="text-align: center;"><strong>${sumRegConfirmed} / ${sumRegTarget}</strong></td>
            <td style="text-align: center;"><strong>${sumConConfirmed} / ${sumConTarget}</strong></td>
            <td style="text-align: center;"><strong>${(sumTotalConfirmed + extCount + tesconCount + natCount).toLocaleString()}</strong></td>
            <td style="text-align: center;"><strong>${(sumTotalTarget + extCount + tesconCount + natCount).toLocaleString()}</strong></td>
          </tr>
        `,
        auditRows: regionalRows.map((r) => ({
          region: r.region,
          confirmed: r.totalConfirmed,
          target: r.totalTarget,
          complianceRate: r.totalTarget > 0 ? ((r.totalConfirmed / r.totalTarget) * 100).toFixed(1) + "%" : "100%",
        })),
      };
    }

    const metrics = {
      contest: effectiveContestName,
      scope:
        regionQuery === "all"
          ? "Nationwide (All 16 Regions + External Branches + National + TESCON)"
          : `${regionQuery} Region`,
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

    // Excel export format
    if (format === "excel" || format === "xlsx") {
      const excelBuffer = await generateAlbumExcel(
        effectiveContestName,
        regionQuery,
        metrics,
        delegates,
        regionalBreakdown,
        levelAudit
      );

      const safeContest = effectiveContestName.replace(/[\s&]+/g, "_");
      const safeRegion = regionQuery !== "all" ? `_${regionQuery.replace(/[\s&]+/g, "_")}` : "";
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

      // Pre-convert all delegate images to WebP data URIs before rendering
      await convertDelegatesImagesToWebp(delegates);

      // Return renderable HTML directly
      const html = generateAlbumHtml(
        effectiveContestName,
        regionQuery,
        metrics,
        delegates,
        regionalBreakdown,
        logoDataUri,
        levelAudit
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
  levelAudit?: any
): Promise<Buffer> {
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
  titleCell.value = "NEW PATRIOTIC PARTY (NPP) — PROVISIONAL ELECTORAL COLLEGE ALBUM & VOTER DIRECTORY";
  titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003399" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 36;

  // Subtitle Row 2
  sheet.mergeCells("A2:N2");
  const subCell = sheet.getCell("A2");
  const scopeLabel =
    regionQuery === "all"
      ? "NATIONWIDE (ALL 16 REGIONS + EXTERNAL BRANCHES + TESCON)"
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
  mTitle.value = "PROVISIONAL ELECTORAL COLLEGE METRICS & COMPLIANCE";
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
    "Under 40 Proportion",
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
  levelAudit?: any
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
            <img class="voter-img" src="${photoSrc}" alt="${d.executive_name}" loading="eager" decoding="sync" data-fallback="${d.avatar_svg}" onerror="this.onerror=null; this.src='${d.avatar_svg}';" />
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

    /* Cover Page Styles (Ahafo Master Design Reverted) */
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

    /* Page 2: Metrics */
    .metrics-page { padding: 5mm 10mm 4mm 10mm; }
    .page-title { font-size: 15pt; font-weight: 900; color: #003399; margin-bottom: 2px; }
    .page-sub { font-size: 9pt; font-weight: 700; color: #64748B; margin-bottom: 8px; }
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

    /* Cards Grid (Pages 3+) */
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

    /* Header & Footer */
    .page-header { margin-bottom: 2px; }
    .header-content { display: flex; align-items: center; gap: 8px; }
    .header-npp-logo { width: auto; height: 28px; max-width: 38px; object-fit: contain; }
    .party-seal-mini { background: #003399; color: white; font-size: 9pt; font-weight: 900; padding: 2px 5px; border-radius: 3px; }
    .header-text h1 { font-size: 11.5pt; font-weight: 900; color: #003399; line-height: 1.1; }
    .header-text h2 { font-size: 7.8pt; font-weight: 800; color: #475569; line-height: 1.1; }
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
    <span>NPP · ${contest.toUpperCase()} PROVISIONAL ELECTION ALBUM (${totalPages} PAGES · ${delegates.length} VOTERS)</span>
    <button id="album-print" class="print-btn" disabled onclick="window.printAlbum()">PREPARING IMAGES…</button>
    ${delegates.some((d) => d.photo_unavailable) ? `<span role="status">${delegates.filter((d) => d.photo_unavailable).length} portrait(s) unavailable; initials shown. Reload to retry unavailable photos.</span>` : ""}
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
            <svg width="74" height="74" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <tr><td><strong>National Level</strong></td><td>${metrics.levelBreakdown.National || 0}</td><td>${(((metrics.levelBreakdown.National || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>
          <tr><td><strong>Regional Level (16 Regions)</strong></td><td>${metrics.levelBreakdown.Regional || 0}</td><td>${(((metrics.levelBreakdown.Regional || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>
          <tr><td><strong>Constituency Level (276 Constituencies)</strong></td><td>${metrics.levelBreakdown.Constituency || 0}</td><td>${(((metrics.levelBreakdown.Constituency || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>
          ${(metrics.levelBreakdown["External Branch"] || 0) > 0 ? `<tr><td><strong>External Branches (Diaspora)</strong></td><td>${metrics.levelBreakdown["External Branch"]}</td><td>${(((metrics.levelBreakdown["External Branch"] || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Certified</td></tr>` : ""}
          <tr><td><strong>TESCON Level (Accredited Institutions)</strong></td><td>${metrics.levelBreakdown.TESCON || 0}</td><td>${(((metrics.levelBreakdown.TESCON || 0) / metrics.actualFigures) * 100).toFixed(1)}%</td><td>Patrons Excluded</td></tr>
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
      <h1 class="page-title">${levelAudit ? levelAudit.tableTitle : "REGIONAL DISTRIBUTION &amp; AUDIT SIGN-OFF"}</h1>
      <h2 class="page-sub">${levelAudit ? levelAudit.tableSub : `Jurisdictional Breakdown &amp; Gazette Closure · ${contest}`}</h2>
      <div class="header-rule"></div>
    </header>

    <div class="table-container">
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
        <span>PROVISIONAL ELECTORAL COLLEGE ALBUM · ${levelAudit ? levelAudit.footerLabel : "REGIONAL AUDIT"}</span>
        <span class="footer-page-pill">${totalPages}</span>
        <span>NATIONAL ELECTIONS COMMITTEE</span>
      </div>
    </footer>
  </div>

<script>${ALBUM_PRINT_SCRIPT}</script>
</body>
</html>`;
}
