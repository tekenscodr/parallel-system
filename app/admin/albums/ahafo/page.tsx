"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, FileText, LoaderCircle, Minus, Plus, Printer, RefreshCw, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { useAlbumUser } from "../session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ALBUM_SECTIONS = [
  { label: "Cover & Certification", page: 1, type: "cover" },
  { label: "Ahafo Regional Executives (1-Sided)", page: 2, type: "regional" },
  { label: "Asunafo North (P1)", page: 3, type: "constituency" },
  { label: "Asunafo North (P2)", page: 4, type: "constituency" },
  { label: "Asunafo South (P1)", page: 5, type: "constituency" },
  { label: "Asunafo South (P2)", page: 6, type: "constituency" },
  { label: "Asutifi North (P1)", page: 7, type: "constituency" },
  { label: "Asutifi North (P2)", page: 8, type: "constituency" },
  { label: "Asutifi South (P1)", page: 9, type: "constituency" },
  { label: "Asutifi South (P2)", page: 10, type: "constituency" },
  { label: "Tano North (P1)", page: 11, type: "constituency" },
  { label: "Tano North (P2)", page: 12, type: "constituency" },
  { label: "Tano South (P1)", page: 13, type: "constituency" },
  { label: "Tano South (P2)", page: 14, type: "constituency" },
  { label: "Ahafo TESCON (1-Sided)", page: 15, type: "tescon" },
];

export default function AhafoAlbumPage() {
  const currentUser = useAlbumUser();
  const [zoom, setZoom] = useState(100);
  const [version, setVersion] = useState(0);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [activePage, setActivePage] = useState(1);
  const iframe = useRef<HTMLIFrameElement>(null);
  const url = `/api/admin/albums/files/ahafo_election_album.html?v=${version}`;
  const loading = loadedVersion !== version;
  const goToPage = (page: number) => {
    setActivePage(page);
    const pages = iframe.current?.contentDocument?.querySelectorAll(".album-page");
    pages?.[page - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <AdminShell title="Ahafo regional album" subtitle="Regional electoral roll · 2026" currentUser={currentUser}>
    <div className="album-ui space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="space-y-2"><Badge variant="outline" className="gap-1.5"><ShieldCheck className="size-3.5" /> National administrator</Badge><h1 className="text-2xl font-semibold tracking-tight">Ahafo regional album</h1><p className="text-sm text-muted-foreground">Review the regional publication and download a copy for printing.</p></div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={`/api/admin/albums/files/NPP_Ahafo_Region_Election_Album_2026.pdf?v=${version}`} download><Download /> Download PDF</a></Button><Button disabled={loading} onClick={() => iframe.current?.contentWindow?.print()}><Printer /> Print album</Button></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="self-start"><CardHeader><CardTitle>Contents</CardTitle><CardDescription>15 pages · A4 portrait</CardDescription></CardHeader><CardContent className="space-y-1"><nav aria-label="Album contents">{ALBUM_SECTIONS.map((section) => <Button key={section.page} variant={activePage === section.page ? "secondary" : "ghost"} disabled={loading} className="h-auto w-full justify-start gap-3 px-2 py-2.5 text-left text-xs whitespace-normal" aria-current={activePage === section.page ? "page" : undefined} onClick={() => goToPage(section.page)}><span className="w-5 shrink-0 text-muted-foreground">{String(section.page).padStart(2, "0")}</span>{section.label}</Button>)}</nav></CardContent></Card>
        <Card className="min-w-0 overflow-hidden"><CardHeader className="gap-3 border-b"><div className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /><CardTitle>Publication preview</CardTitle></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="icon" aria-label="Zoom out" disabled={zoom === 50} onClick={() => setZoom(Math.max(50, zoom - 10))}><Minus /></Button><Button variant="ghost" aria-label="Reset zoom" onClick={() => setZoom(100)}>{zoom}%</Button><Button variant="outline" size="icon" aria-label="Zoom in" disabled={zoom === 150} onClick={() => setZoom(Math.min(150, zoom + 10))}><Plus /></Button><Button variant="outline" size="icon" aria-label="Reload album" onClick={() => setVersion((v) => v + 1)}><RefreshCw /></Button><Button asChild variant="outline"><a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Open album</a></Button><Button asChild variant="outline"><a href={url} download="NPP_Ahafo_Region_Election_Album_2026.html"><Download /> HTML</a></Button></div></CardHeader>
          <CardContent className="overflow-auto bg-muted/30 p-4">{loading && <div role="status" className="flex items-center gap-2 pb-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading publication…</div>}<iframe key={version} ref={iframe} src={url} title="Ahafo regional election album" onLoad={() => setLoadedVersion(version)} className="mx-auto h-[850px] min-w-[320px] border bg-white shadow-sm" style={{ width: `${zoom}%` }} /></CardContent>
        </Card>
      </div>
    </div>
  </AdminShell>;
}
