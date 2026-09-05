"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Landmark,
  Users,
  ShieldAlert,
  Layers,
  LogOut,
  ArrowLeft,
  Activity,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  UserCheck,
  ShieldCheck,
  KeyRound,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AdminShellProps {
  title?: string;
  subtitle?: string;
  currentUser: AdminUser | null;
  children: React.ReactNode;
  onLogout?: () => void;
}

export function AdminShell({
  title = "National Executive Directorate",
  subtitle = "Full nationwide command access across all 6 administrative tiers",
  currentUser,
  children,
  onLogout,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [cachedRole, setCachedRole] = useState("");
  const [clientIp, setClientIp] = useState<string>("127.0.0.1");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // Persist sidebar preference & restore cached role immediately to prevent flicker on refresh
  useEffect(() => {
    setHasMounted(true);
    try {
      const savedSidebar = localStorage.getItem("admin_sidebar_open");
      if (savedSidebar !== null) {
        setSidebarOpen(savedSidebar === "true");
      }
      const savedRole = localStorage.getItem("admin_user_role");
      if (savedRole) {
        setCachedRole(savedRole);
      }
    } catch {
      // localStorage may be blocked in some private browsing contexts
    }
  }, []);

  // Update cached role whenever currentUser is received
  useEffect(() => {
    if (currentUser?.role) {
      const upper = String(currentUser.role).toUpperCase();
      setCachedRole(upper);
      try {
        localStorage.setItem("admin_user_role", upper);
      } catch {
        // ignore
      }
    }
  }, [currentUser]);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPwError("New password must be different from current password.");
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || "Failed to update password.");
        setPwLoading(false);
        return;
      }
      setPwSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPwSuccess("");
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setPwError(`Connection error: ${msg}`);
    } finally {
      setPwLoading(false);
    }
  };

  const roleUpper = String(currentUser?.role || cachedRole || "").toUpperCase();
  const isAdminNational = roleUpper === "ADMIN_NATIONAL" || roleUpper === "ADMIN";
  const isNationalOfficer = roleUpper === "NATIONAL";

  // Navigation tabs visible only for Admin_national
  const navItems = [
    {
      href: "/admin/dashboard",
      label: "Executives Directory",
      icon: Layers,
      description: "261k+ nationwide executive registry & updates",
    },
    {
      href: "/admin/users",
      label: "User Management",
      icon: Users,
      description: "Create national officers & control access",
    },
    {
      href: "/admin/audit-logs",
      label: "Audit Trail & IP Logs",
      icon: ShieldAlert,
      description: "Real-time security log with IP synchronization",
    },
  ];

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_session_token");
      localStorage.removeItem("admin_user_role");
      router.push("/admin/login");
    } catch {
      router.push("/admin/login");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B1120", color: "#f8fafc", display: "flex", flexDirection: "column" }}>
      {/* 
        ========================================================================
        SCENARIO A: ADMIN_NATIONAL (Sidebar Layout Enabled)
        ========================================================================
      */}
      {isAdminNational ? (
        <div style={{ display: "flex", flex: 1, position: "relative" }}>
          {/* Desktop Left Sidebar */}
          {sidebarOpen && (
            <aside
            style={{
              width: "264px",
              background: "#0F172A",
              borderRight: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              position: "sticky",
              top: 0,
              height: "100vh",
              zIndex: 50,
              flexShrink: 0,
            }}
          >
            {/* Directorate Branding */}
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, rgba(30, 64, 175, 0.5), rgba(59, 130, 246, 0.2))",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 15px rgba(59, 130, 246, 0.15)",
                  }}
                >
                  <Landmark size={18} color="#60a5fa" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "800", letterSpacing: "-0.3px", color: "#f8fafc" }}>
                      REACH
                    </span>
                    <span
                      style={{
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#34d399",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: "4px",
                        padding: "1px 5px",
                        fontSize: "9px",
                        fontWeight: "700",
                        letterSpacing: "0.5px",
                      }}
                    >
                      DIRECTORATE
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    ec-data Command Center
                  </div>
                </div>
              </div>

              {/* Collapse Sidebar Button */}
              <button
                type="button"
                onClick={toggleSidebar}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  color: "#94a3b8",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Navigation Links */}
            <div style={{ padding: "18px 12px", flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", padding: "0 10px 10px 10px" }}>
                Admin Portal Navigation
              </div>
              <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href === "/admin/dashboard" && pathname === "/admin");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        textDecoration: "none",
                        color: isActive ? "#ffffff" : "#94a3b8",
                        background: isActive ? "rgba(30, 64, 175, 0.25)" : "transparent",
                        border: isActive ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isActive ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.04)",
                          color: isActive ? "#60a5fa" : "#94a3b8",
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: isActive ? "600" : "500", lineHeight: 1.2 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "10px", color: isActive ? "#93c5fd" : "#64748b", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.description}
                        </div>
                      </div>
                      {isActive && <ChevronRight size={14} color="#60a5fa" />}
                    </Link>
                  );
                })}
              </nav>

              {/* Security & Access Badge */}
              <div
                style={{
                  marginTop: "24px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#34d399", fontSize: "11px", fontWeight: "700" }}>
                  <ShieldCheck size={14} />
                  <span>Audit & IP Sync Active</span>
                </div>
                <p style={{ fontSize: "11px", color: "#94a3b8", margin: "6px 0 0 0", lineHeight: 1.4 }}>
                  All user updates and actions are securely logged with verified client IP sync.
                </p>
              </div>
            </div>

            {/* User Profile & Footer Actions */}
            <div style={{ padding: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(11, 17, 32, 0.6)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      background: "rgba(16, 185, 129, 0.2)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "12px",
                      color: "#34d399",
                    }}
                  >
                    {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : "NA"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {currentUser?.name || "National Admin"}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {currentUser?.email || "admin@ec-data.gov.gh"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & IP sync pill */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "#94a3b8", marginBottom: "12px", padding: "4px 8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "6px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  Role: admin_national
                </span>
                <span style={{ fontFamily: "monospace", color: "#38bdf8" }}>IP Synced</span>
              </div>

              {/* Navigation & Logout Buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <Link
                  href="/dashboard"
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "7px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#94a3b8",
                    fontSize: "11px",
                    textDecoration: "none",
                  }}
                >
                  <ArrowLeft size={12} /> Standard App
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "7px 12px",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={12} /> Logout
                </button>
              </div>
            </div>
          </aside>
          )}

          {/* Main Content Area */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {/* Top Bar for Desktop */}
            <header
              style={{
                height: "64px",
                background: "rgba(15, 23, 42, 0.95)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "0 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backdropFilter: "blur(12px)",
                position: "sticky",
                top: 0,
                zIndex: 40,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    title="Open sidebar navigation"
                    aria-label="Open sidebar navigation"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "rgba(30, 41, 59, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#cbd5e1",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Menu size={15} />
                    <span>Sidebar</span>
                  </button>
                )}
                <div>
                  <h1 style={{ fontSize: "16px", fontWeight: "700", margin: 0, letterSpacing: "-0.3px", color: "#f8fafc" }}>
                    {title}
                  </h1>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>
                    {subtitle}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "999px",
                    padding: "3px 10px",
                    fontSize: "11px",
                    fontWeight: "600",
                  }}
                >
                  Admin_national Privileges
                </span>
                <span
                  style={{
                    background: "rgba(56, 189, 248, 0.1)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: "999px",
                    padding: "3px 10px",
                    fontSize: "11px",
                  }}
                >
                  ec-data PostgreSQL
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalOpen(true);
                    setPwError("");
                    setPwSuccess("");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    background: "rgba(59, 130, 246, 0.12)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <KeyRound size={13} />
                  <span>Change Password</span>
                </button>
              </div>
            </header>

            {/* Page Children */}
            <main style={{ flex: 1 }}>{children}</main>
          </div>
        </div>
      ) : (
        /* 
          ========================================================================
          SCENARIO B: NATIONAL USER (Sidebar Hidden • Executive Access Only)
          ========================================================================
        */
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* Top Full-Width Header */}
          <header
            style={{
              background: "rgba(15, 23, 42, 0.98)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "16px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backdropFilter: "blur(12px)",
              position: "sticky",
              top: 0,
              zIndex: 40,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Landmark size={20} color="#60a5fa" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h1 style={{ fontSize: "16px", fontWeight: "700", margin: 0, letterSpacing: "-0.3px" }}>
                    National Executive Directory
                  </h1>
                  <span
                    style={{
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#60a5fa",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                  >
                    Role: National Officer
                  </span>
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "11px",
                    }}
                  >
                    Audit Synced
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>
                  Authorized to inspect and update nationwide party executives
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setPasswordModalOpen(true);
                  setPwError("");
                  setPwSuccess("");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(59, 130, 246, 0.12)",
                  color: "#60a5fa",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <KeyRound size={13} />
                <span>Change Password</span>
              </button>
              <Link
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#94a3b8",
                  fontSize: "12px",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <ArrowLeft size={13} /> Standard App
              </Link>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#f8fafc" }}>
                  {currentUser?.name || "National Officer"}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b" }}>
                  {currentUser?.email || "officer@ec-data.gov.gh"}
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <LogOut size={13} /> Logout
              </button>
            </div>
          </header>

          {/* Main workspace */}
          <main style={{ flex: 1 }}>{children}</main>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pwLoading) {
              setPasswordModalOpen(false);
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "14px",
              padding: "28px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <KeyRound size={18} color="#60a5fa" />
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "#f8fafc" }}>
                    Change Password
                  </h3>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>
                    Update your account access credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                disabled={pwLoading}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {pwError && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "6px",
                  color: "#f87171",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                {pwError}
              </div>
            )}

            {pwSuccess && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "6px",
                  color: "#34d399",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                {pwSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "5px" }}>
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    background: "rgba(2, 6, 23, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "5px" }}>
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    background: "rgba(2, 6, 23, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "5px" }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    background: "rgba(2, 6, 23, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  disabled={pwLoading}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "6px",
                    border: "none",
                    background: pwLoading ? "#334155" : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: pwLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {pwLoading ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
