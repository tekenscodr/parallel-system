"use client";

import { useEffect, useState } from "react";
import { AppShell, EmptyState, LoadingState } from "@/app/components/AppShell";

type Report = { deliveryStatus: Array<{ label: string; value: number }>; contactsByRegion: Array<{ label: string; value: number }>; totals: { campaigns: number; recipients: number; costPesewas: number } };

export default function ReportsPage() {
  const [data, setData] = useState<Report | null>(null); useEffect(() => { fetch("/api/reports").then((r) => r.json()).then(setData); }, []);
  const maxRegion = Math.max(1, ...(data?.contactsByRegion.map((x) => Number(x.value)) ?? [1]));
  return <AppShell eyebrow="INSIGHTS" title="Reports"><div className="page-content">{!data ? <LoadingState /> : <><section className="metric-grid compact"><article><small>CAMPAIGNS</small><strong>{Number(data.totals.campaigns).toLocaleString()}</strong></article><article><small>TOTAL RECIPIENTS</small><strong>{Number(data.totals.recipients).toLocaleString()}</strong></article><article><small>ESTIMATED SPEND</small><strong>GHS {(Number(data.totals.costPesewas) / 100).toFixed(2)}</strong></article></section><div className="report-grid"><section className="data-card"><div className="card-title"><div><small>DELIVERY</small><h2>Message outcomes</h2></div></div>{data.deliveryStatus.length === 0 ? <EmptyState title="No delivery data" body="Delivery results will appear after campaigns are processed." /> : <div className="outcome-list">{data.deliveryStatus.map((item) => <div key={item.label}><span className={`metric-icon ${item.label === "delivered" ? "green" : "navy"}`}>{item.label === "delivered" ? "✓" : "•"}</span><p><strong>{Number(item.value).toLocaleString()}</strong><small>{item.label}</small></p></div>)}</div>}</section><section className="data-card"><div className="card-title"><div><small>AUDIENCE</small><h2>Contacts by region</h2></div></div>{data.contactsByRegion.length === 0 ? <EmptyState title="No location data" body="Assign contacts to polling stations to populate this report." /> : <div className="bar-list">{data.contactsByRegion.map((item) => <div key={item.label}><label><span>{item.label}</span><strong>{item.value}</strong></label><i><b style={{ width: `${Number(item.value) / maxRegion * 100}%` }} /></i></div>)}</div>}</section></div></>}</div></AppShell>;
}
