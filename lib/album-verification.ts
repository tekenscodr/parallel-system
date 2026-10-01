import crypto from "crypto";
import fs from "fs";
import os from "os";

let cachedEphemeralSecret: string | null = null;

function getAlbumVerifySecret(): string {
  if (process.env.ALBUM_VERIFY_SECRET) {
    return process.env.ALBUM_VERIFY_SECRET;
  }
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }
  if (fs.existsSync("./jwt_secret.txt")) {
    return fs.readFileSync("./jwt_secret.txt", "utf-8").trim();
  }
  if (!cachedEphemeralSecret) {
    const seed = process.env.DATABASE_URL || "npp-nec-default-album-verify-2026";
    cachedEphemeralSecret = crypto
      .createHash("sha256")
      .update(`npp-album-verify:${seed}`)
      .digest("hex");
  }
  return cachedEphemeralSecret;
}

const POSITION_TO_SHORT_CODE: Record<string, string> = {
  "Youth Organisers & Deputies": "yo",
  "Women Organisers & Deputies": "wo",
  "Nasara Coordinators & Deputies": "na",
  Presidential: "pr",
  "National Executives": "ne",
  "Regional Executives": "re",
  "Constituency Executives": "ce",
  "National Chairperson & General Officers": "go",
  "National Directors": "nd",
  "National Council & Elders": "nc",
  "National Leadership & Flagbearers": "nl",
  Chairperson: "ch",
  "Vice Chairperson": "vc",
  "General Secretary": "gs",
  Treasurer: "tr",
  "Communication Officer": "co",
  Organiser: "or",
  "Youth Organiser": "yg",
  "Women Organiser": "wg",
  "Nasara Organiser": "ng",
  "All Men": "am",
  "All Women": "aw",
  "Proxy Voters": "px",
  "Proxy for Youth": "py",
  "Proxy for Women": "pw",
  "Proxy for Nasara": "pn",
  Custom: "cu",
};

const SHORT_CODE_TO_POSITION: Record<string, string> = Object.fromEntries(
  Object.entries(POSITION_TO_SHORT_CODE).map(([k, v]) => [v, k])
);

const CANONICAL_POSITION_IDS = [
  "chairperson",
  "1st_vice",
  "2nd_vice",
  "secretary",
  "deputy_secretary",
  "treasurer",
  "financial_secretary",
  "organiser",
  "deputy_organiser",
  "women_organiser",
  "deputy_women_organiser",
  "youth_organiser",
  "deputy_youth_organiser",
  "nasara_coordinator",
  "deputy_nasara_coordinator",
  "communication_officer",
  "electoral_affairs",
  "research_officer",
  "pwd_officer",
  "special_duties",
  "legal_officer",
  "tescon_president",
  "tescon_wocom",
  "tescon_nasara",
  "member_of_parliament",
  "national_council_rep",
  "foundation_member",
  "council_of_elders",
  "council_of_elders_past_officer",
  "council_of_patrons",
  "director_finance",
  "director_elections",
  "director_research",
  "director_it",
  "deputy_director_it",
  "director_protocol",
  "deputy_director_protocol",
  "director_legal",
  "chairman_legal_committee",
  "national_comm_director",
  "deputy_comm_director",
  "external_relations_officer",
  "deputy_external_relations_officer",
  "national_tescon_coordinator",
  "former_president",
  "flagbearer_vp",
  "former_running_mate",
  "speaker_parliament",
  "past_national_chairman",
  "past_general_secretary",
  "3rd_vice",
  "deputy_national_treasurer",
  "asst_secretary",
  "fin_secretary",
  "dep_organiser",
  "dep_women_organiser",
  "dep_youth_organiser",
  "nasara",
  "dep_nasara",
  "mp",
  "patrons",
  "it_officer",
] as const;

const CANONICAL_JURISDICTION_IDS = [
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
  "External Branch",
  "National Headquarters",
] as const;

const LEVEL_TO_CHAR: Record<string, string> = {
  National: "N",
  Regional: "R",
  Constituency: "C",
  "External Branch": "E",
  TESCON: "T",
};

const CHAR_TO_LEVEL: Record<string, string> = Object.fromEntries(
  Object.entries(LEVEL_TO_CHAR).map(([k, v]) => [v, k])
);

export function expandShortPositionCode(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "Youth Organisers & Deputies";
  return SHORT_CODE_TO_POSITION[trimmed] || trimmed;
}

