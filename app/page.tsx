"use client";

import { useMemo, useState } from "react";

const regions = ["Greater Accra", "Ashanti", "Central", "Eastern", "Volta"];
const constituencies: Record<string, string[]> = {
  "Greater Accra": ["Ablekuma Central", "Ayawaso West Wuogon", "Klottey Korle"],
  Ashanti: ["Bantama", "Manhyia South", "Oforikrom"],
  Central: ["Cape Coast North", "Mfantseman", "Agona West"],
  Eastern: ["New Juaben South", "Akim Oda", "Abuakwa South"],
  Volta: ["Ho Central", "Keta", "Anlo"],
};

const people = [
  { name: "Ama Owusu", phone: "024 682 1940", area: "Adabraka", station: "Presby JHS" },
  { name: "Kofi Mensah", phone: "020 491 7632", area: "Osu", station: "Osu Salem 1" },
  { name: "Esi Ankrah", phone: "055 703 9811", area: "Ringway", station: "Ringway Estate" },
  { name: "Kwame Asare", phone: "027 842 6509", area: "Adabraka", station: "St. Joseph's School" },
  { name: "Akosua Nyarko", phone: "054 326 1178", area: "Osu", station: "Osu Salem 2" },
];

const Icon = ({ name }: { name: string }) => <span className="icon" aria-hidden="true">{name}</span>;

