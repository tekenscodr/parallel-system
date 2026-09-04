"use client";

import { useState } from "react";
import { Landmark, AlertCircle, ArrowRight } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("national.admin@ec-data.gov.gh");
  const [password, setPassword] = useState("AdminNational2026!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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

      // Save token in localStorage and cookie for 100% reliable persistence
      if (data.token) {
        localStorage.setItem("admin_session_token", data.token);
        document.cookie = `admin_session=${data.token}; path=/; max-age=86400; SameSite=Lax`;
      }

      // Full window navigation ensures browser cookie & token sync
      window.location.href = "/admin/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(`Could not connect to authentication server: ${msg}`);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)",
      color: "#f8fafc",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "20px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "460px",
        background: "rgba(15, 23, 42, 0.75)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "16px",
        padding: "36px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(16px)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            marginBottom: "16px",
          }}>
            <Landmark size={26} color="#94a3b8" />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 6px 0", letterSpacing: "-0.5px" }}>
            National Executive Command
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            Restricted to <span style={{ color: "#34d399", fontWeight: "600" }}>admin_national</span> role
          </p>
          <div style={{
            marginTop: "8px",
            display: "inline-block",
            fontSize: "11px",
            padding: "3px 10px",
            borderRadius: "999px",
            background: "rgba(16, 185, 129, 0.12)",
            color: "#34d399",
            border: "1px solid rgba(16, 185, 129, 0.25)"
          }}>
            ec-data PostgreSQL Backend
          </div>
        </div>

        {error && (
          <div style={{
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
          }}>
            <AlertCircle size={15} color="#94a3b8" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "6px" }}>
              Administrator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="national.admin@ec-data.gov.gh"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "8px",
                background: "rgba(2, 6, 23, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "6px" }}>
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
                boxSizing: "border-box"
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
              background: loading ? "#334155" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
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
            <ArrowRight size={15} color="#cbd5e1" />
          </button>
        </form>

        <div style={{
          marginTop: "24px",
          padding: "12px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: "12px",
          color: "#94a3b8"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontWeight: "600", color: "#cbd5e1" }}>Quick Fill Credentials:</span>
            <button
              type="button"
              onClick={() => {
                setEmail("national.admin@ec-data.gov.gh");
                setPassword("AdminNational2026!");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#34d399",
                fontSize: "11px",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline"
              }}
            >
              Fill Defaults
            </button>
          </div>
          Email: <code style={{ color: "#38bdf8" }}>national.admin@ec-data.gov.gh</code>
          <br />
          Password: <code style={{ color: "#38bdf8" }}>AdminNational2026!</code>
        </div>
      </div>
    </div>
  );
}
