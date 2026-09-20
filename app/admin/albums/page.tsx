"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Globe2,
  Layers,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Table2,
  Users,
  X,
} from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { logoutAndRedirect } from "@/lib/client-session";
import { getClientHeaders } from "@/lib/client-device";
import type { AlbumPrintWindow } from "@/lib/album-print";
import { useAlbumUser } from "./session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/native-select";
import {
  CONTEST_LIST,
  WING_PORTFOLIOS,
  GENERAL_CONTEST_LIST,
  CUSTOM_CONTEST,
  CUSTOM_POSITION_CATEGORIES,
  ALL_CUSTOMIZABLE_POSITIONS,
  POSITION_PRESETS,
  ALL_CUSTOMIZABLE_LEVELS,
  LEVEL_PRESETS,
  ALL_VOTER_DETAILS,
  DEFAULT_VOTER_DETAILS,
  VOTER_DETAIL_PRESETS,
  ALL_ELECTORAL_JURISDICTIONS,
  ALL_JURISDICTION_IDS,
  JURISDICTION_PRESETS,
  type ContestType,
  type CustomizablePosition,
  type CustomizableLevel,
  type LevelPresetKey,
  type VoterDetailField,
  type VoterDetailPresetKey,
  type JurisdictionPresetKey,
} from "@/lib/election-contests";

const REGION_OPTIONS = [
  { value: "all", label: "All Ghana · Nationwide Roll" },
  { value: "Ahafo", label: "Ahafo Region" },
  { value: "Ashanti", label: "Ashanti Region" },
  { value: "Bono", label: "Bono Region" },
  { value: "Bono East", label: "Bono East Region" },
  { value: "Central", label: "Central Region" },
  { value: "Eastern", label: "Eastern Region" },
  { value: "Greater Accra", label: "Greater Accra Region" },
  { value: "North East", label: "North East Region" },
  { value: "Northern", label: "Northern Region" },
  { value: "Oti", label: "Oti Region" },
  { value: "Savannah", label: "Savannah Region" },
  { value: "Upper East", label: "Upper East Region" },
  { value: "Upper West", label: "Upper West Region" },
  { value: "Volta", label: "Volta Region" },
  { value: "Western", label: "Western Region" },
  { value: "Western North", label: "Western North Region" },
  { value: "External Branch", label: "External Branch" },
];

type Delegate = {
  id: string; executive_name: string; executive_level: string; region: string;
  constituency: string; canonical_position: string; voter_id: string; phone: string;
  gender: string; age: number | null; image_url: string; avatar_svg: string;
};

type ConstituencyAuditItem = {
  region: string;
  constituency: string;
  confirmed: number;
  target: number;
  variance: number;
  complianceRate: string;
  status: "Compliant" | "Under Quota" | "Over Quota";
  confirmedElected?: number;
  targetElected?: number;
  confirmedAppointed?: number;
  targetAppointed?: number;
};

type AlbumData = {
  delegates: Delegate[];
  generatedAt: string;
  constituencyAudit?: ConstituencyAuditItem[];
  levelAudit?: any;
  metrics: {
    contest: string;
    actualFigures: number; expectedFigures: number; complianceRate: string;
    quorumRequirement: number; levelBreakdown: Record<string, number>;
    regionalQuota?: number;
    constituencyQuota?: number;
    constituencyElectedQuota?: number;
    constituencyAppointedQuota?: number;
    biometricVerification: { verified: number; pending: number; verificationRate: string };
    positionNational?: {
      statutoryBenchmark: number;
      confirmedTotal: number;
      complianceRate: string;
      isRegionalSubset: boolean;
      includedJurisdictionsCount: number;
      excludedJurisdictionsCount: number;
      includedFigures: number;
      includedTarget: number;
      excludedFigures: number;
      excludedTarget: number;
      excludedRegions: string[];
    };
  };
};