export default function Home() {
  const [mode, setMode] = useState<"group" | "individual">("group");
  const [region, setRegion] = useState("Greater Accra");
  const [constituency, setConstituency] = useState("Klottey Korle");
  const [area, setArea] = useState("All electoral areas");
  const [station, setStation] = useState("All polling stations");
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(people[0].name);
  const [message, setMessage] = useState("Hello, this is a reminder that the community meeting takes place this Saturday at 10:00 AM. We look forward to seeing you there.");
  const [sendWhen, setSendWhen] = useState<"now" | "later">("now");
  const [confirmed, setConfirmed] = useState(false);

  const filteredPeople = useMemo(() => people.filter((person) =>
    `${person.name} ${person.phone}`.toLowerCase().includes(search.toLowerCase())
  ), [search]);

  const audience = mode === "individual" ? 1 : station !== "All polling stations" ? 184 : area !== "All electoral areas" ? 642 : 2486;
  const parts = Math.max(1, Math.ceil(message.length / 160));
  const cost = (audience * parts * 0.04).toFixed(2);

  function updateRegion(next: string) {
    setRegion(next);
    setConstituency(constituencies[next][0]);
    setArea("All electoral areas");
    setStation("All polling stations");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Reach home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>reach<span>.</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#dashboard"><Icon name="⌂" />Dashboard</a>
          <a className="active" href="#compose"><Icon name="✎" />Send message</a>
          <a href="#contacts"><Icon name="♙" />Contacts</a>
          <a href="#history"><Icon name="↗" />Message history</a>
          <a href="#reports"><Icon name="▥" />Reports</a>
        </nav>
        <div className="sidebar-bottom">
          <a href="#help"><Icon name="?" />Help & support</a>
          <a href="#settings"><Icon name="⚙" />Settings</a>
          <div className="profile">
            <div className="avatar">KM</div>
            <div><strong>Kofi Mensah</strong><small>Administrator</small></div>
            <button aria-label="Open profile menu">•••</button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><small>MESSAGING</small><h1>Send a message</h1></div>
          <div className="top-actions">
            <div className="credit"><span>SMS balance</span><strong>12,840</strong></div>
            <button className="icon-button" aria-label="Notifications">♧<b /></button>
          </div>
        </header>

        <div className="content-grid">
          <section className="composer" id="compose">
            <div className="step-heading"><span>1</span><div><h2>Choose recipients</h2><p>Select a single contact or target a group by location.</p></div></div>
            <div className="segmented" role="tablist" aria-label="Recipient type">
              <button className={mode === "group" ? "selected" : ""} onClick={() => setMode("group")}><Icon name="♙" />Group by location</button>
              <button className={mode === "individual" ? "selected" : ""} onClick={() => setMode("individual")}><Icon name="•" />Individual</button>
            </div>

            {mode === "group" ? (
              <div className="filters">
                <label><span>Region</span><select value={region} onChange={(e) => updateRegion(e.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Constituency</span><select value={constituency} onChange={(e) => setConstituency(e.target.value)}>{constituencies[region].map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Electoral area</span><select value={area} onChange={(e) => { setArea(e.target.value); setStation("All polling stations"); }}><option>All electoral areas</option><option>Adabraka</option><option>Osu</option><option>Ringway</option></select></label>
                <label><span>Polling station</span><select value={station} onChange={(e) => setStation(e.target.value)}><option>All polling stations</option><option>Presby JHS</option><option>Osu Salem 1</option><option>Ringway Estate</option></select></label>
              </div>
            ) : (
              <div className="contact-picker">
                <label className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone number" /></label>
                <div className="people-list">{filteredPeople.map((person) => (
                  <button key={person.name} className={selectedPerson === person.name ? "picked" : ""} onClick={() => setSelectedPerson(person.name)}>
                    <span className="mini-avatar">{person.name.split(" ").map((n) => n[0]).join("")}</span>
                    <span><strong>{person.name}</strong><small>{person.phone}</small></span><i>✓</i>
                  </button>
                ))}</div>
              </div>
            )}

            <div className="audience-bar"><div className="audience-icon">♙</div><div><small>ESTIMATED RECIPIENTS</small><strong>{audience.toLocaleString()} people</strong></div><button>View list <span>→</span></button></div>

            <div className="divider" />
            <div className="step-heading"><span>2</span><div><h2>Write your message</h2><p>Keep it clear and concise. Each SMS is up to 160 characters.</p></div></div>
            <label className="message-box"><textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={480} /><span>{message.length} / 480 characters · {parts} SMS</span></label>
            <div className="personalise"><button onClick={() => setMessage((current) => `${current} {first_name}`)}>+ Add personalisation</button><span>Try <b>{"{first_name}"}</b> or <b>{"{polling_station}"}</b></span></div>

            <div className="divider" />
            <div className="step-heading"><span>3</span><div><h2>Choose when to send</h2><p>Send immediately or schedule it for later.</p></div></div>
            <div className="schedule-row">
              <button className={sendWhen === "now" ? "chosen" : ""} onClick={() => setSendWhen("now")}><i>◉</i><span><strong>Send now</strong><small>Message will be sent immediately</small></span></button>
              <button className={sendWhen === "later" ? "chosen" : ""} onClick={() => setSendWhen("later")}><i>◷</i><span><strong>Schedule for later</strong><small>Choose a date and time</small></span></button>
            </div>
            {sendWhen === "later" && <div className="date-fields"><label><span>Date</span><input type="date" defaultValue="2026-07-25" /></label><label><span>Time</span><input type="time" defaultValue="10:00" /></label></div>}

            <div className="send-footer">
              <div><span>Estimated cost</span><strong>GHS {cost}</strong><small>{audience.toLocaleString()} recipients × {parts} SMS</small></div>
              <button className="send-button" onClick={() => setConfirmed(true)}>{sendWhen === "now" ? "Review & send" : "Review & schedule"}<span>→</span></button>
            </div>
          </section>

          <aside className="preview-panel">
            <div className="preview-heading"><div><small>LIVE PREVIEW</small><h2>Your message</h2></div><span>SMS</span></div>
            <div className="phone">
              <div className="phone-top"><span>9:41</span><div>● ◒ ▰</div></div>
              <div className="phone-contact"><button>‹</button><div className="sender-logo"><i /><i /><i /></div><strong>Reach</strong><small>SMS message</small></div>
              <div className="phone-body">
                <p>{message.replace("{first_name}", "Ama").replace("{polling_station}", "Presby JHS") || "Your message will appear here."}</p>
                <time>10:24 AM</time>
                <span>Delivered</span>
              </div>
              <div className="phone-compose"><span>Text message</span><button>↑</button></div>
              <i className="home-bar" />
            </div>
            <div className="summary-card">
              <h3>Campaign summary</h3>
              <dl><div><dt>Audience</dt><dd>{mode === "group" ? "Location group" : selectedPerson}</dd></div><div><dt>Region</dt><dd>{region}</dd></div>{mode === "group" && <div><dt>Constituency</dt><dd>{constituency}</dd></div>}<div><dt>Recipients</dt><dd>{audience.toLocaleString()}</dd></div><div><dt>Delivery</dt><dd>{sendWhen === "now" ? "Send now" : "Scheduled"}</dd></div></dl>
            </div>
            <p className="privacy-note">⌾ Recipient details are protected and never shared.</p>
          </aside>
        </div>
      </section>

      {confirmed && <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmed(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setConfirmed(false)} aria-label="Close">×</button><div className="modal-check">✓</div><h2 id="modal-title">Campaign ready</h2><p>Your message is ready for {audience.toLocaleString()} recipient{audience === 1 ? "" : "s"}. Estimated cost: GHS {cost}.</p><button className="confirm-send" onClick={() => setConfirmed(false)}>{sendWhen === "now" ? "Confirm and send" : "Confirm schedule"}</button><button className="cancel" onClick={() => setConfirmed(false)}>Go back and edit</button></div></div>}
    </main>
  );
}
