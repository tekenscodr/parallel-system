"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Printer,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Building,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";

const ALBUM_SECTIONS = [
  { label: "Cover & Certification", page: 1, type: "cover" },
  { label: "National Executives (1-Sided)", page: 2, type: "national" },
  { label: "Ahafo Regional Executives (1-Sided)", page: 3, type: "regional" },
  { label: "Asunafo North (P1)", page: 4, type: "constituency" },
  { label: "Asunafo North (P2)", page: 5, type: "constituency" },
  { label: "Asunafo South (P1)", page: 6, type: "constituency" },
  { label: "Asunafo South (P2)", page: 7, type: "constituency" },
  { label: "Asutifi North (P1)", page: 8, type: "constituency" },
  { label: "Asutifi North (P2)", page: 9, type: "constituency" },
  { label: "Asutifi South (P1)", page: 10, type: "constituency" },
  { label: "Asutifi South (P2)", page: 11, type: "constituency" },
  { label: "Tano North (P1)", page: 12, type: "constituency" },
  { label: "Tano North (P2)", page: 13, type: "constituency" },
  { label: "Tano South (P1)", page: 14, type: "constituency" },
  { label: "Tano South (P2)", page: 15, type: "constituency" },
  { label: "Ahafo TESCON (1-Sided)", page: 16, type: "tescon" },
];

export default function AhafoAlbumPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);

  const [activePage, setActivePage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [albumVersion, setAlbumVersion] = useState<number>(() => Date.now());

  useEffect(() => {
    // Check current admin auth
    fetch("/api/admin/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handlePrint = () => {
    const iframe = document.getElementById("album-iframe") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    } else {
      window.open(`/exports/ahafo_election_album.html?v=${albumVersion}`, "_blank")?.print();
    }
  };

  return (
    <AdminShell
      title="Ahafo Region · Official Election Album & Directory"
      subtitle="16-Page Publication Roll: Acknowledgement, 1-Sided National, 1-Sided Regional, 6 Constituencies (2-Sided) & TESCON"
      currentUser={currentUser}
    >
      <div className="space-y-6">
        {/* Top Control Action Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                NPP Ahafo Region Electoral College Album (2026)
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verified & Certified
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                16 Pages · 6 Constituencies · 114 Constituency Executives · 6 Regional · 6 National · 6 TESCON (No Patrons)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/exports/NPP_Ahafo_Region_Election_Album_2026.pdf?v=${albumVersion}`}
              download="NPP_Ahafo_Region_Election_Album_2026.pdf"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download High-Res PDF (16 Pages)
            </a>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save as PDF
            </button>

            <a
              href={`/exports/ahafo_election_album.html?v=${albumVersion}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Fullscreen HTML
            </a>
          </div>
        </div>

        {/* Section Quick-Jump Chips */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
            Fast Navigation by Tier / Constituency
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {ALBUM_SECTIONS.map((sec) => {
              const isActive = activePage === sec.page;
              let badgeColor = "bg-white text-slate-700 border-slate-300";
              if (sec.type === "cover") badgeColor = "bg-red-50 text-red-800 border-red-300";
              else if (sec.type === "national") badgeColor = "bg-blue-50 text-blue-800 border-blue-300";
              else if (sec.type === "regional") badgeColor = "bg-indigo-50 text-indigo-800 border-indigo-300";
              else if (sec.type === "tescon") badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-300";

              return (
                <button
                  key={sec.page}
                  onClick={() => {
                    setActivePage(sec.page);
                    const iframe = document.getElementById("album-iframe") as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      const el = iframe.contentDocument?.querySelectorAll(".album-page")?.[sec.page - 1];
                      el?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
                    isActive
                      ? "ring-2 ring-blue-600 bg-blue-600 text-white border-blue-600 shadow-sm"
                      : `${badgeColor} hover:border-slate-400`
                  }`}
                >
                  P.{sec.page}: {sec.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Interactive Frame Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 text-slate-300 px-4 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-white">Live Publication Preview</span>
              <span className="text-slate-400">· Standard A4 Portrait</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-mono"
              >
                -
              </button>
              <span className="font-mono text-slate-200">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-mono"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-200"
              >
                Reset
              </button>
            </div>
          </div>

          <div
            className="w-full bg-slate-600 p-4 sm:p-8 flex justify-center overflow-auto"
            style={{ minHeight: "850px" }}
          >
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease",
              }}
            >
              <iframe
                id="album-iframe"
                src={`/exports/ahafo_election_album.html?v=${albumVersion}`}
                title="Ahafo Election Album Preview"
                className="border-0 shadow-2xl rounded"
                style={{
                  width: "220mm",
                  height: "5100mm", // renders full scrollable 16-page spread
                  backgroundColor: "#ffffff",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
