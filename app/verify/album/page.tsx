import React from "react";
import {
  expandShortLevelsCode,
  expandShortPositionCode,
  expandShortPositionsCode,
  expandShortRegionCode,
  expandShortScopeCode,
  verifyAlbumVerificationSignature,
  type AlbumVerifyParams,
} from "@/lib/album-verification";
import VerifyAlbumGuard from "./VerifyAlbumGuard";

export const dynamic = "force-dynamic";

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function pickParam(
  params: Record<string, string | string[] | undefined>,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const val = params[key];
    if (Array.isArray(val) && val[0] !== undefined) {
      return String(val[0]).trim();
    }
    if (typeof val === "string" && val.trim() !== "") {
      return val.trim();
    }
  }
  return fallback;
}

export default async function VerifyAlbumPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const resolvedParams = await Promise.resolve(searchParams);

  const rawPosition = pickParam(
    resolvedParams,
    ["position", "p", "contest"],
    "Youth Organisers & Deputies"
  );
  const position = expandShortPositionCode(rawPosition);
  const region = expandShortRegionCode(
    pickParam(resolvedParams, ["region", "r"], "all")
  );
  const constituency = pickParam(resolvedParams, ["constituency", "c"], "");
  const scope = expandShortScopeCode(
    pickParam(resolvedParams, ["scope", "sc"], "")
  );
  const levels = expandShortLevelsCode(
    pickParam(resolvedParams, ["levels", "lv", "level"], "")
  );
  const gender = pickParam(resolvedParams, ["gender", "g"], "");
  const under40 = pickParam(resolvedParams, ["under40", "u"], "");
  const positions = expandShortPositionsCode(
    pickParam(resolvedParams, ["positions", "ps"], "")
  );
  const rawType = pickParam(resolvedParams, ["album_type", "t"], "final").toLowerCase();
  const albumType =
    rawType === "p" || rawType === "provisional" ? "provisional" : "final";
  const pageRaw = pickParam(resolvedParams, ["page", "pg"], "");
  const pageNum = pageRaw ? Number.parseInt(pageRaw, 10) : null;
  const pageConstituency = pickParam(
    resolvedParams,
    ["page_constituency", "pc"],
    ""
  );
  const sig = pickParam(resolvedParams, ["sig", "s"], "");

  const verifyParams: AlbumVerifyParams = {
    position,
    region,
    constituency,
    scope,
    levels,
    gender,
    under40,
    positions,
    album_type: albumType,
  };

  const isValidSignature = verifyAlbumVerificationSignature(verifyParams, sig);

  if (!isValidSignature) {
    return (
      <VerifyAlbumGuard>
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border-2 border-red-600 rounded-xl p-8 text-center shadow-2xl">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-600/20 border border-red-500 text-red-400 font-black text-xl mb-4">
              !
            </div>
            <h1 className="text-xl font-black tracking-wide text-white uppercase mb-2">
              Invalid or Unverified Album QR Code
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              The cryptographic security signature attached to this QR code link
              could not be verified by the New Patriotic Party (NPP) National
              Elections Committee verification system.
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 font-mono">
              STATUS: SIGNATURE_VERIFICATION_FAILED · READ_ONLY_LOCK_ACTIVE
            </div>
          </div>
        </main>
      </VerifyAlbumGuard>
    );
  }

  const iframeQuery = new URLSearchParams();
  iframeQuery.set("position", position);
  iframeQuery.set("region", region);
  if (constituency) iframeQuery.set("constituency", constituency);
  if (scope) iframeQuery.set("scope", scope);
  if (levels) iframeQuery.set("levels", levels);
  if (gender) iframeQuery.set("gender", gender);
  if (under40) iframeQuery.set("under40", under40);
  if (positions) iframeQuery.set("positions", positions);
  iframeQuery.set("album_type", albumType);
  iframeQuery.set("format", "html");
  iframeQuery.set("verify_mode", "1");
  iframeQuery.set("sig", sig);
  if (pageNum && Number.isFinite(pageNum) && pageNum >= 1) {
    iframeQuery.set("page", String(pageNum));
  }
  if (pageConstituency) {
    iframeQuery.set("page_constituency", pageConstituency);
  }

  const hashSuffix =
    pageNum && Number.isFinite(pageNum) && pageNum >= 1
      ? `#album-page-${pageNum}`
      : "";
  const albumEmbedSrc = `/api/admin/albums/election?${iframeQuery.toString()}${hashSuffix}`;

  const scopeLabel =
    constituency
      ? `${constituency.toUpperCase()} CONSTITUENCY`
      : region === "all"
      ? "NATIONWIDE ELECTORAL ROLL"
      : `${region.toUpperCase()} REGION`;

  return (
    <VerifyAlbumGuard>
      <div className="min-h-screen h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
        <header className="bg-[#003399] border-b-2 border-red-600 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-white text-[#003399] font-black text-xs px-2.5 py-1 rounded tracking-wider">
              NPP · NEC
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black tracking-wide uppercase flex flex-wrap items-center gap-2">
                <span>
                  OFFICIAL {albumType === "final" ? "FINAL CERTIFIED" : "PROVISIONAL"} ALBUM VERIFICATION
                </span>
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  QR AUTHENTICATED
                </span>
              </div>
              <div className="text-[11px] text-blue-100 font-semibold">
                {position} Election · {scopeLabel}
                {pageNum && Number.isFinite(pageNum) ? ` · Scanned Page ${pageNum}` : ""}
                {pageConstituency ? ` · ${pageConstituency.toUpperCase()} Security Check` : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-slate-950/90 border border-amber-400/60 text-amber-300 text-[10px] sm:text-xs font-extrabold px-3 py-1 rounded-full tracking-wide uppercase">
              Read-Only Protected · Copy &amp; Download Disabled
            </span>
          </div>
        </header>

        <main className="flex-1 w-full bg-slate-800 relative overflow-hidden">
          <iframe
            src={albumEmbedSrc}
            title={`Verified ${position} Election Album`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </main>
      </div>
    </VerifyAlbumGuard>
  );
}
