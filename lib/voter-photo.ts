import photoCodes from "./constituency-photo-codes.json";

const BASE_PHOTO_URL = "https://app.newpatrioticparty.org/app/AppFiles/pass_voterid";

function normalizeKey(str: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Returns the official CDN photo URL for a registered Ghanaian voter / executive,
 * or null if voter ID or constituency mapping is unavailable.
 */
export function getVoterPhotoUrl(
  region?: string | null,
  constituency?: string | null,
  voterId?: string | null
): string | null {
  if (!voterId || !/^[0-9]{10}$/.test(voterId.trim())) return null;
  if (!region || !constituency) return null;

  const key = `${normalizeKey(region)}|${normalizeKey(constituency)}`;
  const match = (photoCodes as Record<string, { regFolder: string; tblid: string }>)[key];
  if (!match) return null;

  return `${BASE_PHOTO_URL}/${match.regFolder}/${match.tblid}/${voterId.trim()}.jpg`;
}

/**
 * Derives clean, professional initials from an individual's name.
 */
export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Dignified, high-contrast palette presets for executive avatar fallbacks.
 */
const AVATAR_PALETTES = [
  { bg: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)", text: "#93c5fd", border: "rgba(59, 130, 246, 0.4)" }, // Blue
  { bg: "linear-gradient(135deg, #065f46 0%, #047857 100%)", text: "#a7f3d0", border: "rgba(16, 185, 129, 0.4)" }, // Emerald
  { bg: "linear-gradient(135deg, #701a75 0%, #86198f 100%)", text: "#f5d0fe", border: "rgba(217, 70, 239, 0.4)" }, // Fuchsia
  { bg: "linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)", text: "#fed7aa", border: "rgba(249, 115, 22, 0.4)" }, // Orange
  { bg: "linear-gradient(135deg, #164e63 0%, #0e7490 100%)", text: "#a5f3fc", border: "rgba(6, 182, 212, 0.4)" }, // Cyan
  { bg: "linear-gradient(135deg, #3730a3 0%, #4338ca 100%)", text: "#c7d2fe", border: "rgba(99, 102, 241, 0.4)" }, // Indigo
  { bg: "linear-gradient(135deg, #831843 0%, #9d174d 100%)", text: "#fbcfe8", border: "rgba(236, 72, 153, 0.4)" }, // Rose
  { bg: "linear-gradient(135deg, #78350f 0%, #92400e 100%)", text: "#fde68a", border: "rgba(245, 158, 11, 0.4)" }, // Amber
  { bg: "linear-gradient(135deg, #312e81 0%, #3730a3 100%)", text: "#ddd6fe", border: "rgba(139, 92, 246, 0.4)" }, // Violet
  { bg: "linear-gradient(135deg, #14532d 0%, #166534 100%)", text: "#bbf7d0", border: "rgba(34, 197, 94, 0.4)" }, // Green
];

export function getAvatarPalette(name?: string | null): { bg: string; text: string; border: string } {
  if (!name) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}
