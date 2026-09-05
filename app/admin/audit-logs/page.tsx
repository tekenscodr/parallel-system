"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/admin/components/AdminShell";
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Globe,
  Clock,
  User,
  ArrowRight,
  Eye,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Activity,
  Laptop,
} from "lucide-react";
import { getClientHeaders } from "@/lib/client-device";

interface AuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  requestId: string;
  ipAddress: string;
  deviceId: string | null;
  metadata: Record<string, any>;
  occurredAt: string;
  userAgent: string | null;
  actorEmail: string;
  actorName: string;
  actorRole: string;
}

interface CurrentAdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentAdminUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(30);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedIp, setSelectedIp] = useState("");
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableIps, setAvailableIps] = useState<string[]>([]);

  // Diff Modal State
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auth check
  useEffect(() => {
    fetch("/api/admin/auth/me", { headers: getClientHeaders(), credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.authenticated) {
          router.push("/admin/login");
          return;
        }
        const roleUpper = String(data.user?.role || "").toUpperCase();
        if (roleUpper !== "ADMIN_NATIONAL" && roleUpper !== "ADMIN") {
          router.push("/admin/dashboard");
          return;
        }
        setCurrentUser(data.user);
        if (typeof window !== "undefined" && data.user?.role) {
          localStorage.setItem("admin_user_role", String(data.user.role).toUpperCase());
        }
        setLoadingUser(false);
      })
      .catch(() => {
        router.push("/admin/login");
      });
  }, [router]);

  // Load audit events
  const loadAuditLogs = useCallback(() => {
    setLoadingEvents(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      action: selectedAction,
      ipAddress: selectedIp,
      q: debouncedSearch,
    });

    fetch(`/api/admin/audit-logs?${params.toString()}`, { headers: getClientHeaders(), credentials: "include" })
      .then((res) => (res.ok ? res.json() : { events: [], pagination: { total: 0, totalPages: 1 } }))
      .then((data) => {
        setEvents(data.events || []);
        setTotalCount(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
        if (data.availableActions && data.availableActions.length > 0) {
          setAvailableActions(data.availableActions);
        }
        if (data.availableIps && data.availableIps.length > 0) {
          setAvailableIps(data.availableIps);
        }
        setLoadingEvents(false);
      })
      .catch((err) => {
        console.error("Error loading audit logs:", err);
        setLoadingEvents(false);
      });
  }, [page, limit, selectedAction, selectedIp, debouncedSearch]);

  useEffect(() => {
    if (!loadingUser && currentUser) {
      loadAuditLogs();
    }
  }, [loadingUser, currentUser, loadAuditLogs]);

  // Action badge color helper
  const getActionBadge = (action: string) => {
    switch (action) {
      case "EXECUTIVE_UPDATE":
        return { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.3)", color: "#60a5fa" };
      case "USER_CREATE":
        return { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.3)", color: "#34d399" };
      case "USER_UPDATE":
        return { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", color: "#fbbf24" };
      case "LOGIN":
        return { bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.3)", color: "#38bdf8" };
      case "LOGOUT":
        return { bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.3)", color: "#94a3b8" };
      default:
        return { bg: "rgba(255, 255, 255, 0.08)", border: "rgba(255, 255, 255, 0.15)", color: "#e2e8f0" };
    }
  };

  if (loadingUser) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B1120", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#94a3b8" }}>
          <Loader2 className="animate-spin" size={24} />
          <span>Verifying administrator permissions…</span>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      title="Audit Trail & Security Logs"
      subtitle="Complete chronological audit trail with verified client IP address sync"
      currentUser={currentUser}
    >
      <div style={{ padding: "28px 32px", maxWidth: "1600px", margin: "0 auto" }}>
        {/* KPI Banner */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
          <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8" }}>TOTAL AUDIT EVENTS</span>
              <Activity size={18} color="#60a5fa" />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#f8fafc", marginTop: "8px" }}>{totalCount.toLocaleString()}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Immutable events in PostgreSQL ec-data</div>
          </div>

          <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#34d399" }}>IP SYNCHRONIZATION</span>
              <Globe size={18} color="#34d399" />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#34d399", marginTop: "8px" }}>100% Synced</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Every update tied to real client IP</div>
          </div>

          <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#38bdf8" }}>ACTIVE ACTIONS</span>
              <ShieldAlert size={18} color="#38bdf8" />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#38bdf8", marginTop: "8px" }}>{availableActions.length} Actions</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Executive updates, user mods, logins</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div
          style={{
            background: "#0F172A",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
              <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search actor, resource, or metadata…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: "8px",
                  background: "#1E293B",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>

            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                background: "#1E293B",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
              }}
            >
              <option value="">All Action Types</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>

            <select
              value={selectedIp}
              onChange={(e) => {
                setSelectedIp(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                background: "#1E293B",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
              }}
            >
              <option value="">All IP Addresses</option>
              {availableIps.map((ip) => (
                <option key={ip} value={ip}>{ip}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={loadAuditLogs}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 14px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#94a3b8",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} className={loadingEvents ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#1E293B", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Timestamp</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Actor (User)</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Action</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Target Resource</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Client IP & Device</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600", textAlign: "right" }}>Details / Diff</th>
              </tr>
            </thead>
            <tbody>
              {loadingEvents ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Loading audit records from PostgreSQL ec-data…</span>
                    </div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  const badge = getActionBadge(evt.action);
                  const isExecUpdate = evt.action === "EXECUTIVE_UPDATE";
                  const changedCount = evt.metadata?.changedFields?.length || 0;

                  return (
                    <tr key={evt.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f8fafc", fontSize: "12px" }}>
                          <Clock size={13} color="#94a3b8" />
                          <span>{new Date(evt.occurredAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}</span>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div>
                          <div style={{ fontWeight: "600", color: "#f8fafc", fontSize: "13px" }}>
                            {evt.actorName}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{evt.actorEmail}</span>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "600",
                                color: evt.actorRole === "ADMIN_NATIONAL" ? "#34d399" : "#60a5fa",
                                background: evt.actorRole === "ADMIN_NATIONAL" ? "rgba(16, 185, 129, 0.1)" : "rgba(59, 130, 246, 0.1)",
                                padding: "1px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {evt.actorRole}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.color,
                            borderRadius: "999px",
                            padding: "3px 10px",
                            fontSize: "11px",
                            fontWeight: "700",
                            letterSpacing: "0.3px",
                          }}
                        >
                          {evt.action}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div>
                          <div style={{ color: "#f8fafc", fontWeight: "500", fontSize: "13px" }}>
                            {evt.resource} {evt.resourceId ? `#${evt.resourceId}` : ""}
                          </div>
                          {evt.metadata?.executiveName && (
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                              {String(evt.metadata.executiveName)} ({String(evt.metadata.position || "")})
                            </div>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "6px", padding: "3px 8px", width: "fit-content" }}>
                            <Globe size={12} color="#38bdf8" />
                            <span style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: "12px", fontWeight: "600" }}>
                              {evt.ipAddress}
                            </span>
                          </div>
                          {evt.deviceId && evt.deviceId !== "web" && (
                            <div
                              title={`Hardware/Browser Device Identifier: ${evt.deviceId}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "10px",
                                color: "#94a3b8",
                                background: "rgba(255, 255, 255, 0.04)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                width: "fit-content",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                              }}
                            >
                              <Laptop size={11} color="#64748b" />
                              <span style={{ fontFamily: "monospace", color: "#cbd5e1" }}>
                                {evt.deviceId.length > 18 ? evt.deviceId.slice(0, 16) + "…" : evt.deviceId}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        {isExecUpdate && evt.metadata?.diff ? (
                          <button
                            onClick={() => setSelectedEvent(evt)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "rgba(59, 130, 246, 0.15)",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              color: "#60a5fa",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            <Eye size={13} /> View Diff ({changedCount})
                          </button>
                        ) : evt.metadata ? (
                          <button
                            onClick={() => setSelectedEvent(evt)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "#94a3b8",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            <FileText size={13} /> View Details
                          </button>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div
            style={{
              padding: "14px 20px",
              background: "#1E293B",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#94a3b8",
            }}
          >
            <div>
              Showing {events.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalCount)} of {totalCount.toLocaleString()} total audit events
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: page <= 1 ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: page <= 1 ? "#64748b" : "#ffffff",
                  fontSize: "12px",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <span style={{ padding: "0 8px", color: "#f8fafc", fontWeight: "600" }}>
                Page {page} of {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: page >= totalPages ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: page >= totalPages ? "#64748b" : "#ffffff",
                  fontSize: "12px",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* MODAL: DIFF / AUDIT METADATA INSPECTOR */}
        {selectedEvent && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "20px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "680px",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                background: "#0F172A",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "14px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
                overflow: "hidden",
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        background: getActionBadge(selectedEvent.action).bg,
                        border: `1px solid ${getActionBadge(selectedEvent.action).border}`,
                        color: getActionBadge(selectedEvent.action).color,
                        borderRadius: "999px",
                        padding: "2px 8px",
                        fontSize: "10px",
                        fontWeight: "700",
                      }}
                    >
                      {selectedEvent.action}
                    </span>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "#f8fafc" }}>
                      Audit Investigation Details
                    </h3>
                  </div>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                    Event ID: <code style={{ color: "#38bdf8" }}>{selectedEvent.id}</code> • Synced Client IP:{" "}
                    <code style={{ color: "#34d399" }}>{selectedEvent.ipAddress}</code>
                    {selectedEvent.deviceId && selectedEvent.deviceId !== "web" && (
                      <>
                        {" "}• Device: <code style={{ color: "#fbbf24" }}>{selectedEvent.deviceId}</code>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                {/* Event Metadata Banner */}
                <div
                  style={{
                    background: "#1E293B",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginBottom: "20px",
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "12px",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b" }}>Actor: </span>
                    <strong style={{ color: "#f8fafc" }}>{selectedEvent.actorName}</strong> ({selectedEvent.actorEmail})
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Role: </span>
                    <strong style={{ color: selectedEvent.actorRole === "ADMIN_NATIONAL" ? "#34d399" : "#60a5fa" }}>
                      {selectedEvent.actorRole}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Resource: </span>
                    <strong style={{ color: "#f8fafc" }}>
                      {selectedEvent.resource} #{selectedEvent.resourceId}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Timestamp: </span>
                    <strong style={{ color: "#f8fafc" }}>
                      {new Date(selectedEvent.occurredAt).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Diff Table (if executive update) */}
                {selectedEvent.metadata?.diff && Object.keys(selectedEvent.metadata.diff).length > 0 ? (
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#f8fafc", marginBottom: "10px" }}>
                      Field-Level Modifications ({Object.keys(selectedEvent.metadata.diff).length} fields changed)
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#1E293B", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                          <th style={{ padding: "10px 12px", color: "#94a3b8" }}>Field</th>
                          <th style={{ padding: "10px 12px", color: "#f87171" }}>Previous Value</th>
                          <th style={{ padding: "10px 12px", color: "#34d399" }}>Updated Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedEvent.metadata.diff).map(([fKey, diffVal]: [string, any]) => (
                          <tr key={fKey} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                            <td style={{ padding: "10px 12px", fontWeight: "600", color: "#60a5fa" }}>{fKey}</td>
                            <td style={{ padding: "10px 12px", color: "#f87171", background: "rgba(239, 68, 68, 0.05)" }}>
                              {diffVal.from !== null && diffVal.from !== undefined && diffVal.from !== ""
                                ? String(diffVal.from)
                                : "— (empty)"}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#34d399", background: "rgba(16, 185, 129, 0.05)" }}>
                              {diffVal.to !== null && diffVal.to !== undefined && diffVal.to !== ""
                                ? String(diffVal.to)
                                : "— (cleared)"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#f8fafc", marginBottom: "10px" }}>
                      Event Payload Metadata
                    </div>
                    <pre
                      style={{
                        background: "#020617",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        padding: "14px",
                        color: "#38bdf8",
                        fontSize: "12px",
                        overflowX: "auto",
                        fontFamily: "monospace",
                      }}
                    >
                      {JSON.stringify(selectedEvent.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "#1E293B",
                }}
              >
                <button
                  onClick={() => setSelectedEvent(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
