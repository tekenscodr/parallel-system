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
  ChevronRight,
  Menu,
  X,
  UserCheck,
  ShieldCheck,
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
  const [clientIp, setClientIp] = useState<string>("127.0.0.1");

  const roleUpper = String(currentUser?.role || "").toUpperCase();
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
            <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, rgba(30, 64, 175, 0.5), rgba(59, 130, 246, 0.2))",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 15px rgba(59, 130, 246, 0.15)",
                  }}
                >
                  <Landmark size={20} color="#60a5fa" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "800", letterSpacing: "-0.3px", color: "#f8fafc" }}>
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
              <div>
                <h1 style={{ fontSize: "16px", fontWeight: "700", margin: 0, letterSpacing: "-0.3px", color: "#f8fafc" }}>
                  {title}
                </h1>
                <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>
                  {subtitle}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
    </div>
  );
}