export default function PositionAlbumsPage() {
  const currentUser = useAlbumUser();
  const [contest, setContest] = useState<ContestType>("Women Organiser");
  const [region, setRegion] = useState("all");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([...ALL_JURISDICTION_IDS]);
  const [albumType, setAlbumType] = useState<"provisional" | "final">("provisional");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [scope, setScope] = useState("all_voters");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([
    "chairperson",
    "secretary",
    "organiser",
  ]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([
    "National",
    "Regional",
    "Constituency",
    "External Branch",
    "TESCON",
  ]);
  const [selectedDetails, setSelectedDetails] = useState<VoterDetailField[]>([
    ...DEFAULT_VOTER_DETAILS,
  ]);
  const [detailsFilterOpen, setDetailsFilterOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [positionSearch, setPositionSearch] = useState("");
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    portfolio: true,
    jurisdictions: true,
    levels: true,
    edition: false,
    gender: false,
    details: false,
  });
  const [tab, setTab] = useState("preview");
  const [zoom, setZoom] = useState(100);
  const [result, setResult] = useState<{ key: string; data: AlbumData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);
  const [constituencySearch, setConstituencySearch] = useState("");
  const [constituencyStatusFilter, setConstituencyStatusFilter] = useState("all");
  const [constituencyRegionFilter, setConstituencyRegionFilter] = useState("all");
  const [constituencyPage, setConstituencyPage] = useState(1);
  const [previewReady, setPreviewReady] = useState("");
  const [previewFailure, setPreviewFailure] = useState("");
  const [printRequest, setPrintRequest] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null);

  const isCustom = contest === "Custom";
  const isWingContest =
    !isCustom &&
    contest !== "All Men" &&
    contest !== "All Women" &&
    (WING_PORTFOLIOS.includes(contest as any) ||
      contest === "Youth Organiser" ||
      contest === "Women Organiser" ||
      contest === "Nasara Organiser");

  const effectiveScope =
    contest === "Women Organiser" ||
    contest === "Women Organisers & Deputies" ||
    contest === "All Women" ||
    contest === "All Men"
      ? "all_voters"
      : WING_PORTFOLIOS.includes(contest as any)
      ? (scope === "all_voters" ? "all_voters" : "organisers_only")
      : (scope === "organisers_only" ? "organisers_only" : "all_voters");
  const positionsQuery = isCustom ? `&positions=${encodeURIComponent(selectedPositions.join(","))}` : "";
  const levelsQuery =
    selectedLevels.length > 0 && selectedLevels.length < ALL_CUSTOMIZABLE_LEVELS.length
      ? `&levels=${encodeURIComponent(selectedLevels.join(","))}`
      : level !== "all" && level !== "custom"
      ? `&levels=${encodeURIComponent(level)}`
      : "";
  const isCustomDetails =
    selectedDetails.length !== DEFAULT_VOTER_DETAILS.length ||
    !DEFAULT_VOTER_DETAILS.every((d) => selectedDetails.includes(d));
  const detailsQuery = isCustomDetails
    ? `&details=${encodeURIComponent(selectedDetails.join(","))}`
    : "";
  const genderQuery = gender !== "all" ? `&gender=${encodeURIComponent(gender)}` : "";
  const regionsQuery =
    selectedRegions.length > 0 && selectedRegions.length < ALL_JURISDICTION_IDS.length
      ? `&regions=${encodeURIComponent(selectedRegions.join(","))}`
      : "";
  const albumTypeQuery = albumType === "final" ? "&album_type=final" : "";
  const query = `position=${encodeURIComponent(contest)}&region=${encodeURIComponent(region)}${effectiveScope === "organisers_only" ? "&scope=organisers_only" : ""}${positionsQuery}${levelsQuery}${detailsQuery}${genderQuery}${regionsQuery}${albumTypeQuery}`;
  const requestKey = `${query}&revision=${retry}`;
  const previewUrl = `/api/admin/albums/election?${requestKey}&format=html`;
  const excelDownloadUrl = `/api/admin/albums/election?${query}&format=excel&download=1`;
  const data = result?.key === requestKey ? result.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !data && !error;

  const displayContestTitle =
    data?.metrics.contest ||
    (isCustom
      ? selectedPositions.length > 0
        ? `Custom Selection (${selectedPositions.length} Positions)`
        : "Custom Selection (No Positions Selected)"
      : contest);
  const safeContestFilename = displayContestTitle.replace(/[\s&]+/g, "_");

  const togglePosition = (id: string) => {
    setSelectedPositions((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((p) => p !== id) : [...prev, id];
      return next;
    });
    setPage(1);
  };

  const selectAllPositions = () => {
    setSelectedPositions(ALL_CUSTOMIZABLE_POSITIONS.map((p) => p.id));
    setPage(1);
  };

  const clearAllPositions = () => {
    setSelectedPositions([]);
    setPage(1);
  };

  const applyPreset = (presetKey: keyof typeof POSITION_PRESETS) => {
    setSelectedPositions([...POSITION_PRESETS[presetKey].ids]);
    setPage(1);
  };

  const toggleLevel = (id: string) => {
    setSelectedLevels((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((l) => l !== id) : [...prev, id];
      if (next.length === ALL_CUSTOMIZABLE_LEVELS.length) {
        setLevel("all");
      } else if (next.length === 1) {
        setLevel(next[0]);
      } else {
        setLevel("custom");
      }
      return next;
    });
    setPage(1);
  };

  const selectAllLevels = () => {
    setSelectedLevels(ALL_CUSTOMIZABLE_LEVELS.map((l) => l.id));
    setLevel("all");
    setPage(1);
  };

  const applyLevelPreset = (presetKey: LevelPresetKey) => {
    const ids = [...LEVEL_PRESETS[presetKey].ids];
    setSelectedLevels(ids);
    if (ids.length === ALL_CUSTOMIZABLE_LEVELS.length) {
      setLevel("all");
    } else if (ids.length === 1) {
      setLevel(ids[0]);
    } else {
      setLevel("custom");
    }
    setPage(1);
  };

  const toggleCategory = (catPositions: CustomizablePosition[]) => {
    const catIds = catPositions.map((p) => p.id);
    const allSelected = catIds.every((id) => selectedPositions.includes(id));
    if (allSelected) {
      setSelectedPositions((prev) => prev.filter((id) => !catIds.includes(id)));
    } else {
      setSelectedPositions((prev) => Array.from(new Set([...prev, ...catIds])));
    }
    setPage(1);
  };

  const toggleDetail = (id: VoterDetailField) => {
    setSelectedDetails((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((d) => d !== id) : [...prev, id];
      return next;
    });
    setPage(1);
  };

  const selectAllDetails = () => {
    setSelectedDetails(ALL_VOTER_DETAILS.map((d) => d.id));
    setPage(1);
  };

  const clearAllDetails = () => {
    setSelectedDetails([]);
    setPage(1);
  };

  const applyDetailPreset = (presetKey: VoterDetailPresetKey) => {
    setSelectedDetails([...VOTER_DETAIL_PRESETS[presetKey].ids]);
    setPage(1);
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllAccordions = () => {
    setOpenAccordions({
      portfolio: true,
      jurisdictions: true,
      levels: true,
      edition: true,
      gender: true,
      details: true,
    });
  };

  const collapseAllAccordions = () => {
    setOpenAccordions({
      portfolio: false,
      jurisdictions: false,
      levels: false,
      edition: false,
      gender: false,
      details: false,
    });
  };

  const toggleRegion = (id: string) => {
    setSelectedRegions((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((r) => r !== id) : [...prev, id];
      if (next.length === ALL_JURISDICTION_IDS.length) {
        setRegion("all");
      } else if (next.length === 1) {
        setRegion(next[0]);
      } else {
        setRegion("all");
      }
      return next;
    });
    setPage(1);
  };

  const selectAllRegions = () => {
    setSelectedRegions([...ALL_JURISDICTION_IDS]);
    setRegion("all");
    setPage(1);
  };

  const clearAllRegions = () => {
    setSelectedRegions([]);
    setPage(1);
  };

  const applyJurisdictionPreset = (presetKey: JurisdictionPresetKey) => {
    const ids = [...JURISDICTION_PRESETS[presetKey].ids];
    setSelectedRegions(ids);
    if (ids.length === ALL_JURISDICTION_IDS.length) {
      setRegion("all");
    } else if (ids.length === 1) {
      setRegion(ids[0]);
    } else {
      setRegion("all");
    }
    setPage(1);
  };

  const resetAllFilters = () => {
    setContest("Women Organiser");
    setRegion("all");
    setSelectedRegions([...ALL_JURISDICTION_IDS]);
    setGender("all");
    setScope("all_voters");
    setLevel("all");
    setSelectedLevels(ALL_CUSTOMIZABLE_LEVELS.map((l) => l.id));
    setAlbumType("provisional");
    setSelectedDetails([...DEFAULT_VOTER_DETAILS]);
    setDetailsFilterOpen(false);
    setCustomizerOpen(false);
    setPage(1);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/albums/election?${requestKey}&format=json`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
      headers: getClientHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) {
            logoutAndRedirect("expired");
          }
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Unable to load the album. Please try again.");
        }
        return response.json() as Promise<AlbumData>;
      })
      .then((data) => { if (!controller.signal.aborted) setResult({ key: requestKey, data }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure({ key: requestKey, message: error instanceof Error ? error.message : "Unable to load the album." });
      });
    return () => controller.abort();
  }, [requestKey]);

  const delegates = data?.delegates ?? [];
  const filtered = delegates.filter((d) => {
    const matchesLevel =
      level === "all"
        ? true
        : level === "custom"
        ? selectedLevels.some((sl) => sl.toLowerCase() === String(d.executive_level || "").toLowerCase())
        : String(d.executive_level || "").toLowerCase() === level.toLowerCase();

    const matchesGender =
      gender === "all"
        ? true
        : String(d.gender || "").toLowerCase() === gender.toLowerCase();

    const matchesRegion =
      selectedRegions.length === 0 ||
      selectedRegions.length >= ALL_JURISDICTION_IDS.length
        ? (region === "all" ? true : String(d.region || "").toLowerCase() === region.toLowerCase())
        : selectedRegions.some((r) => r.toLowerCase() === String(d.region || "").toLowerCase());

    return (
      matchesLevel &&
      matchesGender &&
      matchesRegion &&
      [d.executive_name, d.voter_id, d.constituency, d.region, d.canonical_position].some((value) =>
        String(value ?? "").toLowerCase().includes(search.trim().toLowerCase())
      )
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * 50, currentPage * 50);
  const metrics = data?.metrics;

  const allConstituencyAudit = data?.constituencyAudit ?? [];
  const filteredConstituencies = allConstituencyAudit.filter((c) => {
    const matchesSearch =
      !constituencySearch.trim() ||
      c.constituency.toLowerCase().includes(constituencySearch.toLowerCase()) ||
      c.region.toLowerCase().includes(constituencySearch.toLowerCase());
    const matchesStatus =
      constituencyStatusFilter === "all" || c.status === constituencyStatusFilter;
    const matchesRegion =
      constituencyRegionFilter === "all" ||
      c.region.toLowerCase().trim() === constituencyRegionFilter.toLowerCase().trim();
    return matchesSearch && matchesStatus && matchesRegion;
  });
  const totalConstituencyPages = Math.max(1, Math.ceil(filteredConstituencies.length / 50));
  const currentConstituencyPage = Math.min(constituencyPage, totalConstituencyPages);
  const pagedConstituencies = filteredConstituencies.slice(
    (currentConstituencyPage - 1) * 50,
    currentConstituencyPage * 50
  );

  const exportJson = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `NPP_${safeContestFilename}_${region}_Electorate_2026.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePreviewLoad = async (frame: HTMLIFrameElement) => {
    const albumWindow = frame.contentWindow as AlbumPrintWindow | null;
    const ready = await albumWindow?.albumReady;
    if (iframe.current !== frame) return;
    if (ready) setPreviewReady(previewUrl);
    else setPreviewFailure(previewUrl);
  };

  useEffect(() => {
    if (printRequest !== previewUrl || previewReady !== previewUrl) return;
    const albumWindow = iframe.current?.contentWindow as AlbumPrintWindow | null;
    if (albumWindow?.document.documentElement.dataset.albumReady === "true") {
      void albumWindow.printAlbum?.();
      setPrintRequest("");
    }
  }, [printRequest, previewReady, previewUrl, tab]);

  const handlePrintPdf = () => {
    setTab("preview");
    setPrintRequest(previewUrl);
  };

  return (
    <AdminShell title="Election albums" subtitle="Prepare and manage the provisional electoral roll" currentUser={currentUser}>
      <div className="album-ui space-y-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5"><ShieldCheck className="size-3.5" /> National administrator</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">Election albums <span className="text-muted-foreground">/ 2026</span></h1>
            <p className="text-sm text-muted-foreground">Select a portfolio or wing extraction and region to preview, review, and export your album.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300">
              <a href="/api/admin/albums/audit-statistics/export" download="NPP_Regional_and_Wings_Statutory_Audit_Statistics_2026.xlsx">
                <Table2 className="size-4" /> Regional &amp; Wings Audit Stats (.xlsx)
              </a>
            </Button>
            <Button asChild variant="outline" disabled={!data || !delegates.length}>
              <a href={excelDownloadUrl} download={`NPP_${safeContestFilename}_${region}_Voter_Directory_2026.xlsx`}>
                <Download className="size-4" /> Download Excel (.xlsx)
              </a>
            </Button>
            <Button variant="outline" disabled={!data} onClick={exportJson}><Download className="size-4" /> Export JSON</Button>
            <Button disabled={!data || !delegates.length || printRequest === previewUrl || previewFailure === previewUrl} onClick={handlePrintPdf}><Printer className="size-4" /> {printRequest === previewUrl && previewFailure !== previewUrl ? "Preparing images…" : "Print / Save PDF"}</Button>
          </div>
        </div>

        {/* Filter Configuration Accordion Card */}
        {(() => {
          const excludedJurisdiction = ALL_ELECTORAL_JURISDICTIONS.find((j) => !selectedRegions.includes(j.id));
          const excludedRegLabel = excludedJurisdiction ? excludedJurisdiction.shortName : "1 region";

          const isAllJurisdictions = selectedRegions.length === ALL_JURISDICTION_IDS.length;
          const isJurisdictionsActive = !isAllJurisdictions;

          const excludedLevel = ALL_CUSTOMIZABLE_LEVELS.find((l) => !selectedLevels.includes(l.id));
          const excludedLevelLabel = excludedLevel ? excludedLevel.shortLabel : "1 level";
          const isAllLevels = selectedLevels.length === ALL_CUSTOMIZABLE_LEVELS.length && level === "all";
          const isLevelsActive = !isAllLevels;

          const isEditionActive = albumType === "final";
          const isGenderActive = gender !== "all";
          const isPortfolioActive = isCustom || isWingContest || contest === "All Men" || contest === "All Women";
          const isDetailsActive = isCustomDetails;

          const totalActiveFilters =
            (isPortfolioActive ? 1 : 0) +
            (isJurisdictionsActive ? 1 : 0) +
            (isLevelsActive ? 1 : 0) +
            (isEditionActive ? 1 : 0) +
            (isGenderActive ? 1 : 0) +
            (isDetailsActive ? 1 : 0);

          return (
            <Card className="border shadow-xs">
              <CardHeader className="border-b bg-card/60 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xl">Album configuration</CardTitle>
                      {totalActiveFilters > 0 ? (
                        <Badge className="bg-blue-600 text-white hover:bg-blue-700 font-medium">
                          {totalActiveFilters} Active Filter{totalActiveFilters === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground font-normal">
                          All Dormant (Default Roll)
                        </Badge>
                      )}
                      {albumType === "final" ? (
                        <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200">
                          <CheckCircle2 className="size-3 text-emerald-600" /> Final Certified Album
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-slate-600 dark:text-slate-400">
                          Provisional Draft Edition
                        </Badge>
                      )}
                      {isCustom && (
                        <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                          <Sparkles className="size-3 text-blue-600" /> Customise Mode
                        </Badge>
                      )}
                      {isCustomDetails && (
                        <Badge variant="secondary" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                          <SlidersHorizontal className="size-3 text-indigo-600" /> {selectedDetails.length}/9 Details
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      Organized into active &amp; dormant accordion columns: independently configure elective wing scopes, multi-region subsets (select all or leave regions out), administrative tiers, provisional/final certification, and voter card details.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={expandAllAccordions}
                    >
                      <ChevronDown className="size-3.5" /> Expand All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={collapseAllAccordions}
                    >
                      <ChevronUp className="size-3.5" /> Collapse All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={resetAllFilters}
                    >
                      <RotateCcw className="size-3.5" /> Reset Filters
                    </Button>
                    <Button
                      type="button"
                      variant={detailsFilterOpen ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => {
                        const next = !detailsFilterOpen;
                        setDetailsFilterOpen(next);
                        setOpenAccordions((prev) => ({ ...prev, details: next }));
                      }}
                    >
                      <SlidersHorizontal className="size-3.5" />
                      {detailsFilterOpen
                        ? "Hide Detail Filters"
                        : `Filter Voter Details (${selectedDetails.length}/9)`}
                    </Button>
                    <Button
                      type="button"
                      variant={isCustom ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => {
                        if (!isCustom) {
                          setContest("Custom");
                          setCustomizerOpen(true);
                          setOpenAccordions((prev) => ({ ...prev, portfolio: true }));
                        } else {
                          setCustomizerOpen(!customizerOpen);
                        }
                        setPage(1);
                      }}
                    >
                      <SlidersHorizontal className="size-3.5" />
                      {isCustom
                        ? customizerOpen
                          ? "Hide Position Picker"
                          : `Edit Positions (${selectedPositions.length})`
                        : "Customise Positions"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* Accordion Column Status Overview Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-2.5 rounded-lg bg-muted/40 border border-muted text-xs">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("portfolio")}
                    className="flex flex-col text-left p-2 rounded-md hover:bg-background transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">1. Portfolio</span>
                    <span className="font-medium truncate text-foreground">{isCustom ? `Custom (${selectedPositions.length})` : contest}</span>
                    <span className={`text-[11px] mt-0.5 font-medium ${isPortfolioActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`}>
                      {isPortfolioActive ? "Active" : "Dormant"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleAccordion("jurisdictions")}
                    className="flex flex-col text-left p-2 rounded-md hover:bg-background transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">2. Regions</span>
                    <span className="font-medium truncate text-foreground">
                      {isAllJurisdictions
                        ? "All 18 Regions"
                        : selectedRegions.length === ALL_JURISDICTION_IDS.length - 1
                        ? `17 (${excludedRegLabel} out)`
                        : `${selectedRegions.length}/18 Regions`}
                    </span>
                    <span className={`text-[11px] mt-0.5 font-medium ${isJurisdictionsActive ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`}>
                      {isJurisdictionsActive ? "Active (Subset)" : "Dormant (All 18)"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleAccordion("levels")}
                    className="flex flex-col text-left p-2 rounded-md hover:bg-background transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">3. Tiers</span>
                    <span className="font-medium truncate text-foreground">
                      {isAllLevels
                        ? "All 5 Tiers"
                        : selectedLevels.length === 4
                        ? `4 (${excludedLevelLabel} out)`
                        : `${selectedLevels.length}/5 Tiers`}
                    </span>
                    <span className={`text-[11px] mt-0.5 font-medium ${isLevelsActive ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`}>
                      {isLevelsActive ? "Active" : "Dormant"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleAccordion("edition")}
                    className="flex flex-col text-left p-2 rounded-md hover:bg-background transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">4. Edition</span>
                    <span className="font-medium truncate text-foreground">
                      {albumType === "final" ? "Final Certified" : "Provisional"}
                    </span>
                    <span className={`text-[11px] mt-0.5 font-medium ${albumType === "final" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                      {albumType === "final" ? "Active (Certified)" : "Dormant (Draft)"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleAccordion("gender")}
                    className="flex flex-col text-left p-2 rounded-md hover:bg-background transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">5. Gender</span>
                    <span className="font-medium truncate text-foreground">
                      {gender === "all" ? "All Genders" : gender === "male" ? "Men Only" : "Women Only"}
                    </span>
                    <span className={`text-[11px] mt-0.5 font-medium ${isGenderActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`}>
                      {isGenderActive ? "Active" : "Dormant"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleAccordion("details")}
                    className="flex flex-col text-left p-2 rounded-md hover:bg-background transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">6. Details</span>
                    <span className="font-medium truncate text-foreground">{selectedDetails.length}/9 Fields</span>
                    <span className={`text-[11px] mt-0.5 font-medium ${isDetailsActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"}`}>
                      {isDetailsActive ? "Active" : "Dormant"}
                    </span>
                  </button>
                </div>

                {/* The 6 Accordion Panels */}
                <div className="space-y-3">
                  {/* Accordion 1: Portfolio & Wing Scope */}
                  <div className={`rounded-xl border transition-all ${openAccordions.portfolio ? "border-blue-300 dark:border-blue-900/70 bg-card shadow-2xs" : "border-border/60 bg-muted/20"}`}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion("portfolio")}
                      className="w-full flex items-center justify-between p-3.5 text-left select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-xs">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Elective Portfolio & Wing Scope
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Choose portfolio, wing extractions (Youth, Women, Nasara), or custom positions
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPortfolioActive ? (
                          <Badge className="bg-blue-600 text-white text-xs">
                            {isCustom
                              ? `Active: Custom (${selectedPositions.length} Positions)`
                              : isWingContest
                              ? `Active: ${contest} (Wing Portfolio)`
                              : contest === "All Men"
                              ? "Active: Male Roll"
                              : contest === "All Women"
                              ? "Active: Female Roll"
                              : `Active: ${contest}`}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Dormant: Standard Portfolio
                          </Badge>
                        )}
                        {openAccordions.portfolio ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {openAccordions.portfolio && (
                      <div className="px-4 pb-4 pt-1 border-t border-blue-100 dark:border-blue-950 space-y-3.5">
                        {/* Wing Quick Selection Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-xs font-medium text-muted-foreground mr-1">Quick Portfolios:</span>
                          <Button
                            type="button"
                            variant={contest === "Youth Organisers & Deputies" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setContest("Youth Organisers & Deputies");
                              setScope("organisers_only");
                              setPage(1);
                            }}
                          >
                            Youth Wing
                          </Button>
                          <Button
                            type="button"
                            variant={contest === "Women Organisers & Deputies" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setContest("Women Organisers & Deputies");
                              setGender("female");
                              setScope("all_voters");
                              setPage(1);
                            }}
                          >
                            Women Wing
                          </Button>
                          <Button
                            type="button"
                            variant={contest === "Nasara Coordinators & Deputies" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setContest("Nasara Coordinators & Deputies");
                              setScope("organisers_only");
                              setPage(1);
                            }}
                          >
                            Nasara Wing
                          </Button>
                          <Button
                            type="button"
                            variant={contest === "All Men" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setContest("All Men");
                              setGender("male");
                              setScope("all_voters");
                              setPage(1);
                            }}
                          >
                            All Men (5,606)
                          </Button>
                          <Button
                            type="button"
                            variant={contest === "All Women" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setContest("All Women");
                              setGender("female");
                              setScope("all_voters");
                              setPage(1);
                            }}
                          >
                            All Women (1,390)
                          </Button>
                          <Button
                            type="button"
                            variant={isCustom ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setContest("Custom");
                              setCustomizerOpen(true);
                              setPage(1);
                            }}
                          >
                            ✨ Custom Multi-Position
                          </Button>
                        </div>

                        {/* Portfolio Select Dropdown */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                          <div className="space-y-1.5">
                            <label htmlFor="contest" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                              Elective portfolio / Mode
                            </label>
                            <NativeSelect
                              id="contest"
                              value={contest}
                              onChange={(e) => {
                                const val = e.target.value as ContestType;
                                setContest(val);
                                if (val === "Custom") {
                                  setCustomizerOpen(true);
                                }
                                if (val === "All Men") {
                                  setGender("male");
                                  setScope("all_voters");
                                } else if (val === "All Women" || val === "Women Organiser" || val === "Women Organisers & Deputies") {
                                  setGender("female");
                                  setScope("all_voters");
                                } else if (WING_PORTFOLIOS.includes(val as any)) {
                                  setScope("organisers_only");
                                } else {
                                  setScope("all_voters");
                                }
                                setPage(1);
                              }}
                            >
                              <optgroup label="Custom Multi-Position Extraction">
                                <option value="Custom">✨ Custom Selection (Select Specific Positions…)</option>
                              </optgroup>
                              <optgroup label="Wing Organisers & Deputies (Exclusive Extraction)">
                                {WING_PORTFOLIOS.map((item) => (
                                  <option key={item} value={item}>
                                    {item === "Women Organisers & Deputies"
                                      ? "Women Organiser (All Female Electoral College)"
                                      : item}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="General Election Contests & Full Rolls">
                                {GENERAL_CONTEST_LIST.map((item) => (
                                  <option key={item} value={item}>
                                    {item === "Women Organiser"
                                      ? "Women Organiser (All Female Electoral College)"
                                      : item === "All Men"
                                      ? "All Men (Male Electoral College Roll · 5,606)"
                                      : item === "All Women"
                                      ? "All Women (Female Electoral College Roll · 1,390)"
                                      : item}
                                  </option>
                                ))}
                              </optgroup>
                            </NativeSelect>
                          </div>

                          {isWingContest && (
                            <div className="space-y-1.5">
                              <label htmlFor="scope" className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                                Electorate filter
                              </label>
                              <NativeSelect
                                id="scope"
                                value={effectiveScope}
                                onChange={(e) => {
                                  setScope(e.target.value);
                                  setPage(1);
                                }}
                              >
                                <option value="all_voters">
                                  {contest === "Women Organiser" || contest === "Women Organisers & Deputies"
                                    ? "All Females in Electoral College (All Eligible Women)"
                                    : "Full Voting College (All Eligible Voters)"}
                                </option>
                                {contest !== "Women Organiser" && contest !== "Women Organisers & Deputies" && (
                                  <option value="organisers_only">Organisers & Deputies Only (Wing Executives)</option>
                                )}
                              </NativeSelect>
                            </div>
                          )}
                        </div>

                        {/* Wing Notice */}
                        {isWingContest && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                            💡 <strong>Wing Mode Active:</strong> You can independently deselect administrative tiers (e.g. exclude TESCON or External Branches in <strong>Column 3</strong>) and/or deselect specific regions (in <strong>Column 2</strong>) to extract your exact wing sub-album.
                          </div>
                        )}

                        {/* Custom Positions Picker (when Custom is selected or toggled) */}
                        {isCustom && (
                          <div className="rounded-xl border bg-card p-4 shadow-2xs space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-2.5">
                              <div>
                                <h4 className="font-semibold text-xs flex items-center gap-1.5 text-blue-950 dark:text-blue-100">
                                  <SlidersHorizontal className="size-3.5 text-blue-600" />
                                  Select Positions Needed for Album ({selectedPositions.length} Selected)
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  The album, PDF, voter register, and Excel export will include strictly the checked positions.
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Button variant="outline" size="sm" onClick={selectAllPositions} className="h-6 text-xs">
                                  Select All Positions
                                </Button>
                                <Button variant="outline" size="sm" onClick={clearAllPositions} className="h-6 text-xs text-muted-foreground">
                                  Clear Positions
                                </Button>
                              </div>
                            </div>

                            {/* Presets Bar */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium text-muted-foreground mr-1">Presets:</span>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("core_slate")}>
                                Core Slate (Top 5)
                              </Button>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("key_officers")}>
                                Key Officers (Top 10)
                              </Button>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("wings_only")}>
                                Wing Executives
                              </Button>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("regional_slate")}>
                                Full Regional (21)
                              </Button>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("constituency_slate")}>
                                Full Constituency (19)
                              </Button>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("elected_constituency")}>
                                Elected Only (11)
                              </Button>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("appointed_constituency")}>
                                Appointed Only (8)
                              </Button>
                              <Button type="button" variant="secondary" size="sm" className="h-6 text-xs" onClick={() => applyPreset("deputies_only")}>
                                Deputies Only
                              </Button>
                            </div>

                            {/* Search */}
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                              <Input
                                placeholder="Filter positions by title (e.g., Chairperson, Secretary, Organiser, Nasara)..."
                                value={positionSearch}
                                onChange={(e) => setPositionSearch(e.target.value)}
                                className="pl-9 h-8 text-xs"
                              />
                              {positionSearch && (
                                <button
                                  type="button"
                                  onClick={() => setPositionSearch("")}
                                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="size-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Position Categories Grid */}
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-1">
                              {CUSTOM_POSITION_CATEGORIES.map((group) => {
                                const filteredPositions = group.positions.filter((pos) =>
                                  !positionSearch.trim() ||
                                  pos.label.toLowerCase().includes(positionSearch.toLowerCase()) ||
                                  pos.synonyms.some((s) => s.toLowerCase().includes(positionSearch.toLowerCase()))
                                );

                                if (filteredPositions.length === 0) return null;

                                const allGroupSelected = group.positions.every((p) =>
                                  selectedPositions.includes(p.id)
                                );

                                return (
                                  <div
                                    key={group.category}
                                    className="rounded-lg border bg-muted/20 p-2.5 space-y-2 flex flex-col justify-between"
                                  >
                                    <div className="flex items-center justify-between border-b pb-1">
                                      <span className="font-semibold text-xs text-foreground">
                                        {group.category}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleCategory(group.positions)}
                                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                      >
                                        {allGroupSelected ? "None" : "All"}
                                      </button>
                                    </div>
                                    <div className="space-y-1">
                                      {filteredPositions.map((pos) => {
                                        const isChecked = selectedPositions.includes(pos.id);
                                        return (
                                          <label
                                            key={pos.id}
                                            className={`flex items-start gap-2 p-1 rounded cursor-pointer transition-colors text-xs select-none ${
                                              isChecked
                                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 font-medium"
                                                : "hover:bg-muted/60 text-muted-foreground"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              className="mt-0.5 size-3.5 rounded accent-blue-600 cursor-pointer"
                                              checked={isChecked}
                                              onChange={() => togglePosition(pos.id)}
                                            />
                                            <span className="leading-tight">{pos.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accordion 2: Regional Jurisdictions (Multi-Region Selection) */}
                  <div className={`rounded-xl border transition-all ${openAccordions.jurisdictions ? "border-amber-300 dark:border-amber-900/70 bg-card shadow-2xs" : "border-border/60 bg-muted/20"}`}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion("jurisdictions")}
                      className="w-full flex items-center justify-between p-3.5 text-left select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                          2
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Regional Jurisdictions (Multi-Region Selection)
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Select all 18 regions, leave one region out (e.g. uncheck Ashanti), or pick specific belts
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isJurisdictionsActive ? (
                          <Badge className="bg-amber-600 text-white text-xs">
                            {selectedRegions.length === ALL_JURISDICTION_IDS.length - 1
                              ? `Active: 17/18 Regions (${excludedRegLabel} left out)`
                              : selectedRegions.length === 0
                              ? "Active: 0 Regions"
                              : `Active: ${selectedRegions.length}/18 Regions Selected`}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Dormant: All 18 Jurisdictions Included
                          </Badge>
                        )}
                        {openAccordions.jurisdictions ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {openAccordions.jurisdictions && (
                      <div className="px-4 pb-4 pt-1 border-t border-amber-100 dark:border-amber-950 space-y-3.5">
                        {/* Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-xs font-medium text-muted-foreground mr-1">Jurisdiction Presets:</span>
                          <Button
                            type="button"
                            variant={selectedRegions.length === ALL_JURISDICTION_IDS.length ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyJurisdictionPreset("all")}
                          >
                            All 18 Jurisdictions
                          </Button>
                          <Button
                            type="button"
                            variant={selectedRegions.length === 16 && !selectedRegions.includes("External Branch") && !selectedRegions.includes("National Headquarters") ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyJurisdictionPreset("sixteen_regions")}
                          >
                            16 Ghana Regions
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyJurisdictionPreset("southern_belt")}
                          >
                            Southern Belt (6)
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyJurisdictionPreset("middle_belt")}
                          >
                            Middle Belt (5)
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyJurisdictionPreset("northern_belt")}
                          >
                            Northern Belt (5)
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyJurisdictionPreset("diaspora_and_hq")}
                          >
                            Diaspora & HQ (2)
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground ml-auto"
                            onClick={selectAllRegions}
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={clearAllRegions}
                          >
                            Clear All
                          </Button>
                        </div>

                        {/* Deselection Notification */}
                        {selectedRegions.length === ALL_JURISDICTION_IDS.length - 1 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 flex items-center justify-between">
                            <span>
                              ✓ <strong>1 Region Left Out:</strong> 17 jurisdictions included — <strong>{excludedRegLabel} Region</strong> is currently excluded from this album extraction.
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] text-amber-900 dark:text-amber-200 underline"
                              onClick={selectAllRegions}
                            >
                              Re-include {excludedRegLabel}
                            </Button>
                          </div>
                        ) : isAllJurisdictions ? (
                          <p className="text-xs text-muted-foreground">
                            All 18 jurisdictions active. Click any checked region card below to leave it out (e.g., uncheck Ashanti or Northern), or choose a belt preset.
                          </p>
                        ) : (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 flex items-center justify-between">
                            <span>
                              ✓ <strong>Custom Jurisdiction Subset:</strong> {selectedRegions.length} of 18 jurisdictions selected.
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] text-blue-900 dark:text-blue-200 underline"
                              onClick={selectAllRegions}
                            >
                              Reset to All 18
                            </Button>
                          </div>
                        )}

                        {/* 18 Jurisdictions Checkbox Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                          {ALL_ELECTORAL_JURISDICTIONS.map((j) => {
                            const isChecked = selectedRegions.includes(j.id);
                            return (
                              <button
                                key={j.id}
                                type="button"
                                onClick={() => toggleRegion(j.id)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all select-none ${
                                  isChecked
                                    ? "border-amber-500/80 bg-white dark:bg-slate-900 shadow-2xs ring-1 ring-amber-500/20 text-foreground"
                                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 opacity-70"
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {isChecked ? (
                                    <CheckSquare className="size-4 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <Square className="size-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-xs font-semibold truncate ${isChecked ? "text-foreground" : "text-muted-foreground"}`}>
                                      {j.name}
                                    </span>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal shrink-0">
                                      {j.belt}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                                    <span className="truncate">{j.description || j.shortName}</span>
                                    {(j.constituencies ?? 0) > 0 && (
                                      <span>· {j.constituencies} Units</span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Native Select for single region compatibility */}
                        <div className="pt-2 border-t flex flex-wrap items-center gap-3">
                          <label htmlFor="region" className="text-xs font-semibold text-muted-foreground">
                            Quick Single-Region Selector:
                          </label>
                          <NativeSelect
                            id="region"
                            value={region}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRegion(val);
                              if (val === "all") {
                                setSelectedRegions([...ALL_JURISDICTION_IDS]);
                              } else {
                                setSelectedRegions([val]);
                              }
                              setPage(1);
                            }}
                            className="w-72 text-xs"
                          >
                            {REGION_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Accordion 3: Administrative Tiers (Deselect Levels) */}
                  <div className={`rounded-xl border transition-all ${openAccordions.levels ? "border-sky-300 dark:border-sky-900/70 bg-card shadow-2xs" : "border-border/60 bg-muted/20"}`}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion("levels")}
                      className="w-full flex items-center justify-between p-3.5 text-left select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 font-semibold text-xs">
                          3
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Administrative Tiers (Deselect Levels)
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            National, Regional, Constituency, External Branch, TESCON · Easily deselect levels for wings
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLevelsActive ? (
                          <Badge className="bg-sky-600 text-white text-xs">
                            {selectedLevels.length === 4
                              ? `Active: 4/5 Tiers (${excludedLevelLabel} deselected)`
                              : `Active: ${selectedLevels.length}/5 Tiers Active`}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Dormant: All 5 Tiers Included
                          </Badge>
                        )}
                        {openAccordions.levels ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {openAccordions.levels && (
                      <div className="px-4 pb-4 pt-1 border-t border-sky-100 dark:border-sky-950 space-y-3.5">
                        {/* Presets Bar */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-xs font-medium text-muted-foreground mr-1">Tier Presets:</span>
                          <Button
                            type="button"
                            variant={selectedLevels.length === ALL_CUSTOMIZABLE_LEVELS.length ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyLevelPreset("all_levels")}
                          >
                            All Levels (5)
                          </Button>
                          <Button
                            type="button"
                            variant={selectedLevels.length === 1 && selectedLevels.includes("Regional") ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyLevelPreset("regional_only")}
                          >
                            Regional Only
                          </Button>
                          <Button
                            type="button"
                            variant={selectedLevels.length === 1 && selectedLevels.includes("Constituency") ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyLevelPreset("constituency_only")}
                          >
                            Constituency Only
                          </Button>
                          <Button
                            type="button"
                            variant={selectedLevels.length === 1 && selectedLevels.includes("External Branch") ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyLevelPreset("branches_only")}
                          >
                            External Branches Only
                          </Button>
                          <Button
                            type="button"
                            variant={selectedLevels.length === 1 && selectedLevels.includes("TESCON") ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyLevelPreset("tescon_only")}
                          >
                            TESCON Only
                          </Button>
                          <Button
                            type="button"
                            variant={selectedLevels.length === 2 && selectedLevels.includes("Regional") && selectedLevels.includes("Constituency") ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => applyLevelPreset("core_executives")}
                          >
                            Regional + Constituency
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground ml-auto"
                            onClick={selectAllLevels}
                          >
                            Select All Levels
                          </Button>
                        </div>

                        {/* Level Checkbox Pills */}
                        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 pt-1">
                          {ALL_CUSTOMIZABLE_LEVELS.map((lvl) => {
                            const isChecked = selectedLevels.includes(lvl.id);
                            return (
                              <button
                                key={lvl.id}
                                type="button"
                                onClick={() => toggleLevel(lvl.id)}
                                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all select-none ${
                                  isChecked
                                    ? "bg-white dark:bg-slate-900 border-sky-400 dark:border-sky-600 shadow-2xs text-sky-950 dark:text-sky-100 font-medium ring-1 ring-sky-400/20"
                                    : "bg-muted/20 border-border/60 text-muted-foreground hover:bg-muted/40 opacity-70"
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {isChecked ? (
                                    <CheckSquare className="size-4 text-sky-600 dark:text-sky-400" />
                                  ) : (
                                    <Square className="size-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="space-y-0.5 leading-tight">
                                  <span className="font-semibold block text-xs">{lvl.shortLabel}</span>
                                  <span className="text-[11px] text-muted-foreground block line-clamp-2">{lvl.description}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Native Select for level compatibility */}
                        <div className="pt-2 border-t flex flex-wrap items-center gap-3">
                          <label htmlFor="level" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                            <span>Administrative Level Filter:</span>
                          </label>
                          <NativeSelect
                            id="level"
                            value={level}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLevel(val);
                              if (val === "all") {
                                setSelectedLevels(ALL_CUSTOMIZABLE_LEVELS.map((l) => l.id));
                              } else if (val !== "custom") {
                                setSelectedLevels([val]);
                              }
                              setPage(1);
                            }}
                            className="w-80 text-xs"
                          >
                            <option value="all">All Levels (National, Regional, Constituency, External, TESCON)</option>
                            {level === "custom" && (
                              <option value="custom">Custom Levels ({selectedLevels.length} Tiers Selected)</option>
                            )}
                            <option value="Regional">Regional Level Only (16 Regions)</option>
                            <option value="Constituency">Constituency Level Only (276 Constituencies)</option>
                            <option value="External Branch">External Branches Only (Diaspora)</option>
                            <option value="TESCON">TESCON Only (Campus Institutions)</option>
                            <option value="National">National Level Only (Council & Executives)</option>
                          </NativeSelect>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Accordion 4: Album Edition & Certification (Provisional vs Final) */}
                  <div className={`rounded-xl border transition-all ${openAccordions.edition ? "border-emerald-300 dark:border-emerald-900/70 bg-card shadow-2xs" : "border-border/60 bg-muted/20"}`}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion("edition")}
                      className="w-full flex items-center justify-between p-3.5 text-left select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                          4
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Album Edition & Official Certification
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Toggle between the Provisional publication and the Official Final Certified Album
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditionActive ? (
                          <Badge className="bg-emerald-600 text-white text-xs gap-1">
                            <CheckCircle2 className="size-3" /> Active: Official Final Certified Album
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Dormant: Provisional Working Register
                          </Badge>
                        )}
                        {openAccordions.edition ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {openAccordions.edition && (
                      <div className="px-4 pb-4 pt-1 border-t border-emerald-100 dark:border-emerald-950 space-y-3.5">
                        <p className="text-xs text-muted-foreground pt-1">
                          Select the publication grade. The Final Certified Edition replaces draft notices and provisional watermarks with the Presidential Elections Committee Official Golden/Emerald Seal, formal legal promulgation proclamation, and certified register insignia.
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2 pt-1">
                          {/* Option 1: Provisional */}
                          <div
                            onClick={() => {
                              setAlbumType("provisional");
                              setPage(1);
                            }}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                              albumType === "provisional"
                                ? "border-slate-500 bg-white dark:bg-slate-900 shadow-2xs ring-2 ring-slate-400/20 text-foreground"
                                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs tracking-tight text-foreground">
                                Provisional Register & Album
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                DRAFT / WORKING REGISTER
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              Includes PROVISIONAL diagonal watermarks across all photo pages and cover, statutory notice for delegate vetting, claims &amp; objections, and provisional verification badge.
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                {albumType === "provisional" ? "✓ Currently Active" : "Click to select"}
                              </span>
                              <Button
                                type="button"
                                variant={albumType === "provisional" ? "default" : "outline"}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAlbumType("provisional");
                                  setPage(1);
                                }}
                              >
                                {albumType === "provisional" ? "Active (Provisional)" : "Switch to Provisional"}
                              </Button>
                            </div>
                          </div>

                          {/* Option 2: Final Certified */}
                          <div
                            onClick={() => {
                              setAlbumType("final");
                              setPage(1);
                            }}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                              albumType === "final"
                                ? "border-emerald-500 bg-white dark:bg-slate-900 shadow-2xs ring-2 ring-emerald-500/20 text-foreground"
                                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs tracking-tight text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                                <ShieldCheck className="size-4 text-emerald-600" />
                                Official Final Certified Album
                              </span>
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                CERTIFIED & PROMULGATED
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              Features the Official Presidential Elections Committee Certified Seal, statutory promulgation proclamation, official final verified register badge, and <strong>no provisional watermarks</strong>.
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                {albumType === "final" ? "✓ Currently Active (Certified)" : "Click to promulgate"}
                              </span>
                              <Button
                                type="button"
                                variant={albumType === "final" ? "default" : "outline"}
                                size="sm"
                                className={`h-7 text-xs ${albumType === "final" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAlbumType("final");
                                  setPage(1);
                                }}
                              >
                                {albumType === "final" ? "Active (Final Certified)" : "Promulgate Final Certified"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Accordion 5: Gender Roll Filter */}
                  <div className={`rounded-xl border transition-all ${openAccordions.gender ? "border-purple-300 dark:border-purple-900/70 bg-card shadow-2xs" : "border-border/60 bg-muted/20"}`}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion("gender")}
                      className="w-full flex items-center justify-between p-3.5 text-left select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-semibold text-xs">
                          5
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Gender Roll Filter
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Universal gender extraction across all administrative tiers or contest portfolios
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isGenderActive ? (
                          <Badge className="bg-purple-600 text-white text-xs">
                            {gender === "male" ? "Active: Men Only (5,606)" : "Active: Women Only (1,390)"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Dormant: All Genders (Men & Women)
                          </Badge>
                        )}
                        {openAccordions.gender ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {openAccordions.gender && (
                      <div className="px-4 pb-4 pt-1 border-t border-purple-100 dark:border-purple-950 space-y-3.5">
                        <div className="grid gap-2.5 sm:grid-cols-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setGender("all");
                              setPage(1);
                            }}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              gender === "all"
                                ? "border-purple-500 bg-white dark:bg-slate-900 shadow-2xs ring-1 ring-purple-500/20 text-foreground font-semibold"
                                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <span className="block text-xs">All Genders (Men & Women)</span>
                            <span className="text-[11px] font-normal text-muted-foreground block mt-0.5">
                              Complete composite college roll
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setGender("male");
                              setPage(1);
                            }}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              gender === "male"
                                ? "border-purple-500 bg-white dark:bg-slate-900 shadow-2xs ring-1 ring-purple-500/20 text-foreground font-semibold"
                                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <span className="block text-xs">Men Only (All Eligible Men)</span>
                            <span className="text-[11px] font-normal text-muted-foreground block mt-0.5">
                              Male roll benchmark: 5,606 voters
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setGender("female");
                              setPage(1);
                            }}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              gender === "female"
                                ? "border-purple-500 bg-white dark:bg-slate-900 shadow-2xs ring-1 ring-purple-500/20 text-foreground font-semibold"
                                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                            }`}
                          >
                            <span className="block text-xs">Women Only (All Eligible Women)</span>
                            <span className="text-[11px] font-normal text-muted-foreground block mt-0.5">
                              Female roll benchmark: 1,390 voters
                            </span>
                          </button>
                        </div>

                        {/* Native Select for gender filter compatibility */}
                        <div className="pt-2 border-t flex flex-wrap items-center gap-3">
                          <label htmlFor="gender" className="text-xs font-semibold text-muted-foreground">
                            Gender Filter:
                          </label>
                          <NativeSelect
                            id="gender"
                            value={gender}
                            onChange={(e) => {
                              setGender(e.target.value as "all" | "male" | "female");
                              setPage(1);
                            }}
                            className="w-72 text-xs"
                          >
                            <option value="all">All Genders (Men & Women)</option>
                            <option value="male">Men Only (All Eligible Men)</option>
                            <option value="female">Women Only (All Eligible Women)</option>
                          </NativeSelect>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Accordion 6: Voter Profile Details (9 Card Fields) */}
                  <div className={`rounded-xl border transition-all ${openAccordions.details ? "border-indigo-300 dark:border-indigo-900/70 bg-card shadow-2xs" : "border-border/60 bg-muted/20"}`}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion("details")}
                      className="w-full flex items-center justify-between p-3.5 text-left select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-semibold text-xs">
                          6
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">
                            Voter Profile Details (9 Card Fields)
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Select which demographic, accreditation, and directory fields appear on photo cards
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDetailsActive ? (
                          <Badge className="bg-indigo-600 text-white text-xs">
                            Active: {selectedDetails.length}/9 Details Displayed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Dormant: Standard 7 Fields
                          </Badge>
                        )}
                        {openAccordions.details ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {openAccordions.details && (
                      <div className="px-4 pb-4 pt-1 border-t border-indigo-100 dark:border-indigo-950 space-y-3.5">
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-xs font-medium text-muted-foreground mr-1">Presets:</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => applyDetailPreset("default_standard")}
                          >
                            Default (Standard)
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => applyDetailPreset("id_verification")}
                          >
                            ID Verification
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => applyDetailPreset("photo_badge")}
                          >
                            Accreditation Badge
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => applyDetailPreset("contact_directory")}
                          >
                            Contact Directory
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => applyDetailPreset("full_profile")}
                          >
                            Full Profile (All 9)
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground ml-auto"
                            onClick={selectAllDetails}
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                            onClick={clearAllDetails}
                          >
                            Clear All
                          </Button>
                        </div>

                        {/* Detail Checkbox Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                          {ALL_VOTER_DETAILS.map((detail) => {
                            const isSelected = selectedDetails.includes(detail.id);
                            return (
                              <button
                                key={detail.id}
                                type="button"
                                onClick={() => toggleDetail(detail.id)}
                                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                                  isSelected
                                    ? "border-indigo-500 bg-white dark:bg-slate-900 shadow-2xs text-foreground ring-1 ring-indigo-500/20"
                                    : "border-border/70 bg-card/40 text-muted-foreground hover:bg-muted/50 opacity-70"
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {isSelected ? (
                                    <CheckSquare className="size-4 text-indigo-600 dark:text-indigo-400" />
                                  ) : (
                                    <Square className="size-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-xs font-semibold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                                      {detail.label}
                                    </span>
                                    {detail.isStandard ? (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/40 font-normal">Standard</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 font-normal">Extended</Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{detail.description}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}


        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
          {[
            {
              label: "Confirmed voters",
              value: metrics?.actualFigures.toLocaleString(),
              detail: metrics
                ? metrics.positionNational?.isRegionalSubset
                  ? `${metrics.expectedFigures.toLocaleString()} active target · Position Benchmark: ${metrics.positionNational.confirmedTotal.toLocaleString()} / ${metrics.positionNational.statutoryBenchmark.toLocaleString()} (${metrics.positionNational.complianceRate})`
                  : `${metrics.expectedFigures.toLocaleString()} expected · ${metrics.complianceRate} coverage`
                : "Current electorate",
              icon: Users,
            },
            { label: "Quorum threshold", value: metrics?.quorumRequirement.toLocaleString(), detail: "Two-thirds of confirmed voters", icon: ShieldCheck },
            { label: "Voter IDs recorded", value: metrics?.biometricVerification.verified.toLocaleString(), detail: metrics ? `${metrics.biometricVerification.pending.toLocaleString()} IDs pending` : "Identification coverage", icon: FileText },
            { label: "Album scope", value: selectedRegions.length === ALL_JURISDICTION_IDS.length ? (region === "all" ? "Nationwide" : region) : `${selectedRegions.length} Jurisdictions`, detail: `${albumType === "final" ? "Final certified" : "Provisional draft"} · ${selectedLevels.length}/5 tiers`, icon: Table2 },
          ].map(({ label, value, detail, icon: Icon }) => <Card key={label}><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardDescription>{label}</CardDescription><Icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold tracking-tight">{value ?? "—"}</div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="preview" className="gap-2"><FileText className="size-4" /> Album preview</TabsTrigger>
              <TabsTrigger value="register" className="gap-2"><Table2 className="size-4" /> Voter register {data && <Badge variant="secondary">{delegates.length.toLocaleString()}</Badge>}</TabsTrigger>
              <TabsTrigger value="stats" className="gap-2"><Building2 className="size-4" /> Constituency statistics {allConstituencyAudit.length > 0 && <Badge variant="secondary">{allConstituencyAudit.length.toLocaleString()}</Badge>}</TabsTrigger>
            </TabsList>
            {data && <span className="text-xs text-muted-foreground">Generated {new Date(data.generatedAt).toLocaleString()}</span>}
          </div>
          {loading ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 pt-6" role="status"><LoaderCircle className="size-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Preparing your electoral roll…</p></CardContent></Card>
            : error ? <Card><CardContent className="space-y-3 pt-6" role="alert"><p className="font-medium">Album could not be loaded</p><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button></CardContent></Card>
            : <>
              <TabsContent value="preview" forceMount className="data-[state=inactive]:hidden">
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-col justify-between gap-4 border-b lg:flex-row lg:items-center">
                    <div className="space-y-1.5"><CardTitle>{displayContestTitle} {isWingContest && effectiveScope === "organisers_only" ? "directory" : "election roll"}</CardTitle><CardDescription>{albumType === "final" ? "Official Final Certified Publication · A4 portrait" : "Provisional publication · A4 portrait"}</CardDescription></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="icon" aria-label="Zoom out" disabled={zoom === 50} onClick={() => setZoom((z) => Math.max(50, z - 10))}><Minus /></Button>
                      <Button variant="ghost" className="w-16 tabular-nums" aria-label="Reset zoom to 100 percent" onClick={() => setZoom(100)}>{zoom}%</Button>
                      <Button variant="outline" size="icon" aria-label="Zoom in" disabled={zoom === 150} onClick={() => setZoom((z) => Math.min(150, z + 10))}><Plus /></Button>
                      <Button asChild variant="outline"><a href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open album</a></Button>
                      <Button asChild variant="outline">
                        <a href={excelDownloadUrl} download={`NPP_${safeContestFilename}_${region}_Voter_Directory_2026.xlsx`}>
                          <Download /> Download Excel (.xlsx)
                        </a>
                      </Button>
                      <Button asChild variant="outline"><a href={`${previewUrl}&download=1`} download={`NPP_${safeContestFilename}_${region}_Album_2026.html`}><Download /> Download HTML (WebP)</a></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-auto bg-muted/30 p-4 sm:p-6">
                    {previewFailure === previewUrl && <div role="alert" className="mb-4 space-y-2"><p>The album or its images could not be loaded. Reload before printing.</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Reload album</Button></div>}
                    {delegates.length ? <iframe key={previewUrl} ref={iframe} title={`${displayContestTitle} election album preview`} src={previewUrl} onLoad={(event) => void handlePreviewLoad(event.currentTarget)} className="mx-auto h-[800px] min-w-[320px] border bg-white shadow-sm" style={{ width: `${zoom}%` }} /> : <div className="py-24 text-center text-sm text-muted-foreground">{isCustom && selectedPositions.length === 0 ? "No positions currently selected. Please check positions above to compile your custom album." : "No eligible delegates in this selection. Choose another portfolio, positions, or region."}</div>}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="register">
                <Card>
                  <CardHeader><CardTitle>Voter register</CardTitle><CardDescription>Review delegate records before publishing your album.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search delegates" placeholder="Search name, voter ID, position…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <NativeSelect
                          aria-label="Filter by administrative level"
                          className="sm:w-48"
                          value={level}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLevel(val);
                            if (val === "all") {
                              setSelectedLevels(ALL_CUSTOMIZABLE_LEVELS.map((l) => l.id));
                            } else if (val !== "custom") {
                              setSelectedLevels([val]);
                            }
                            setPage(1);
                          }}
                        >
                          <option value="all">All levels</option>
                          {level === "custom" && (
                            <option value="custom">Custom Levels ({selectedLevels.length})</option>
                          )}
                          {["National", "Regional", "External Branch", "Constituency", "TESCON"].map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </NativeSelect>
                        <Button asChild variant="outline" size="sm">
                          <a href={excelDownloadUrl} download={`NPP_${safeContestFilename}_${region}_Voter_Directory_2026.xlsx`}>
                            <Download className="size-4" /> Export Excel (.xlsx)
                          </a>
                        </Button>
                      </div>
                    </div>

                    {metrics && <div className="flex flex-wrap gap-2">{Object.entries(metrics.levelBreakdown).map(([name, count]) => <Badge key={name} variant="outline">{name}: {count.toLocaleString()}</Badge>)}</div>}
                    <div className="rounded-md border"><Table><TableHeader><TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Delegate</TableHead>
                      {selectedDetails.includes("level") && <TableHead>Level</TableHead>}
                      <TableHead>Constituency / Region</TableHead>
                      {selectedDetails.includes("position") && <TableHead>Position</TableHead>}
                      {selectedDetails.includes("voter_id") && <TableHead>Voter ID</TableHead>}
                      {selectedDetails.includes("phone") && <TableHead>Phone</TableHead>}
                      {selectedDetails.includes("demographics") && <TableHead>Demographics</TableHead>}
                    </TableRow></TableHeader><TableBody>
                      {rows.length === 0 ? <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No delegates match your filters.</TableCell></TableRow> : rows.map((d, i) => <TableRow key={d.id}>
                        <TableCell className="text-muted-foreground">{(currentPage - 1) * 50 + i + 1}</TableCell>
                        <TableCell>
                          <div className="flex min-w-48 items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarImage
                                src={selectedDetails.includes("photo") ? (d.image_url || d.avatar_svg) : d.avatar_svg}
                                alt=""
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-muted text-xs">
                                {d.executive_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {selectedDetails.includes("name") ? d.executive_name : <span className="text-xs font-mono text-muted-foreground">[Name Hidden]</span>}
                            </span>
                          </div>
                        </TableCell>
                        {selectedDetails.includes("level") && <TableCell><Badge variant="secondary">{d.executive_level}</Badge></TableCell>}
                        <TableCell>{[d.constituency, d.region].filter(Boolean).join(" / ")}</TableCell>
                        {selectedDetails.includes("position") && <TableCell>{d.canonical_position || (d as any).position}</TableCell>}
                        {selectedDetails.includes("voter_id") && <TableCell className="whitespace-nowrap font-mono text-xs">{d.voter_id || "—"}</TableCell>}
                        {selectedDetails.includes("phone") && <TableCell className="whitespace-nowrap">{d.phone || "—"}</TableCell>}
                        {selectedDetails.includes("demographics") && <TableCell className="whitespace-nowrap">{d.gender || "—"} · {d.age == null ? "Age unknown" : `${d.age} yrs`}</TableCell>}
                      </TableRow>)}
                    </TableBody></Table></div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>{filtered.length ? (currentPage - 1) * 50 + 1 : 0}–{Math.min(currentPage * 50, filtered.length)} of {filtered.length.toLocaleString()} delegates</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="px-2 text-xs">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="stats">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle>Constituency statutory audit &amp; compliance</CardTitle>
                        <CardDescription>
                          Audit individual constituencies against statutory quotas (Target: 19 per Constituency [11 Elected + 8 Appointed] · Regional: 21 per Region)
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300">
                          <a href="/api/admin/albums/audit-statistics/export" download="NPP_Regional_and_Wings_Statutory_Audit_Statistics_2026.xlsx">
                            <Table2 className="size-4 mr-1.5" /> All Regional &amp; Wings Audit Stats (.xlsx)
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <a href={excelDownloadUrl} download={`NPP_${safeContestFilename}_${region}_Voter_Directory_2026.xlsx`}>
                            <Download className="size-4 mr-1.5" /> Export Current Scope (.xlsx)
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Top Stat KPI Cards */}
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-3.5 border-blue-200 dark:border-blue-800">
                        <div className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">Constituency Quota</div>
                        <div className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{metrics?.constituencyQuota ?? 19}</div>
                        <p className="mt-0.5 text-xs text-blue-700/80 dark:text-blue-400">11 Elected + 8 Appointed per constituency</p>
                      </div>
                      <div className="rounded-lg border bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 border-indigo-200 dark:border-indigo-800">
                        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Regional Quota</div>
                        <div className="mt-1 text-2xl font-bold text-indigo-950 dark:text-indigo-100">{metrics?.regionalQuota ?? 21}</div>
                        <p className="mt-0.5 text-xs text-indigo-700/80 dark:text-indigo-400">Statutory executives per region</p>
                      </div>
                      <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-3.5 border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Constituencies Tracked</div>
                        <div className="mt-1 text-2xl font-bold text-foreground">{allConstituencyAudit.length}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground">In active scope ({region === "all" ? "Nationwide" : region})</p>
                      </div>
                      <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 border-emerald-200 dark:border-emerald-800">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Full Compliance</div>
                        <div className="mt-1 text-2xl font-bold text-emerald-950 dark:text-emerald-100">
                          {allConstituencyAudit.filter((c) => c.status === "Compliant").length} / {allConstituencyAudit.length}
                        </div>
                        <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400">
                          {allConstituencyAudit.length
                            ? `${Math.round((allConstituencyAudit.filter((c) => c.status === "Compliant").length / allConstituencyAudit.length) * 100)}% compliance rate`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative w-full sm:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                          aria-label="Search constituency"
                          placeholder="Search constituency name or region…"
                          className="pl-9 text-xs"
                          value={constituencySearch}
                          onChange={(e) => {
                            setConstituencySearch(e.target.value);
                            setConstituencyPage(1);
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {region === "all" && (
                          <NativeSelect
                            aria-label="Filter by region"
                            className="sm:w-44 text-xs"
                            value={constituencyRegionFilter}
                            onChange={(e) => {
                              setConstituencyRegionFilter(e.target.value);
                              setConstituencyPage(1);
                            }}
                          >
                            <option value="all">All 16 regions</option>
                            {REGION_OPTIONS.filter((r) => r.value !== "all").map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </NativeSelect>
                        )}
                        <NativeSelect
                          aria-label="Filter by compliance status"
                          className="sm:w-36 text-xs"
                          value={constituencyStatusFilter}
                          onChange={(e) => {
                            setConstituencyStatusFilter(e.target.value);
                            setConstituencyPage(1);
                          }}
                        >
                          <option value="all">All statuses</option>
                          <option value="Compliant">Compliant (100%)</option>
                          <option value="Under Quota">Under Quota</option>
                          <option value="Over Quota">Over Quota</option>
                        </NativeSelect>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead>Constituency</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead className="text-center">Total Confirmed</TableHead>
                            <TableHead className="text-center">Elected (x/11)</TableHead>
                            <TableHead className="text-center">Appointed (x/8)</TableHead>
                            <TableHead className="text-center">Statutory Quota</TableHead>
                            <TableHead className="text-center">Variance</TableHead>
                            <TableHead className="text-center">Compliance Rate</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedConstituencies.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                                No constituencies match your search or filter.
                              </TableCell>
                            </TableRow>
                          ) : (
                            pagedConstituencies.map((c, i) => (
                              <TableRow key={`${c.region}-${c.constituency}`}>
                                <TableCell className="text-center text-muted-foreground text-xs">
                                  {(currentConstituencyPage - 1) * 50 + i + 1}
                                </TableCell>
                                <TableCell className="font-semibold text-foreground text-xs">
                                  {c.constituency}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">{c.region}</TableCell>
                                <TableCell className="text-center font-semibold text-xs">{c.confirmed}</TableCell>
                                <TableCell className="text-center text-xs">
                                  <span className={c.confirmedElected !== undefined && c.confirmedElected < (c.targetElected ?? 11) ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-700 dark:text-emerald-400 font-semibold"}>
                                    {c.confirmedElected ?? "—"} / {c.targetElected ?? 11}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center text-xs">
                                  <span className={c.confirmedAppointed !== undefined && c.confirmedAppointed < (c.targetAppointed ?? 8) ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-700 dark:text-emerald-400 font-semibold"}>
                                    {c.confirmedAppointed ?? "—"} / {c.targetAppointed ?? 8}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center text-xs">{c.target}</TableCell>
                                <TableCell className="text-center text-xs">
                                  <span className={c.variance > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}>
                                    {c.variance > 0 ? `-${c.variance}` : c.variance < 0 ? `+${Math.abs(c.variance)}` : "0"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs">{c.complianceRate}</TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant={
                                      c.status === "Compliant"
                                        ? "outline"
                                        : c.status === "Under Quota"
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className={
                                      c.status === "Compliant"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[11px]"
                                        : c.status === "Under Quota"
                                        ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-[11px]"
                                        : "text-[11px]"
                                    }
                                  >
                                    {c.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                      <p>
                        {filteredConstituencies.length ? (currentConstituencyPage - 1) * 50 + 1 : 0}–
                        {Math.min(currentConstituencyPage * 50, filteredConstituencies.length)} of{" "}
                        {filteredConstituencies.length.toLocaleString()} constituencies
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentConstituencyPage === 1}
                          onClick={() => setConstituencyPage(currentConstituencyPage - 1)}
                        >
                          Previous
                        </Button>
                        <span className="px-2 text-xs">
                          Page {currentConstituencyPage} of {totalConstituencyPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentConstituencyPage === totalConstituencyPages}
                          onClick={() => setConstituencyPage(currentConstituencyPage + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>}
        </Tabs>
      </div>
    </AdminShell>
  );
}
