"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Landmark,
  Map,
  Building2,
  Layers,
  Vote,
  GraduationCap,
  Globe,
  Search,
  Download,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  FileCheck,
  UserCheck,
  Compass,
  LogOut,
} from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";

type OverviewData = {
  totals: {
    total: number;
    women: number;
    nasara: number;
    appointed: number;
    elected: number;
  };
  tiers: Array<{ level: string; count: number; women: number }>;
  genderDistribution: Array<{ label: string; count: number }>;
  regionalDistribution: Array<{ region: string; count: number }>;
  user: { id: string; email: string; name: string; role: string };
};

type ExecutiveRow = {
  id: number;
  executiveLevel: string;
  slotStatus: string;
  region: string;
  constituency: string;
  electoralArea: string;
  pollingStation: string;
  position: string;
  executiveName: string;
  membershipId: string;
  email: string;
  ghanaCard: string;
  voterId: string;
  gender: string;
  status: string;
};

type ExecutiveDetail = {
  id: number;
  executiveName: string;
  position: string;
  executiveLevel: string;
  slotStatus: string;
  region: string;
  constituency: string;
  electoralArea: string;
  pollingStation: string;
  gender: string;
  phone: string;
  email: string;
  ghanaCard: string;
  voterId: string;
  membershipId: string;
  dateOfBirth: string;
  age: number | null;
  status: string;
};

const REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
  "Greater Accra", "North East", "Northern", "Oti", "Savannah",
  "Upper East", "Upper West", "Volta", "Western", "Western North"
];

const TIERS = [
  { id: "", label: "All Levels", icon: Globe },
  { id: "National", label: "National", icon: Landmark },
  { id: "Region", label: "Regional", icon: Map },
  { id: "Constituency", label: "Constituency", icon: Building2 },
  { id: "Electoral Area", label: "Electoral Area", icon: Layers },
  { id: "Polling Station", label: "Polling Station", icon: Vote },
  { id: "TESCON", label: "TESCON", icon: GraduationCap },
];

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_session_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

