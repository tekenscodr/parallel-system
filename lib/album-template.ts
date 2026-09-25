import fs from "fs";
import path from "path";
import {
  DEFAULT_VOTER_DETAILS,
  type VoterDetailField,
} from "./election-contests.ts";
import {
  getNationalSectionInfo,
  getRegionalSectionRank,
  getTesconInstitution,
  compareNationalAlbumDelegates,
} from "./album-hierarchy.ts";
import { ALBUM_PRINT_SCRIPT } from "./album-print.ts";

export const GHANA_REGIONS_ORDER = [
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

let ELEPHANT_SEAL_DATA_URI: string | null = null;

export function getElephantSealDataUriSync(): string | null {
  if (ELEPHANT_SEAL_DATA_URI) return ELEPHANT_SEAL_DATA_URI;
  try {
    const candidatePaths = [
      path.join(process.cwd(), "public", "npp-seal.png"),
      path.join(process.cwd(), "public", "npp_logo.png"),
      path.join(process.cwd(), "public", "npp-logo.png"),
      path.join(process.cwd(), "public", "logo.png"),
    ];
    const filePath = candidatePaths.find((p) => fs.existsSync(p));
    if (filePath) {
      const rawBuf = fs.readFileSync(filePath);
      ELEPHANT_SEAL_DATA_URI = "data:image/png;base64," + rawBuf.toString("base64");
    }
  } catch {
    // Non-fatal
  }
  return ELEPHANT_SEAL_DATA_URI;
}

export function renderCurvedText(
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

export interface CardPageSpec {
  headerSubTitle: string;
  footerLabel: string;
  cards: any[];
  isConstituencyPart2?: boolean;
  constituencyName?: string;
  constituencyCapital?: string;
  totalConstituencyExecutives?: number;
  isLeadershipPage?: boolean;
}

export function generateAlbumHtml(
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
    const isNational = String(d.executive_level || "").toLowerCase().trim() === "national";
    const natSectionInfo = isNational ? getNationalSectionInfo(d) : null;
    const jurisdictionSuffix =
      isNational && natSectionInfo
        ? ` · ${natSectionInfo.section}`
        : ((isWingAlbum && (isConstituency || isExtBranch) && d.constituency) || (isMp && d.constituency))
        ? ` (${String(d.constituency).trim()})`
        : "";

    const isYouthAlbum =
      /(?:youth)/i.test(contest) ||
      Boolean(d.canonical_position && /(?:youth)/i.test(d.canonical_position)) ||
      Boolean(d.position && /(?:youth)/i.test(d.position));

    const ageVal =
      d.age !== null && d.age !== undefined
        ? `${d.age} yrs`
        : d.is_under_40
        ? "Under 40"
        : "—";

    const demographicText = [
      d.gender && d.gender !== "Unknown" ? d.gender : null,
      d.age !== null && d.age !== undefined ? `${d.age} yrs` : (d.is_under_40 ? "Under 40" : null),
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
            ${isYouthAlbum ? `
            <div class="detail-line">
              <span class="lbl">Age:</span> <span class="val" style="font-weight: 700; color: #0F172A;">${ageVal}</span>
            </div>
            ` : ""}
            ${showDemographics && demographicText ? `
            <div class="detail-line">
              <span class="lbl">${isYouthAlbum ? "Gender:" : "Demographics:"}</span> <span class="val">${isYouthAlbum && d.gender && d.gender !== "Unknown" ? d.gender : demographicText}</span>
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

  const cardPages: CardPageSpec[] = [];
  let currentCardPageNum = 3; // Page 1: Cover, Page 2: Metrics, Pages 3..N: Cards

  // Partition delegates into administrative levels
  const isNationalScope = region.toLowerCase().includes("national");
  const nationalDelegates = delegates.filter((d) => {
    const lvl = String(d.executive_level || "").toLowerCase().trim();
    if (lvl !== "national") return false;
    if (isNationalScope) return true;
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
    nationalDelegates.sort(compareNationalAlbumDelegates);

    const nationalSectionConfigs: {
      rank: number;
      title: string;
      footer: string;
      isLeadershipPage?: boolean;
    }[] = [
      {
        rank: 1,
        title: "PRESIDENT, FLAGBEARER, RUNNING MATE & SPEAKER OF PARLIAMENT",
        footer: "NATIONAL REGISTER · PRESIDENTIAL & STATE LEADERSHIP",
        isLeadershipPage: true,
      },
      {
        rank: 2,
        title: "NATIONAL EXECUTIVES AND DIRECTORS",
        footer: "NATIONAL REGISTER · NATIONAL EXECUTIVES & DIRECTORS",
      },
      {
        rank: 3,
        title: "FORMER CHAIRMAN AND FORMER GENERAL SECRETARY",
        footer: "NATIONAL REGISTER · PAST NATIONAL LEADERSHIP",
      },
      {
        rank: 4,
        title: "COUNCIL OF ELDERS",
        footer: "NATIONAL REGISTER · COUNCIL OF ELDERS",
      },
      {
        rank: 5,
        title: "COUNCIL OF PATRONS",
        footer: "NATIONAL REGISTER · COUNCIL OF PATRONS",
      },
      {
        rank: 6,
        title: "OTHER NATIONAL EXECUTIVES",
        footer: "NATIONAL REGISTER · REGIONAL REPRESENTATIVES TO NATIONAL COUNCIL",
      },
    ];

    for (const sec of nationalSectionConfigs) {
      const secDelegates = nationalDelegates.filter(
        (d) => getNationalSectionInfo(d).rank === sec.rank
      );
      if (secDelegates.length === 0) continue;

      const totalParts = Math.ceil(secDelegates.length / 10);
      for (let i = 0; i < secDelegates.length; i += 10) {
        const chunk = secDelegates.slice(i, i + 10);
        const partIdx = Math.floor(i / 10) + 1;
        chunk.forEach((d) => {
          d.page_number = currentCardPageNum;
        });

        const partSuffix = totalParts > 1 ? ` (PART ${partIdx} OF ${totalParts})` : "";
        cardPages.push({
          headerSubTitle: `NATIONAL LEVEL REGISTER · ${sec.title}${partSuffix}`,
          footerLabel: sec.footer,
          cards: chunk,
          isLeadershipPage: sec.isLeadershipPage,
        });
        currentCardPageNum++;
      }
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
      if (regExecs.length > 0) {
        const chunk = regExecs.slice(0, 10);
        chunk.forEach((d) => {
          d.page_number = currentCardPageNum;
        });
        cardPages.push({
          headerSubTitle: `${regionName.toUpperCase()} REGION · REGIONAL LEADERSHIP`,
          footerLabel: `${regionName.toUpperCase()} REGIONAL EXECUTIVES`,
          cards: chunk,
        });
        currentCardPageNum++;
      }

      // 2. Constituency executives for this region
      const regConstituencyDelegates = delegates.filter(
        (d) =>
          String(d.executive_level || "").toLowerCase().trim() === "constituency" &&
          String(d.region || "").toLowerCase().trim() === regionName.toLowerCase()
      );

      const constituenciesInRegion = Array.from(
        new Set(regConstituencyDelegates.map((d) => String(d.constituency || "").trim()))
      ).filter(Boolean).sort();

      for (const cName of constituenciesInRegion) {
        const cList = regConstituencyDelegates.filter(
          (d) => String(d.constituency || "").trim() === cName
        );
        for (let i = 0; i < cList.length; i += 10) {
          const chunk = cList.slice(i, i + 10);
          const partIdx = Math.floor(i / 10) + 1;
          chunk.forEach((d) => {
            d.page_number = currentCardPageNum;
          });
          cardPages.push({
            headerSubTitle: `${regionName.toUpperCase()} REGION · ${cName.toUpperCase()} (PART ${partIdx})`,
            footerLabel: `${regionName.toUpperCase()} · ${cName.toUpperCase()}`,
            cards: chunk,
          });
          currentCardPageNum++;
        }
      }
    }

    // 3. External branches (if present in wing album)
    const extBranchDelegates = delegates.filter(
      (d) =>
        String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
        String(d.region || "").toLowerCase().includes("external")
    );
    if (extBranchDelegates.length > 0) {
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
    // Standard layout (not a pure Wing Album)
    // 2. Regional Level Pages
    const regionsPresent = Array.from(
      new Set(regionalDelegates.map((d) => String(d.region || "").trim()))
    ).filter(Boolean).sort();

    for (const regionName of regionsPresent) {
      const regionList = regionalDelegates.filter(
        (d) => String(d.region || "").trim() === regionName
      );
      for (let i = 0; i < regionList.length; i += 10) {
        const chunk = regionList.slice(i, i + 10);
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

      // National Council Representatives in this region
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

      // Foundation Members in this region
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

      // Members of Parliament in this region
      const mps = delegates.filter(
        (d) =>
          getRegionalSectionRank(d) === 4 &&
          String(d.region || "").toLowerCase().trim() === regionName.toLowerCase().trim()
      );
      if (mps.length > 0) {
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

    // 3. Constituency Level Pages
    const constituenciesPresent = Array.from(
      new Set(constituencyDelegates.map((d) => String(d.constituency || "").trim()))
    ).filter(Boolean).sort();

    for (const cName of constituenciesPresent) {
      const cList = constituencyDelegates.filter(
        (d) => String(d.constituency || "").trim() === cName
      );
      const cRegion = cList[0]?.region ? String(cList[0].region).trim().toUpperCase() : "";
      const regionPrefix = cRegion && cRegion !== "NATIONAL" ? `${cRegion} REGION · ` : "";

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
        constituencyCapital: cList[0]?.constituency_capital || "",
        totalConstituencyExecutives: cList.length,
      });
      currentCardPageNum++;

      // Overflow Page(s) if constituency has > 19 executives
      if (cList.length > 19) {
        for (let i = 19; i < cList.length; i += 10) {
          const chunk = cList.slice(i, i + 10);
          const partIdx = Math.floor(i / 10) + 1;
          chunk.forEach((d) => {
            d.page_number = currentCardPageNum;
          });
          cardPages.push({
            headerSubTitle: `${regionPrefix}CONSTITUENCY EXECUTIVES · ${cName.toUpperCase()} (PART ${partIdx})`,
            footerLabel: `${cName.toUpperCase()}`,
            cards: chunk,
          });
          currentCardPageNum++;
        }
      }
    }

    // 4. External Branch Level Pages
    const extBranches = delegates.filter(
      (d) =>
        String(d.executive_level || "").toLowerCase().trim() === "external branch" ||
        String(d.region || "").toLowerCase().includes("external")
    );
    if (extBranches.length > 0) {
      const branchNames = Array.from(
        new Set(extBranches.map((d) => String(d.constituency || d.region || "External Branch").trim()))
      ).filter(Boolean).sort();

      for (const branchName of branchNames) {
        const branchDelegates = extBranches.filter(
          (d) => String(d.constituency || d.region || "External Branch").trim() === branchName
        );
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

    // 5. TESCON Level Pages
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
