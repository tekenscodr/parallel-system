"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell, LoadingState } from "@/app/components/AppShell";

type Location = { id: string; name: string; regionId?: string; constituencyId?: string; electoralAreaId?: string };
type Locations = { regions: Location[]; constituencies: Location[]; electoralAreas: Location[]; pollingStations: Location[] };
type Contact = { id: string; firstName: string; lastName: string; phoneNumber: string; pollingStationId?: string; consentStatus: string };

export default function SendMessagePage() {
  const [locations, setLocations] = useState<Locations | null>(null); const [contacts, setContacts] = useState<Contact[]>([]);
  const [mode, setMode] = useState<"location" | "individual">("location"); const [regionId, setRegionId] = useState(""); const [constituencyId, setConstituencyId] = useState(""); const [electoralAreaId, setElectoralAreaId] = useState(""); const [pollingStationId, setPollingStationId] = useState(""); const [contactId, setContactId] = useState("");
  const [name, setName] = useState(""); const [message, setMessage] = useState(""); const [sendLater, setSendLater] = useState(false); const [scheduledAt, setScheduledAt] = useState(""); const [notice, setNotice] = useState(""); const [sending, setSending] = useState(false);
  const [estimated, setEstimated] = useState(0);
  useEffect(() => { Promise.all([fetch("/api/locations").then((r) => r.json()), fetch("/api/contacts").then((r) => r.json())]).then(([l, c]) => { setLocations(l); setContacts(c.contacts ?? []); }); }, []);
  const constituencies = useMemo(() => locations?.constituencies.filter((x) => !regionId || x.regionId === regionId) ?? [], [locations, regionId]);
  const electoralAreas = useMemo(() => locations?.electoralAreas.filter((x) => !constituencyId || x.constituencyId === constituencyId) ?? [], [locations, constituencyId]);
  const stations = useMemo(() => locations?.pollingStations.filter((x) => !electoralAreaId || x.electoralAreaId === electoralAreaId) ?? [], [locations, electoralAreaId]);
  const selectedContact = contacts.find((x) => x.id === contactId); const parts = Math.max(1, Math.ceil(message.length / 160));
  useEffect(() => {
    const params = new URLSearchParams();
    if (mode === "individual" && contactId) params.set("contactId", contactId);
    else if (pollingStationId) params.set("pollingStationId", pollingStationId);
    else if (electoralAreaId) params.set("electoralAreaId", electoralAreaId);
    else if (constituencyId) params.set("constituencyId", constituencyId);
    else if (regionId) params.set("regionId", regionId);
    fetch(`/api/audience-count?${params}`).then((r) => r.json()).then((d) => setEstimated(Number(d.count ?? 0)));
  }, [mode, contactId, regionId, constituencyId, electoralAreaId, pollingStationId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSending(true); setNotice("");
    const response = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, message, regionId: regionId || null, constituencyId: constituencyId || null, electoralAreaId: electoralAreaId || null, pollingStationId: pollingStationId || null, contactId: mode === "individual" ? contactId : null, scheduledAt: sendLater && scheduledAt ? new Date(scheduledAt).toISOString() : null }) });
    const data = await response.json(); setSending(false); if (!response.ok) return setNotice(data.error ?? "Could not create campaign.");
    setNotice(`${data.recipients} recipient${data.recipients === 1 ? "" : "s"} queued successfully. Estimated cost: GHS ${(data.costPesewas / 100).toFixed(2)}.`); setName(""); setMessage("");
  }

  return <AppShell eyebrow="MESSAGING" title="Send a message">{!locations ? <div className="page-content"><LoadingState /></div> : <form className="content-grid" onSubmit={submit}><section className="composer">
    {notice && <div className="alert">{notice}</div>}
    <div className="step-heading"><span>1</span><div><h2>Choose recipients</h2><p>Target one opted-in contact or a geographic audience.</p></div></div>
    <div className="segmented"><button type="button" className={mode === "location" ? "selected" : ""} onClick={() => setMode("location")}>♙ Group by location</button><button type="button" className={mode === "individual" ? "selected" : ""} onClick={() => setMode("individual")}>• Individual</button></div>
    {mode === "location" ? <div className="filters">
      <label><span>Region</span><select value={regionId} onChange={(e) => { setRegionId(e.target.value); setConstituencyId(""); setElectoralAreaId(""); setPollingStationId(""); }}><option value="">All regions</option>{locations.regions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label><span>Constituency</span><select value={constituencyId} onChange={(e) => { setConstituencyId(e.target.value); setElectoralAreaId(""); setPollingStationId(""); }}><option value="">All constituencies</option>{constituencies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label><span>Electoral area</span><select value={electoralAreaId} onChange={(e) => { setElectoralAreaId(e.target.value); setPollingStationId(""); }}><option value="">All electoral areas</option>{electoralAreas.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label><span>Polling station</span><select value={pollingStationId} onChange={(e) => setPollingStationId(e.target.value)}><option value="">All polling stations</option>{stations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    </div> : <div className="single-field"><label><span>Opted-in contact</span><select value={contactId} onChange={(e) => setContactId(e.target.value)} required><option value="">Choose a contact</option>{contacts.filter((x) => x.consentStatus === "opted_in").map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName} · {x.phoneNumber}</option>)}</select></label></div>}
    <div className="audience-bar"><div className="audience-icon">♙</div><div><small>ESTIMATED RECIPIENTS</small><strong>{estimated.toLocaleString()} opted-in people</strong></div></div>
    <div className="divider" /><div className="step-heading"><span>2</span><div><h2>Write your message</h2><p>Personalisation tokens are replaced when the recipient list is created.</p></div></div>
    <div className="single-field"><label><span>Campaign name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday community meeting" /></label></div>
    <label className="message-box"><textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={480} required placeholder="Write your message…" /><span>{message.length} / 480 characters · {parts} SMS</span></label>
    <div className="personalise"><button type="button" onClick={() => setMessage((value) => `${value}{first_name}`)}>+ First name</button><button type="button" onClick={() => setMessage((value) => `${value}{polling_station}`)}>+ Polling station</button></div>
    <div className="divider" /><div className="step-heading"><span>3</span><div><h2>Choose when to send</h2><p>Create the campaign now or schedule it.</p></div></div>
    <div className="schedule-row"><button type="button" className={!sendLater ? "chosen" : ""} onClick={() => setSendLater(false)}><i>◉</i><span><strong>Queue now</strong><small>Create recipient records immediately</small></span></button><button type="button" className={sendLater ? "chosen" : ""} onClick={() => setSendLater(true)}><i>◷</i><span><strong>Schedule</strong><small>Choose a future date and time</small></span></button></div>
    {sendLater && <div className="single-field"><label><span>Delivery time</span><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required /></label></div>}
    <div className="send-footer"><div><span>Estimated cost</span><strong>GHS {(estimated * parts * .04).toFixed(2)}</strong><small>{estimated} recipients × {parts} SMS</small></div><button className="send-button" disabled={sending || !message || estimated === 0}>{sending ? "Creating…" : sendLater ? "Schedule campaign" : "Create campaign"}<span>→</span></button></div>
  </section><aside className="preview-panel"><div className="preview-heading"><div><small>LIVE PREVIEW</small><h2>Your message</h2></div><span>SMS</span></div><div className="phone"><div className="phone-top"><span>9:41</span><div>● ◒ ▰</div></div><div className="phone-contact"><button type="button">‹</button><div className="sender-logo"><i /><i /><i /></div><strong>Reach</strong><small>SMS message</small></div><div className="phone-body"><p>{message.replaceAll("{first_name}", selectedContact?.firstName ?? "Ama").replaceAll("{polling_station}", "Presby JHS") || "Your message will appear here."}</p><time>10:24 AM</time><span>Preview</span></div><div className="phone-compose"><span>Text message</span><button type="button">↑</button></div><i className="home-bar" /></div><div className="summary-card"><h3>Campaign summary</h3><dl><div><dt>Audience</dt><dd>{mode === "individual" ? "Individual" : "Location group"}</dd></div><div><dt>Recipients</dt><dd>{estimated}</dd></div><div><dt>SMS parts</dt><dd>{parts}</dd></div><div><dt>Delivery</dt><dd>{sendLater ? "Scheduled" : "Queue now"}</dd></div></dl></div></aside></form>}</AppShell>;
}
