"use client";

import { useState } from "react";
import { Landmark, AlertCircle, CheckCircle2, ArrowRight, KeyRound, Lock } from "lucide-react";

export default function AdminLoginPage() {
  const [mode, setMode] = useState<"login" | "resubmit">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      if (data.token) {
        localStorage.setItem("admin_session_token", data.token);
        if (data.user?.role) {
          localStorage.setItem("admin_user_role", String(data.user.role).toUpperCase());
        }
        document.cookie = `admin_session=${data.token}; path=/; max-age=86400; SameSite=Lax`;
      }

      window.location.href = "/admin/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(`Could not connect to authentication server: ${msg}`);
      setLoading(false);
    }
  };

  const handleResubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update password.");
        setLoading(false);
        return;
      }

      setSuccess("Password updated successfully! Logging you in...");

      if (data.token) {
        localStorage.setItem("admin_session_token", data.token);
        if (data.user?.role) {
          localStorage.setItem("admin_user_role", String(data.user.role).toUpperCase());
        }
        document.cookie = `admin_session=${data.token}; path=/; max-age=86400; SameSite=Lax`;
      }

      setTimeout(() => {
        window.location.href = "/admin/dashboard";
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(`Could not connect to authentication server: ${msg}`);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)",
        color: "#f8fafc",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(15, 23, 42, 0.75)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          padding: "36px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              marginBottom: "16px",
            }}
          >
            {mode === "resubmit" ? (
              <KeyRound size={26} color="#38bdf8" />
            ) : (
              <Landmark size={26} color="#94a3b8" />
            )}
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 6px 0",
              letterSpacing: "-0.5px",
            }}
          >
            National Executive Command
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            {mode === "resubmit"
              ? "Resubmit and set a new password on login"
              : "Restricted to authorized national administrators & officers"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "rgba(2, 6, 23, 0.7)",
            padding: "4px",
            borderRadius: "10px",
            marginBottom: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setSuccess("");
            }}
            style={{
              padding: "8px",
              borderRadius: "7px",
              border: "none",
              background: mode === "login" ? "rgba(30, 41, 59, 0.9)" : "transparent",
              color: mode === "login" ? "#ffffff" : "#94a3b8",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Standard Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("resubmit");
              setError("");
              setSuccess("");
            }}
            style={{
              padding: "8px",
              borderRadius: "7px",
              border: "none",
              background: mode === "resubmit" ? "rgba(30, 41, 59, 0.9)" : "transparent",
              color: mode === "resubmit" ? "#38bdf8" : "#94a3b8",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Resubmit Password
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#f87171",
              fontSize: "13px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              color: "#34d399",
              fontSize: "13px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {mode === "login" ? (
          /* ================= STANDARD LOGIN FORM ================= */
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Administrator Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@ec-data.gov.gh"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 23, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#cbd5e1",
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setMode("resubmit")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#38bdf8",
                    fontSize: "11px",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Need to change password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 23, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "8px",
                background: loading
                  ? "#334155"
                  : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>{loading ? "Authenticating…" : "Authenticate & Access Directorate"}</span>
              <ArrowRight size={15} />
            </button>
          </form>
        ) : (
          /* ================= RESUBMIT PASSWORD FORM ================= */
          <form onSubmit={handleResubmitPassword}>
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@ec-data.gov.gh"
                style={{
                  width: "100%",
                  padding: "11px 13px",
                  borderRadius: "8px",
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
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Current / Temporary Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: "100%",
                  padding: "11px 13px",
                  borderRadius: "8px",
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
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                New Password (minimum 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                style={{
                  width: "100%",
                  padding: "11px 13px",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 23, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "22px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new strong password"
                style={{
                  width: "100%",
                  padding: "11px 13px",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 23, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "8px",
                background: loading
                  ? "#334155"
                  : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <span>{loading ? "Updating & Logging in…" : "Resubmit Password & Sign In"}</span>
              <Lock size={15} />
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "12px",
                cursor: "pointer",
                textAlign: "center",
                padding: "6px",
              }}
            >
              ← Back to standard Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
