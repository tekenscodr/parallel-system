"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { getClientHeaders } from "@/lib/client-device";
import { logoutAndRedirect } from "@/lib/client-session";
import {
  GitPullRequest,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  Check,
  X,
  User,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
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

interface UpdateRequestItem {
  id: string;
  executive_id: number;
  executive_name: string;
  executive_level: string;
  region: string;
  constituency: string | null;
  position: string;
  requester_name: string;
  requester_phone: string;
  requester_role: string;
  requester_email: string | null;
  proposed_changes: Record<string, any>;
  current_values: Record<string, any>;
  reason: string | null;
  supporting_doc_url: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  tracking_code: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

interface StatsData {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function AdminUpdateRequestsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UpdateRequestItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Diff Review Modal
  const [selectedRequest, setSelectedRequest] = useState<UpdateRequestItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Session guard
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

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (levelFilter && levelFilter !== "ALL") params.set("level", levelFilter);
      if (regionFilter && regionFilter !== "ALL") params.set("region", regionFilter);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/admin/update-requests?${params.toString()}`, {
        headers: getClientHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to load update requests:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, levelFilter, regionFilter, page]);

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [currentUser, fetchRequests]);

  // Submit Review (Approve or Reject)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    if (reviewAction === "REJECT" && !reviewNotes.trim()) {
      alert("Please enter a reason for rejecting this update request.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/update-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getClientHeaders() },
        credentials: "include",
        body: JSON.stringify({
          action: reviewAction,
          notes: reviewNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRequest(null);
        setReviewNotes("");
        fetchRequests();
      } else {
        alert(data.error || "Failed to process update request.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    if (status === "APPROVED") {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> APPROVED & SYNCED
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

  // Field label formatter
  const formatFieldLabel = (key: string) => {
    switch (key) {
      case "executive_name":
        return "Full Executive Name";
      case "phone":
        return "Phone Number";
      case "email":
        return "Email Address";
      case "ghana_card":
        return "Ghana Card Number";
      case "voter_id":
        return "EC Voter ID";
      case "gender":
        return "Gender";
      case "date_of_birth":
        return "Date of Birth";
      case "age":
        return "Age";
      case "image_url":
        return "Official Photo";
      case "position":
        return "Executive Position";
      default:
        return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  return (
    <AdminShell
      title="Executive Update Requests"
      subtitle="Review correction submissions and sync verified updates directly to the national database"
      currentUser={currentUser}
    >
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Top Header & Refresh */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-7 h-7 text-sky-400" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                Executive Update Requests
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Field corrections, spelling fixes, phone numbers, Ghana Card updates, and photo changes
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRequests()}
              className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-slate-400 uppercase font-semibold">
                Total Submissions
              </CardDescription>
              <CardTitle className="text-2xl font-black text-slate-100">
                {stats?.total ?? total}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              All submitted correction requests
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-amber-400 uppercase font-semibold">
                Pending Review
              </CardDescription>
              <CardTitle className="text-2xl font-black text-amber-400">
                {stats?.pending ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              Awaiting admin approval & sync
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-emerald-400 uppercase font-semibold">
                Approved & Synced
              </CardDescription>
              <CardTitle className="text-2xl font-black text-emerald-400">
                {stats?.approved ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              Directly committed to database
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-rose-400 uppercase font-semibold">
                Rejected
              </CardDescription>
              <CardTitle className="text-2xl font-black text-rose-400">
                {stats?.rejected ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-400">
              Denied after verification
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by executive name, tracking code, requester..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
                  <option value="APPROVED">Approved & Synced</option>
                  <option value="REJECTED">Rejected</option>
                </NativeSelect>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 whitespace-nowrap">Level:</span>
                <NativeSelect
                  value={levelFilter}
                  onChange={(e) => {
                    setLevelFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-950 border-slate-800 text-slate-200 text-xs w-36"
                >
                  <option value="ALL">All Levels</option>
                  <option value="Constituency">Constituency</option>
                  <option value="Region">Region</option>
                  <option value="National">National</option>
                  <option value="TESCON">TESCON</option>
                  <option value="External Branch">External Branch</option>
                </NativeSelect>
              </div>

              {(search || statusFilter !== "ALL" || levelFilter !== "ALL" || regionFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setLevelFilter("ALL");
                    setRegionFilter("ALL");
                    setPage(1);
                  }}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/80">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-semibold text-xs">TRACKING CODE</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">EXECUTIVE RECORD</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">LEVEL & REGION</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">REQUESTER DETAILS</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">PROPOSED CHANGES</TableHead>
                  <TableHead className="text-slate-400 font-semibold text-xs">STATUS</TableHead>
                  <TableHead className="text-right text-slate-400 font-semibold text-xs">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                      Loading update requests...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      No update requests match your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const proposedKeys = Object.keys(item.proposed_changes || {});
                    return (
                      <TableRow key={item.id} className="border-slate-800/80 hover:bg-slate-800/40 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-sky-400">
                          {item.tracking_code}
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold text-slate-100">{item.executive_name}</div>
                          <div className="text-xs text-slate-400">{item.position}</div>
                          <div className="text-[11px] text-slate-500">ID #{item.executive_id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                            {item.executive_level}
                          </Badge>
                          <div className="text-xs text-slate-300 mt-1">{item.region}</div>
                          {item.constituency && (
                            <div className="text-[11px] text-slate-400">{item.constituency}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-slate-200">{item.requester_name}</div>
                          <div className="text-[11px] text-slate-400">{item.requester_role}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{item.requester_phone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {proposedKeys.map((key) => (
                              <span
                                key={key}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20"
                              >
                                {formatFieldLabel(key)}
                              </span>
                            ))}
                          </div>
                          {item.reason && (
                            <div className="text-[11px] text-slate-400 italic mt-1 line-clamp-1">
                              &ldquo;{item.reason}&rdquo;
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(item);
                              setReviewAction(item.status === "REJECTED" ? "REJECT" : "APPROVE");
                              setReviewNotes(item.review_notes || "");
                            }}
                            className="bg-sky-600/20 text-sky-300 hover:bg-sky-600/30 border border-sky-500/30 h-8 text-xs font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Review Diff
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {items.length > 0 ? (page - 1) * 20 + 1 : 0} to{" "}
              {Math.min(page * 20, total)} of {total} requests
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
      {/* SIDE-BY-SIDE DIFF & APPROVAL MODAL                                        */}
      {/* ========================================================================= */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent maxWidth="max-w-3xl" className="bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <GitPullRequest className="w-5 h-5 text-sky-400" />
                  Review Update Request: {selectedRequest.tracking_code}
                </DialogTitle>
                {getStatusBadge(selectedRequest.status)}
              </div>
              <DialogDescription className="text-xs text-slate-400">
                Submitted by {selectedRequest.requester_name} ({selectedRequest.requester_role}, {selectedRequest.requester_phone}) on{" "}
                {new Date(selectedRequest.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            {/* Executive Target Context */}
            <div className="p-3.5 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400">Target Executive: </span>
                <span className="font-bold text-slate-200">{selectedRequest.executive_name}</span>
                <span className="text-slate-400"> (ID #{selectedRequest.executive_id})</span>
              </div>
              <div>
                <span className="text-slate-400">Position: </span>
                <span className="font-semibold text-slate-200">{selectedRequest.position}</span>
              </div>
              <div>
                <span className="text-slate-400">Jurisdiction: </span>
                <span className="font-semibold text-slate-200">
                  {selectedRequest.region} {selectedRequest.constituency ? `• ${selectedRequest.constituency}` : ""}
                </span>
              </div>
            </div>

            {/* Requester Reason & Notes */}
            {selectedRequest.reason && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200">
                <span className="font-bold">Reason for update: </span>
                {selectedRequest.reason}
              </div>
            )}

            {/* Side-by-Side Diff Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Proposed Changes vs Current Values
              </div>

              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-950/80">
                    <TableRow className="border-slate-800">
                      <TableHead className="text-xs text-slate-400 font-semibold w-1/3">FIELD</TableHead>
                      <TableHead className="text-xs text-slate-400 font-semibold w-1/3">CURRENT RECORD</TableHead>
                      <TableHead className="text-xs text-slate-400 font-semibold w-1/3">PROPOSED VALUE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(selectedRequest.proposed_changes).map(([key, newVal]) => {
                      const oldVal = selectedRequest.current_values[key];
                      const isImage = key === "image_url";

                      return (
                        <TableRow key={key} className="border-slate-800/60 bg-slate-950/20">
                          <TableCell className="text-xs font-bold text-slate-300">
                            {formatFieldLabel(key)}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400 bg-rose-950/10 border-r border-slate-800">
                            {isImage ? (
                              oldVal ? (
                                <img src={String(oldVal)} alt="Current" className="w-12 h-12 object-cover rounded border border-slate-700" />
                              ) : (
                                <span className="italic text-slate-600">No Photo</span>
                              )
                            ) : (
                              String(oldVal || "None / Empty")
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-emerald-300 bg-emerald-950/20">
                            {isImage ? (
                              newVal ? (
                                <img src={String(newVal)} alt="Proposed" className="w-12 h-12 object-cover rounded border border-emerald-500/40" />
                              ) : (
                                <span className="italic text-slate-600">No Photo</span>
                              )
                            ) : (
                              String(newVal || "None")
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Review Decision Form */}
            <form onSubmit={handleReviewSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="review-action">Decision</Label>
                  <NativeSelect
                    id="review-action"
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value as any)}
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  >
                    <option value="APPROVE">APPROVE & COMMIT TO DATABASE</option>
                    <option value="REJECT">REJECT PROPOSED CHANGES</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor="review-notes-input">
                    {reviewAction === "REJECT" ? "Rejection Reason *" : "Review Notes (Optional)"}
                  </Label>
                  <Input
                    id="review-notes-input"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      reviewAction === "REJECT"
                        ? "State reason for rejecting request..."
                        : "Optional verification notes..."
                    }
                    className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRequest(null)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className={
                    reviewAction === "APPROVE"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                      : "bg-rose-600 hover:bg-rose-500 text-white font-bold"
                  }
                >
                  {isSubmitting
                    ? "Processing..."
                    : reviewAction === "APPROVE"
                    ? "Confirm & Sync to Database"
                    : "Confirm Rejection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
