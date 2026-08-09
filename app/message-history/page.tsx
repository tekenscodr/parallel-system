"use client";

import { useEffect, useState } from "react";
import { AppShell, EmptyState, LoadingState } from "@/app/components/AppShell";

type Campaign = { id: string; name: string; message: string; status: string; audienceType: string; recipients: number; delivered: number; failed: number; costPesewas: number; scheduledAt?: string; createdAt: string };

export default function HistoryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  useEffect(() => { fetch("/api/campaigns").then((r) => r.json()).then((d) => setCampaigns(d.campaigns ?? [])); }, []);
  return <AppShell eyebrow="MESSAGING" title="Message history"><div className="page-content"><section className="data-card"><div className="card-title"><div><small>ALL CAMPAIGNS</small><h2>Delivery activity</h2></div></div>
    {!campaigns ? <LoadingState /> : campaigns.length === 0 ? <EmptyState title="No message history" body="Messages you send or schedule will be tracked here." /> : <div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Status</th><th>Audience</th><th>Delivery</th><th>Cost</th><th>Date</th></tr></thead><tbody>{campaigns.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small className="truncate">{item.message}</small></td><td><span className={`status ${item.status}`}>{item.status}</span></td><td>{item.recipients} <small>{item.audienceType}</small></td><td><strong>{Number(item.delivered ?? 0)}</strong> delivered<br /><small>{Number(item.failed ?? 0)} failed</small></td><td>GHS {(item.costPesewas / 100).toFixed(2)}</td><td>{new Date(item.scheduledAt ?? item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}</tbody></table></div>}
  </section></div></AppShell>;
}
