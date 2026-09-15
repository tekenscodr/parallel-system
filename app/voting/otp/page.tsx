"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Vote, KeyRound, ArrowRight, ShieldCheck, AlertCircle, Loader2, RotateCcw, ArrowLeft } from "lucide-react";

function OtpVerificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    const idFromParam = searchParams.get("identifier");
    const idFromStorage = typeof window !== "undefined" ? sessionStorage.getItem("voting_identifier") : "";
    const phoneFromStorage = typeof window !== "undefined" ? sessionStorage.getItem("voting_masked_phone") : "";
    const devOtpFromStorage = typeof window !== "undefined" ? sessionStorage.getItem("voting_dev_otp") : "";

    const activeId = idFromParam || idFromStorage || "";
    if (!activeId) {
      router.replace("/voting/login");
      return;
    }

    setIdentifier(activeId);
    if (phoneFromStorage) setMaskedPhone(phoneFromStorage);

    // If dev OTP is available in dev mode, prefill hint
    if (devOtpFromStorage) {
      setInfoMessage(`[Development Demo Code: ${devOtpFromStorage}]`);
    }
  }, [searchParams, router]);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/voting/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          otp: cleanOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Invalid verification code. Please double check and try again.");
        setLoading(false);
        return;
      }

      // Store verified token in sessionStorage as backup
      if (typeof window !== "undefined" && data.token) {
        sessionStorage.setItem("delegate_token", data.token);
      }

      router.push("/voting/confirmation");
    } catch (err: any) {
      setError("Network error while verifying OTP. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setError(null);
    setInfoMessage(null);

    try {
      const res = await fetch("/api/voting/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });

      const data = await res.json();
      setResending(false);

      if (!res.ok || !data.success) {
        setError(data.error || "Unable to resend verification code. Please retry.");
        return;
      }

      setResendTimer(60);
      setInfoMessage("A new verification code has been dispatched to your phone.");
      if (data.devOtp) {
        sessionStorage.setItem("voting_dev_otp", data.devOtp);
        setInfoMessage(`New code sent! [Demo Code: ${data.devOtp}]`);
      }
    } catch {
      setResending(false);
      setError("Failed to reach the SMS service. Please retry.");
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
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
              Identification
            </span>
            <span className="w-8 h-[1px] bg-emerald-600/50"></span>
            <span className="text-blue-400 font-bold flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
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
              <div className="w-12 h-12 rounded-full bg-blue-900/40 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Enter Verification Code
              </h2>
              <p className="text-sm text-slate-400 mt-1.5">
                We have sent an SMS containing a 6-digit code to your registered mobile number{" "}
                {maskedPhone && <span className="font-semibold text-slate-200">({maskedPhone})</span>}.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-300 text-xs sm:text-sm animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )}

            {/* Info Message */}
            {infoMessage && (
              <div className="mb-5 p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs sm:text-sm font-medium text-center">
                {infoMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl px-4 py-3.5 text-center text-white text-2xl tracking-[0.4em] font-mono font-black placeholder:text-slate-700 placeholder:tracking-normal transition-all outline-none"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Confirm Election</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Resend Actions */}
            <div className="mt-6 flex flex-col items-center gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Didn&apos;t receive the SMS code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendTimer > 0 || resending}
                  className="text-blue-400 hover:text-blue-300 font-bold disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {resending && <Loader2 className="w-3 h-3 animate-spin" />}
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend OTP"}
                </button>
              </div>

              <Link
                href="/voting/login"
                className="text-slate-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Use a different Voter ID or Phone number</span>
              </Link>
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

export default function VotingOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">
          Loading verification...
        </div>
      }
    >
      <OtpVerificationForm />
    </Suspense>
  );
}
