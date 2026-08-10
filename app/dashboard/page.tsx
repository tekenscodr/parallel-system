"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AppShell, EmptyState, LoadingState } from "@/app/components/AppShell";

type CountRow = { label: string; value: number; region?: string };
type Data = {
  totals: { contacts: number; campaigns: number; delivered: number; balance: number };
  readiness: { withDob: number; mapped: number; pending: number; optedIn: number };
  contactsByRegion: CountRow[];
  topConstituencies: CountRow[];
  recent: Array<{ id: string; name: string; status: string; recipients: number; createdAt: string }>;
};

function percent(value: number, total: number) {
  return total ? Math.round((Number(value) / total) * 100) : 0;
}

export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((value) => value.error ? setError(value.error) : setData(value))
      .catch(() => setError("Could not load campaign intelligence."));
  }, []);

  const maxRegion = useMemo(() => Math.max(1, ...(data?.contactsByRegion.map((row) => Number(row.value)) ?? [1])), [data]);

  return <AppShell eyebrow="CAMPAIGN COMMAND" title="Campaign dashboard"><div className="page-content campaign-dashboard">
    <section className="campaign-hero">
      <div className="campaign-hero-copy"><small>CENTRAL CAMPAIGN • FIELD INTELLIGENCE</small><h2>Turn verified contacts into<br />precise local mobilisation.</h2><p>See audience readiness, polling-station coverage and campaign delivery from one command centre.</p><div className="campaign-hero-actions"><Link href="/send-message">Launch a campaign <span>→</span></Link><Link className="quiet-link" href="/contacts">Review contacts</Link></div></div>
      <div className="hero-readiness"><span>DATA READINESS</span><strong>{data ? percent(data.readiness.mapped, data.totals.contacts) : 0}%</strong><p>of active contacts mapped to a polling station</p><i><b style={{ width: `${data ? percent(data.readiness.mapped, data.totals.contacts) : 0}%` }} /></i></div>
    </section>
    {error && <div className="alert error">{error}</div>}
    {!data ? <LoadingState label="Loading campaign intelligence…" /> : <>
      <section className="campaign-metrics" aria-label="Campaign metrics">
        <article><small>ACTIVE CONTACTS</small><strong>{data.totals.contacts.toLocaleString()}</strong><p><span className="trend-dot green" />Verified campaign audience</p></article>
        <article><small>WITH DATE OF BIRTH</small><strong>{Number(data.readiness.withDob).toLocaleString()}</strong><p>{percent(data.readiness.withDob, data.totals.contacts)}% identity completeness</p></article>
        <article><small>POLLING-STATION MAPPED</small><strong>{Number(data.readiness.mapped).toLocaleString()}</strong><p>{percent(data.readiness.mapped, data.totals.contacts)}% location coverage</p></article>
        <article><small>CONSENT READY</small><strong>{Number(data.readiness.optedIn).toLocaleString()}</strong><p>{Number(data.readiness.pending).toLocaleString()} awaiting consent</p></article>
      </section>

      <div className="campaign-grid">
        <section className="campaign-panel region-panel"><div className="campaign-panel-title"><div><small>GEOGRAPHIC COVERAGE</small><h2>Contacts by region</h2></div><Link href="/locations">Explore locations →</Link></div>
          {data.contactsByRegion.length === 0 ? <EmptyState title="No mapped contacts" body="Polling-station assignments will populate regional coverage." /> : <div className="region-bars">{data.contactsByRegion.map((row, index) => <div key={row.label} className="region-row"><span className="region-rank">{String(index + 1).padStart(2, "0")}</span><div><label><span>{row.label}</span><strong>{Number(row.value).toLocaleString()}</strong></label><i><b style={{ width: `${Number(row.value) / maxRegion * 100}%` }} /></i></div></div>)}</div>}
        </section>

        <section className="campaign-panel readiness-panel"><div className="campaign-panel-title"><div><small>AUDIENCE HEALTH</small><h2>Activation readiness</h2></div></div>
          <div className="readiness-ring" style={{ "--ready": `${percent(data.readiness.mapped, data.totals.contacts)}%` } as CSSProperties}><div><strong>{percent(data.readiness.mapped, data.totals.contacts)}%</strong><span>mapped</span></div></div>
          <div className="readiness-list"><div><span><i className="green" />DOB verified</span><strong>{Number(data.readiness.withDob).toLocaleString()}</strong></div><div><span><i className="navy" />Station mapped</span><strong>{Number(data.readiness.mapped).toLocaleString()}</strong></div><div><span><i className="gold" />Pending consent</span><strong>{Number(data.readiness.pending).toLocaleString()}</strong></div></div>
          <p className="consent-callout">Messaging remains locked to opted-in contacts. Review consent before launching outreach.</p>
        </section>
      </div>

      <div className="campaign-grid lower-grid">
        <section className="campaign-panel"><div className="campaign-panel-title"><div><small>FIELD PRIORITIES</small><h2>Largest constituencies</h2></div></div>
          {data.topConstituencies.length === 0 ? <EmptyState title="No constituency data" body="Mapped contacts will appear here." /> : <div className="constituency-list">{data.topConstituencies.map((row) => <div key={`${row.region}-${row.label}`}><span><strong>{row.label}</strong><small>{row.region}</small></span><b>{Number(row.value).toLocaleString()}</b></div>)}</div>}
        </section>
        <section className="campaign-panel"><div className="campaign-panel-title"><div><small>RECENT ACTIVITY</small><h2>Latest campaigns</h2></div><Link href="/message-history">View all →</Link></div>
          {data.recent.length === 0 ? <EmptyState title="No campaigns yet" body="Create the first campaign when consented contacts are ready." /> : <div className="campaign-activity">{data.recent.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{new Date(item.createdAt).toLocaleDateString()}</small></span><span className={`status ${item.status}`}>{item.status}</span><b>{Number(item.recipients).toLocaleString()}</b></div>)}</div>}
        </section>
      </div>
    </>}
  </div></AppShell>;
}
