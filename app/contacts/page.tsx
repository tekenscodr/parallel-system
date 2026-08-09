"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell, EmptyState, LoadingState } from "@/app/components/AppShell";

type Contact = { id: string; firstName: string; lastName: string; phoneNumber: string; consentStatus: string; isActive: number; pollingStation?: string; electoralArea?: string; constituency?: string; region?: string };
type Station = { id: string; name: string };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]); const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState(""); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false); const [notice, setNotice] = useState("");
  const load = useCallback(async () => { setLoading(true); const response = await fetch(`/api/contacts?search=${encodeURIComponent(search)}`); const data = await response.json(); setContacts(data.contacts ?? []); setLoading(false); }, [search]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { fetch("/api/locations").then((r) => r.json()).then((d) => setStations(d.pollingStations ?? [])); }, []);

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json(); if (!response.ok) return setNotice(data.error ?? "Could not add contact.");
    setNotice("Contact added successfully."); setOpen(false); event.currentTarget.reset(); await load();
  }
  async function toggleConsent(contact: Contact) {
    const next = contact.consentStatus === "opted_in" ? "opted_out" : "opted_in";
    await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ consentStatus: next }) }); await load();
  }

  return <AppShell eyebrow="AUDIENCE" title="Contacts"><div className="page-content">
    <div className="page-actions"><label className="global-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts or phone number" /></label><button className="primary-button" onClick={() => setOpen(true)}>+ Add contact</button></div>
    {notice && <div className="alert">{notice}</div>}
    <section className="data-card"><div className="card-title"><div><small>DIRECTORY</small><h2>{contacts.length} contacts</h2></div></div>
      {loading ? <LoadingState /> : contacts.length === 0 ? <EmptyState title="No contacts found" body="Add your first opted-in contact to begin creating an audience." /> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Location</th><th>Consent</th><th></th></tr></thead><tbody>{contacts.map((contact) => <tr key={contact.id}><td><strong>{contact.firstName} {contact.lastName}</strong></td><td>{contact.phoneNumber}</td><td><span>{contact.pollingStation ?? "Unassigned"}</span><small>{[contact.electoralArea, contact.constituency, contact.region].filter(Boolean).join(" · ")}</small></td><td><span className={`status ${contact.consentStatus}`}>{contact.consentStatus.replace("_", " ")}</span></td><td><button className="table-action" onClick={() => toggleConsent(contact)}>{contact.consentStatus === "opted_in" ? "Opt out" : "Opt in"}</button></td></tr>)}</tbody></table></div>}
    </section>
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal form-modal" onSubmit={addContact} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button><h2>Add a contact</h2><p>Only message people who have given clear SMS consent.</p><div className="form-grid"><label><span>First name</span><input name="firstName" required /></label><label><span>Last name</span><input name="lastName" /></label><label className="wide"><span>Phone number</span><input name="phoneNumber" placeholder="+233 24 000 0000" required /></label><label className="wide"><span>Polling station</span><select name="pollingStationId"><option value="">Unassigned</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label><label><span>Consent</span><select name="consentStatus"><option value="pending">Pending</option><option value="opted_in">Opted in</option><option value="opted_out">Opted out</option></select></label><label><span>Language</span><select name="preferredLanguage"><option value="en">English</option><option value="tw">Twi</option><option value="ee">Ewe</option><option value="ga">Ga</option></select></label></div><button className="confirm-send" type="submit">Save contact</button></form></div>}
  </div></AppShell>;
}
