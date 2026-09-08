"use client";

import { useState, useEffect } from "react";
import { Landmark, AlertCircle, ArrowRight } from "lucide-react";
import { initClientIpDetection, getClientHeaders } from "@/lib/client-device";
import { checkClientRateLimit } from "@/lib/client-rate-limit";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [mountTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    initClientIpDetection().catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 1. Anti-Bot Honeypot Trap check
    if (honeypot.trim() !== "") {
      setError("Automated bot submission detected.");
      return;
    }

    // 2. Anti-Script Inhuman Speed check (submitted < 400ms after render)
    if (Date.now() - mountTime < 400) {
      setError("Submission too rapid. Please verify credentials manually.");
      return;
    }

    // 3. Client-side sliding window rate limit
    const clientLimit = checkClientRateLimit("LOGIN");
    if (!clientLimit.allowed) {
      setError(clientLimit.message || "Too many attempts. Please wait.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: getClientHeaders({ "Content-Type": "application/json" }),
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

      try {
        sessionStorage.setItem("admin_login_time", String(Date.now()));
        localStorage.setItem(
          "admin_password_updated",
          data.user?.passwordChanged ? "true" : "false"
        );
        sessionStorage.removeItem("admin_password_dismissed");
      } catch {
        // ignore
      }

      // If user already changed their password in DB, proceed straight to dashboard!
      // Otherwise, direct them to change their password once.
      if (data.user?.passwordChanged) {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/admin/change-password";
      }
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
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
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
            <Landmark size={26} color="#94a3b8" />
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
            Restricted to authorized national administrators & officers
          </p>
          <div
            style={{
              marginTop: "8px",
              display: "inline-block",
              fontSize: "11px",
              padding: "3px 10px",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.12)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >
            ec-data PostgreSQL Backend
          </div>
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

        <form onSubmit={handleLogin}>
          {/* Honeypot Trap Field - Hidden from humans, targets auto-fill bots */}
          <div
            style={{
              position: "absolute",
              left: "-9999px",
              top: "-9999px",
              opacity: 0,
              height: 0,
              width: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            <label htmlFor="website_url_check">Security Verification URL</label>
            <input
              type="text"
              id="website_url_check"
              name="website_url_check"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

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
              placeholder="admin@domain.com"
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
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "600",
                color: "#cbd5e1",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
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
      </div>
    </div>
  );
}
