"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Landmark, ChevronLeft, Menu } from "lucide-react";

const navigation = [
  { href: "/dashboard", icon: "⌂", label: "Dashboard" },
  { href: "/send-message", icon: "✎", label: "Send message" },
  { href: "/contacts", icon: "♙", label: "Contacts" },
  { href: "/locations", icon: "⌖", label: "Locations" },
  { href: "/message-history", icon: "↗", label: "Message history" },
  { href: "/reports", icon: "▥", label: "Reports" },
];

export function AppShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // Restore sidebar preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("app_sidebar_open");
      if (saved !== null) {
        setSidebarOpen(saved === "true");
      }
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("app_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <main className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px 33px" }}>
          <Link className="brand" href="/dashboard" aria-label="Reach dashboard" style={{ padding: 0 }}>
            <span className="brand-mark"><i /><i /><i /></span>
            <span>reach<span>.</span></span>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#aebbc3",
              borderRadius: "6px",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>
              <span className="icon" aria-hidden="true">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/admin/dashboard" style={{ color: "#10b981", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}><Landmark size={15} color="#94a3b8" />National Directorate</Link>
          <Link href="/help"><span className="icon">?</span>Help & support</Link>
          <Link className={pathname === "/settings" ? "active" : ""} href="/settings"><span className="icon">⚙</span>Settings</Link>
          <div className="profile"><div className="avatar">KM</div><div><strong>Kofi Mensah</strong><small>Administrator</small></div></div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {!sidebarOpen && (
              <button
                type="button"
                onClick={toggleSidebar}
                title="Open navigation"
                aria-label="Open navigation"
                style={{
                  background: "var(--cream)",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--navy)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <Menu size={14} />
                <span>Navigation</span>
              </button>
            )}
            <div><small>{eyebrow}</small><h1>{title}</h1></div>
          </div>
          <div className="top-actions"><Link className="header-cta" href="/send-message">+ New message</Link><button className="icon-button" aria-label="Notifications">♧<b /></button></div>
        </header>
        {children}
      </section>
    </main>
  );
}

export function LoadingState({ label = "Loading data…" }: { label?: string }) {
  return <div className="loading-state" role="status"><span />{label}</div>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><strong>{title}</strong><p>{body}</p></div>;
}