export function compressPositionsCode(raw: string): string {
  const expanded = expandShortPositionsCode(raw);
  if (!expanded) return "";
  const items = expanded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  let mask = BigInt(0);
  const one = BigInt(1);
  for (const item of items) {
    const idx = CANONICAL_POSITION_IDS.indexOf(item as any);
    if (idx === -1) {
      return expanded;
    }
    mask |= one << BigInt(idx);
  }
  return `~${mask.toString(36)}`;
}

export function expandShortPositionsCode(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("~")) {
    try {
      const base36 = trimmed.slice(1);
      let mask = BigInt(0);
      const zero = BigInt(0);
      const one = BigInt(1);
      const radix = BigInt(36);
      for (const ch of base36) {
        const digit = parseInt(ch, 36);
        if (Number.isNaN(digit)) return trimmed;
        mask = mask * radix + BigInt(digit);
      }
      const matched: string[] = [];
      for (let i = 0; i < CANONICAL_POSITION_IDS.length; i++) {
        if ((mask & (one << BigInt(i))) !== zero) {
          matched.push(CANONICAL_POSITION_IDS[i]);
        }
      }
      return matched.join(",");
    } catch {
      return trimmed;
    }
  }
  // Canonicalize order if all items are known position IDs
  const items = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    items.length > 1 &&
    items.every((it) => CANONICAL_POSITION_IDS.includes(it as any))
  ) {
    const itemSet = new Set(items);
    return CANONICAL_POSITION_IDS.filter((id) => itemSet.has(id)).join(",");
  }
  return items.join(",");
}

export function compressRegionCode(raw: string): string {
  const expanded = expandShortRegionCode(raw);
  if (!expanded || expanded === "all") return expanded;
  if (!expanded.includes(",")) return expanded;
  const items = expanded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let mask = 0;
  for (const item of items) {
    const idx = CANONICAL_JURISDICTION_IDS.findIndex(
      (j) => j.toLowerCase() === item.toLowerCase()
    );
    if (idx === -1) return expanded;
    mask |= 1 << idx;
  }
  return `~${mask.toString(36)}`;
}

export function expandShortRegionCode(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "all";
  if (trimmed.startsWith("~")) {
    const num = parseInt(trimmed.slice(1), 36);
    if (Number.isNaN(num) || num <= 0) return "all";
    const matched: string[] = [];
    for (let i = 0; i < CANONICAL_JURISDICTION_IDS.length; i++) {
      if ((num & (1 << i)) !== 0) {
        matched.push(CANONICAL_JURISDICTION_IDS[i]);
      }
    }
    return matched.length > 0 ? matched.join(",") : "all";
  }
  return trimmed;
}

export function compressLevelsCode(raw: string): string {
  const expanded = expandShortLevelsCode(raw);
  if (!expanded || expanded === "all") return "";
  const items = expanded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  const chars: string[] = [];
  for (const item of items) {
    const entry = Object.entries(LEVEL_TO_CHAR).find(
      ([k]) => k.toLowerCase() === item.toLowerCase()
    );
    if (!entry) return expanded;
    chars.push(entry[1]);
  }
  return `~${chars.join("")}`;
}

export function expandShortLevelsCode(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("~")) {
    const codes = trimmed.slice(1).toUpperCase().split("");
    const levels = codes.map((c) => CHAR_TO_LEVEL[c]).filter(Boolean);
    return levels.join(",");
  }
  return trimmed;
}

export function compressScopeCode(raw: string): string {
  const expanded = expandShortScopeCode(raw);
  if (expanded === "organisers_only") return "o";
  if (expanded === "all_voters") return "a";
  return expanded;
}

export function expandShortScopeCode(raw: string): string {
  const trimmed = String(raw || "").trim().toLowerCase();
  if (trimmed === "o") return "organisers_only";
  if (trimmed === "a") return "all_voters";
  return trimmed;
}

export const CANONICAL_LOCAL_ORIGIN = "http://localhost:3000";
export const CANONICAL_PROD_ORIGIN = "https://paratrooper-navy.vercel.app";

export function resolveVerificationOrigin(reqOrigin: string): string {
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).trim();
  const candidate = configured || String(reqOrigin || "").trim();
  if (candidate) {
    const lower = candidate.toLowerCase();
    if (
      lower.includes("localhost") ||
      lower.includes("127.0.0.1") ||
      lower.includes("[::1]") ||
      lower.includes("::1")
    ) {
      return CANONICAL_LOCAL_ORIGIN;
    }
    return CANONICAL_PROD_ORIGIN;
  }
  if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
    return CANONICAL_LOCAL_ORIGIN;
  }
  return CANONICAL_PROD_ORIGIN;
}

