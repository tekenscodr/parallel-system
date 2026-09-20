"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Landmark,
  Users,
  ShieldAlert,
  Layers,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  Award,
  GitPullRequest,
} from "lucide-react";
import { initClientIpDetection } from "@/lib/client-device";
import { canAccessAlbums } from "@/lib/album-access";
import { useSessionGuard, logoutAndRedirect } from "@/lib/client-session";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordChanged?: boolean;
  passwordChangedAt?: string | null;
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

  // Monitor token expiration & auto-logout when expired
  useSessionGuard();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        if (window.innerWidth < 1024) return false;
        const savedSidebar = localStorage.getItem("admin_sidebar_open");
        if (savedSidebar !== null) return savedSidebar === "true";
      } catch {
        // ignore
      }
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  const [cachedRole] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("admin_user_role") || "";
      } catch {
        // ignore
      }
    }
    return "";
  });

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<"prompt" | "form">("prompt");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // 5-minute reminder to confirm whether to change or keep password if not changed after login
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentUser?.passwordChanged) return;

    try {
      const isUpdated = localStorage.getItem("admin_password_updated") === "true";
      const isDismissed = sessionStorage.getItem("admin_password_dismissed") === "true";

      if (isUpdated || isDismissed) {
        return;
      }

      const loginTimeStr = sessionStorage.getItem("admin_login_time");
      const loginTime = loginTimeStr ? parseInt(loginTimeStr, 10) : Date.now();
      if (!loginTimeStr) {
        sessionStorage.setItem("admin_login_time", String(loginTime));
      }

      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      const elapsed = Date.now() - loginTime;
      const remaining = Math.max(0, FIVE_MINUTES_MS - elapsed);

      const timer = setTimeout(() => {
        const currentUpdated = localStorage.getItem("admin_password_updated") === "true" || !!currentUser?.passwordChanged;
        const currentDismissed = sessionStorage.getItem("admin_password_dismissed") === "true";
        if (!currentUpdated && !currentDismissed) {
          setModalStep("prompt");
          setPwError("");
          setPwSuccess("");
          setPasswordModalOpen(true);
        }
      }, remaining);

      return () => clearTimeout(timer);
    } catch {
      // ignore
    }
  }, [currentUser]);

  useEffect(() => {
    initClientIpDetection().catch(() => {});
  }, []);

  // Update cached role whenever currentUser is received
  useEffect(() => {
    if (currentUser?.role) {
      const upper = String(currentUser.role).toUpperCase();
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
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_session_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PASSWORD_ALREADY_CHANGED") {
          try {
            localStorage.setItem("admin_password_updated", "true");
          } catch {
            // ignore
          }
        }
        setPwError(data.error || "Failed to update password.");
        setPwLoading(false);
        return;
      }
      setPwSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      try {
        localStorage.setItem("admin_password_updated", "true");
      } catch {
        // ignore
      }
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
  const isC1 = roleUpper === "C1";
  const isPasswordLocked = !isAdminNational && Boolean(currentUser?.passwordChanged);

  // Navigation tabs visible only for Admin_national
  const navItems = [
    {
      href: "/admin/dashboard",
      label: "Executives Directory",
      icon: Layers,
      description: "261k+ nationwide executive registry & updates",
    },
    {
      href: "/admin/accreditation",
      label: "Accreditation & Badges",
      icon: Award,
      description: "Media, Security & Protocol credentials & pass printing",
    },
    {
      href: "/admin/update-requests",
      label: "Update Requests",
      icon: GitPullRequest,
      description: "Review and approve executive correction submissions",
    },
    {
      href: "/admin/albums",
      label: "Election Albums",
      icon: FileText,
      description: "Provisional election albums by contest & level",
    },
    {
      href: "/admin/albums/ahafo",
      label: "Ahafo Regional Album",
      icon: FileText,
      description: "Official 15-page regional electoral roll",
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
  ].filter((item) => !item.href.startsWith("/admin/albums") || canAccessAlbums(currentUser));

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    await logoutAndRedirect("user_logout");
  };

  return (
    <div style={{ minHeight: "100vh", background: isC1 ? "#ffffff" : "#0B1120", color: isC1 ? "#0f172a" : "#f8fafc", display: "flex", flexDirection: "column" }}>
      <style>{`
        @media (max-width: 768px) {
          .scenario-b-header {
            padding: 12px 16px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .scenario-b-header-user {
            justify-content: space-between !important;
            width: 100% !important;
          }
        }
      `}</style>
      {/* 
        ========================================================================
        SCENARIO A: ADMIN_NATIONAL (Sidebar Layout Enabled)
        ========================================================================
      */}
      {isAdminNational ? (
        <div style={{ display: "flex", flex: 1, position: "relative" }}>
          <style>{`
            @media (max-width: 1023px) {
              .admin-desktop-sidebar {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                height: 100vh !important;
                width: 280px !important;
                z-index: 100 !important;
                box-shadow: 0 0 50px rgba(0, 0, 0, 0.8) !important;
              }
              .admin-mobile-backdrop {
                display: block !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: rgba(0, 0, 0, 0.65) !important;
                backdrop-filter: blur(4px) !important;
                z-index: 99 !important;
              }
              .admin-header {
                padding: 0 16px !important;
              }
              .admin-header-badges {
                display: none !important;
              }
              .admin-mobile-menu-btn {
                display: inline-flex !important;
              }
            }
            @media (min-width: 1024px) {
              .admin-mobile-backdrop {
                display: none !important;
              }
            }
          `}</style>
          {/* Desktop Left Sidebar */}
          {sidebarOpen && (
            <>
              <div className="admin-mobile-backdrop" onClick={toggleSidebar} />
              <aside
                className="admin-desktop-sidebar"
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
                    borderRadius: "50%",
                    background: "#ffffff",
                    border: "1.5px solid rgba(56, 189, 248, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px",
                    overflow: "hidden",
                    boxShadow: "0 0 15px rgba(56, 189, 248, 0.25)",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/npp-logo.png"
                    alt="NPP IT Directorate"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "800", letterSpacing: "-0.3px", color: "#f8fafc" }}>
                      NPP I.T. DIRECTORATE
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
                      COMMAND
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Electoral College & Executive Registry
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

              {/* Logout Button */}
              <div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
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
          </>
          )}

          {/* Main Content Area */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {/* Top Bar for Desktop */}
            <header
              className="admin-header"
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
                <button
                  type="button"
                  className={!sidebarOpen ? undefined : "admin-mobile-menu-btn"}
                  onClick={toggleSidebar}
                  title="Toggle sidebar navigation"
                  aria-label="Toggle sidebar navigation"
                  style={{
                    display: !sidebarOpen ? "inline-flex" : "none",
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
                  <span>Menu</span>
                </button>
                {!sidebarOpen && (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "2px",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src="/npp-logo.png"
                      alt="NPP IT Directorate"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
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

              <div className="admin-header-badges" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                {isPasswordLocked ? (
                  <div
                    title="Your personal password has already been set and is locked under system security policy."
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      borderRadius: "6px",
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "default",
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Password Set</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setModalStep("form");
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
                )}
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
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: isC1 ? "#ffffff" : undefined }}>
          {/* Top Full-Width Header */}
          <header
            className="scenario-b-header"
            style={{
              background: isC1 ? "#ffffff" : "rgba(15, 23, 42, 0.98)",
              borderBottom: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)",
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
                  background: isC1 ? "#fdf2f8" : "rgba(59, 130, 246, 0.15)",
                  border: isC1 ? "1px solid #fbcfe8" : "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Landmark size={20} color={isC1 ? "#db2777" : "#60a5fa"} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: "16px", fontWeight: "700", margin: 0, letterSpacing: "-0.3px", color: isC1 ? "#0f172a" : "#f8fafc" }}>
                    {isC1 ? "Aspirant page" : (title || "National Executive Directory")}
                  </h1>
                  <span
                    style={{
                      background: isC1 ? "#fdf2f8" : "rgba(59, 130, 246, 0.15)",
                      color: isC1 ? "#be185d" : "#60a5fa",
                      border: isC1 ? "1px solid #fbcfe8" : "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                  >
                    {isC1 ? "All Women" : "Role: National Officer"}
                  </span>
                  <span
                    style={{
                      background: isC1 ? "#f0fdf4" : "rgba(16, 185, 129, 0.1)",
                      color: isC1 ? "#15803d" : "#34d399",
                      border: isC1 ? "1px solid #bbf7d0" : "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                  >
                    Audit Synced
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: isC1 ? "#64748b" : "#94a3b8", margin: "2px 0 0 0" }}>
                  {isC1
                    ? "Authorized to view female electoral college executives across National, Regional, Constituency, External Branches, and TESCON (Presidents & WOCOM)"
                    : "Authorized to inspect and update nationwide party executives"}
                </p>
              </div>
            </div>

            <div className="scenario-b-header-user" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {isPasswordLocked ? (
                <div
                  title="Your personal password has already been set and is locked under system security policy."
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    background: isC1 ? "#f0fdf4" : "rgba(16, 185, 129, 0.1)",
                    color: isC1 ? "#15803d" : "#34d399",
                    border: isC1 ? "1px solid #bbf7d0" : "1px solid rgba(16, 185, 129, 0.25)",
                    fontSize: "12px",
                    fontWeight: "500",
                    cursor: "default",
                  }}
                >
                  <CheckCircle2 size={13} />
                  <span>Password Set</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModalStep("form");
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
                    background: isC1 ? "#f1f5f9" : "rgba(59, 130, 246, 0.12)",
                    color: isC1 ? "#334155" : "#60a5fa",
                    border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(59, 130, 246, 0.3)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <KeyRound size={13} />
                  <span>Change Password</span>
                </button>
              )}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: isC1 ? "#0f172a" : "#f8fafc" }}>
                  {currentUser?.name || (isC1 ? "All Women Officer" : "National Officer")}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b" }}>
                  {currentUser?.email || (isC1 ? "all_women@ec-data.gov.gh" : "officer@ec-data.gov.gh")}
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
                  background: isC1 ? "#fef2f2" : "rgba(239, 68, 68, 0.15)",
                  color: isC1 ? "#dc2626" : "#f87171",
                  border: isC1 ? "1px solid #fecaca" : "1px solid rgba(239, 68, 68, 0.3)",
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
              background: isC1 ? "#ffffff" : "#0f172a",
              border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "14px",
              padding: "28px",
              boxShadow: isC1 ? "0 25px 50px -12px rgba(0, 0, 0, 0.15)" : "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: modalStep === "prompt" ? "rgba(56, 189, 248, 0.15)" : "rgba(59, 130, 246, 0.15)",
                    border: modalStep === "prompt" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(59, 130, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {modalStep === "prompt" ? (
                    <ShieldAlert size={18} color="#38bdf8" />
                  ) : (
                    <KeyRound size={18} color="#60a5fa" />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: isC1 ? "#0f172a" : "#f8fafc" }}>
                    {modalStep === "prompt" ? "Security Confirmation" : "Change Password"}
                  </h3>
                  <p style={{ fontSize: "11px", color: isC1 ? "#64748b" : "#94a3b8", margin: "2px 0 0 0" }}>
                    {modalStep === "prompt"
                      ? "Confirm whether to change or keep your password"
                      : "Update your account access credentials"}
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
                  color: isC1 ? "#64748b" : "#94a3b8",
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

            {modalStep === "prompt" ? (
              /* ================= STAGE 1: PROMPT ================= */
              <div>
                <div
                  style={{
                    padding: "14px 16px",
                    background: isC1 ? "#f0f9ff" : "rgba(56, 189, 248, 0.08)",
                    border: isC1 ? "1px solid #bae6fd" : "1px solid rgba(56, 189, 248, 0.2)",
                    borderRadius: "10px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <ShieldAlert size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h4 style={{ fontSize: "13px", fontWeight: "700", color: isC1 ? "#0369a1" : "#f8fafc", margin: "0 0 4px 0" }}>
                      Password Update Notice
                    </h4>
                    <p style={{ fontSize: "12px", color: isC1 ? "#0284c7" : "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                      You logged in without changing your password. Would you like to set a new password now or keep your current password?
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        sessionStorage.setItem("admin_password_dismissed", "true");
                      } catch {
                        // ignore
                      }
                      setPasswordModalOpen(false);
                    }}
                    style={{
                      padding: "11px 14px",
                      borderRadius: "8px",
                      border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                      background: isC1 ? "#f1f5f9" : "rgba(255, 255, 255, 0.05)",
                      color: isC1 ? "#334155" : "#cbd5e1",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "center",
                    }}
                  >
                    Keep Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalStep("form");
                      setPwError("");
                      setPwSuccess("");
                    }}
                    style={{
                      padding: "11px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>Change Password</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              /* ================= STAGE 2: FORM ================= */
              <form onSubmit={handleChangePassword}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: isC1 ? "#334155" : "#cbd5e1", marginBottom: "5px" }}>
                    Current Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: "100%",
                        padding: "10px 38px 10px 12px",
                        borderRadius: "6px",
                        background: isC1 ? "#f8fafc" : "rgba(2, 6, 23, 0.7)",
                        border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                        color: isC1 ? "#0f172a" : "#ffffff",
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((prev) => !prev)}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: isC1 ? "#64748b" : "#94a3b8",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: isC1 ? "#334155" : "#cbd5e1", marginBottom: "5px" }}>
                    New Password (min 8 characters)
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNewPw ? "text" : "password"}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: "100%",
                        padding: "10px 38px 10px 12px",
                        borderRadius: "6px",
                        background: isC1 ? "#f8fafc" : "rgba(2, 6, 23, 0.7)",
                        border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                        color: isC1 ? "#0f172a" : "#ffffff",
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((prev) => !prev)}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: isC1 ? "#64748b" : "#94a3b8",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: isC1 ? "#334155" : "#cbd5e1", marginBottom: "5px" }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirmPw ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: "100%",
                        padding: "10px 38px 10px 12px",
                        borderRadius: "6px",
                        background: isC1 ? "#f8fafc" : "rgba(2, 6, 23, 0.7)",
                        border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                        color: isC1 ? "#0f172a" : "#ffffff",
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((prev) => !prev)}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: isC1 ? "#64748b" : "#94a3b8",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    disabled={pwLoading}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                      background: isC1 ? "#f1f5f9" : "transparent",
                      color: isC1 ? "#334155" : "#cbd5e1",
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
