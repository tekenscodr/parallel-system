"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Printer,
  ExternalLink,
  Download,
  ShieldCheck,
  ShieldAlert,
  Users,
  Building,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Sparkles,
  LoaderCircle,
  Table as TableIcon,
  Eye,
} from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";
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

export default function PositionAlbumsPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);

  const [selectedContest, setSelectedContest] = useState<ContestType>("Youth Organiser");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"preview" | "table">("preview");

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiData, setApiData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string>("");

  // Table search & filter
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  useEffect(() => {
    // Authenticate user
    fetch("/api/admin/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setFetchError("");
    setPage(1);

    const url = `/api/admin/albums/election?position=${encodeURIComponent(
      selectedContest
    )}&region=${encodeURIComponent(selectedRegion)}&format=json`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to fetch album data.");
        }
        return res.json();
      })
      .then((data) => {
        setApiData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setFetchError(err.message || "Unable to load electoral roll.");
        setIsLoading(false);
      });
  }, [selectedContest, selectedRegion]);

  const previewUrl = `/api/admin/albums/election?position=${encodeURIComponent(
    selectedContest
  )}&region=${encodeURIComponent(selectedRegion)}&format=html&v=${Date.now()}`;

  const handlePrint = () => {
    const iframe = document.getElementById("album-preview-iframe") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    } else {
      window.open(previewUrl, "_blank")?.print();
    }
  };

  const metrics = apiData?.metrics;
  const delegates = apiData?.delegates || [];

  const roleUpper = String(currentUser?.role || "").toUpperCase();
  const isSystemAdmin = roleUpper === "ADMIN_NATIONAL" || roleUpper === "ADMIN";

  // Filter delegates for table view
  const filteredDelegates = delegates.filter((d: any) => {
    const matchesSearch =
      !searchTerm ||
      d.executive_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.voter_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.constituency.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.canonical_position.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel =
      levelFilter === "all" || d.executive_level.toLowerCase() === levelFilter.toLowerCase();

    return matchesSearch && matchesLevel;
  });

  const totalTablePages = Math.max(1, Math.ceil(filteredDelegates.length / pageSize));
  const currentTableRows = filteredDelegates.slice((page - 1) * pageSize, page * pageSize);

  // If user is authenticated but not a System Admin, block access
  if (currentUser && !isSystemAdmin) {
    return (
      <AdminShell
        title="Election Album Generator · Restricted"
        subtitle="Confidential Electoral Roll"
        currentUser={currentUser}
      >
        <div className="max-w-md mx-auto my-20 p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Restricted to System Administrators</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            The Election Album Generator, voter directory, and PDF export tools are strictly classified and accessible only to authorized <strong>System Administrators</strong> (<code className="text-blue-400">ADMIN_NATIONAL</code>).
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-400 mb-6">
            Logged in as: <span className="text-slate-200 font-medium">{currentUser.email}</span>
            <br />
            Assigned Role: <span className="text-amber-400 font-bold">{currentUser.role}</span>
          </div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
          >
            Return to Executive Directory
          </Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Election Album Generator · 2026"
      subtitle="Generate, preview, and print certified Provisional Albums across National, Regional, Constituency, and TESCON levels"
      currentUser={currentUser}
    >
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 p-5 lg:p-6 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Provisional Electoral College Publication
              </div>
              <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                {selectedContest} Election Roll
              </h1>
              <p className="text-xs lg:text-sm text-slate-400 mt-0.5">
                Two-stage hierarchy (National &rarr; Regional &rarr; Constituency &rarr; TESCON) · Strictly excluding TESCON Patrons
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handlePrint}
                disabled={isLoading || !delegates.length}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print / Save as PDF
              </button>

              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Fullscreen Album
              </a>

              <a
                href={previewUrl}
                download={`NPP_${selectedContest.replace(/\s+/g, "_")}_Election_Album_2026.html`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/80 transition-colors"
                title="Download lightweight standalone album with compressed WebP images"
              >
                <Download className="w-4 h-4" />
                Download HTML (WebP)
              </a>

              <button
                onClick={() => {
                  if (!apiData) return;
                  const blob = new Blob([JSON.stringify(apiData, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `NPP_${selectedContest.replace(/\s+/g, "_")}_Electorate_2026.json`;
                  a.click();
                }}
                disabled={!apiData}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            </div>
          </div>

          {/* Position Selector Tabs */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Select Elective Portfolio
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {CONTEST_LIST.map((contest) => {
                const isActive = selectedContest === contest;
                return (
                  <button
                    key={contest}
                    onClick={() => setSelectedContest(contest)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/50"
                        : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60"
                    }`}
                  >
                    <span>{contest}</span>
                    {contest === "Youth Organiser" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Under 40 + Reps
                      </span>
                    )}
                    {contest === "Women Organiser" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        Females
                      </span>
                    )}
                    {contest === "Nasara Organiser" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Nasara Reps
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Region Scope Filter */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-400">Jurisdiction Scope:</span>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeTab === "preview" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Publication View
              </button>
              <button
                onClick={() => setActiveTab("table")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeTab === "table" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                Voter Register ({delegates.length})
              </button>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid (Expected vs Actual, Demographics, Quorum) */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirmed Voters</div>
              <div className="text-2xl font-black text-blue-400 mt-1">
                {metrics.actualFigures.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Expected: {metrics.expectedFigures.toLocaleString()} ({metrics.complianceRate})
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">2/3 Quorum Threshold</div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {metrics.quorumRequirement.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Statutory Article 17 requirement</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">National Level</div>
              <div className="text-2xl font-black text-indigo-400 mt-1">
                {metrics.levelBreakdown.National.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">HQ &amp; Council of Elders</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Regional Level</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {metrics.levelBreakdown.Regional.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">16 Regional Secretariats</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Constituency Level</div>
              <div className="text-2xl font-black text-purple-400 mt-1">
                {metrics.levelBreakdown.Constituency.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">276 Constituencies</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TESCON Level</div>
              <div className="text-2xl font-black text-rose-400 mt-1">
                {metrics.levelBreakdown.TESCON.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Patrons strictly excluded</div>
            </div>
          </div>
        )}

        {/* MAIN BODY: EITHER PREVIEW OR REGISTER TABLE */}
        {activeTab === "preview" ? (
          <div className="bg-slate-900/90 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950 text-slate-300 px-4 py-3 flex items-center justify-between text-xs border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Live Publication Spread (Ahafo Master Design)
                </span>
                <span className="text-slate-500">· Standard A4 Portrait</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono"
                >
                  -
                </button>
                <span className="font-mono text-slate-200 text-xs px-1">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono"
                >
                  +
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Reset
                </button>
              </div>
            </div>

            <div
              className="relative w-full bg-slate-800/80 p-4 sm:p-8 flex justify-center overflow-auto"
              style={{ minHeight: "850px" }}
            >
              {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-start gap-3 bg-slate-950/80 pt-32 text-white">
                  <LoaderCircle className="h-8 w-8 animate-spin text-blue-400" />
                  <span className="text-sm font-semibold">Compiling two-stage electoral roll...</span>
                </div>
              )}

              {fetchError ? (
                <div className="p-8 text-center text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 max-w-md my-auto">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                  <div className="font-bold text-sm">Failed to Load Album</div>
                  <div className="text-xs text-red-300 mt-1">{fetchError}</div>
                </div>
              ) : (
                <div
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <iframe
                    id="album-preview-iframe"
                    src={previewUrl}
                    title={`${selectedContest} Album Preview`}
                    className="border-0 shadow-2xl rounded"
                    style={{
                      width: "220mm",
                      height: "3600mm",
                      backgroundColor: "#ffffff",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: INTERACTIVE REGISTER TABLE */
          <div className="bg-slate-900/90 rounded-2xl shadow-xl border border-slate-800 p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search name, voter ID, position..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400">Level:</span>
                <select
                  value={levelFilter}
                  onChange={(e) => {
                    setLevelFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none"
                >
                  <option value="all">All Levels</option>
                  <option value="National">National</option>
                  <option value="Regional">Regional</option>
                  <option value="Constituency">Constituency</option>
                  <option value="TESCON">TESCON</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-bold">#</th>
                    <th className="p-3 font-bold">Delegate Name</th>
                    <th className="p-3 font-bold">Administrative Tier</th>
                    <th className="p-3 font-bold">Constituency / Region</th>
                    <th className="p-3 font-bold">Canonical Position</th>
                    <th className="p-3 font-bold">Voter ID</th>
                    <th className="p-3 font-bold">Phone</th>
                    <th className="p-3 font-bold">Demographics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500">
                        No delegates found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    currentTableRows.map((d: any, idx: number) => {
                      const absoluteIndex = (page - 1) * pageSize + idx + 1;
                      return (
                        <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-slate-500 font-mono">{absoluteIndex}</td>
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700">
                              <img
                                src={d.image_url || d.avatar_svg}
                                alt={d.executive_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = d.avatar_svg;
                                }}
                              />
                            </div>
                            <span>{d.executive_name}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.executive_level === "National"
                                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                  : d.executive_level === "Regional"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : d.executive_level === "Constituency"
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              }`}
                            >
                              {d.executive_level}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300">
                            {d.constituency ? `${d.constituency} (${d.region})` : d.region}
                          </td>
                          <td className="p-3 font-semibold text-blue-300">{d.canonical_position}</td>
                          <td className="p-3 font-mono text-slate-300">{d.voter_id}</td>
                          <td className="p-3 text-slate-400">{d.phone}</td>
                          <td className="p-3 text-slate-400">
                            {d.gender} · {d.age ? `${d.age} yrs` : "Age —"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination */}
            <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
              <div>
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, filteredDelegates.length)} of{" "}
                {filteredDelegates.length.toLocaleString()} entries
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded bg-slate-800 text-white disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-2">
                  Page {page} of {totalTablePages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalTablePages, p + 1))}
                  disabled={page === totalTablePages}
                  className="px-3 py-1 rounded bg-slate-800 text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