export interface AlbumVerifyParams {
  position: string;
  region: string;
  constituency?: string;
  scope?: string;
  levels?: string;
  gender?: string;
  under40?: string;
  positions?: string;
  album_type?: string;
  polling_station?: string;
}

function canonicalizeAlbumParams(params: AlbumVerifyParams): string {
  const fullPosition = expandShortPositionCode(
    params.position || "Youth Organisers & Deputies"
  );
  const fullRegion = expandShortRegionCode(
    compressRegionCode(params.region || "all")
  );
  const fullScope = expandShortScopeCode(params.scope || "");
  const fullLevels = expandShortLevelsCode(
    compressLevelsCode(params.levels || "")
  );
  const fullPositions = expandShortPositionsCode(
    compressPositionsCode(params.positions || "")
  );
  const albumTypeNorm =
    String(params.album_type || "final").trim().toLowerCase() === "p" ||
    String(params.album_type || "final").trim().toLowerCase() === "provisional"
      ? "provisional"
      : "final";
  const entries: Array<[string, string]> = [
    ["position", fullPosition],
    ["region", fullRegion],
    ["constituency", String(params.constituency || "").trim()],
    ["scope", fullScope],
    ["levels", fullLevels],
    ["gender", String(params.gender || "").trim()],
    ["under40", String(params.under40 || "").trim()],
    ["positions", fullPositions],
    ["album_type", albumTypeNorm],
  ];
  if (params.polling_station) {
    entries.push(["polling_station", String(params.polling_station).trim()]);
  }
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

export function signAlbumVerificationParams(params: AlbumVerifyParams): string {
  const secret = getAlbumVerifySecret();
  const payload = canonicalizeAlbumParams(params);
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .slice(0, 24);
}

export function verifyAlbumVerificationSignature(
  params: AlbumVerifyParams,
  signature: string | null | undefined
): boolean {
  if (!signature || typeof signature !== "string") return false;
  const fullExpected = signAlbumVerificationParams(params);
  const sigTrim = signature.trim();
  // Support both 16-char compact QR signatures and 24-char full signatures
  if (sigTrim.length !== 16 && sigTrim.length !== 24) return false;
  const expectedSlice = fullExpected.slice(0, sigTrim.length);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sigTrim, "utf8"),
      Buffer.from(expectedSlice, "utf8")
    );
  } catch {
    return false;
  }
}

export function buildAlbumVerificationUrl(
  baseOrigin: string,
  params: AlbumVerifyParams,
  pageOptions?: {
    page?: number;
    pageConstituency?: string;
    section?: string;
  }
): string {
  const fullSig = signAlbumVerificationParams(params);
  const shortSig = fullSig.slice(0, 16);
  const fullPos = expandShortPositionCode(
    params.position || "Youth Organisers & Deputies"
  );
  const posCode = POSITION_TO_SHORT_CODE[fullPos] || fullPos;

  const search = new URLSearchParams();
  search.set("p", posCode);
  const fullRegion = expandShortRegionCode(params.region || "all");
  if (fullRegion && fullRegion !== "all") {
    search.set("r", compressRegionCode(fullRegion));
  }
  if (params.constituency) search.set("c", params.constituency);
  if (params.scope) search.set("sc", compressScopeCode(params.scope));
  if (params.levels && params.levels !== "all") {
    search.set("lv", compressLevelsCode(params.levels));
  }
  if (params.gender && params.gender !== "all") search.set("g", params.gender);
  if (params.under40) search.set("u", params.under40);
  if (params.positions) {
    search.set("ps", compressPositionsCode(params.positions));
  }
  if (params.album_type && params.album_type !== "final") {
    search.set("t", params.album_type === "provisional" ? "p" : params.album_type);
  }
  if (params.polling_station) {
    search.set("st", params.polling_station);
  }
  if (pageOptions?.page !== undefined && pageOptions.page > 1) {
    search.set("pg", String(pageOptions.page));
  }
  if (pageOptions?.pageConstituency && !pageOptions?.page) {
    search.set("pc", pageOptions.pageConstituency);
  }
  search.set("s", shortSig);

  const cleanOrigin = resolveVerificationOrigin(baseOrigin);
  return `${cleanOrigin}/verify/album?${search.toString()}`;
}