export default function NationalAdminDashboard() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [currentUser, setCurrentUser] = useState<OverviewData["user"] | null>(null);
  const [authError, setAuthError] = useState<string>("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedConstituency, setSelectedConstituency] = useState<string>("");
  const [constituencyList, setConstituencyList] = useState<string[]>([]);
  const [loadingConstituencies, setLoadingConstituencies] = useState<boolean>(false);
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Roster table state
  const [rows, setRows] = useState<ExecutiveRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingRows, setLoadingRows] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [activeExecutive, setActiveExecutive] = useState<ExecutiveDetail | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load constituencies STRICTLY tied to selectedRegion
  useEffect(() => {
    if (!selectedRegion) {
      setConstituencyList([]);
      setSelectedConstituency("");
      setLoadingConstituencies(false);
      return;
    }

    setLoadingConstituencies(true);
    const params = new URLSearchParams({ region: selectedRegion });

    fetch(`/api/admin/constituencies?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { constituencies: [] }))
      .then((data) => {
        setConstituencyList(data.constituencies || []);
        setLoadingConstituencies(false);
      })
      .catch(() => {
        setConstituencyList([]);
        setLoadingConstituencies(false);
      });
  }, [selectedRegion]);

  // Auth check & Overview data fetch
  useEffect(() => {
    const headers = getAuthHeaders();
    fetch("/api/admin/auth/me", {
      credentials: "include",
      headers,
    })
      .then((res) => {
        if (!res.ok) {
          setAuthError("Session expired or unauthorized. Please login.");
          return null;
        }
        return res.json();
      })
      .then((authData) => {
        if (!authData || !authData.authenticated) {
          setAuthError("Session expired or unauthorized. Please login.");
          return;
        }
        setCurrentUser(authData.user);

        // Load overview analytics
        fetch("/api/admin/overview", {
          credentials: "include",
          headers: getAuthHeaders(),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.totals) {
              setOverview(data);
            }
            setLoadingOverview(false);
          })
          .catch(() => setLoadingOverview(false));
      })
      .catch((err: unknown) => {
        setAuthError(err instanceof Error ? err.message : "Authentication error");
      });
  }, []);

  // Fetch paginated roster
  const fetchRoster = useCallback(() => {
    setLoadingRows(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (selectedLevel) params.set("level", selectedLevel);
    if (selectedRegion) params.set("region", selectedRegion);
    if (selectedConstituency) params.set("constituency", selectedConstituency);
    if (selectedCohort) params.set("cohort", selectedCohort);
    if (selectedSlot) params.set("slot", selectedSlot);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/admin/executives?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load directory");
        return res.json();
      })
      .then((res) => {
        setRows(res.data || []);
        setTotalRows(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        setLoadingRows(false);
      })
      .catch(() => {
        setLoadingRows(false);
      });
  }, [page, limit, selectedLevel, selectedRegion, selectedConstituency, selectedCohort, selectedSlot, debouncedSearch]);

  useEffect(() => {
    if (currentUser) {
      fetchRoster();
    }
  }, [currentUser, fetchRoster]);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_session_token");
      document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
    startTransition(() => {
      router.push("/admin/login");
    });
  };

  const getTierCount = (tierName: string) => {
    if (!overview) return 0;
    if (!tierName) return overview.totals.total;
    const t = overview.tiers.find((x) => x.level.toLowerCase() === tierName.toLowerCase());
    return t ? t.count : 0;
  };

  // Open Edit/View Modal
  const handleOpenModal = (id: number) => {
    setModalError("");
    setModalSuccess("");
    setModalLoading(true);
    setModalOpen(true);

    fetch(`/api/admin/executives/${id}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load executive details");
        return res.json();
      })
      .then((data) => {
        setActiveExecutive(data.executive);
        setModalLoading(false);
      })
      .catch((err: unknown) => {
        setModalError(err instanceof Error ? err.message : "Failed to load executive details");
        setModalLoading(false);
      });
  };

  const handleCloseModal = () => {
    if (modalSaving) return;
    setModalOpen(false);
    setActiveExecutive(null);
    setModalError("");
    setModalSuccess("");
  };

  // Handle Form Change
  const handleFieldChange = (field: keyof ExecutiveDetail, value: string) => {
    if (!activeExecutive) return;
    setActiveExecutive({
      ...activeExecutive,
      [field]: value,
    });
  };

  // Submit Executive Update Form
  const handleSaveExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExecutive) return;

    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

    try {
      const res = await fetch(`/api/admin/executives/${activeExecutive.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activeExecutive),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Update failed.");
      }

      setModalSuccess("Executive record updated successfully in ec-data database.");
      setModalSaving(false);

      // Optimistically update row in table
      setRows((prev) =>
        prev.map((r) =>
          r.id === activeExecutive.id
            ? {
                ...r,
                executiveName: activeExecutive.executiveName,
                position: activeExecutive.position,
                executiveLevel: activeExecutive.executiveLevel,
                slotStatus: activeExecutive.slotStatus,
                region: activeExecutive.region,
                constituency: activeExecutive.constituency,
                electoralArea: activeExecutive.electoralArea,
                pollingStation: activeExecutive.pollingStation,
                gender: activeExecutive.gender,
                voterId: activeExecutive.voterId,
                status: activeExecutive.status,
              }
            : r
        )
      );

      // Dismiss modal after 1.2s
      setTimeout(() => {
        handleCloseModal();
      }, 1200);
    } catch (err: unknown) {
      setModalSaving(false);
      setModalError(err instanceof Error ? err.message : "Failed to save updates.");
    }
  };

  const exportUrl = `/api/admin/export?level=${encodeURIComponent(selectedLevel)}&region=${encodeURIComponent(selectedRegion)}&constituency=${encodeURIComponent(selectedConstituency)}&cohort=${encodeURIComponent(selectedCohort)}&slot=${encodeURIComponent(selectedSlot)}&search=${encodeURIComponent(debouncedSearch)}`;

  if (authError && !currentUser) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#090d16",
        color: "#f8fafc",
        fontFamily: "Inter, sans-serif"
      }}>
        <div style={{
          textAlign: "center",
          padding: "36px",
          background: "rgba(15, 23, 42, 0.8)",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          maxWidth: "420px"
        }}>
          <div style={{ display: "inline-flex", marginBottom: "16px" }}>
            <Lock size={36} color="#94a3b8" />
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Authentication Required</h2>
          <p style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "24px" }}>{authError}</p>
          <button
            onClick={() => router.push("/admin/login")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "8px",
              background: "#10b981",
              color: "#ffffff",
              fontWeight: "600",
              border: "none",
              cursor: "pointer"
            }}
          >
            Go to Admin Login <ArrowRight size={14} color="#ffffff" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      title="Executives Directory & Command Centre"
      subtitle="Comprehensive nationwide registry of all 261,553 party executives across all 6 administrative tiers"
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "28px 32px" }}>
        {/* Tier Cards Grid (6 Levels) with Grey Lucide Icons */}
        <section style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
              Executive Levels Command Selector
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Click a level card to filter directory roster</span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px"
          }}>
            {TIERS.map((tier) => {
              const isActive = selectedLevel === tier.id;
              const count = getTierCount(tier.id);
              const IconComp = tier.icon;
              return (
                <div
                  key={tier.id}
                  onClick={() => {
                    setSelectedLevel(tier.id);
                    setPage(1);
                  }}
                  style={{
                    background: isActive ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(15, 23, 42, 0.8) 100%)" : "rgba(15, 23, 42, 0.6)",
                    border: isActive ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    padding: "16px 18px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? "0 8px 20px -4px rgba(16, 185, 129, 0.2)" : "none"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <IconComp size={20} color="#94a3b8" />
                    </div>
                    {isActive && (
                      <span style={{
                        fontSize: "10px",
                        background: "#10b981",
                        color: "#ffffff",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: "700"
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: isActive ? "#34d399" : "#cbd5e1" }}>
                    {tier.label}
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#ffffff", marginTop: "2px" }}>
                    {loadingOverview ? "…" : count.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    {tier.id === "" ? "Total across all 6 levels" : `Registered ${tier.label.toLowerCase()} officers`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Executive Directorate KPI Metrics with Grey Lucide Icons */}
        {overview && (
          <section style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            marginBottom: "28px"
          }}>
            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Total Nationwide Officers</span>
                <Users size={15} color="#94a3b8" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: "#ffffff" }}>{overview.totals.total.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Across 6 executive levels</span>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Elected Officers</span>
                <Vote size={15} color="#94a3b8" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: "#34d399" }}>{overview.totals.elected.toLocaleString()}</span>
                <span style={{ fontSize: "12px", color: "#34d399" }}>({Math.round((overview.totals.elected / overview.totals.total) * 100)}%)</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Formally elected slates</span>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Appointed Officers</span>
                <FileCheck size={15} color="#94a3b8" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: "#fbbf24" }}>{overview.totals.appointed.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Deputies, Officers & Patrons</span>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Women Executives</span>
                <UserCheck size={15} color="#94a3b8" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: "#f472b6" }}>{overview.totals.women.toLocaleString()}</span>
                <span style={{ fontSize: "12px", color: "#f472b6" }}>({Math.round((overview.totals.women / overview.totals.total) * 100)}%)</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Female officers in directory</span>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Nasara Directorate</span>
                <Compass size={15} color="#94a3b8" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: "#38bdf8" }}>{overview.totals.nasara.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Coordinators & Organisers</span>
            </div>
          </section>
        )}

        {/* Multi-Dimensional Filter & Search Toolbar */}
        <section style={{
          background: "rgba(15, 23, 42, 0.8)",
          borderRadius: "12px",
          padding: "18px 20px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          marginBottom: "20px"
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "14px", marginBottom: "14px" }}>
            {/* Search Input with Grey Search Icon */}
            <div style={{ flex: "1 1 320px", position: "relative", display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: "12px", pointerEvents: "none", display: "flex" }}>
                <Search size={15} color="#94a3b8" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, voter ID, constituency, or position…"
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 36px",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 23, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <X size={14} color="#94a3b8" />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <a
                href={exportUrl}
                download
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  textDecoration: "none",
                  boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)"
                }}
              >
                <Download size={14} color="#ffffff" /> Export Filtered CSV
              </a>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
            {/* Level Filter Dropdown */}
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                background: "rgba(2, 6, 23, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="">All Levels</option>
              <option value="National">National Level</option>
              <option value="Region">Regional Level</option>
              <option value="Constituency">Constituency Level</option>
              <option value="Electoral Area">Electoral Area Level</option>
              <option value="Polling Station">Polling Station Level</option>
              <option value="TESCON">TESCON Level</option>
            </select>

            {/* Region ➔ Constituency Tied Cluster */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "3px 6px",
              background: "rgba(255, 255, 255, 0.04)",
              borderRadius: "8px",
              border: selectedRegion ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)"
            }}>
              {/* Region Dropdown */}
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedConstituency("");
                  setPage(1);
                }}
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "rgba(2, 6, 23, 0.85)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="">All 16 Regions</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <ArrowRight size={13} color={selectedRegion ? "#34d399" : "#64748b"} />

              {/* Constituency Filter Dropdown (Strictly Tied to Region) */}
              <select
                disabled={!selectedRegion}
                value={selectedConstituency}
                onChange={(e) => {
                  setSelectedConstituency(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: selectedRegion ? "rgba(2, 6, 23, 0.85)" : "rgba(15, 23, 42, 0.5)",
                  border: selectedConstituency
                    ? "1px solid #10b981"
                    : selectedRegion
                    ? "1px solid rgba(255, 255, 255, 0.15)"
                    : "1px solid rgba(255, 255, 255, 0.06)",
                  color: selectedRegion ? "#ffffff" : "#64748b",
                  fontSize: "13px",
                  outline: "none",
                  cursor: selectedRegion ? "pointer" : "not-allowed",
                  maxWidth: "260px",
                  transition: "all 0.15s ease"
                }}
              >
                {!selectedRegion ? (
                  <option value="">Select Region First</option>
                ) : loadingConstituencies ? (
                  <option value="">Loading {selectedRegion} constituencies…</option>
                ) : (
                  <>
                    <option value="">
                      All {selectedRegion} Constituencies ({constituencyList.length})
                    </option>
                    {constituencyList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Demographics Cohort Filter */}
            <select
              value={selectedCohort}
              onChange={(e) => {
                setSelectedCohort(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                background: "rgba(2, 6, 23, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="">All Demographics</option>
              <option value="women">Women Executives</option>
              <option value="nasara">Nasara Officers</option>
            </select>

            {/* Slot Type */}
            <select
              value={selectedSlot}
              onChange={(e) => {
                setSelectedSlot(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                background: "rgba(2, 6, 23, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="">All Appointment Types</option>
              <option value="elected">Elected Executives</option>
              <option value="appointed">Appointed Executives</option>
            </select>

            {/* Clear All Filters Button */}
            {(selectedLevel || selectedRegion || selectedConstituency || selectedCohort || selectedSlot || debouncedSearch) && (
              <button
                onClick={() => {
                  setSelectedLevel("");
                  setSelectedRegion("");
                  setSelectedConstituency("");
                  setSelectedCohort("");
                  setSelectedSlot("");
                  setSearchQuery("");
                  setPage(1);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                <RotateCcw size={12} color="#94a3b8" /> Reset Filters
              </button>
            )}

            <div style={{ marginLeft: "auto", fontSize: "13px", color: "#94a3b8" }}>
              Showing <strong>{rows.length.toLocaleString()}</strong> of <strong>{totalRows.toLocaleString()}</strong> matches
            </div>
          </div>
        </section>

        {/* Executive Roster Grid Table with 'Level' Column and Action Buttons */}
        <section style={{
          background: "rgba(15, 23, 42, 0.8)",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          overflow: "hidden"
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{
                  background: "rgba(30, 41, 59, 0.8)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#94a3b8",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  <th style={{ padding: "12px 16px" }}>Region</th>
                  <th style={{ padding: "12px 16px" }}>Constituency</th>
                  <th style={{ padding: "12px 16px" }}>Level</th>
                  <th style={{ padding: "12px 16px" }}>Position</th>
                  <th style={{ padding: "12px 16px" }}>Executive Name</th>
                  <th style={{ padding: "12px 16px" }}>Gender</th>
                  <th style={{ padding: "12px 16px" }}>Voter ID</th>
                  <th style={{ padding: "12px 16px" }}>Slot Type</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRows ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                        <Loader2 size={24} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                      Querying ec-data PostgreSQL database…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "48px", color: "#64748b" }}>
                      No executive records found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isAppointed = row.slotStatus?.toLowerCase().includes("appointed");
                    const unitDetail = row.pollingStation || row.electoralArea;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => handleOpenModal(row.id)}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          transition: "background 0.15s ease",
                          cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>{row.region || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "#cbd5e1", fontWeight: "500" }}>{row.constituency || "—"}</td>
                        
                        {/* Level Column */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{
                              fontSize: "11px",
                              padding: "2px 7px",
                              borderRadius: "5px",
                              fontWeight: "600",
                              width: "fit-content",
                              background: row.executiveLevel === "National" ? "rgba(168, 85, 247, 0.2)" :
                                          row.executiveLevel === "Region" ? "rgba(59, 130, 246, 0.2)" :
                                          row.executiveLevel === "Constituency" ? "rgba(16, 185, 129, 0.2)" :
                                          row.executiveLevel === "TESCON" ? "rgba(234, 179, 8, 0.2)" : "rgba(148, 163, 184, 0.12)",
                              color: row.executiveLevel === "National" ? "#c084fc" :
                                     row.executiveLevel === "Region" ? "#60a5fa" :
                                     row.executiveLevel === "Constituency" ? "#34d399" :
                                     row.executiveLevel === "TESCON" ? "#facc15" : "#cbd5e1"
                            }}>
                              {row.executiveLevel}
                            </span>
                            {unitDetail && (
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                {unitDetail}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: "12px 16px", fontWeight: "600", color: "#f8fafc" }}>
                          {row.position}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#ffffff", fontWeight: "500" }}>
                          {row.executiveName}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            fontSize: "11px",
                            color: row.gender?.toLowerCase() === "female" ? "#f472b6" : "#94a3b8"
                          }}>
                            {row.gender || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#94a3b8" }}>
                          {row.voterId || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <span style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isAppointed ? "rgba(251, 191, 36, 0.15)" : "rgba(16, 185, 129, 0.12)",
                            color: isAppointed ? "#fbbf24" : "#34d399"
                          }}>
                            {isAppointed ? "Appointed" : "Elected"}
                          </span>
                        </td>

                        {/* Action Edit/View Button with Grey Pencil */}
                        <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(row.id);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "5px 12px",
                              borderRadius: "6px",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#cbd5e1",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Pencil size={12} color="#94a3b8" /> View / Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            background: "rgba(30, 41, 59, 0.6)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: "13px",
            color: "#94a3b8"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: "rgba(2, 6, 23, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: "12px"
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong>
              </span>
              <button
                disabled={page <= 1 || loadingRows}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: page <= 1 ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.1)",
                  color: page <= 1 ? "#475569" : "#ffffff",
                  border: "none",
                  cursor: page <= 1 ? "not-allowed" : "pointer"
                }}
              >
                <ChevronLeft size={14} color={page <= 1 ? "#475569" : "#94a3b8"} /> Previous
              </button>
              <button
                disabled={page >= totalPages || loadingRows}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: page >= totalPages ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.1)",
                  color: page >= totalPages ? "#475569" : "#ffffff",
                  border: "none",
                  cursor: page >= totalPages ? "not-allowed" : "pointer"
                }}
              >
                Next <ChevronRight size={14} color={page >= totalPages ? "#475569" : "#94a3b8"} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* EDIT & VIEW MODAL DIALOG WITH GREY LUCIDE ICONS */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "840px",
              maxHeight: "88vh",
              background: "#0f172a",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 28px",
                background: "rgba(30, 41, 59, 0.7)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0, color: "#ffffff" }}>
                    {activeExecutive ? activeExecutive.executiveName : "Executive Record Details"}
                  </h3>
                  {activeExecutive && (
                    <>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: "600",
                          background: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                        }}
                      >
                        ID #{activeExecutive.id}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: "600",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#34d399",
                        }}
                      >
                        {activeExecutive.executiveLevel}
                      </span>
                    </>
                  )}
                </div>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                  View and update complete executive record in PostgreSQL <code>ec-data</code>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#cbd5e1",
                  width: "34px",
                  height: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} color="#94a3b8" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
              {modalLoading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                    <Loader2 size={26} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                  Fetching complete executive profile from ec-data…
                </div>
              ) : modalError && !activeExecutive ? (
                <div
                  style={{
                    padding: "16px",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    color: "#f87171",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <AlertCircle size={16} color="#94a3b8" /> {modalError}
                </div>
              ) : activeExecutive ? (
                <form id="executive-edit-form" onSubmit={handleSaveExecutive}>
                  {modalSuccess && (
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: "8px",
                        color: "#34d399",
                        fontSize: "13px",
                        fontWeight: "600",
                        marginBottom: "20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <CheckCircle2 size={16} color="#94a3b8" /> {modalSuccess}
                    </div>
                  )}

                  {modalError && (
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "8px",
                        color: "#f87171",
                        fontSize: "13px",
                        marginBottom: "20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <AlertCircle size={16} color="#94a3b8" /> {modalError}
                    </div>
                  )}

                  {/* Group 1: Executive Profile & Designation */}
                  <div style={{ marginBottom: "22px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#34d399",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "12px",
                      }}
                    >
                      1. Profile & Designation
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={activeExecutive.executiveName || ""}
                          onChange={(e) => handleFieldChange("executiveName", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Position / Role *
                        </label>
                        <input
                          type="text"
                          required
                          value={activeExecutive.position || ""}
                          onChange={(e) => handleFieldChange("position", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Executive Level *
                        </label>
                        <select
                          value={activeExecutive.executiveLevel || ""}
                          onChange={(e) => handleFieldChange("executiveLevel", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="National">National Level</option>
                          <option value="Region">Regional Level</option>
                          <option value="Constituency">Constituency Level</option>
                          <option value="Electoral Area">Electoral Area Level</option>
                          <option value="Polling Station">Polling Station Level</option>
                          <option value="TESCON">TESCON Level</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Slot Status / Appointment *
                        </label>
                        <select
                          value={activeExecutive.slotStatus || "Elected"}
                          onChange={(e) => handleFieldChange("slotStatus", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="Elected">Elected</option>
                          <option value="Appointed">Appointed</option>
                          <option value="Appointed Deputy">Appointed Deputy</option>
                          <option value="Patron">Patron / Advisory</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Administrative Status
                        </label>
                        <select
                          value={activeExecutive.status || "ACTIVE"}
                          onChange={(e) => handleFieldChange("status", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="RESIGNED">RESIGNED</option>
                          <option value="DECEASED">DECEASED</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Jurisdiction & Location */}
                  <div style={{ marginBottom: "22px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#38bdf8",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "12px",
                      }}
                    >
                      2. Jurisdiction & Location
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Region
                        </label>
                        <select
                          value={activeExecutive.region || ""}
                          onChange={(e) => handleFieldChange("region", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="">National / None</option>
                          {REGIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Constituency
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.constituency || ""}
                          onChange={(e) => handleFieldChange("constituency", e.target.value)}
                          placeholder="e.g. BANTAMA"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Electoral Area
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.electoralArea || ""}
                          onChange={(e) => handleFieldChange("electoralArea", e.target.value)}
                          placeholder="e.g. Kotei"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Polling Station / Institution
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.pollingStation || ""}
                          onChange={(e) => handleFieldChange("pollingStation", e.target.value)}
                          placeholder="e.g. D/A Primary School or KNUST Chapter"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Group 3: Identity & Demographics */}
                  <div style={{ marginBottom: "22px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#f59e0b",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "12px",
                      }}
                    >
                      3. Identity & Demographics
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Gender
                        </label>
                        <select
                          value={activeExecutive.gender || ""}
                          onChange={(e) => handleFieldChange("gender", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="">Unspecified</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Voter ID Number
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.voterId || ""}
                          onChange={(e) => handleFieldChange("voterId", e.target.value)}
                          placeholder="e.g. 1948012345"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontFamily: "monospace",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Ghana Card (NIA Number)
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.ghanaCard || ""}
                          onChange={(e) => handleFieldChange("ghanaCard", e.target.value)}
                          placeholder="e.g. GHA-123456789-0"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontFamily: "monospace",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Membership ID
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.membershipId || ""}
                          onChange={(e) => handleFieldChange("membershipId", e.target.value)}
                          placeholder="e.g. NPP-MEM-001"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Date of Birth (YYYY-MM-DD)
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.dateOfBirth || ""}
                          onChange={(e) => handleFieldChange("dateOfBirth", e.target.value)}
                          placeholder="YYYY-MM-DD"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontFamily: "monospace",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "5px" }}>
                          Derived Age
                        </label>
                        <div
                          style={{
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            color: "#cbd5e1",
                            fontSize: "13px",
                          }}
                        >
                          {activeExecutive.age !== null ? `${activeExecutive.age} years` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group 4: Contact Information */}
                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#a78bfa",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "12px",
                      }}
                    >
                      4. Contact Information
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={activeExecutive.phone || ""}
                          onChange={(e) => handleFieldChange("phone", e.target.value)}
                          placeholder="e.g. 0244123456"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontFamily: "monospace",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={activeExecutive.email || ""}
                          onChange={(e) => handleFieldChange("email", e.target.value)}
                          placeholder="e.g. officer@example.com"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            background: "rgba(2, 6, 23, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#ffffff",
                            fontSize: "13px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </form>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 28px",
                background: "rgba(30, 41, 59, 0.7)",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                type="button"
                disabled={modalSaving}
                onClick={handleCloseModal}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: modalSaving ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>

              {activeExecutive && (
                <button
                  type="submit"
                  form="executive-edit-form"
                  disabled={modalSaving || modalLoading}
                  style={{
                    padding: "9px 22px",
                    borderRadius: "8px",
                    background: modalSaving
                      ? "#334155"
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "600",
                    border: "none",
                    cursor: modalSaving || modalLoading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {modalSaving ? "Saving Updates…" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
