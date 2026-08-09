"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, LoadingState } from "@/app/components/AppShell";

type Data = { totals: { contacts: number; campaigns: number; delivered: number; balance: number }; recent: Array<{ id: string; name: string; status: string; recipients: number; createdAt: string }> };

export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/dashboard").then((r) => r.json()).then((value) => value.error ? setError(value.error) : setData(value)).catch(() => setError("Could not load dashboard data.")); }, []);

  return <AppShell eyebrow="OVERVIEW" title="Dashboard"><div className="page-content">
    <section className="welcome-card"><div><small>GOOD MORNING</small><h2>Reach the right people,<br />at the right time.</h2><p>Plan location-based SMS campaigns and monitor delivery from one place.</p></div><Link href="/send-message">Compose a message <span>→</span></Link></section>
    {error && <div className="alert error">{error}</div>}
    {!data ? <LoadingState /> : <>
      <section className="metric-grid">
        <article><span className="metric-icon orange">♙</span><small>ACTIVE CONTACTS</small><strong>{data.totals.contacts.toLocaleString()}</strong><p>Consent-aware recipients</p></article>
        <article><span className="metric-icon navy">✎</span><small>CAMPAIGNS</small><strong>{data.totals.campaigns.toLocaleString()}</strong><p>All message campaigns</p></article>
        <article><span className="metric-icon green">✓</span><small>DELIVERED SMS</small><strong>{data.totals.delivered.toLocaleString()}</strong><p>Confirmed deliveries</p></article>
        <article><span className="metric-icon gold">¢</span><small>SMS BALANCE</small><strong>{data.totals.balance.toLocaleString()}</strong><p>Available message credits</p></article>
      </section>
      <section className="data-card"><div className="card-title"><div><small>RECENT ACTIVITY</small><h2>Latest campaigns</h2></div><Link href="/message-history">View all →</Link></div>
        {data.recent.length === 0 ? <EmptyState title="No campaigns yet" body="Your first sent or scheduled message will appear here." /> : <div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Status</th><th>Recipients</th><th>Created</th></tr></thead><tbody>{data.recent.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><span className={`status ${item.status}`}>{item.status}</span></td><td>{item.recipients}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </div></AppShell>;
}
