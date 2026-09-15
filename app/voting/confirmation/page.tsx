"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Vote,
  ShieldCheck,
  User,
  CheckCircle2,
  Calendar,
  MapPin,
  Building2,
  LogOut,
  AlertCircle,
  Loader2,
  Award,
} from "lucide-react";
import type { EntitledPosition } from "@/lib/voting-entitlement";

interface DelegateInfo {
  id: number | string;
  name: string;
  voterId: string;
  phone: string;
  level: string;
  region: string;
  constituency: string;
  position: string;
  gender: string;
  age: number | null;
}

export default function ElectionConfirmationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delegate, setDelegate] = useState<DelegateInfo | null>(null);
  const [positions, setPositions] = useState<EntitledPosition[]>([]);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfirmation() {
      try {
        const token = typeof window !== "undefined" ? sessionStorage.getItem("delegate_token") : null;
        const res = await fetch("/api/voting/confirmation", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Your voting session has expired. Please sign in again.");
          setLoading(false);
          return;
        }

        setDelegate(data.delegate);
        setPositions(data.entitledPositions || []);
        setVerifiedAt(data.verifiedAt);
        setLoading(false);
      } catch (err: any) {
        setError("Unable to retrieve election confirmation details. Please check your connection.");
        setLoading(false);
      }
    }

    loadConfirmation();
  }, []);

  function handleLogout() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("delegate_token");
      sessionStorage.removeItem("voting_identifier");
      sessionStorage.removeItem("voting_masked_phone");
    }
    router.push("/voting/login");
  }

  const categoryColorMap: Record<string, { bg: string; text: string; border: string; label: string }> = {
    general: {
      bg: "bg-blue-950/60",
      text: "text-blue-300",
      border: "border-blue-700/60",
      label: "General National Ballot",
    },
    youth: {
      bg: "bg-amber-950/60",
      text: "text-amber-300",
      border: "border-amber-700/60",
      label: "Youth Wing Ballot",
    },
    women: {
      bg: "bg-rose-950/60",
      text: "text-rose-300",
      border: "border-rose-700/60",
      label: "Women's Wing Ballot",
    },
    nasara: {
      bg: "bg-emerald-950/60",
      text: "text-emerald-300",
      border: "border-emerald-700/60",
      label: "Nasara Wing Ballot",
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-900/60 border border-blue-700/50 flex items-center justify-center text-blue-400 shadow-inner">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold tracking-tight text-white text-base md:text-lg uppercase">
              New Patriotic Party
            </h1>
            <p className="text-xs text-blue-400 font-medium">
              National Executive Elections 2026 · Electoral College
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-700/60 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Identity Confirmed</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium">Loading election authorization & voting entitlements...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <Link
              href="/voting/login"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Return to Delegate Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-between max-w-md mx-auto px-2 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
                Identification
              </span>
              <span className="w-8 h-[1px] bg-emerald-600/50"></span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
                OTP
              </span>
              <span className="w-8 h-[1px] bg-emerald-600/50"></span>
              <span className="text-blue-400 font-bold flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                Confirmation
              </span>
            </div>

            {/* Banner */}
            <div className="bg-gradient-to-r from-blue-900/60 via-slate-900 to-blue-900/40 border border-blue-700/50 rounded-2xl p-6 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-1 flex">
                <div className="flex-1 bg-red-600"></div>
                <div className="flex-1 bg-white"></div>
                <div className="flex-1 bg-blue-600"></div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                    Electoral College Status: Confirmed
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Election Authorization Confirmation
                  </h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                    Your executive profile has been verified against the official National Register. Below are the contested portfolios you are constitutionally authorized to vote for.
                  </p>
                </div>
                <div className="text-left md:text-right flex-shrink-0">
                  <div className="text-xs text-slate-400">Total Authorized Portfolios</div>
                  <div className="text-3xl font-black text-blue-400">{positions.length}</div>
                </div>
              </div>
            </div>

            {/* Delegate Profile Card */}
            {delegate && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                  <User className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    Verified Delegate Profile
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Full Name
                    </span>
                    <span className="text-sm font-extrabold text-white block truncate">
                      {delegate.name}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Voter ID Number
                    </span>
                    <span className="text-sm font-mono font-bold text-blue-400 block">
                      {delegate.voterId || "—"}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Executive Level
                    </span>
                    <span className="text-sm font-bold text-slate-200 block">
                      {delegate.level}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Position / Role
                    </span>
                    <span className="text-sm font-bold text-slate-200 block truncate">
                      {delegate.position}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Region
                      </span>
                      <span className="text-xs font-bold text-slate-300 block truncate">
                        {delegate.region || "National"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Constituency / Campus
                      </span>
                      <span className="text-xs font-bold text-slate-300 block truncate">
                        {delegate.constituency || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Age Category
                      </span>
                      <span className="text-xs font-bold text-slate-300 block">
                        {delegate.age !== null ? `${delegate.age} yrs (${delegate.age < 40 ? "Under 40" : "40+"})` : "General"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                        Verification Status
                      </span>
                      <span className="text-xs font-bold text-emerald-400 block">
                        Active & Certified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Entitled Positions Grid */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    Authorized Contested Portfolios
                  </h3>
                </div>
                <div className="text-xs text-slate-400">
                  Showing {positions.length} authorized ballots
                </div>
              </div>

              {positions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  <p className="text-sm font-medium">
                    No active voting portfolios authorized for this account profile.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {positions.map((pos, idx) => {
                    const styling = categoryColorMap[pos.category] || categoryColorMap.general;
                    return (
                      <div
                        key={pos.id || idx}
                        className={`rounded-xl border p-4.5 transition-all bg-slate-950/70 border-slate-800/90 hover:border-slate-700 flex flex-col justify-between`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styling.bg} ${styling.text} ${styling.border}`}
                            >
                              {styling.label}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Authorized
                            </span>
                          </div>

                          <h4 className="text-base font-extrabold text-white tracking-tight">
                            {pos.title}
                          </h4>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <span className="text-[11px] font-medium text-slate-500">
                            Eligibility Criterion:
                          </span>
                          <span className="font-semibold text-slate-300 text-right">
                            {pos.reason}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Official Confirmation Notice */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400 leading-relaxed">
              <p>
                This document serves as your official electronic authorization confirmation for the New Patriotic Party National Executive Elections 2026.
              </p>
              {verifiedAt && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Session verified at {new Date(verifiedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600">
        <p>National Elections Committee · NPP IT Directorate © 2026. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
