"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
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
  type ContestType,
  type CustomizablePosition,
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
type AlbumData = {
  delegates: Delegate[];
  generatedAt: string;
  metrics: {
    contest: string;
    actualFigures: number; expectedFigures: number; complianceRate: string;
    quorumRequirement: number; levelBreakdown: Record<string, number>;
    biometricVerification: { verified: number; pending: number; verificationRate: string };
  };
};

export default function PositionAlbumsPage() {
  const currentUser = useAlbumUser();
  const [contest, setContest] = useState<ContestType>("Youth Organisers & Deputies");
  const [region, setRegion] = useState("all");
  const [scope, setScope] = useState("organisers_only");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([
    "chairperson",
    "secretary",
    "organiser",
  ]);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [positionSearch, setPositionSearch] = useState("");
  const [tab, setTab] = useState("preview");
  const [zoom, setZoom] = useState(100);
  const [result, setResult] = useState<{ key: string; data: AlbumData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);
  const [previewReady, setPreviewReady] = useState("");
  const [previewFailure, setPreviewFailure] = useState("");
  const [printRequest, setPrintRequest] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null);

  const isCustom = contest === "Custom";
  const isWingContest =
    !isCustom &&
    (WING_PORTFOLIOS.includes(contest as any) ||
      contest === "Youth Organiser" ||
      contest === "Women Organiser" ||
      contest === "Nasara Organiser");

  const effectiveScope = WING_PORTFOLIOS.includes(contest as any) ? "organisers_only" : scope;
  const positionsQuery = isCustom ? `&positions=${encodeURIComponent(selectedPositions.join(","))}` : "";
  const query = `position=${encodeURIComponent(contest)}&region=${encodeURIComponent(region)}${effectiveScope === "organisers_only" ? "&scope=organisers_only" : ""}${positionsQuery}`;
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


  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/albums/election?${requestKey}&format=json`, { signal: controller.signal, cache: "no-store" })
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
  const filtered = delegates.filter((d) =>
    (level === "all" || d.executive_level === level) &&
    [d.executive_name, d.voter_id, d.constituency, d.region, d.canonical_position].some((value) =>
      String(value ?? "").toLowerCase().includes(search.trim().toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * 50, currentPage * 50);
  const metrics = data?.metrics;

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
            <Button asChild variant="outline" disabled={!data || !delegates.length}>
              <a href={excelDownloadUrl} download={`NPP_${safeContestFilename}_${region}_Voter_Directory_2026.xlsx`}>
                <Download className="size-4" /> Download Excel (.xlsx)
              </a>
            </Button>
            <Button variant="outline" disabled={!data} onClick={exportJson}><Download className="size-4" /> Export JSON</Button>
            <Button disabled={!data || !delegates.length || printRequest === previewUrl || previewFailure === previewUrl} onClick={handlePrintPdf}><Printer className="size-4" /> {printRequest === previewUrl && previewFailure !== previewUrl ? "Preparing images…" : "Print / Save PDF"}</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Album configuration</CardTitle>
                  {isCustom && (
                    <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                      <Sparkles className="size-3 text-blue-600" /> Customise Mode
                    </Badge>
                  )}
                </div>
                <CardDescription>Choose an elective portfolio, wing extraction, or select custom positions.</CardDescription>
              </div>
              <Button
                type="button"
                variant={isCustom ? "default" : "outline"}
                size="sm"
                className="gap-1.5 self-start sm:self-auto"
                onClick={() => {
                  if (!isCustom) {
                    setContest("Custom");
                    setCustomizerOpen(true);
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
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
              <div className="space-y-2">
                <label htmlFor="contest" className="text-sm font-medium">Elective portfolio / Mode</label>
                <NativeSelect
                  id="contest"
                  value={contest}
                  onChange={(e) => {
                    const val = e.target.value as ContestType;
                    setContest(val);
                    if (val === "Custom") {
                      setCustomizerOpen(true);
                    }
                    if (WING_PORTFOLIOS.includes(val as any)) {
                      setScope("organisers_only");
                    }
                    setPage(1);
                  }}
                >
                  <optgroup label="Custom Multi-Position Extraction">
                    <option value="Custom">✨ Custom Selection (Select Specific Positions…)</option>
                  </optgroup>
                  <optgroup label="Wing Organisers & Deputies (Exclusive Extraction)">
                    {WING_PORTFOLIOS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </optgroup>
                  <optgroup label="General Election Contests">
                    {GENERAL_CONTEST_LIST.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </optgroup>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <label htmlFor="region" className="text-sm font-medium">Region</label>
                <NativeSelect id="region" value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}>
                  {REGION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </NativeSelect>
              </div>
              {isWingContest ? (
                <div className="space-y-2">
                  <label htmlFor="scope" className="text-sm font-medium">Electorate filter</label>
                  <NativeSelect
                    id="scope"
                    value={effectiveScope}
                    onChange={(e) => {
                      setScope(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="organisers_only">Organisers & Deputies Only (Wing Executives)</option>
                    <option value="all_voters">Full Voting College (All Eligible Voters)</option>
                  </NativeSelect>
                </div>
              ) : isCustom ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Selected: {selectedPositions.length} position{selectedPositions.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    National → Regional → External Branch → Constituency → TESCON
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">National → Regional → External Branch → Constituency → TESCON<br />TESCON patrons excluded</p>
              )}
            </div>

            {/* Position Customizer Panel when in Custom mode */}
            {isCustom && (
              <div className="rounded-xl border bg-card p-4 shadow-xs space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <SlidersHorizontal className="size-4 text-blue-600" />
                      Select Positions Needed for Album
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Check any combination of positions below. The album, PDF, voter register, and Excel export will include only selected positions.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={selectAllPositions} className="h-7 text-xs">
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearAllPositions} className="h-7 text-xs text-muted-foreground">
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Quick Presets Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    Presets:
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyPreset("core_slate")}
                  >
                    Core Slate (Top 5)
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyPreset("key_officers")}
                  >
                    Key Officers (Top 10)
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyPreset("wings_only")}
                  >
                    Wing Executives
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyPreset("constituency_slate")}
                  >
                    Full Constituency (17)
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyPreset("deputies_only")}
                  >
                    Deputies Only
                  </Button>
                </div>

                {/* Position Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter positions by title (e.g., Chairperson, Secretary, Organiser, Nasara)..."
                    value={positionSearch}
                    onChange={(e) => setPositionSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                  {positionSearch && (
                    <button
                      type="button"
                      onClick={() => setPositionSearch("")}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {/* Selected Positions Summary Pills */}
                {selectedPositions.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-lg bg-muted/40 border border-muted">
                    <span className="text-xs font-semibold text-foreground mr-1">
                      Active ({selectedPositions.length}):
                    </span>
                    {selectedPositions.map((id) => {
                      const pos = ALL_CUSTOMIZABLE_POSITIONS.find((p) => p.id === id);
                      const label = pos ? pos.label.split(" / ")[0] : id;
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-white dark:bg-slate-800 border shadow-2xs hover:bg-slate-100"
                        >
                          <span>{label}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${label}`}
                            onClick={() => togglePosition(id)}
                            className="text-muted-foreground hover:text-destructive rounded-full p-0.5"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                    ⚠️ No positions currently selected. Please pick at least one position below to compile this album.
                  </div>
                )}

                {/* Categorized Positions Checkbox Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-1">
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
                        className="rounded-lg border bg-muted/20 p-3 space-y-2 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between border-b pb-1.5">
                          <span className="font-semibold text-xs tracking-tight text-foreground">
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
                        <div className="space-y-1.5">
                          {filteredPositions.map((pos) => {
                            const isChecked = selectedPositions.includes(pos.id);
                            return (
                              <label
                                key={pos.id}
                                className={`flex items-start gap-2.5 p-1.5 rounded-md cursor-pointer transition-colors text-xs select-none ${
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
          </CardContent>
        </Card>


        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
          {[
            { label: "Confirmed voters", value: metrics?.actualFigures.toLocaleString(), detail: metrics ? `${metrics.expectedFigures.toLocaleString()} expected · ${metrics.complianceRate} coverage` : "Current electorate", icon: Users },
            { label: "Quorum threshold", value: metrics?.quorumRequirement.toLocaleString(), detail: "Two-thirds of confirmed voters", icon: ShieldCheck },
            { label: "Voter IDs recorded", value: metrics?.biometricVerification.verified.toLocaleString(), detail: metrics ? `${metrics.biometricVerification.pending.toLocaleString()} IDs pending` : "Identification coverage", icon: FileText },
            { label: "Album scope", value: region === "all" ? "Nationwide" : region, detail: "National, regional, external, constituency & TESCON", icon: Table2 },
          ].map(({ label, value, detail, icon: Icon }) => <Card key={label}><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardDescription>{label}</CardDescription><Icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold tracking-tight">{value ?? "—"}</div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList><TabsTrigger value="preview" className="gap-2"><FileText className="size-4" /> Album preview</TabsTrigger><TabsTrigger value="register" className="gap-2"><Table2 className="size-4" /> Voter register {data && <Badge variant="secondary">{delegates.length.toLocaleString()}</Badge>}</TabsTrigger></TabsList>
            {data && <span className="text-xs text-muted-foreground">Generated {new Date(data.generatedAt).toLocaleString()}</span>}
          </div>
          {loading ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 pt-6" role="status"><LoaderCircle className="size-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Preparing your electoral roll…</p></CardContent></Card>
            : error ? <Card><CardContent className="space-y-3 pt-6" role="alert"><p className="font-medium">Album could not be loaded</p><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button></CardContent></Card>
            : <>
              <TabsContent value="preview" forceMount className="data-[state=inactive]:hidden">
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-col justify-between gap-4 border-b lg:flex-row lg:items-center">
                    <div className="space-y-1.5"><CardTitle>{displayContestTitle} {isWingContest && effectiveScope === "organisers_only" ? "directory" : "election roll"}</CardTitle><CardDescription>Provisional publication · A4 portrait</CardDescription></div>
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
                        <NativeSelect aria-label="Filter by administrative level" className="sm:w-48" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}><option value="all">All levels</option>{["National", "Regional", "External Branch", "Constituency", "TESCON"].map((item) => <option key={item}>{item}</option>)}</NativeSelect>
                        <Button asChild variant="outline" size="sm">
                          <a href={excelDownloadUrl} download={`NPP_${safeContestFilename}_${region}_Voter_Directory_2026.xlsx`}>
                            <Download className="size-4" /> Export Excel (.xlsx)
                          </a>
                        </Button>
                      </div>
                    </div>

                    {metrics && <div className="flex flex-wrap gap-2">{Object.entries(metrics.levelBreakdown).map(([name, count]) => <Badge key={name} variant="outline">{name}: {count.toLocaleString()}</Badge>)}</div>}
                    <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Delegate</TableHead><TableHead>Level</TableHead><TableHead>Constituency / Region</TableHead><TableHead>Position</TableHead><TableHead>Voter ID</TableHead><TableHead>Phone</TableHead><TableHead>Demographics</TableHead></TableRow></TableHeader><TableBody>
                      {rows.length === 0 ? <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No delegates match your filters.</TableCell></TableRow> : rows.map((d, i) => <TableRow key={d.id}>
                        <TableCell className="text-muted-foreground">{(currentPage - 1) * 50 + i + 1}</TableCell>
                        <TableCell><div className="flex min-w-48 items-center gap-3"><Avatar className="size-8"><AvatarImage src={d.image_url || d.avatar_svg} alt="" className="object-cover" /><AvatarFallback className="bg-muted text-xs">{d.executive_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</AvatarFallback></Avatar><span className="font-medium">{d.executive_name}</span></div></TableCell>
                        <TableCell><Badge variant="secondary">{d.executive_level}</Badge></TableCell><TableCell>{[d.constituency, d.region].filter(Boolean).join(" / ")}</TableCell><TableCell>{d.canonical_position}</TableCell><TableCell className="whitespace-nowrap font-mono text-xs">{d.voter_id || "—"}</TableCell><TableCell className="whitespace-nowrap">{d.phone || "—"}</TableCell><TableCell className="whitespace-nowrap">{d.gender || "—"} · {d.age == null ? "Age unknown" : `${d.age} yrs`}</TableCell>
                      </TableRow>)}
                    </TableBody></Table></div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>{filtered.length ? (currentPage - 1) * 50 + 1 : 0}–{Math.min(currentPage * 50, filtered.length)} of {filtered.length.toLocaleString()} delegates</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="px-2 text-xs">Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>}
        </Tabs>
      </div>
    </AdminShell>
  );
}
