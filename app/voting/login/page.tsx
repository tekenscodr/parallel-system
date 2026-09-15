"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Vote, Phone, CreditCard, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export default function VotingLoginPage() {
  const router = useRouter();
  const [identifierType, setIdentifierType] = useState<"voterId" | "phone">("voterId");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setError("Please enter your Voter ID or Phone number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/voting/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanInput }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Verification failed. Please check your credentials and try again.");
        setLoading(false);
        return;
      }

      // Store verification context in sessionStorage for the OTP step
      if (typeof window !== "undefined") {
        sessionStorage.setItem("voting_identifier", data.identifier);
        sessionStorage.setItem("voting_masked_phone", data.phoneMasked || "");
        if (data.devOtp) {
          sessionStorage.setItem("voting_dev_otp", data.devOtp);
        }
      }

      router.push(`/voting/otp?identifier=${encodeURIComponent(data.identifier)}`);
    } catch (err: any) {
      setError("Unable to connect to the verification server. Please check your internet connection and retry.");
      setLoading(false);
    }
  }

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
              National Executive Elections 2026 · Delegate Portal
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Official Ballot Roll</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          {/* Step Indicator */}
          <div className="mb-6 flex items-center justify-between px-2 text-xs font-semibold text-slate-400">
            <span className="text-blue-400 font-bold flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
              Identification
            </span>
            <span className="w-8 h-[1px] bg-slate-800"></span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px]">2</span>
              OTP
            </span>
            <span className="w-8 h-[1px] bg-slate-800"></span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px]">3</span>
              Confirmation
            </span>
          </div>

          {/* Card Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Top Red-White-Blue NPP Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 flex">
              <div className="flex-1 bg-red-600"></div>
              <div className="flex-1 bg-white"></div>
              <div className="flex-1 bg-blue-600"></div>
            </div>

            <div className="text-center mb-6 pt-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Delegate Sign In
              </h2>
              <p className="text-sm text-slate-400 mt-1.5">
                Verify your electoral college credentials to view your entitled voting portfolios.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => {
                  setIdentifierType("voterId");
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  identifierType === "voterId"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Voter ID
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentifierType("phone");
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  identifierType === "phone"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Phone className="w-4 h-4" />
                Phone Number
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-300 text-xs sm:text-sm animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {identifierType === "voterId" ? "10-Digit Voter ID Number" : "Registered Phone Number"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode={identifierType === "voterId" ? "numeric" : "tel"}
                    autoComplete="off"
                    autoFocus
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      identifierType === "voterId"
                        ? "e.g. 1928472910"
                        : "e.g. 024 123 4567 or +233 24..."
                    }
                    className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-white text-base font-medium placeholder:text-slate-600 transition-all outline-none"
                    disabled={loading}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    {identifierType === "voterId" ? (
                      <CreditCard className="w-5 h-5" />
                    ) : (
                      <Phone className="w-5 h-5" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {identifierType === "voterId"
                    ? "Your standard 10-digit Electoral Commission Voter ID number."
                    : "The mobile phone number registered on your executive delegate record."}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed group active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying Record...</span>
                  </>
                ) : (
                  <>
                    <span>Continue & Send OTP</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-500">
                Facing issues? Contact the{" "}
                <span className="text-slate-300 font-semibold">
                  Elections Directorate Helpdesk
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600">
        <p>National Elections Committee · NPP IT Directorate © 2026. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
