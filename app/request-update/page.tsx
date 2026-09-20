"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GitPullRequest,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Building,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ExecutiveRecord {
  id: number;
  executive_name: string;
  executive_level: string;
  region: string;
  constituency: string | null;
  position: string;
  phone: string | null;
  email: string | null;
  ghana_card: string | null;
  voter_id: string | null;
  gender: string | null;
  date_of_birth: string | null;
  age: number | null;
  image_url: string | null;
}

export default function PublicRequestUpdatePage() {
  const [activeTab, setActiveTab] = useState<string>("submit");

  // Search executive state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRegion, setSearchRegion] = useState("ALL");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ExecutiveRecord[]>([]);
  const [selectedExecutive, setSelectedExecutive] = useState<ExecutiveRecord | null>(null);

  // Proposed changes state
  const [proposedName, setProposedName] = useState("");
  const [proposedPhone, setProposedPhone] = useState("");
  const [proposedGhanaCard, setProposedGhanaCard] = useState("");
  const [proposedVoterId, setProposedVoterId] = useState("");
  const [proposedGender, setProposedGender] = useState("");
  const [proposedDob, setProposedDob] = useState("");
  const [proposedAge, setProposedAge] = useState("");
  const [proposedImageUrl, setProposedImageUrl] = useState("");
  const [proposedPosition, setProposedPosition] = useState("");

  // Requester details
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requesterRole, setRequesterRole] = useState("Self (Executive)");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [reason, setReason] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedResult, setSubmittedResult] = useState<any>(null);

  // Tracking tab state
  const [trackCode, setTrackCode] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedRequests, setTrackedRequests] = useState<any[]>([]);
  const [trackError, setTrackError] = useState("");

  // Search executives
  const handleSearchExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() && searchRegion === "ALL") return;

    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery.trim());
      if (searchRegion !== "ALL") params.set("region", searchRegion);
      params.set("limit", "15");

      const res = await fetch(`/api/executives/search?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.executives || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  // Select executive and prefill
  const handleSelectExecutive = (exec: ExecutiveRecord) => {
    setSelectedExecutive(exec);
    setProposedName(exec.executive_name || "");
    setProposedPhone(exec.phone || "");
    setProposedGhanaCard(exec.ghana_card || "");
    setProposedVoterId(exec.voter_id || "");
    setProposedGender(exec.gender || "Male");
    setProposedDob(exec.date_of_birth || "");
    setProposedAge(exec.age ? String(exec.age) : "");
    setProposedImageUrl(exec.image_url || "");
    setProposedPosition(exec.position || "");
  };

  // Submit update request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExecutive) return;
    setSubmitError("");

    // Calculate diff
    const proposedChanges: Record<string, any> = {};
    if (proposedName.trim() && proposedName.trim() !== selectedExecutive.executive_name) {
      proposedChanges.executive_name = proposedName.trim();
    }
    if (proposedPhone.trim() && proposedPhone.trim() !== (selectedExecutive.phone || "")) {
      proposedChanges.phone = proposedPhone.trim();
    }
    if (proposedGhanaCard.trim() && proposedGhanaCard.trim() !== (selectedExecutive.ghana_card || "")) {
      proposedChanges.ghana_card = proposedGhanaCard.trim().toUpperCase();
    }
    if (proposedVoterId.trim() && proposedVoterId.trim() !== (selectedExecutive.voter_id || "")) {
      proposedChanges.voter_id = proposedVoterId.trim();
    }
    if (proposedGender && proposedGender !== (selectedExecutive.gender || "")) {
      proposedChanges.gender = proposedGender;
    }
    if (proposedDob.trim() && proposedDob.trim() !== (selectedExecutive.date_of_birth || "")) {
      proposedChanges.date_of_birth = proposedDob.trim();
    }
    if (proposedAge.trim() && Number(proposedAge) !== selectedExecutive.age) {
      proposedChanges.age = parseInt(proposedAge, 10);
    }
    if (proposedImageUrl.trim() && proposedImageUrl.trim() !== (selectedExecutive.image_url || "")) {
      proposedChanges.image_url = proposedImageUrl.trim();
    }
    if (proposedPosition.trim() && proposedPosition.trim() !== selectedExecutive.position) {
      proposedChanges.position = proposedPosition.trim();
    }

    if (Object.keys(proposedChanges).length === 0) {
      setSubmitError("No changes were made. Please modify at least one field before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        executiveId: selectedExecutive.id,
        requesterName,
        requesterPhone,
        requesterRole,
        requesterEmail: requesterEmail || undefined,
        proposedChanges,
        reason: reason || undefined,
      };

      const res = await fetch("/api/update-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.message || "Failed to submit update request.");
        return;
      }

      setSubmittedResult(data);
    } catch (err: any) {
      setSubmitError(err.message || "A network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // Lookup tracked requests
  const handleTrackLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackCode.trim()) return;

    setTrackingLoading(true);
    setTrackError("");
    setTrackedRequests([]);

    try {
      const res = await fetch(`/api/update-requests?code=${encodeURIComponent(trackCode.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setTrackError(data.message || "No requests found for this tracking code.");
        return;
      }

      setTrackedRequests(data.requests || []);
    } catch (err: any) {
      setTrackError("Error looking up request: " + err.message);
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-1 border border-sky-400/40 flex items-center justify-center shadow-md">
              <img src="/npp-logo.png" alt="NPP" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
                EXECUTIVE UPDATES PORTAL
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] py-0">2026</Badge>
              </div>
              <div className="text-[11px] text-slate-400">
                Official Electoral College Data Corrections
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/accreditation"
              className="text-slate-400 hover:text-sky-300 transition-colors hidden sm:inline-block"
            >
              Conference Accreditation
            </Link>
            <Link
              href="/admin/login"
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 py-10 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 px-3 py-1 text-xs">
            Electoral Roll & Executive Integrity
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Request Data Correction or Profile Update
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Find your executive profile to submit corrections for name spelling, phone numbers, Ghana Card, voter IDs, or profile photos.
          </p>
        </div>
      </section>

      {/* Main Workspace */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger
              value="submit"
              className="text-xs font-semibold data-[state=active]:bg-sky-600 data-[state=active]:text-white rounded-lg py-2"
            >
              <GitPullRequest className="w-4 h-4 mr-1.5" /> Submit Correction
            </TabsTrigger>
            <TabsTrigger
              value="track"
              className="text-xs font-semibold data-[state=active]:bg-sky-600 data-[state=active]:text-white rounded-lg py-2"
            >
              <Search className="w-4 h-4 mr-1.5" /> Track Request Status
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: SUBMIT CORRECTION REQUEST                                          */}
          {/* ========================================================================= */}
          <TabsContent value="submit" className="space-y-6 animate-in fade-in-50 duration-300">
            {submittedResult ? (
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-emerald-950/40 to-slate-900 border-b border-emerald-500/30 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Correction Request Submitted!</h3>
                    <p className="text-xs text-slate-300">
                      Your update request has been securely recorded and queued for administrative approval.
                    </p>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase">Tracking Reference</div>
                      <div className="text-2xl font-black font-mono text-sky-400 tracking-wider mt-0.5">
                        {submittedResult.trackingCode}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Use this reference number anytime to check if your update has been reviewed and synced.
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setTrackCode(submittedResult.trackingCode);
                        setActiveTab("track");
                      }}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs"
                    >
                      Track Request Progress <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>
                </CardContent>

                <CardFooter className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSubmittedResult(null);
                      setSelectedExecutive(null);
                      setSearchResults([]);
                    }}
                    className="border-slate-800 text-slate-300 text-xs"
                  >
                    Submit Another Correction
                  </Button>
                </CardFooter>
              </Card>
            ) : !selectedExecutive ? (
              /* Step 1: Search and Select Executive */
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-sky-400" /> Step 1: Locate Executive Profile
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Search by executive name, phone number, Ghana Card, or filter by Region to select the record you wish to correct.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <form onSubmit={handleSearchExecutive} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        placeholder="Search name (e.g. Mensah), phone, Ghana Card..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-950 border-slate-800 text-slate-100"
                      />
                    </div>
                    <NativeSelect
                      value={searchRegion}
                      onChange={(e) => setSearchRegion(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs w-full sm:w-44"
                    >
                      <option value="ALL">All Regions</option>
                      <option value="Greater Accra">Greater Accra</option>
                      <option value="Ashanti">Ashanti</option>
                      <option value="Eastern">Eastern</option>
                      <option value="Central">Central</option>
                      <option value="Western">Western</option>
                      <option value="Volta">Volta</option>
                      <option value="Northern">Northern</option>
                      <option value="Upper East">Upper East</option>
                      <option value="Upper West">Upper West</option>
                      <option value="Bono">Bono</option>
                      <option value="Bono East">Bono East</option>
                      <option value="Ahafo">Ahafo</option>
                      <option value="Western North">Western North</option>
                      <option value="Oti">Oti</option>
                      <option value="Savannah">Savannah</option>
                      <option value="North East">North East</option>
                    </NativeSelect>
                    <Button
                      type="submit"
                      disabled={searching}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                    >
                      {searching ? "Searching..." : "Search"}
                    </Button>
                  </form>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-xs font-semibold text-slate-400">
                        Select your record from matching executives ({searchResults.length}):
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 max-h-96 overflow-y-auto pr-1">
                        {searchResults.map((exec) => (
                          <div
                            key={exec.id}
                            onClick={() => handleSelectExecutive(exec)}
                            className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-sky-500/50 hover:bg-slate-850 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border border-slate-800 bg-slate-800">
                                {exec.image_url && <AvatarImage src={exec.image_url} alt={exec.executive_name} />}
                                <AvatarFallback className="text-xs font-bold text-slate-300">
                                  {exec.executive_name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-bold text-slate-100 group-hover:text-sky-300 transition-colors">
                                  {exec.executive_name}
                                </div>
                                <div className="text-xs text-slate-400">{exec.position}</div>
                                <div className="text-[11px] text-slate-500">
                                  {exec.region} {exec.constituency ? `• ${exec.constituency}` : ""}
                                </div>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              className="bg-sky-600/20 text-sky-300 hover:bg-sky-600 hover:text-white border border-sky-500/30 text-xs font-semibold"
                            >
                              Select Record <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Step 2: Form with Proposed Changes */
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-sky-400" /> Step 2: Propose Corrections
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-1">
                      Modifying record for{" "}
                      <span className="font-bold text-slate-200">{selectedExecutive.executive_name}</span>{" "}
                      ({selectedExecutive.position} • {selectedExecutive.region})
                    </CardDescription>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedExecutive(null)}
                    className="border-slate-700 text-slate-300 text-xs"
                  >
                    Change Record
                  </Button>
                </CardHeader>

                <form onSubmit={handleSubmitRequest}>
                  <CardContent className="space-y-6 pt-6">
                    {submitError && (
                      <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                        {submitError}
                      </div>
                    )}

                    {/* Correction Fields */}
                    <div className="space-y-4">
                      <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                        Editable Profile Fields
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="prop-name">Full Executive Name</Label>
                          <Input
                            id="prop-name"
                            required
                            value={proposedName}
                            onChange={(e) => setProposedName(e.target.value)}
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                          <span className="text-[10px] text-slate-500">Correct typos or official spelling</span>
                        </div>

                        <div>
                          <Label htmlFor="prop-phone">Phone Number</Label>
                          <Input
                            id="prop-phone"
                            value={proposedPhone}
                            onChange={(e) => setProposedPhone(e.target.value)}
                            placeholder="0240000000"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                          <span className="text-[10px] text-slate-500">Used for voting OTP & communications</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="prop-ghana-card">Ghana Card Number</Label>
                          <Input
                            id="prop-ghana-card"
                            value={proposedGhanaCard}
                            onChange={(e) => setProposedGhanaCard(e.target.value)}
                            placeholder="GHA-000000000-0"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>

                        <div>
                          <Label htmlFor="prop-voter-id">EC Voter ID Number</Label>
                          <Input
                            id="prop-voter-id"
                            value={proposedVoterId}
                            onChange={(e) => setProposedVoterId(e.target.value)}
                            placeholder="10-digit Voter ID"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="prop-gender">Gender</Label>
                          <NativeSelect
                            id="prop-gender"
                            value={proposedGender}
                            onChange={(e) => setProposedGender(e.target.value)}
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </NativeSelect>
                        </div>

                        <div>
                          <Label htmlFor="prop-dob">Date of Birth</Label>
                          <Input
                            id="prop-dob"
                            value={proposedDob}
                            onChange={(e) => setProposedDob(e.target.value)}
                            placeholder="YYYY-MM-DD"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>

                        <div>
                          <Label htmlFor="prop-age">Age</Label>
                          <Input
                            id="prop-age"
                            type="number"
                            value={proposedAge}
                            onChange={(e) => setProposedAge(e.target.value)}
                            placeholder="Age"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="prop-image">Photo URL (Portrait / Avatar)</Label>
                        <Input
                          id="prop-image"
                          value={proposedImageUrl}
                          onChange={(e) => setProposedImageUrl(e.target.value)}
                          placeholder="https://cms.newpatrioticparty.org/uploads/..."
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Requester Identity & Reason */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                        Requester Verification & Reason
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="req-name">Your Full Name *</Label>
                          <Input
                            id="req-name"
                            required
                            value={requesterName}
                            onChange={(e) => setRequesterName(e.target.value)}
                            placeholder="e.g. Kwabena Asante"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>

                        <div>
                          <Label htmlFor="req-phone">Your Phone Number *</Label>
                          <Input
                            id="req-phone"
                            required
                            value={requesterPhone}
                            onChange={(e) => setRequesterPhone(e.target.value)}
                            placeholder="0240000000"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>

                        <div>
                          <Label htmlFor="req-role">Your Role / Relationship *</Label>
                          <NativeSelect
                            id="req-role"
                            value={requesterRole}
                            onChange={(e) => setRequesterRole(e.target.value)}
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          >
                            <option value="Self (Executive)">Self (I am the executive)</option>
                            <option value="Constituency Secretary">Constituency Secretary</option>
                            <option value="Constituency Chairman">Constituency Chairman</option>
                            <option value="Regional IT Officer">Regional IT Officer</option>
                            <option value="Regional Secretary">Regional Secretary</option>
                            <option value="TESCON President">TESCON President</option>
                            <option value="Other Party Officer">Other Party Officer</option>
                          </NativeSelect>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="req-reason">Reason for Correction *</Label>
                        <Textarea
                          id="req-reason"
                          required
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Please explain why this update is needed (e.g. spelling error on ballot album, new phone number acquired, missing Ghana Card)..."
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100 min-h-[80px]"
                        />
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-6 border-t border-slate-800 bg-slate-950/40 flex justify-end">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-8 shadow-lg shadow-sky-600/20"
                    >
                      {submitting ? "Submitting..." : "Submit Correction for Review"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            )}
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: TRACK STATUS                                                       */}
          {/* ========================================================================= */}
          <TabsContent value="track" className="space-y-6 animate-in fade-in-50 duration-300">
            <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-sky-400" /> Track Update Request Status
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Enter your tracking code (e.g. REQ-2026-ABCDEF) or the requester phone number to inspect the review progress.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <form onSubmit={handleTrackLookup} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Enter tracking code (REQ-2026-...) or phone number..."
                      value={trackCode}
                      onChange={(e) => setTrackCode(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-800 text-slate-100 font-mono"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={trackingLoading}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    {trackingLoading ? "Searching..." : "Track Request"}
                  </Button>
                </form>

                {trackError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                    {trackError}
                  </div>
                )}

                {trackedRequests.length > 0 && (
                  <div className="space-y-4 pt-2">
                    {trackedRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-5 rounded-xl border border-slate-800 bg-slate-950/70 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                          <div>
                            <div className="text-xs font-bold text-slate-400 uppercase">Tracking Code</div>
                            <div className="text-lg font-black font-mono text-sky-400">{req.tracking_code}</div>
                          </div>
                          <div>
                            {req.status === "APPROVED" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs py-1 px-3">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> APPROVED & SYNCED TO DATABASE
                              </Badge>
                            ) : req.status === "REJECTED" ? (
                              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs py-1 px-3">
                                <XCircle className="w-3.5 h-3.5 mr-1" /> REJECTED
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs py-1 px-3">
                                <Clock className="w-3.5 h-3.5 mr-1" /> PENDING REVIEW
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 block">Executive</span>
                            <span className="font-bold text-slate-200">{req.executive_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Position</span>
                            <span className="font-semibold text-slate-300">{req.position}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Submitted On</span>
                            <span className="text-slate-300">
                              {new Date(req.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {req.review_notes && (
                          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                            <span className="font-bold text-slate-400">Admin Review Notes: </span>
                            <span className="text-slate-200">{req.review_notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        New Patriotic Party (NPP) • National Executive Directorate & IT Command • 2026
      </footer>
    </div>
  );
}
