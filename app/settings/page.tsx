"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell, LoadingState } from "@/app/components/AppShell";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null); const [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then((d) => setSettings({ sender_id: "Reach", cost_per_sms_pesewas: "4", default_country_code: "+233", ...(d.settings ?? {}) })); }, []);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); setNotice(response.ok ? "Settings saved." : "Could not save settings."); }
  return <AppShell eyebrow="ADMINISTRATION" title="Settings"><div className="page-content">{!settings ? <LoadingState /> : <form className="settings-card" onSubmit={save}><div className="card-title"><div><small>SMS CONFIGURATION</small><h2>Messaging defaults</h2><p>These values are stored securely with your application data.</p></div></div>{notice && <div className="alert">{notice}</div>}<div className="form-grid"><label><span>Sender ID</span><input name="sender_id" defaultValue={settings.sender_id} maxLength={11} /></label><label><span>Cost per SMS (pesewas)</span><input name="cost_per_sms_pesewas" type="number" min="0" defaultValue={settings.cost_per_sms_pesewas} /></label><label><span>Default country code</span><input name="default_country_code" defaultValue={settings.default_country_code} /></label></div><button className="primary-button" type="submit">Save changes</button></form>}</div></AppShell>;
}
