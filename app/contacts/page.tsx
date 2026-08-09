"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppShell, EmptyState, LoadingState } from "@/app/components/AppShell";

type Contact = { id: string; firstName: string; lastName: string; phoneNumber: string; email?: string; dateOfBirth?: string; voterId?: string; ghanaCardNumber?: string; source: "platform" | "user_upload"; uploadedByName?: string; uploadedByEmail?: string; consentStatus: string; isActive: number; pollingStation?: string; electoralArea?: string; constituency?: string; region?: string };
type Station = { id: string; name: string };
type Constituency = { id: string; name: string };

const CSV_COLUMNS: Record<string, string> = {
  firstname: "firstName", first_name: "firstName", lastname: "lastName", last_name: "lastName",
  phone: "phoneNumber", phonenumber: "phoneNumber", phone_number: "phoneNumber",
  email: "email", birthday: "dateOfBirth", dateofbirth: "dateOfBirth", date_of_birth: "dateOfBirth",
  voterid: "voterId", voter_id: "voterId", ghanacard: "ghanaCardNumber",
  ghanacardnumber: "ghanaCardNumber", ghana_card_number: "ghanaCardNumber",
  pollingstationcode: "pollingStationCode", polling_station_code: "pollingStationCode",
  consent: "consentStatus", consentstatus: "consentStatus", consent_status: "consentStatus",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]); const [stations, setStations] = useState<Station[]>([]); const [constituencies, setConstituencies] = useState<Constituency[]>([]); const [selectedConstituency, setSelectedConstituency] = useState("");
  const [search, setSearch] = useState(""); const [source, setSource] = useState(""); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false); const [notice, setNotice] = useState(""); const [uploading, setUploading] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { setLoading(true); const response = await fetch(`/api/contacts?search=${encodeURIComponent(search)}&source=${encodeURIComponent(source)}`); const data = await response.json(); setContacts(data.contacts ?? []); setLoading(false); }, [search, source]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { fetch("/api/locations").then((r) => r.json()).then((d) => setConstituencies(d.constituencies ?? [])); }, []);
  useEffect(() => { if (!selectedConstituency) return setStations([]); fetch(`/api/locations?constituencyId=${encodeURIComponent(selectedConstituency)}`).then((r) => r.json()).then((d) => setStations(d.pollingStations ?? [])); }, [selectedConstituency]);

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json(); if (!response.ok) return setNotice(data.error ?? "Could not add contact.");
    setNotice("Contact added to your uploaded contacts."); setOpen(false); setSelectedConstituency(""); event.currentTarget.reset(); await load();
  }
  async function uploadCsv(file: File) {
    setUploading(true); setNotice("");
    try {
      const matrix = parseCsv(await file.text()); const headers = matrix.shift()?.map(normalizeHeader) ?? [];
      const rows = matrix.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((key, i) => [key, row[i]?.trim() ?? ""]).filter(([key]) => key)));
      const response = await fetch("/api/contacts/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: file.name, rows }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Could not upload contacts.");
      setNotice(`${data.imported} contacts imported${data.skipped ? `; ${data.skipped} skipped` : ""}.`); setSource("user_upload"); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not upload contacts."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function toggleConsent(contact: Contact) {
    const next = contact.consentStatus === "opted_in" ? "opted_out" : "opted_in";
    await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ consentStatus: next }) }); await load();
  }

  return <AppShell eyebrow="AUDIENCE" title="Contacts"><div className="page-content">
    <div className="page-actions contact-actions"><label className="global-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email or ID" /></label><select className="source-filter" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Contact source"><option value="">All contacts</option><option value="user_upload">My uploaded contacts</option><option value="platform">Reach contacts</option></select><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])} /><button className="secondary-button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading…" : "Upload CSV"}</button><button className="primary-button" onClick={() => setOpen(true)}>+ Add contact</button></div>
    <div className="ownership-note"><strong>Two contact sources</strong><span>Your uploads stay linked to your account. Reach contacts are maintained by the platform and can be unlocked through a paid access plan.</span></div>
    {notice && <div className="alert">{notice}</div>}
    <section className="data-card"><div className="card-title"><div><small>DIRECTORY</small><h2>{contacts.length} contacts</h2></div><small>CSV headers: firstName, lastName, phoneNumber, email, dateOfBirth, voterId, ghanaCardNumber, pollingStationCode</small></div>
      {loading ? <LoadingState /> : contacts.length === 0 ? <EmptyState title="No contacts found" body="Upload a CSV, add a contact, or switch contact sources." /> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone & email</th><th>Location</th><th>Source</th><th>Consent</th><th></th></tr></thead><tbody>{contacts.map((contact) => <tr key={contact.id}><td><strong>{contact.firstName} {contact.lastName}</strong>{contact.dateOfBirth && <small>Born {contact.dateOfBirth}</small>}</td><td><span>{contact.phoneNumber}</span><small>{contact.email || [contact.voterId, contact.ghanaCardNumber].filter(Boolean).join(" · ")}</small></td><td><span>{contact.pollingStation ?? "Unassigned"}</span><small>{[contact.electoralArea, contact.constituency, contact.region].filter(Boolean).join(" · ")}</small></td><td><span className={`source-badge ${contact.source}`}>{contact.source === "platform" ? "Reach" : "My upload"}</span>{contact.uploadedByName && <small>{contact.uploadedByName}</small>}</td><td><span className={`status ${contact.consentStatus}`}>{contact.consentStatus.replace("_", " ")}</span></td><td><button className="table-action" onClick={() => toggleConsent(contact)}>{contact.consentStatus === "opted_in" ? "Opt out" : "Opt in"}</button></td></tr>)}</tbody></table></div>}
    </section>
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal form-modal" onSubmit={addContact} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button><h2>Add your contact</h2><p>Optional details improve matching. Only message people who have given clear SMS consent.</p><div className="form-grid"><label><span>First name</span><input name="firstName" required /></label><label><span>Last name</span><input name="lastName" /></label><label><span>Phone number</span><input name="phoneNumber" placeholder="+233 24 000 0000" required /></label><label><span>Email (optional)</span><input name="email" type="email" /></label><label><span>Birthday (optional)</span><input name="dateOfBirth" type="date" /></label><label><span>Voter ID (optional)</span><input name="voterId" /></label><label className="wide"><span>Ghana Card number (optional)</span><input name="ghanaCardNumber" /></label><label className="wide"><span>Constituency</span><select value={selectedConstituency} onChange={(e) => setSelectedConstituency(e.target.value)}><option value="">Choose constituency</option>{constituencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="wide"><span>Polling station</span><select name="pollingStationId" disabled={!selectedConstituency}><option value="">Unassigned</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label><label><span>Consent</span><select name="consentStatus"><option value="pending">Pending</option><option value="opted_in">Opted in</option><option value="opted_out">Opted out</option></select></label><label><span>Language</span><select name="preferredLanguage"><option value="en">English</option><option value="tw">Twi</option><option value="ee">Ewe</option><option value="ga">Ga</option></select></label></div><button className="confirm-send" type="submit">Save contact</button></form></div>}
  </div></AppShell>;
}

function normalizeHeader(value: string) { return CSV_COLUMNS[value.trim().toLowerCase().replace(/[ -]/g, "_")] ?? ""; }
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) { const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); } return rows;
}
