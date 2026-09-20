"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Award,
  Shield,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Printer,
  QrCode,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  IdCard,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
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
import { NativeSelect } from "@/components/ui/native-select";

export default function PublicAccreditationPage() {
  const [activeTab, setActiveTab] = useState<string>("apply");

  // Application form state
  const [formCategory, setFormCategory] = useState("MEDIA");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("Male");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [region, setRegion] = useState("Greater Accra");
  const [street, setStreet] = useState("");
  const [ghanaPostAddress, setGhanaPostAddress] = useState("");
  const [idType, setIdType] = useState("ghana-card");
  const [idNumber, setIdNumber] = useState("");
  const [voterId, setVoterId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedPass, setSubmittedPass] = useState<any>(null);

  // Status check state
  const [searchQuery, setSearchQuery] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [foundPass, setFoundPass] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    try {
      const payload = {
        category: formCategory,
        name,
        gender,
        company,
        roleTitle: roleTitle || undefined,
        serviceNumber: serviceNumber || undefined,
        emergencyContact: emergencyContact || undefined,
        region,
        street,
        ghanaPostAddress,
        idType,
        idNumber,
        voterId: voterId || undefined,
        phone: phone || undefined,
        email: email || undefined,
        profileImage: imageUrl || undefined,
      };

      const res = await fetch("/api/accreditation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.message || "Failed to submit application.");
        return;
      }

      setSubmittedPass(data.accreditation);
    } catch (err: any) {
      setSubmitError(err.message || "A network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setStatusError("");
    setCheckingStatus(true);
    setFoundPass(null);

    try {
      const q = searchQuery.trim();
      let queryParam = "code=" + encodeURIComponent(q);
      if (q.toUpperCase().startsWith("GHA-") || q.length >= 10 && !q.includes("-")) {
        queryParam = "idNumber=" + encodeURIComponent(q);
      }

      const res = await fetch(`/api/accreditation?${queryParam}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        // Try with voterId
        const res2 = await fetch(`/api/accreditation?voterId=${encodeURIComponent(q)}`);
        const data2 = await res2.json();
        if (data2.success && data2.accreditation) {
          setFoundPass(data2.accreditation);
          return;
        }

        setStatusError(data.message || "No accreditation pass found with these details.");
        return;
      }

      setFoundPass(data.accreditation);
    } catch (err: any) {
      setStatusError("Could not retrieve pass details: " + err.message);
    } finally {
      setCheckingStatus(false);
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
                NPP ACCREDITATION PORTAL
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] py-0">2026</Badge>
              </div>
              <div className="text-[11px] text-slate-400">
                Official Media, Security & Protocol Credentialing
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/request-update"
              className="text-slate-400 hover:text-sky-300 transition-colors hidden sm:inline-block"
            >
              Request Data Correction
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

      {/* Hero Header */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 py-12 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30 px-3 py-1 text-xs">
            National Electoral Conference Credentials
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Accreditation & Pass Issuance Portal
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Apply online for official press passes, security clearance, and conference badges, or check the vetting status of your existing credential.
          </p>
        </div>
      </section>

      {/* Main Workspace */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger
              value="apply"
              className="text-xs font-semibold data-[state=active]:bg-sky-600 data-[state=active]:text-white rounded-lg py-2"
            >
              <Award className="w-4 h-4 mr-1.5" /> Apply for Accreditation
            </TabsTrigger>
            <TabsTrigger
              value="status"
              className="text-xs font-semibold data-[state=active]:bg-sky-600 data-[state=active]:text-white rounded-lg py-2"
            >
              <Search className="w-4 h-4 mr-1.5" /> Check Status & Pass
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: APPLY FOR ACCREDITATION                                            */}
          {/* ========================================================================= */}
          <TabsContent value="apply" className="space-y-6 animate-in fade-in-50 duration-300">
            {submittedPass ? (
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-emerald-950/40 to-slate-900 border-b border-emerald-500/30 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Application Successfully Submitted!</h3>
                    <p className="text-xs text-slate-300">
                      Your accreditation request has been registered and is queued for national vetting.
                    </p>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase">Accreditation Code</div>
                      <div className="text-2xl font-black font-mono text-sky-400 tracking-wider mt-0.5">
                        {submittedPass.accreditationCode}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Save this code to check your pass status or retrieve your official badge.
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setSearchQuery(submittedPass.accreditationCode);
                        setActiveTab("status");
                      }}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs"
                    >
                      View Accreditation Status <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Applicant Name</span>
                      <span className="font-bold text-slate-200">{submittedPass.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Category</span>
                      <span className="font-bold text-sky-300">{submittedPass.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Organization</span>
                      <span className="font-bold text-slate-200">{submittedPass.company}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ID Number</span>
                      <span className="font-mono text-slate-200">{submittedPass.idNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status</span>
                      <span className="font-bold text-amber-400">PENDING VETTING</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSubmittedPass(null);
                      setName("");
                      setCompany("");
                      setIdNumber("");
                      setPhone("");
                    }}
                    className="border-slate-800 text-slate-300 text-xs"
                  >
                    Submit Another Application
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-sky-400" /> Accreditation Application Form
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Please provide accurate personal and organizational details. All submissions undergo security vetting.
                  </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-6">
                    {submitError && (
                      <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                        {submitError}
                      </div>
                    )}

                    {/* Category Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="category">Accreditation Category *</Label>
                      <NativeSelect
                        id="category"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 font-semibold"
                      >
                        <option value="MEDIA">Press / Media Personnel (TV, Radio, Print, Online)</option>
                        <option value="SECURITY">State Security / Executive Protection Detail</option>
                        <option value="USHER">Conference Protocol & Hall Ushering Team</option>
                        <option value="POLITICAL_PARTY">Fraternal Political Party Delegation</option>
                        <option value="CIVIL_SOCIETY">Civil Society Organization / Observer</option>
                        <option value="INTERNATIONAL_ORG">International Diplomatic Mission / Observer</option>
                      </NativeSelect>
                    </div>

                    {/* Personal Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Kwame Kyeremeh"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender">Gender *</Label>
                        <NativeSelect
                          id="gender"
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </NativeSelect>
                      </div>
                    </div>

                    {/* Organization & Designation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="company">
                          {formCategory === "SECURITY"
                            ? "Security Agency / Command Unit *"
                            : formCategory === "USHER"
                            ? "Protocol Committee / Ushering Unit *"
                            : "Media House / Organization *"}
                        </Label>
                        <Input
                          id="company"
                          required
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="e.g. Joy FM / Multimedia Group"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="roleTitle">Role / Designation</Label>
                        <Input
                          id="roleTitle"
                          value={roleTitle}
                          onChange={(e) => setRoleTitle(e.target.value)}
                          placeholder="e.g. Senior Broadcast Journalist"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Security specific fields */}
                    {formCategory === "SECURITY" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-rose-950/10 border border-rose-900/30 rounded-lg">
                        <div>
                          <Label htmlFor="serviceNumber">Service / Force Number</Label>
                          <Input
                            id="serviceNumber"
                            value={serviceNumber}
                            onChange={(e) => setServiceNumber(e.target.value)}
                            placeholder="e.g. GPS-84920"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>
                        <div>
                          <Label htmlFor="emergencyContact">Commanding Officer / Emergency Phone</Label>
                          <Input
                            id="emergencyContact"
                            value={emergencyContact}
                            onChange={(e) => setEmergencyContact(e.target.value)}
                            placeholder="0240000000"
                            className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                          />
                        </div>
                      </div>
                    )}

                    {/* Identification */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="idType">ID Type *</Label>
                        <NativeSelect
                          id="idType"
                          value={idType}
                          onChange={(e) => setIdType(e.target.value)}
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        >
                          <option value="ghana-card">Ghana Card (National ID)</option>
                          <option value="voter-id">EC Voter ID Card</option>
                          <option value="passport">Passport</option>
                          <option value="service-id">Official Service / Press ID</option>
                        </NativeSelect>
                      </div>
                      <div>
                        <Label htmlFor="idNumber">Identification Number *</Label>
                        <Input
                          id="idNumber"
                          required
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                          placeholder="GHA-000000000-0"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="voterId">EC Voter ID (Optional)</Label>
                        <Input
                          id="voterId"
                          value={voterId}
                          onChange={(e) => setVoterId(e.target.value)}
                          placeholder="10-digit Voter ID"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Location & Digital Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="region">Region *</Label>
                        <NativeSelect
                          id="region"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        >
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
                      </div>
                      <div>
                        <Label htmlFor="street">Office / Street Address *</Label>
                        <Input
                          id="street"
                          required
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="e.g. Kokomlemle High Street"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ghanaPostAddress">GhanaPost GPS Digital Address *</Label>
                        <Input
                          id="ghanaPostAddress"
                          required
                          value={ghanaPostAddress}
                          onChange={(e) => setGhanaPostAddress(e.target.value)}
                          placeholder="e.g. GA-019-3829"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100 uppercase"
                        />
                      </div>
                    </div>

                    {/* Contact details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0240000000"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@organization.com"
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="imageUrl">Passport Photo URL (Optional)</Label>
                        <Input
                          id="imageUrl"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="mt-1 bg-slate-950 border-slate-800 text-slate-100"
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
                      {submitting ? "Submitting..." : "Submit Accreditation Application"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            )}
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: CHECK STATUS & RETRIEVE PASS                                       */}
          {/* ========================================================================= */}
          <TabsContent value="status" className="space-y-6 animate-in fade-in-50 duration-300">
            <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-sky-400" /> Accreditation Pass Lookup
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Enter your Accreditation Code (e.g. MED-2026-06CB96), Ghana Card Number, or Voter ID to inspect verification status and retrieve your official badge.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <form onSubmit={handleSearchPass} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Enter code (MED-2026-...) or Ghana Card (GHA-...)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-800 text-slate-100"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={checkingStatus}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    {checkingStatus ? "Searching..." : "Lookup Pass"}
                  </Button>
                </form>

                {statusError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                    {statusError}
                  </div>
                )}

                {/* Found Pass View */}
                {foundPass && (
                  <div className="space-y-6 pt-2">
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-400 uppercase font-semibold">Status Decision</div>
                        <div className="mt-1">
                          {foundPass.status === "APPROVED" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-sm py-1 px-3">
                              <CheckCircle2 className="w-4 h-4 mr-1.5" /> ACCREDITATION APPROVED
                            </Badge>
                          ) : foundPass.status === "REJECTED" ? (
                            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-sm py-1 px-3">
                              <XCircle className="w-4 h-4 mr-1.5" /> APPLICATION DENIED
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-sm py-1 px-3">
                              <Clock className="w-4 h-4 mr-1.5" /> UNDER VETTING
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-semibold uppercase">Credential Code</div>
                        <div className="text-xl font-black font-mono text-sky-400">
                          {foundPass.accreditationCode}
                        </div>
                      </div>
                    </div>

                    {/* Official Badge Preview if Approved */}
                    {foundPass.status === "APPROVED" && (
                      <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="w-80 rounded-2xl overflow-hidden bg-white text-slate-900 shadow-2xl border-4 border-slate-900">
                          <div
                            className={`p-4 text-center text-white ${
                              foundPass.category === "SECURITY"
                                ? "bg-rose-700"
                                : foundPass.category === "USHER"
                                ? "bg-amber-600"
                                : "bg-blue-800"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <img src="/npp-logo.png" alt="NPP" className="w-8 h-8 object-contain bg-white rounded-full p-0.5" />
                              <span className="text-[10px] font-extrabold tracking-widest uppercase opacity-90">
                                NPP NATIONAL SECRETARIAT
                              </span>
                              <Shield className="w-5 h-5 text-white/90" />
                            </div>
                            <div className="text-lg font-black tracking-wider uppercase mt-1">
                              {foundPass.category === "MEDIA"
                                ? "OFFICIAL MEDIA"
                                : foundPass.category === "SECURITY"
                                ? "SECURITY CLEARANCE"
                                : foundPass.category === "USHER"
                                ? "PROTOCOL & USHER"
                                : foundPass.category}
                            </div>
                            <div className="text-[9px] font-semibold uppercase tracking-widest opacity-80">
                              2026 ELECTORAL CONFERENCE PASS
                            </div>
                          </div>

                          <div className="p-5 flex flex-col items-center text-center">
                            <div className="w-28 h-28 rounded-xl border-4 border-slate-200 overflow-hidden shadow-md bg-slate-100 flex items-center justify-center mb-3">
                              {foundPass.profileImage ? (
                                <img src={foundPass.profileImage} alt={foundPass.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-2xl font-black text-slate-400">
                                  {foundPass.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <h3 className="text-lg font-extrabold text-slate-900 uppercase leading-tight">
                              {foundPass.name}
                            </h3>
                            <p className="text-xs font-bold text-blue-800 mt-0.5">
                              {foundPass.company}
                            </p>
                            {foundPass.roleTitle && (
                              <p className="text-[11px] text-slate-600 font-medium">
                                {foundPass.roleTitle}
                              </p>
                            )}

                            <div className="mt-3 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                              ZONE: {foundPass.assignedZone || "PLENARY & MEDIA CENTER"}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-200 w-full flex items-center justify-between px-2">
                              <div className="text-left">
                                <div className="text-[9px] text-slate-500 uppercase font-semibold">Pass Number</div>
                                <div className="text-xs font-black font-mono text-slate-900">
                                  {foundPass.accreditationCode}
                                </div>
                                <div className="text-[9px] text-slate-500 uppercase mt-1">National ID</div>
                                <div className="text-[10px] font-mono font-semibold text-slate-700">
                                  {foundPass.idNumber}
                                </div>
                              </div>

                              <div className="w-16 h-16 bg-slate-900 rounded-lg p-1.5 flex flex-col items-center justify-center text-white">
                                <QrCode className="w-full h-full text-white" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-900 text-slate-300 text-[9px] font-mono text-center py-1.5 uppercase tracking-widest">
                            ★ OFFICIAL SECURITY CREDENTIAL ★
                          </div>
                        </div>

                        <Button
                          onClick={() => window.print()}
                          className="mt-6 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs"
                        >
                          <Printer className="w-4 h-4 mr-2" /> Print / Download Official Pass
                        </Button>
                      </div>
                    )}
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
