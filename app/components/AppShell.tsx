"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="Reach dashboard">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>reach<span>.</span></span>
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>
              <span className="icon" aria-hidden="true">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/help"><span className="icon">?</span>Help & support</Link>
          <Link className={pathname === "/settings" ? "active" : ""} href="/settings"><span className="icon">⚙</span>Settings</Link>
          <div className="profile"><div className="avatar">KM</div><div><strong>Kofi Mensah</strong><small>Administrator</small></div></div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div><small>{eyebrow}</small><h1>{title}</h1></div>
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
