"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { getClientHeaders } from "@/lib/client-device";
import { logoutAndRedirect } from "@/lib/client-session";
import {
  Award,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Eye,
  Check,
  Building,
  MapPin,
  IdCard,
  QrCode,
  UserCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AccreditationItem {
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
  status: "PENDING" | "APPROVED" | "REJECTED";
  accreditationCode: string;
  qrCodeData?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface StatsData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  media_count: number;
  security_count: number;
  usher_count: number;
  party_count: number;
  civil_count: number;
  international_count: number;
}

export default function AdminAccreditationPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AccreditationItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [badgeModalItem, setBadgeModalItem] = useState<AccreditationItem | null>(null);
  const [reviewModalItem, setReviewModalItem] = useState<AccreditationItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewZone, setReviewZone] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // New Pass Modal
  const [newPassOpen, setNewPassOpen] = useState(false);
  const [isCreatingPass, setIsCreatingPass] = useState(false);
  const [newPassForm, setNewPassForm] = useState({
    name: "",
    gender: "Male",
    category: "MEDIA",
    company: "",
    roleTitle: "",
    assignedZone: "Main Plenary & Press Gallery",
    region: "Greater Accra",
    street: "National Headquarters",
    ghanaPostAddress: "GA-001-2026",
    idType: "ghana-card",
    idNumber: "",
    phone: "",
    email: "",
    voterId: "",
  });

  // Check current session
  useEffect(() => {
    fetch("/api/admin/auth/me", { headers: getClientHeaders(), credentials: "include" })
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

  // Fetch accreditations
  const fetchAccreditations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter && categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/admin/accreditation?${params.toString()}`, {
        headers: getClientHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats || null);
        setCategoryBreakdown(data.categoryBreakdown || []);
      }
    } catch (err) {
      console.error("Failed to load accreditations:", err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, page]);

  useEffect(() => {
    if (currentUser) {
      fetchAccreditations();
    }
  }, [currentUser, fetchAccreditations]);

  // Handle Review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalItem) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch("/api/admin/accreditation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientHeaders() },
        credentials: "include",
        body: JSON.stringify({
          id: reviewModalItem.id,
          status: reviewStatus,
          notes: reviewNotes,
          assignedZone: reviewZone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewModalItem(null);
        fetchAccreditations();
      } else {
        alert(data.error || "Failed to update status.");
      }
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Quick Approve
  const handleQuickApprove = async (item: AccreditationItem) => {
    try {
      const res = await fetch("/api/admin/accreditation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientHeaders() },
        credentials: "include",
        body: JSON.stringify({
          id: item.id,
          status: "APPROVED",
          notes: "Approved via quick action.",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAccreditations();
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Create Pass
  const handleCreatePassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPass(true);
    try {
      const res = await fetch("/api/admin/accreditation", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientHeaders() },
        credentials: "include",
        body: JSON.stringify(newPassForm),
      });
      const data = await res.json();
      if (data.success) {
        setNewPassOpen(false);
        setNewPassForm({
          name: "",
          gender: "Male",
          category: "MEDIA",
          company: "",
          roleTitle: "",
          assignedZone: "Main Plenary & Press Gallery",
          region: "Greater Accra",
          street: "National Headquarters",
          ghanaPostAddress: "GA-001-2026",
          idType: "ghana-card",
          idNumber: "",
          phone: "",
          email: "",
          voterId: "",
        });
        fetchAccreditations();
      } else {
        alert(data.error || "Failed to create pass.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsCreatingPass(false);
    }
  };

  // Category badge styling helper
  const getCategoryBadge = (cat: string) => {
    const c = cat.toUpperCase();
    if (c === "MEDIA") {
      return <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30">PRESS / MEDIA</Badge>;
    }
    if (c === "SECURITY") {
      return <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30">SECURITY DETAIL</Badge>;
    }
    if (c === "USHER") {
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">PROTOCOL & USHER</Badge>;
    }
    if (c === "POLITICAL_PARTY") {
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">PARTY DELEGATION</Badge>;
    }
    if (c === "CIVIL_SOCIETY") {
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">CIVIL SOCIETY</Badge>;
    }
    return <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30">{c}</Badge>;
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    if (status === "APPROVED") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> APPROVED
        </Badge>
      );
    }
    if (status === "REJECTED") {
      return (
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> REJECTED
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1">
        <Clock className="w-3 h-3" /> PENDING REVIEW
      </Badge>
    );
  };

  return (
    <AdminShell
      title="Accreditation & Badges Management"
      subtitle="Official accreditation directory, pass review workflow, and printable security credentials"
      currentUser={currentUser}
    >
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Top Header & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-7 h-7 text-sky-400" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                Accreditation Directorate
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Issue and authenticate credentials for Media, State Security, and Protocol staff
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAccreditations()}
              className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setNewPassOpen(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Issue On-Site Pass
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-slate-400 uppercase font-semibold">
                Total Accreditations
              </CardDescription>
              <CardTitle className="text-2xl font-black text-slate-100">
                {stats?.total ?? total}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              Active records registered
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-emerald-400 uppercase font-semibold">
                Approved Passes
              </CardDescription>
              <CardTitle className="text-2xl font-black text-emerald-400">
                {stats?.approved ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              Authorized for venue entry
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-amber-400 uppercase font-semibold">
                Pending Verification
              </CardDescription>
              <CardTitle className="text-2xl font-black text-amber-400">
                {stats?.pending ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              Awaiting vetting & badge print
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-rose-400 uppercase font-semibold">
                Rejected / Flagged
              </CardDescription>
              <CardTitle className="text-2xl font-black text-rose-400">
                {stats?.rejected ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              Revoked or unverified
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown Bar */}
        <div className="flex flex-wrap gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 self-center mr-2">
            Categories:
          </span>
          <button
            onClick={() => {
              setCategoryFilter("ALL");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === "ALL"
                ? "bg-sky-500 text-white font-semibold"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            All Categories ({stats?.total ?? 0})
          </button>
          <button
            onClick={() => {
              setCategoryFilter("MEDIA");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === "MEDIA"
                ? "bg-sky-500 text-white font-semibold"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Media & Press ({stats?.media_count ?? 0})
          </button>
          <button
            onClick={() => {
              setCategoryFilter("SECURITY");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === "SECURITY"
                ? "bg-rose-600 text-white font-semibold"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Security ({stats?.security_count ?? 0})
          </button>
          <button
            onClick={() => {
              setCategoryFilter("USHER");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === "USHER"
                ? "bg-amber-600 text-white font-semibold"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Ushers & Protocol ({stats?.usher_count ?? 0})
          </button>
          <button
            onClick={() => {
              setCategoryFilter("POLITICAL_PARTY");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === "POLITICAL_PARTY"
                ? "bg-blue-600 text-white font-semibold"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Party Delegations ({stats?.party_count ?? 0})
          </button>
          <button
            onClick={() => {
              setCategoryFilter("CIVIL_SOCIETY");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === "CIVIL_SOCIETY"
                ? "bg-emerald-600 text-white font-semibold"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Civil Society / Observers ({stats?.civil_count ?? 0})
          </button>
        </div>

        {/* Filter Controls Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by name, code, company, ID, or phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 whitespace-nowrap">Status:</span>
                <NativeSelect
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-950 border-slate-800 text-slate-200 text-xs w-36"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </NativeSelect>
              </div>

              {(search || categoryFilter !== "ALL" || statusFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("ALL");
                    setStatusFilter("ALL");
                    setPage(1);
                  }}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table View */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/80">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-semibold text-xs">ACCREDITATION CODE</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">APPLICANT DETAILS</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">CATEGORY</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">ORGANIZATION / MEDIA HOUSE</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">ASSIGNED ZONE</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">IDENTIFICATION</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">STATUS</TableHead>
                  <TableHead className="text-right text-slate-400 font-semibold text-xs">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                      Loading accreditation records...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                      No accreditation records match your current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className="border-slate-800/80 hover:bg-slate-800/40 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-sky-400">
                        {item.accreditationCode}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-slate-700 bg-slate-800">
                            {item.profileImage && (
                              <AvatarImage src={item.profileImage} alt={item.name} />
                            )}
                            <AvatarFallback className="text-xs font-bold text-slate-300">
                              {item.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-semibold text-slate-100">{item.name}</div>
                            <div className="text-xs text-slate-400 capitalize">
                              {item.gender} • {item.phone || "No phone"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getCategoryBadge(item.category)}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-slate-200">{item.company}</div>
                        {item.roleTitle && (
                          <div className="text-[11px] text-slate-400">{item.roleTitle}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-300">
                          {item.assignedZone || (
                            <span className="text-slate-500 italic">General Venue Access</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-300 uppercase font-mono">{item.idNumber}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.idType}
                          {item.voterId ? ` • Voter: ${item.voterId}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Badge preview button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBadgeModalItem(item)}
                            title="Print Badge"
                            className="h-8 w-8 p-0 text-slate-300 hover:text-sky-300 hover:bg-sky-500/10"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>

                          {/* Quick Approve if Pending */}
                          {item.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickApprove(item)}
                              title="Quick Approve"
                              className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Detailed review modal */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReviewModalItem(item);
                              setReviewStatus(item.status === "REJECTED" ? "REJECTED" : "APPROVED");
                              setReviewNotes(item.notes || "");
                              setReviewZone(item.assignedZone || "");
                            }}
                            title="Edit / Review"
                            className="h-8 px-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                          >
                            Review
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {items.length > 0 ? (page - 1) * 25 + 1 : 0} to{" "}
              {Math.min(page * 25, total)} of {total} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2 border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
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
                className="h-8 px-2 border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* PRINTABLE OFFICIAL BADGE MODAL                                             */}
      {/* ========================================================================= */}
      {badgeModalItem && (
        <Dialog open={!!badgeModalItem} onOpenChange={(open) => !open && setBadgeModalItem(null)}>
          <DialogContent maxWidth="max-w-xl" className="bg-slate-900 border-slate-800 text-slate-100 p-0 overflow-hidden">
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #official-print-badge, #official-print-badge * {
                  visibility: visible !important;
                }
                #official-print-badge {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 320px !important;
                  margin: 0 auto !important;
                }
              }
            `}</style>
            <DialogHeader className="p-4 pb-2 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-sky-400" /> Official Security Credential Pass
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-400">
                Official accreditation badge ready for high-resolution lanyard printing.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 flex flex-col items-center justify-center bg-slate-950/70">
              {/* The Printable Badge Card */}
              <div
                id="official-print-badge"
                className="w-80 rounded-2xl overflow-hidden bg-white text-slate-900 shadow-2xl border-4 border-slate-900 relative"
                style={{ minHeight: "460px" }}
              >
                {/* Badge Header with Category Color */}
                <div
                  className={`p-4 text-center text-white relative ${
                    badgeModalItem.category === "SECURITY"
                      ? "bg-rose-700"
                      : badgeModalItem.category === "USHER"
                      ? "bg-amber-600"
                      : "bg-blue-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <img src="/npp-logo.png" alt="NPP" className="w-8 h-8 object-contain bg-white rounded-full p-0.5" />
                    <span className="text-[10px] font-extrabold tracking-widest uppercase opacity-90">
                      NPP NATIONAL SECRETARIAT
                    </span>
                    <Shield className="w-5 h-5 text-white/90" />
                  </div>
                  <div className="text-lg font-black tracking-wider uppercase mt-1">
                    {badgeModalItem.category === "MEDIA"
                      ? "OFFICIAL MEDIA"
                      : badgeModalItem.category === "SECURITY"
                      ? "SECURITY CLEARANCE"
                      : badgeModalItem.category === "USHER"
                      ? "PROTOCOL & USHER"
                      : badgeModalItem.category}
                  </div>
                  <div className="text-[9px] font-semibold uppercase tracking-widest opacity-80">
                    2026 NATIONAL ELECTORAL CONFERENCE
                  </div>
                </div>

                {/* Badge Body */}
                <div className="p-5 flex flex-col items-center text-center">
                  {/* Photo / Avatar */}
                  <div className="w-28 h-28 rounded-xl border-4 border-slate-200 overflow-hidden shadow-md bg-slate-100 flex items-center justify-center mb-3">
                    {badgeModalItem.profileImage ? (
                      <img src={badgeModalItem.profileImage} alt={badgeModalItem.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-2xl font-black text-slate-400">
                        {badgeModalItem.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name & Title */}
                  <h3 className="text-lg font-extrabold text-slate-900 uppercase leading-tight">
                    {badgeModalItem.name}
                  </h3>
                  <p className="text-xs font-bold text-blue-800 mt-0.5">
                    {badgeModalItem.company}
                  </p>
                  {badgeModalItem.roleTitle && (
                    <p className="text-[11px] text-slate-600 font-medium">
                      {badgeModalItem.roleTitle}
                    </p>
                  )}

                  {/* Zone Access Badge */}
                  <div className="mt-3 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                    ZONE: {badgeModalItem.assignedZone || "ALL-ACCESS PLENARY"}
                  </div>

                  {/* QR & Barcode Section */}
                  <div className="mt-4 pt-3 border-t border-slate-200 w-full flex items-center justify-between px-2">
                    <div className="text-left">
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">Pass Number</div>
                      <div className="text-xs font-black font-mono text-slate-900">
                        {badgeModalItem.accreditationCode}
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase mt-1">ID Ref</div>
                      <div className="text-[10px] font-mono font-semibold text-slate-700">
                        {badgeModalItem.idNumber}
                      </div>
                    </div>

                    <div className="w-16 h-16 bg-slate-900 rounded-lg p-1.5 flex flex-col items-center justify-center text-white">
                      <QrCode className="w-full h-full text-white" />
                    </div>
                  </div>
                </div>

                {/* Footer Security Watermark */}
                <div className="bg-slate-900 text-slate-300 text-[9px] font-mono text-center py-1.5 uppercase tracking-widest">
                  ★ NON-TRANSFERABLE • OFFICIAL SECURITY CREDENTIAL ★
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between sm:justify-between items-center">
              <span className="text-xs text-slate-400">
                Print on 300gsm laminated card or ID pouch
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setBadgeModalItem(null)} className="border-slate-700 text-slate-300">
                  Close
                </Button>
                <Button size="sm" onClick={() => window.print()} className="bg-sky-600 hover:bg-sky-500 text-white">
                  <Printer className="w-4 h-4 mr-1.5" /> Print Pass
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* REVIEW / EDIT STATUS MODAL                                                */}
      {/* ========================================================================= */}
      {reviewModalItem && (
        <Dialog open={!!reviewModalItem} onOpenChange={(open) => !open && setReviewModalItem(null)}>
          <DialogContent maxWidth="max-w-lg" className="bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-100">
                Review Accreditation: {reviewModalItem.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Update vetting status, assign security zones, or attach administrative review notes.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleReviewSubmit} className="space-y-4 py-2">
              <div>
                <Label htmlFor="review-status">Decision Status</Label>
                <NativeSelect
                  id="review-status"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as any)}
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                >
                  <option value="APPROVED">APPROVE - Grant Official Pass</option>
                  <option value="REJECTED">REJECT - Deny Accreditation</option>
                </NativeSelect>
              </div>

              <div>
                <Label htmlFor="review-zone">Assigned Security Zone</Label>
                <Input
                  id="review-zone"
                  value={reviewZone}
                  onChange={(e) => setReviewZone(e.target.value)}
                  placeholder="e.g. Press Gallery, Plenary Floor, VIP Holding Room"
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              <div>
                <Label htmlFor="review-notes">Administrative Notes</Label>
                <Textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any internal vetting notes or reasons..."
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 min-h-[70px]"
                />
              </div>

              <DialogFooter className="pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewModalItem(null)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingReview}
                  className={
                    reviewStatus === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-rose-600 hover:bg-rose-500 text-white"
                  }
                >
                  {isSubmittingReview ? "Saving..." : `Confirm ${reviewStatus}`}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* ISSUE ON-SITE PASS MODAL                                                  */}
      {/* ========================================================================= */}
      {newPassOpen && (
        <Dialog open={newPassOpen} onOpenChange={setNewPassOpen}>
          <DialogContent maxWidth="max-w-xl" className="bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" /> Issue On-Site Accreditation Pass
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Direct administrative badge issuance for arriving VIP press, security detachments, or protocol officers.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreatePassSubmit} className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-name">Full Name *</Label>
                  <Input
                    id="new-name"
                    required
                    value={newPassForm.name}
                    onChange={(e) => setNewPassForm({ ...newPassForm, name: e.target.value })}
                    placeholder="e.g. Kwame Mensah"
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor="new-gender">Gender *</Label>
                  <NativeSelect
                    id="new-gender"
                    value={newPassForm.gender}
                    onChange={(e) => setNewPassForm({ ...newPassForm, gender: e.target.value })}
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-category">Category *</Label>
                  <NativeSelect
                    id="new-category"
                    value={newPassForm.category}
                    onChange={(e) => setNewPassForm({ ...newPassForm, category: e.target.value })}
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  >
                    <option value="MEDIA">Media & Press</option>
                    <option value="SECURITY">Security Detail</option>
                    <option value="USHER">Protocol & Usher</option>
                    <option value="POLITICAL_PARTY">Political Party Delegation</option>
                    <option value="CIVIL_SOCIETY">Civil Society / Observer</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor="new-company">Organization / Media House *</Label>
                  <Input
                    id="new-company"
                    required
                    value={newPassForm.company}
                    onChange={(e) => setNewPassForm({ ...newPassForm, company: e.target.value })}
                    placeholder="e.g. Peace FM, GPS VIP Unit"
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-role">Designation / Role Title</Label>
                  <Input
                    id="new-role"
                    value={newPassForm.roleTitle}
                    onChange={(e) => setNewPassForm({ ...newPassForm, roleTitle: e.target.value })}
                    placeholder="e.g. Senior Photojournalist"
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor="new-zone">Assigned Zone</Label>
                  <Input
                    id="new-zone"
                    value={newPassForm.assignedZone}
                    onChange={(e) => setNewPassForm({ ...newPassForm, assignedZone: e.target.value })}
                    placeholder="e.g. Press Gallery & Plenary"
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-idnumber">Ghana Card / ID Number *</Label>
                  <Input
                    id="new-idnumber"
                    required
                    value={newPassForm.idNumber}
                    onChange={(e) => setNewPassForm({ ...newPassForm, idNumber: e.target.value })}
                    placeholder="GHA-000000000-0"
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor="new-phone">Contact Phone</Label>
                  <Input
                    id="new-phone"
                    value={newPassForm.phone}
                    onChange={(e) => setNewPassForm({ ...newPassForm, phone: e.target.value })}
                    placeholder="0240000000"
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewPassOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingPass}
                  className="bg-sky-600 hover:bg-sky-500 text-white"
                >
                  {isCreatingPass ? "Issuing..." : "Issue & Authorize Pass"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
