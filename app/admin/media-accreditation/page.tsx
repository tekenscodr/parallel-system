"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { getClientHeaders } from "@/lib/client-device";
import { logoutAndRedirect } from "@/lib/client-session";
import {
  Camera,
  Download,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  MapPin,
  Phone,
  Mail,
  IdCard,
  LayoutGrid,
  Table as TableIcon,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Award,
  CheckSquare,
  Square,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface MediaAccreditationRecord {
  id: string;
  category: string;
  name: string;
  gender: string;
  company: string;
  roleTitle?: string | null;
  assignedZone?: string | null;
  serviceNumber?: string | null;
  emergencyContact?: string | null;
  region: string;
  street: string;
  ghanaPostAddress: string;
  idType: string;
  idNumber: string;
  voterId?: string | null;
  profileImage?: string | null;
  phone?: string | null;
  email?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  accreditationCode: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface DashboardStats {
  total_all: number;
  media_total: number;
  scoped_total: number;
  with_photo: number;
  missing_photo: number;
  approved: number;
  pending: number;
  rejected: number;
  distinct_companies: number;
}

interface CompanyBreakdownItem {
  company: string;
  total: number;
  with_photo: number;
  approved: number;
  pending: number;
}

interface RegionBreakdownItem {
  region: string;
  total: number;
  with_photo: number;
}

interface CategoryBreakdownItem {
  category: string;
  total: number;
  with_photo: number;
}

export default function MediaAccreditationDashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MediaAccreditationRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [companyBreakdown, setCompanyBreakdown] = useState<CompanyBreakdownItem[]>([]);
  const [regionBreakdown, setRegionBreakdown] = useState<RegionBreakdownItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);

  // Filters & View State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("MEDIA");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [hasPhotoFilter, setHasPhotoFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");
  const [imageFormat, setImageFormat] = useState<"jpg" | "webp" | "png">("jpg");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<string>("250");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Selection & Bulk Download State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [exportingData, setExportingData] = useState<string | null>(null);

  // Photo Lightbox Modal
  const [previewItem, setPreviewItem] = useState<MediaAccreditationRecord | null>(null);

  // Verify admin session
  useEffect(() => {
    fetch("/api/admin/auth/me", {
      headers: getClientHeaders(),
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.authenticated) {
          logoutAndRedirect("expired");
          return;
        }
        setCurrentUser(data.user);
      })
      .catch(() => logoutAndRedirect("expired"));
  }, []);

  const buildFilterQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    params.set("category", categoryFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (companyFilter !== "ALL") params.set("company", companyFilter);
    if (regionFilter !== "ALL") params.set("region", regionFilter);
    if (hasPhotoFilter !== "ALL") params.set("hasPhoto", hasPhotoFilter);
    return params;
  }, [search, categoryFilter, statusFilter, companyFilter, regionFilter, hasPhotoFilter]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildFilterQueryParams();
      params.set("page", String(page));
      params.set("limit", limit);

      const res = await fetch(`/api/admin/media-accreditation?${params.toString()}`, {
        headers: getClientHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats || null);
        setCompanyBreakdown(data.companyBreakdown || []);
        setRegionBreakdown(data.regionBreakdown || []);
        setCategoryBreakdown(data.categoryBreakdown || []);
      }
    } catch (err) {
      console.error("Failed to load media accreditation data:", err);
    } finally {
      setLoading(false);
    }
  }, [buildFilterQueryParams, page, limit]);

  useEffect(() => {
    if (currentUser) {
      fetchRecords();
    }
  }, [currentUser, fetchRecords]);

  const hasPhoto = (item: MediaAccreditationRecord) =>
    Boolean(item.profileImage && String(item.profileImage).trim());

  const getPreviewImageUrl = (item: MediaAccreditationRecord) => {
    if (!hasPhoto(item)) return "";
    if (String(item.profileImage).startsWith("data:image/")) {
      return String(item.profileImage);
    }
    return `/api/admin/media-accreditation/image?id=${encodeURIComponent(item.id)}&inline=1`;
  };

  // Single image download
  const handleDownloadSingleImage = async (
    item: MediaAccreditationRecord,
    fmt: "jpg" | "webp" | "png" = imageFormat
  ) => {
    if (!hasPhoto(item)) return;
    try {
      const url = `/api/admin/media-accreditation/image?id=${encodeURIComponent(
        item.id
      )}&format=${fmt}&download=1`;
      const res = await fetch(url, {
        headers: getClientHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        alert("Could not download image for " + item.name);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const safeName = item.name.trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g, " ").replace(/\s+/g, " ") || "Applicant";
      const filename = filenameMatch
        ? filenameMatch[1]
        : `${safeName}.${fmt}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    } catch (err: any) {
      alert("Error downloading image: " + err.message);
    }
  };

  // Bulk ZIP download (all filtered or selected IDs)
  const handleDownloadZip = async (onlySelected = false) => {
    if (onlySelected && selectedIds.size === 0) {
      alert("Please select at least one record with a photo first.");
      return;
    }
    setDownloadingZip(true);
    try {
      const params = buildFilterQueryParams();
      params.set("format", imageFormat);

      const res = onlySelected
        ? await fetch(`/api/admin/media-accreditation/images-zip?${params.toString()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getClientHeaders() },
            credentials: "include",
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          })
        : await fetch(`/api/admin/media-accreditation/images-zip?${params.toString()}`, {
            headers: getClientHeaders(),
            credentials: "include",
          });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        alert(errData?.error || "Failed to generate ZIP archive of images.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match
        ? match[1]
        : `media_accreditation_photos.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } catch (err: any) {
      alert("Bulk ZIP download error: " + err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  // Export Data (.xlsx, .csv, .txt, .json)
  const handleExportData = async (format: "xlsx" | "csv" | "txt" | "json") => {
    setExportingData(format);
    try {
      const params = buildFilterQueryParams();
      params.set("format", format);

      const res = await fetch(`/api/admin/media-accreditation/export?${params.toString()}`, {
        headers: getClientHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        alert("Failed to export media accreditation data.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match
        ? match[1]
        : format === "txt"
        ? "media_accreditation_data.txt"
        : `NPP_${categoryFilter}_Accreditation_Data_2026.${format}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    } catch (err: any) {
      alert("Export error: " + err.message);
    } finally {
      setExportingData(null);
    }
  };

  // Selection helpers
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const s = String(status || "").toUpperCase();
    if (s === "APPROVED") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[11px] flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3" /> APPROVED
        </Badge>
      );
    }
    if (s === "REJECTED") {
      return (
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[11px] flex items-center gap-1 w-fit">
          <XCircle className="w-3 h-3" /> REJECTED
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] flex items-center gap-1 w-fit">
        <Clock className="w-3 h-3" /> PENDING
      </Badge>
    );
  };

  return (
    <AdminShell
      title="Media Accreditation Data & Photo Archive"
      subtitle="Complete media accreditation dataset, Excel/CSV exports, and bulk portrait image downloads"
      currentUser={currentUser}
    >
      <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Top Header & Export / Download Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
                    Media Accreditation Data &amp; Image Center
                  </h2>
                  <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
                    {categoryFilter === "ALL" ? "ALL CATEGORIES" : categoryFilter}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                  Inspect all submitted media accreditation records, export spreadsheets, and download individual or bulk ZIP portrait photos
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/accreditation"
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Award className="w-3.5 h-3.5 text-sky-400" />
              Badge Vetting &amp; Print
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRecords()}
              className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {/* Export Excel */}
            <Button
              size="sm"
              disabled={exportingData !== null}
              onClick={() => handleExportData("xlsx")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              {exportingData === "xlsx" ? "Exporting..." : "Export Excel (.xlsx)"}
            </Button>

            {/* Export CSV */}
            <Button
              variant="outline"
              size="sm"
              disabled={exportingData !== null}
              onClick={() => handleExportData("csv")}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
              {exportingData === "csv" ? "Exporting..." : "Export CSV"}
            </Button>

            {/* Export Text (.txt) */}
            <Button
              variant="outline"
              size="sm"
              disabled={exportingData !== null}
              onClick={() => handleExportData("txt")}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              {exportingData === "txt" ? "Exporting..." : "Export Text (.txt)"}
            </Button>

            {/* Image Format Selector + Bulk ZIP Download */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <NativeSelect
                value={imageFormat}
                onChange={(e) => setImageFormat(e.target.value as "jpg" | "webp" | "png")}
                className="bg-slate-900 border-slate-700 text-slate-200 text-xs h-8 w-24"
                title="Select image download format"
              >
                <option value="jpg">JPG Format</option>
                <option value="png">PNG Format</option>
                <option value="webp">WebP Format</option>
              </NativeSelect>

              <Button
                size="sm"
                disabled={downloadingZip}
                onClick={() => handleDownloadZip(false)}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold h-8 px-3 shadow-md"
              >
                <FolderArchive className="w-3.5 h-3.5 mr-1.5" />
                {downloadingZip
                  ? "Building ZIP..."
                  : `Download Photos + Data (.ZIP)`}
              </Button>

              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  disabled={downloadingZip}
                  onClick={() => handleDownloadZip(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold h-8 px-3"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Selected ({selectedIds.size}) .ZIP
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-[11px] text-slate-400 uppercase font-semibold">
                Total ({categoryFilter})
              </CardDescription>
              <CardTitle className="text-2xl font-black text-white">
                {stats?.scoped_total ?? total}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-[11px] text-slate-400">
              All categories total: {stats?.total_all ?? 0}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-[11px] text-sky-400 uppercase font-semibold">
                With Uploaded Photo
              </CardDescription>
              <CardTitle className="text-2xl font-black text-sky-400">
                {stats?.with_photo ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-[11px] text-slate-400">
              {stats?.scoped_total
                ? `${Math.round(((stats.with_photo || 0) / stats.scoped_total) * 100)}% photo coverage`
                : "Ready for download"}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-[11px] text-amber-400 uppercase font-semibold">
                Missing Photo
              </CardDescription>
              <CardTitle className="text-2xl font-black text-amber-400">
                {stats?.missing_photo ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-[11px] text-slate-400">
              Records without portrait
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-[11px] text-purple-400 uppercase font-semibold">
                Media Houses / Orgs
              </CardDescription>
              <CardTitle className="text-2xl font-black text-purple-400">
                {stats?.distinct_companies ?? companyBreakdown.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-[11px] text-slate-400">
              Distinct organizations registered
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-[11px] text-emerald-400 uppercase font-semibold">
                Approved Passes
              </CardDescription>
              <CardTitle className="text-2xl font-black text-emerald-400">
                {stats?.approved ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-[11px] text-slate-400">
              Cleared for badge printing
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-[11px] text-slate-400 uppercase font-semibold">
                Pending Vetting
              </CardDescription>
              <CardTitle className="text-2xl font-black text-slate-200">
                {stats?.pending ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-[11px] text-slate-400">
              Rejected: {stats?.rejected ?? 0}
            </CardContent>
          </Card>
        </div>

        {/* Category Tabs & Top Media Houses Filter Chips */}
        <div className="space-y-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          {/* Category Selector */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
              Category Scope:
            </span>
            <button
              onClick={() => {
                setCategoryFilter("MEDIA");
                setCompanyFilter("ALL");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                categoryFilter === "MEDIA"
                  ? "bg-sky-600 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              MEDIA / PRESS ONLY ({stats?.media_total ?? 0})
            </button>
            <button
              onClick={() => {
                setCategoryFilter("ALL");
                setCompanyFilter("ALL");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                categoryFilter === "ALL"
                  ? "bg-sky-600 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              ALL CATEGORIES ({stats?.total_all ?? 0})
            </button>
            {categoryBreakdown
              .filter((c) => c.category !== "MEDIA")
              .map((c) => (
                <button
                  key={c.category}
                  onClick={() => {
                    setCategoryFilter(c.category);
                    setCompanyFilter("ALL");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    categoryFilter === c.category
                      ? "bg-sky-600 text-white shadow"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {c.category} ({c.total})
                </button>
              ))}
          </div>

          {/* Media House Quick-Filter Pills */}
          {companyBreakdown.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-slate-400 shrink-0">
                Media Houses / Orgs:
              </span>
              <button
                onClick={() => {
                  setCompanyFilter("ALL");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                  companyFilter === "ALL"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                All ({stats?.scoped_total ?? total})
              </button>
              {companyBreakdown.slice(0, 20).map((comp) => (
                <button
                  key={comp.company}
                  onClick={() => {
                    setCompanyFilter(
                      companyFilter === comp.company ? "ALL" : comp.company
                    );
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
                    companyFilter === comp.company
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <span>{comp.company}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/50 text-[10px] text-sky-300">
                    {comp.total} ({comp.with_photo}📷)
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search, Filter & View Mode Controls */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by name, code (MED-2026-...), media house, role, phone, email, ID number, GPS..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-slate-950 border-slate-800 text-slate-100 text-xs"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Photo Filter */}
              <NativeSelect
                value={hasPhotoFilter}
                onChange={(e) => {
                  setHasPhotoFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs w-44"
              >
                <option value="ALL">All Records (With &amp; Without Photo)</option>
                <option value="WITH_PHOTO">With Uploaded Photo Only</option>
                <option value="MISSING_PHOTO">Missing Photo Only</option>
              </NativeSelect>

              {/* Media House Dropdown */}
              <NativeSelect
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs w-48"
              >
                <option value="ALL">All Media Houses ({companyBreakdown.length})</option>
                {companyBreakdown.map((c) => (
                  <option key={c.company} value={c.company}>
                    {c.company} ({c.total})
                  </option>
                ))}
              </NativeSelect>

              {/* Region Filter */}
              <NativeSelect
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs w-40"
              >
                <option value="ALL">All Regions</option>
                {regionBreakdown.map((r) => (
                  <option key={r.region} value={r.region}>
                    {r.region} ({r.total})
                  </option>
                ))}
              </NativeSelect>

              {/* Status Filter */}
              <NativeSelect
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs w-36"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="REJECTED">Rejected</option>
              </NativeSelect>

              {/* Rows Per Page */}
              <NativeSelect
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs w-32"
              >
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
                <option value="250">250 per page</option>
                <option value="500">500 per page</option>
                <option value="ALL">Show All ({total})</option>
              </NativeSelect>

              {/* View Mode Switcher */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                    viewMode === "table"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("gallery")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                    viewMode === "gallery"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Photo Grid
                </button>
              </div>

              {(search ||
                statusFilter !== "ALL" ||
                companyFilter !== "ALL" ||
                regionFilter !== "ALL" ||
                hasPhotoFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setCompanyFilter("ALL");
                    setRegionFilter("ALL");
                    setHasPhotoFilter("ALL");
                    setPage(1);
                  }}
                  className="text-rose-400 hover:text-rose-300 text-xs h-8"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* VIEW 1: FULL DATA TABLE                                                   */}
        {/* ========================================================================= */}
        {viewMode === "table" ? (
          <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/90">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllVisible}
                        className="text-slate-400 hover:text-white"
                        title="Select / Deselect All"
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">PHOTO</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">CODE &amp; CATEGORY</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">FULL NAME &amp; GENDER</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">MEDIA HOUSE / ORGANIZATION</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">CONTACT (PHONE &amp; EMAIL)</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">IDENTIFICATION</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">LOCATION &amp; GPS</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">STATUS &amp; DATE</TableHead>
                    <TableHead className="text-right text-slate-400 font-semibold text-xs">DOWNLOAD PHOTO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-16 text-slate-400">
                        <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-sky-400" />
                        Loading media accreditation records...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-16 text-slate-400">
                        No media accreditation records match your current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const itemHasPhoto = hasPhoto(item);
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <TableRow
                          key={item.id}
                          className={`border-slate-800/80 hover:bg-slate-800/40 transition-colors ${
                            isSelected ? "bg-sky-950/25" : ""
                          }`}
                        >
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectRow(item.id)}
                              className="text-slate-400 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-sky-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </TableCell>

                          {/* Photo Thumbnail */}
                          <TableCell>
                            {itemHasPhoto ? (
                              <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                className="relative group w-12 h-14 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shadow hover:border-sky-400 transition"
                                title="Click to preview full photo"
                              >
                                <img
                                  src={getPreviewImageUrl(item)}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </button>
                            ) : (
                              <div className="w-12 h-14 rounded-lg border border-dashed border-slate-700 bg-slate-950 flex flex-col items-center justify-center text-[10px] text-slate-500 font-bold">
                                No Photo
                              </div>
                            )}
                          </TableCell>

                          {/* Code & Category */}
                          <TableCell>
                            <div className="font-mono text-xs font-bold text-sky-400">
                              {item.accreditationCode}
                            </div>
                            <Badge className="mt-1 bg-slate-800 text-slate-300 border-slate-700 text-[10px] py-0">
                              {item.category}
                            </Badge>
                          </TableCell>

                          {/* Name & Gender */}
                          <TableCell>
                            <div className="text-sm font-bold text-slate-100">{item.name}</div>
                            <div className="text-xs text-slate-400 capitalize">{item.gender}</div>
                          </TableCell>

                          {/* Media House & Role */}
                          <TableCell>
                            <div className="text-xs font-bold text-slate-200">{item.company}</div>
                            {item.roleTitle ? (
                              <div className="text-[11px] text-sky-300/90 mt-0.5">{item.roleTitle}</div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic">Media Representative</div>
                            )}
                            {item.assignedZone && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Zone: {item.assignedZone}
                              </div>
                            )}
                          </TableCell>

                          {/* Phone & Email */}
                          <TableCell>
                            <div className="text-xs text-slate-200 font-mono">
                              {item.phone || <span className="text-slate-500">—</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {item.email || <span className="text-slate-500">—</span>}
                            </div>
                          </TableCell>

                          {/* Identification */}
                          <TableCell>
                            <div className="text-xs font-mono font-semibold text-slate-200">
                              {item.idNumber}
                            </div>
                            <div className="text-[11px] text-slate-400 uppercase">
                              {item.idType}
                              {item.voterId ? ` • Voter: ${item.voterId}` : ""}
                            </div>
                          </TableCell>

                          {/* Location & GPS */}
                          <TableCell>
                            <div className="text-xs font-semibold text-slate-200">{item.region}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {item.street}
                            </div>
                            <div className="text-[10px] font-mono text-sky-400">
                              {item.ghanaPostAddress}
                            </div>
                          </TableCell>

                          {/* Status & Date */}
                          <TableCell>
                            {getStatusBadge(item.status)}
                            <div className="text-[10px] text-slate-500 mt-1">
                              {item.createdAt
                                ? new Date(item.createdAt).toLocaleString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </div>
                          </TableCell>

                          {/* Download Actions */}
                          <TableCell className="text-right">
                            {itemHasPhoto ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPreviewItem(item)}
                                  className="h-8 px-2 border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 text-xs"
                                  title="View Large Photo"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleDownloadSingleImage(item, imageFormat)}
                                  className="h-8 px-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                                  title={`Download photo as .${imageFormat.toUpperCase()}`}
                                >
                                  <Download className="w-3.5 h-3.5 mr-1" />
                                  .{imageFormat.toUpperCase()}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">No image</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                Showing <span className="font-bold text-slate-200">{items.length}</span> of{" "}
                <span className="font-bold text-slate-200">{total}</span> matching records
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-sky-400 font-semibold">
                    • {selectedIds.size} selected
                  </span>
                )}
              </div>
              {limit !== "ALL" && totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 border-slate-800 bg-slate-900 text-slate-300"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <span className="px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 px-2.5 border-slate-800 bg-slate-900 text-slate-300"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: PHOTO GALLERY / PORTRAIT GRID                                     */
          /* ========================================================================= */
          <div className="space-y-4">
            {loading ? (
              <Card className="bg-slate-900 border-slate-800 p-16 text-center text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-sky-400" />
                Loading photo gallery...
              </Card>
            ) : items.length === 0 ? (
              <Card className="bg-slate-900 border-slate-800 p-16 text-center text-slate-400">
                No accreditation records match your current filters.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {items.map((item) => {
                  const itemHasPhoto = hasPhoto(item);
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <Card
                      key={item.id}
                      className={`bg-slate-900 border-slate-800 overflow-hidden flex flex-col justify-between transition hover:border-slate-700 ${
                        isSelected ? "ring-2 ring-sky-500" : ""
                      }`}
                    >
                      <div>
                        {/* Portrait Image Area */}
                        <div className="relative h-56 bg-slate-950 border-b border-slate-800 flex items-center justify-center overflow-hidden">
                          {itemHasPhoto ? (
                            <img
                              src={getPreviewImageUrl(item)}
                              alt={item.name}
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                              onClick={() => setPreviewItem(item)}
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-600">
                              <ImageIcon className="w-10 h-10 mb-1" />
                              <span className="text-xs font-semibold">No Photo Uploaded</span>
                            </div>
                          )}

                          {/* Top-Left Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectRow(item.id)}
                            className="absolute top-2.5 left-2.5 w-7 h-7 rounded-lg bg-slate-950/80 border border-slate-700 flex items-center justify-center text-white hover:bg-slate-900"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-sky-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>

                          {/* Top-Right Code Badge */}
                          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-950/85 border border-slate-700 font-mono text-[10px] font-bold text-sky-400">
                            {item.accreditationCode}
                          </div>
                        </div>

                        {/* Applicant Info */}
                        <div className="p-4 space-y-1.5">
                          <div className="font-bold text-sm text-white truncate" title={item.name}>
                            {item.name}
                          </div>
                          <div
                            className="text-xs font-semibold text-sky-400 truncate"
                            title={item.company}
                          >
                            {item.company}
                          </div>
                          {item.roleTitle && (
                            <div className="text-[11px] text-slate-400 truncate">
                              {item.roleTitle}
                            </div>
                          )}
                          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{item.region}</span>
                            <span className="font-mono">{item.phone || "No phone"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        {getStatusBadge(item.status)}

                        {itemHasPhoto ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewItem(item)}
                              className="h-7 px-2 border-slate-700 bg-slate-800 text-slate-200 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDownloadSingleImage(item, imageFormat)}
                              className="h-7 px-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                            >
                              <Download className="w-3.5 h-3.5 mr-1" />
                              Download
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">No photo</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FULL PHOTO PREVIEW & MULTI-FORMAT DOWNLOAD MODAL                          */}
      {/* ========================================================================= */}
      {previewItem && (
        <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <DialogContent
            maxWidth="max-w-2xl"
            className="bg-slate-900 border-slate-800 text-slate-100"
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center justify-between">
                <span>{previewItem.name}</span>
                <span className="font-mono text-sm text-sky-400">
                  {previewItem.accreditationCode}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {previewItem.company}
                {previewItem.roleTitle ? ` • ${previewItem.roleTitle}` : ""} • {previewItem.region}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              {/* High-Res Portrait Preview */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center min-h-[280px]">
                {hasPhoto(previewItem) ? (
                  <img
                    src={getPreviewImageUrl(previewItem)}
                    alt={previewItem.name}
                    className="max-h-[360px] w-auto object-contain"
                  />
                ) : (
                  <div className="text-slate-500 text-sm">No image available</div>
                )}
              </div>

              {/* Full Metadata */}
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div>
                    <span className="text-slate-500 block">Media House / Organization</span>
                    <span className="font-bold text-slate-100 text-sm">
                      {previewItem.company}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Role / Designation</span>
                    <span className="font-semibold text-sky-300">
                      {previewItem.roleTitle || "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-500 block">Category</span>
                      <span className="font-bold text-slate-200">{previewItem.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Gender</span>
                      <span className="font-bold text-slate-200 capitalize">
                        {previewItem.gender}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block">Phone</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {previewItem.phone || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ID ({previewItem.idType})</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {previewItem.idNumber}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email</span>
                    <span className="font-mono text-slate-200">
                      {previewItem.email || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Address &amp; Digital GPS</span>
                    <span className="text-slate-200">
                      {previewItem.street}, {previewItem.region} ({previewItem.ghanaPostAddress})
                    </span>
                  </div>
                </div>

                {/* Multi-format Download Buttons */}
                {hasPhoto(previewItem) && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Download Applicant Portrait As:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDownloadSingleImage(previewItem, "jpg")}
                        className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> JPG
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDownloadSingleImage(previewItem, "png")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> PNG
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDownloadSingleImage(previewItem, "webp")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> WebP
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewItem(null)}
                className="border-slate-700 text-slate-300"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
