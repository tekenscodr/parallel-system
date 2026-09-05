"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/admin/components/AdminShell";
import {
  Users,
  UserPlus,
  Search,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  User,
  X,
  RefreshCw,
  Power,
  Key,
  Globe,
  Clock,
} from "lucide-react";

interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  lastIpAddress: string | null;
  activeSessionsCount: number;
}

interface CurrentAdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentAdminUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("NATIONAL");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Reset Password Modal
  const [resetModalUser, setResetModalUser] = useState<AdminUserRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // Fetch current session
  useEffect(() => {
    fetch("/api/admin/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.authenticated) {
          router.push("/admin/login");
          return;
        }
        const roleUpper = String(data.user?.role || "").toUpperCase();
        if (roleUpper !== "ADMIN_NATIONAL" && roleUpper !== "ADMIN") {
          // National users cannot access user management
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

  // Fetch users list
  const loadUsers = useCallback(() => {
    setLoadingUsers(true);
    fetch("/api/admin/users", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => {
        setUsers(data.users || []);
        setLoadingUsers(false);
      })
      .catch((err) => {
        console.error("Error loading users:", err);
        setLoadingUsers(false);
      });
  }, []);

  useEffect(() => {
    if (!loadingUser && currentUser) {
      loadUsers();
    }
  }, [loadingUser, currentUser, loadUsers]);

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
          role: createRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user.");
      }

      setCreateSuccess(`User ${data.user.name} created successfully!`);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("NATIONAL");
      loadUsers();

      setTimeout(() => {
        setCreateModalOpen(false);
        setCreateSuccess("");
      }, 1200);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Error creating user.");
    } finally {
      setCreating(false);
    }
  };

  // Handle Toggle Status (ACTIVE / SUSPENDED)
  const handleToggleStatus = async (user: AdminUserRecord) => {
    const nextStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const confirmMsg =
      nextStatus === "SUSPENDED"
        ? `Are you sure you want to suspend ${user.name}? They will be immediately logged out and blocked from updating executives.`
        : `Activate account for ${user.name}?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update status.");
        return;
      }

      // Optimistic update
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
    } catch (err) {
      console.error("Status toggle error:", err);
      alert("Failed to update status.");
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetting(true);
    setResetError("");
    setResetSuccess("");

    try {
      const res = await fetch(`/api/admin/users/${resetModalUser.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      setResetSuccess("Password successfully updated.");
      setNewPassword("");
      setTimeout(() => {
        setResetModalUser(null);
        setResetSuccess("");
      }, 1200);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "Error resetting password.");
    } finally {
      setResetting(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || u.role.toUpperCase() === roleFilter.toUpperCase();
    const matchesStatus = !statusFilter || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "ACTIVE").length;
  const suspendedUsers = users.filter((u) => u.status === "SUSPENDED").length;
  const nationalUsers = users.filter((u) => u.role.toUpperCase() === "NATIONAL").length;

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
      title="User Management"
      subtitle="National Officer Accounts, Access Roles & Security Audit"
      currentUser={currentUser}
    >
      <div style={{ padding: "28px 32px", maxWidth: "1600px", margin: "0 auto" }}>
        {/* KPI Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8" }}>TOTAL USERS</span>
              <Users size={18} color="#60a5fa" />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#f8fafc", marginTop: "8px" }}>{totalUsers}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Configured in PostgreSQL ec-data</div>
          </div>

          <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#34d399" }}>ACTIVE USERS</span>
              <CheckCircle2 size={18} color="#34d399" />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#34d399", marginTop: "8px" }}>{activeUsers}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Authorized for system access</div>
          </div>

          <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#38bdf8" }}>NATIONAL OFFICERS</span>
              <ShieldCheck size={18} color="#38bdf8" />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#38bdf8", marginTop: "8px" }}>{nationalUsers}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Executive update privileges only</div>
          </div>

          <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#f87171" }}>SUSPENDED</span>
              <Power size={18} color="#f87171" />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#f87171", marginTop: "8px" }}>{suspendedUsers}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Blocked from logging in</div>
          </div>
        </div>

        {/* Search & Actions Bar */}
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
                placeholder="Search user name or email…"
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
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
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
              <option value="">All Roles</option>
              <option value="ADMIN_NATIONAL">Admin_national</option>
              <option value="NATIONAL">National</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={loadUsers}
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
              <RefreshCw size={14} className={loadingUsers ? "animate-spin" : ""} /> Refresh
            </button>

            <button
              onClick={() => {
                setCreateError("");
                setCreateSuccess("");
                setCreateModalOpen(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 16px",
                borderRadius: "8px",
                background: "#2563EB",
                border: "none",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(37, 99, 235, 0.3)",
              }}
            >
              <UserPlus size={15} /> Create National User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div style={{ background: "#0F172A", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#1E293B", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>User Identity</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Access Role</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Account Status</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Last Verified IP</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600" }}>Last Active</th>
                <th style={{ padding: "14px 18px", color: "#94a3b8", fontWeight: "600", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Loading user accounts from ec-data…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleUpper = u.role.toUpperCase();
                  const isAdmin = roleUpper === "ADMIN_NATIONAL" || roleUpper === "ADMIN";
                  const isCurrent = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: isAdmin ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.15)",
                              border: isAdmin ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid rgba(16, 185, 129, 0.3)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "12px",
                              color: isAdmin ? "#60a5fa" : "#34d399",
                            }}
                          >
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: "600", color: "#f8fafc" }}>
                              {u.name} {isCurrent && <span style={{ color: "#38bdf8", fontSize: "11px" }}>(You)</span>}
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            background: isAdmin ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                            color: isAdmin ? "#34d399" : "#60a5fa",
                            border: isAdmin ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(59, 130, 246, 0.3)",
                            borderRadius: "999px",
                            padding: "3px 10px",
                            fontSize: "11px",
                            fontWeight: "600",
                          }}
                        >
                          {isAdmin ? "Admin_national" : "National Officer"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: u.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: u.status === "ACTIVE" ? "#34d399" : "#f87171",
                            border: u.status === "ACTIVE" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "999px",
                            padding: "3px 10px",
                            fontSize: "11px",
                            fontWeight: "600",
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: u.status === "ACTIVE" ? "#34d399" : "#f87171" }} />
                          {u.status}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        {u.lastIpAddress ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Globe size={13} color="#94a3b8" />
                            <span style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: "12px" }}>
                              {u.lastIpAddress}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>Pending first login</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        {u.lastSeenAt ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8", fontSize: "12px" }}>
                            <Clock size={13} />
                            <span>{new Date(u.lastSeenAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            onClick={() => {
                              setResetError("");
                              setResetSuccess("");
                              setNewPassword("");
                              setResetModalUser(u);
                            }}
                            title="Reset password"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "#94a3b8",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            <Key size={12} /> Reset Pass
                          </button>

                          {!isCurrent && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                background: u.status === "ACTIVE" ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                border: u.status === "ACTIVE" ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid rgba(16, 185, 129, 0.25)",
                                color: u.status === "ACTIVE" ? "#f87171" : "#34d399",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              <Power size={12} /> {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MODAL: CREATE USER */}
        {createModalOpen && (
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
                maxWidth: "480px",
                background: "#0F172A",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "14px",
                padding: "28px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0, color: "#f8fafc" }}>
                    Create National User
                  </h2>
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                    National officers have access to view and update executives only.
                  </p>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {createError && (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "10px 14px", color: "#f87171", fontSize: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={15} /> {createError}
                </div>
              )}

              {createSuccess && (
                <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", padding: "10px 14px", color: "#34d399", fontSize: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} /> {createSuccess}
                </div>
              )}

              <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "6px" }}>
                    Full Name
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={15} color="#64748b" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kwame Mensah"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: "8px",
                        background: "#1E293B",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#ffffff",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "6px" }}>
                    Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} color="#64748b" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="email"
                      required
                      placeholder="e.g. kwame.mensah@ec-data.gov.gh"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: "8px",
                        background: "#1E293B",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#ffffff",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "6px" }}>
                    Initial Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} color="#64748b" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: "8px",
                        background: "#1E293B",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#ffffff",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "6px" }}>
                    Access Privilege Level
                  </label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "#1E293B",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  >
                    <option value="NATIONAL">National (Executive View & Updates Only — No Sidebar)</option>
                    <option value="ADMIN_NATIONAL">Admin_national (Full Admin with Sidebar & Audit)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#94a3b8",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 18px",
                      borderRadius: "8px",
                      background: "#2563EB",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {creating && <Loader2 className="animate-spin" size={14} />}
                    {creating ? "Creating Account…" : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RESET PASSWORD */}
        {resetModalUser && (
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
                maxWidth: "440px",
                background: "#0F172A",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "14px",
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "#f8fafc" }}>
                  Reset Password: {resetModalUser.name}
                </h3>
                <button
                  onClick={() => setResetModalUser(null)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {resetError && (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "10px 14px", color: "#f87171", fontSize: "12px", marginBottom: "14px" }}>
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", padding: "10px 14px", color: "#34d399", fontSize: "12px", marginBottom: "14px" }}>
                  {resetSuccess}
                </div>
              )}

              <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "#1E293B",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#94a3b8",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetting}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "#2563EB",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {resetting ? "Resetting…" : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
