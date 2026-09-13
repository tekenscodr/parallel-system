"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, LoaderCircle, Minus, Plus, Printer, Search, ShieldCheck, Table2, Users } from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { useAlbumUser } from "./session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/native-select";
import { CONTEST_LIST, type ContestType } from "@/lib/election-contests";

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
    actualFigures: number; expectedFigures: number; complianceRate: string;
    quorumRequirement: number; levelBreakdown: Record<string, number>;
    biometricVerification: { verified: number; pending: number; verificationRate: string };
  };
};

export default function PositionAlbumsPage() {
  const currentUser = useAlbumUser();
  const [contest, setContest] = useState<ContestType>("Youth Organiser");
  const [region, setRegion] = useState("all");
  const [tab, setTab] = useState("preview");
  const [zoom, setZoom] = useState(100);
  const [result, setResult] = useState<{ key: string; data: AlbumData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);
  const [previewReady, setPreviewReady] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null);
  const query = `position=${encodeURIComponent(contest)}&region=${encodeURIComponent(region)}`;
  const requestKey = `${query}&revision=${retry}`;
  const previewUrl = `/api/admin/albums/election?${requestKey}&format=html`;
  const data = result?.key === requestKey ? result.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !data && !error;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/albums/election?${requestKey}&format=json`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
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
    link.download = `NPP_${contest.replaceAll(" ", "_")}_${region}_Electorate_2026.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <AdminShell title="Election albums" subtitle="Prepare and manage the provisional electoral roll" currentUser={currentUser}>
      <div className="album-ui space-y-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="space-y-2">
            <Badge variant="outline" className="gap-1.5"><ShieldCheck className="size-3.5" /> National administrator</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">Election albums <span className="text-muted-foreground">/ 2026</span></h1>
            <p className="text-sm text-muted-foreground">Select a portfolio and region to preview, review, and export your album.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!data} onClick={exportJson}><Download /> Export JSON</Button>
            <Button disabled={!data || !delegates.length || tab !== "preview" || previewReady !== previewUrl} onClick={() => iframe.current?.contentWindow?.print()}><Printer /> Print / Save PDF</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Album configuration</CardTitle><CardDescription>Choose the electorate included in this publication.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
            <div className="space-y-2"><label htmlFor="contest" className="text-sm font-medium">Elective portfolio</label>
              <NativeSelect id="contest" value={contest} onChange={(e) => { setContest(e.target.value as ContestType); setPage(1); }}>
                {CONTEST_LIST.map((item) => <option key={item}>{item}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2"><label htmlFor="region" className="text-sm font-medium">Region</label>
              <NativeSelect id="region" value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}>
                {REGION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </NativeSelect>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">National → Regional → Constituency → TESCON<br />TESCON patrons excluded</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
          {[
            { label: "Confirmed voters", value: metrics?.actualFigures.toLocaleString(), detail: metrics ? `${metrics.expectedFigures.toLocaleString()} expected · ${metrics.complianceRate} coverage` : "Current electorate", icon: Users },
            { label: "Quorum threshold", value: metrics?.quorumRequirement.toLocaleString(), detail: "Two-thirds of confirmed voters", icon: ShieldCheck },
            { label: "Voter IDs recorded", value: metrics?.biometricVerification.verified.toLocaleString(), detail: metrics ? `${metrics.biometricVerification.pending.toLocaleString()} IDs pending` : "Identification coverage", icon: FileText },
            { label: "Album scope", value: region === "all" ? "Nationwide" : region, detail: "National, regional, constituency & TESCON", icon: Table2 },
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
              <TabsContent value="preview">
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-col justify-between gap-4 border-b lg:flex-row lg:items-center">
                    <div className="space-y-1.5"><CardTitle>{contest} election roll</CardTitle><CardDescription>Provisional publication · A4 portrait</CardDescription></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="icon" aria-label="Zoom out" disabled={zoom === 50} onClick={() => setZoom((z) => Math.max(50, z - 10))}><Minus /></Button>
                      <Button variant="ghost" className="w-16 tabular-nums" aria-label="Reset zoom to 100 percent" onClick={() => setZoom(100)}>{zoom}%</Button>
                      <Button variant="outline" size="icon" aria-label="Zoom in" disabled={zoom === 150} onClick={() => setZoom((z) => Math.min(150, z + 10))}><Plus /></Button>
                      <Button asChild variant="outline"><a href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open album</a></Button>
                      <Button asChild variant="outline"><a href={`${previewUrl}&download=1`} download={`NPP_${contest.replaceAll(" ", "_")}_${region}_Album_2026.html`}><Download /> Download HTML (WebP)</a></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-auto bg-muted/30 p-4 sm:p-6">
                    {delegates.length ? <iframe key={previewUrl} ref={iframe} title={`${contest} election album preview`} src={previewUrl} onLoad={() => setPreviewReady(previewUrl)} className="mx-auto h-[800px] min-w-[320px] border bg-white shadow-sm" style={{ width: `${zoom}%` }} /> : <div className="py-24 text-center text-sm text-muted-foreground">No eligible delegates in this selection. Choose another portfolio or region.</div>}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="register">
                <Card>
                  <CardHeader><CardTitle>Voter register</CardTitle><CardDescription>Review delegate records before publishing your album.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search delegates" placeholder="Search name, voter ID, position…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
                      <NativeSelect aria-label="Filter by administrative level" className="sm:w-48" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}><option value="all">All levels</option>{["National", "Regional", "Constituency", "TESCON"].map((item) => <option key={item}>{item}</option>)}</NativeSelect>
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
