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
  Trash2,
  UserPlus,
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
  Phone,
} from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { getClientHeaders } from "@/lib/client-device";

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
  dateOfBirth?: string | null;
  age?: number | null;
  phone?: string | null;
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

const POSITIONS_BY_LEVEL: Record<string, string[]> = {
  National: [
    "National Chairman",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "3rd Vice-Chairperson",
    "General Secretary",
    "Deputy General Secretary",
    "National Organiser",
    "Deputy National Organiser",
    "National Treasurer",
    "Deputy National Treasurer",
    "National Women Organiser",
    "Deputy National Women Organiser",
    "National Youth Organiser",
    "Deputy National Youth Organiser",
    "National Nasara Organiser",
    "Deputy National Nasara Organiser",
    "National Communication Director",
    "Deputy Communication Director",
    "Director of Research and Elections",
  ],
  Region: [
    "Regional Chairman",
    "1st Regional Vice-Chairperson",
    "2nd Regional Vice-Chairperson",
    "Regional Secretary",
    "Assistant Regional Secretary",
    "Regional Organiser",
    "Deputy Regional Organiser",
    "Regional Treasurer",
    "Deputy Regional Treasurer",
    "Regional Women Organiser",
    "Deputy Regional Women Organiser",
    "Regional Youth Organiser",
    "Deputy Regional Youth Organiser",
    "Regional Nasara Organiser",
    "Deputy Regional Nasara Organiser",
    "Regional Communication Officer",
    "Regional Research & Elections Officer",
  ],
  Constituency: [
    "Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "Secretary",
    "Deputy Secretary",
    "Organiser",
    "Deputy Organiser",
    "Treasurer",
    "Financial Secretary",
    "Women Organiser",
    "Deputy Women Organiser",
    "Youth Organiser",
    "Deputy Youth Organiser",
    "Nasara Organiser",
    "Deputy Nasara Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Research Officer",
    "Pwd Coordinator",
    "Patron",
    "Council of Elders",
  ],
  "Electoral Area": [
    "Chairperson",
    "Secretary",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
  ],
  "Polling Station": [
    "Chairperson",
    "Secretary",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
  ],
  TESCON: [
    "President",
    "Vice President",
    "General Secretary",
    "Deputy General Secretary",
    "Organiser",
    "Deputy Organiser",
    "Treasurer",
    "Financial Secretary",
    "Women Commissioner",
    "Deputy Women Commissioner",
    "Communication Officer",
    "Research & Elections Officer",
    "Nasara Coordinator",
  ],
};

function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return getClientHeaders(extra);
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

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [executiveToDelete, setExecutiveToDelete] = useState<ExecutiveRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Add Executive Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  // Voter Search in Add Modal
  const [searchVoterId, setSearchVoterId] = useState("");
  const [searchingVoter, setSearchingVoter] = useState(false);
  const [voterSearchStatus, setVoterSearchStatus] = useState<{
    found: boolean;
    message: string;
  } | null>(null);

  // New Executive Form fields
  const [newExecName, setNewExecName] = useState("");
  const [newExecLevel, setNewExecLevel] = useState("Constituency");
  const [newExecSlot, setNewExecSlot] = useState("Elected");
  const [newExecRegion, setNewExecRegion] = useState("");
  const [newExecConstituency, setNewExecConstituency] = useState("");
  const [newExecElectoralArea, setNewExecElectoralArea] = useState("");
  const [newExecPollingStation, setNewExecPollingStation] = useState("");
  const [newExecPosition, setNewExecPosition] = useState("");
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [newExecGender, setNewExecGender] = useState("Male");
  const [newExecPhone, setNewExecPhone] = useState("");
  const [newExecEmail, setNewExecEmail] = useState("");
  const [newExecGhanaCard, setNewExecGhanaCard] = useState("");
  const [newExecVoterId, setNewExecVoterId] = useState("");
  const [newExecMembershipId, setNewExecMembershipId] = useState("");
  const [newExecDob, setNewExecDob] = useState("");
  const [newExecAge, setNewExecAge] = useState<string>("");
  const [newExecStatus, setNewExecStatus] = useState("Active");
  const [newExecConstituencyList, setNewExecConstituencyList] = useState<string[]>([]);
  const [loadingNewExecConstituencies, setLoadingNewExecConstituencies] = useState(false);

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
        if (typeof window !== "undefined" && authData.user?.role) {
          localStorage.setItem("admin_user_role", String(authData.user.role).toUpperCase());
        }

        // Load overview analytics
        loadOverview();
      })
      .catch((err: unknown) => {
        setAuthError(err instanceof Error ? err.message : "Authentication error");
      });
  }, []);

  const loadOverview = useCallback(() => {
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
      localStorage.removeItem("admin_user_role");
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

  // Load constituencies for Add Executive modal
  useEffect(() => {
    if (!newExecRegion) {
      setNewExecConstituencyList([]);
      setNewExecConstituency("");
      return;
    }
    setLoadingNewExecConstituencies(true);
    const params = new URLSearchParams({ region: newExecRegion });
    fetch(`/api/admin/constituencies?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { constituencies: [] }))
      .then((data) => {
        setNewExecConstituencyList(data.constituencies || []);
        setLoadingNewExecConstituencies(false);
      })
      .catch(() => {
        setNewExecConstituencyList([]);
        setLoadingNewExecConstituencies(false);
      });
  }, [newExecRegion]);

  // Delete Executive Handlers
  const handleOpenDeleteModal = (row: ExecutiveRow) => {
    setExecutiveToDelete(row);
    setDeleteError("");
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setExecutiveToDelete(null);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!executiveToDelete) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/admin/executives/${executiveToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete executive.");
        setDeleting(false);
        return;
      }

      setDeleteModalOpen(false);
      setExecutiveToDelete(null);
      setDeleting(false);
      fetchRoster();
      loadOverview();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setDeleteError(`Deletion failed: ${msg}`);
      setDeleting(false);
    }
  };

  // Search Voter by Voter ID
  const handleSearchVoter = async () => {
    const cleanId = searchVoterId.trim();
    if (!cleanId) return;
    setSearchingVoter(true);
    setVoterSearchStatus(null);
    setAddError("");

    try {
      const res = await fetch(`/api/admin/voters/lookup?voterId=${encodeURIComponent(cleanId)}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (res.ok && data.found && data.voter) {
        const v = data.voter;
        setNewExecName(v.name || "");
        setNewExecVoterId(v.voterId || cleanId);
        setNewExecGhanaCard(v.ghanaCard || "");
        setNewExecGender(v.gender || "Male");
        setNewExecDob(v.dateOfBirth || "");
        setNewExecAge(v.age ? String(v.age) : "");
        setNewExecPhone(v.phone || "");
        if (v.region) setNewExecRegion(v.region);
        if (v.constituency) setNewExecConstituency(v.constituency);
        if (v.electoralArea) setNewExecElectoralArea(v.electoralArea);
        if (v.pollingStation) setNewExecPollingStation(v.pollingStation);

        setVoterSearchStatus({
          found: true,
          message: `Voter record found for "${v.name}"! Details auto-populated below.`,
        });
      } else {
        setNewExecVoterId(cleanId);
        setVoterSearchStatus({
          found: false,
          message: data.message || `No voter record found for "${cleanId}". You can enter details manually below.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      setVoterSearchStatus({
        found: false,
        message: `Voter registry search error: ${msg}. You can enter details manually.`,
      });
    } finally {
      setSearchingVoter(false);
    }
  };

  const handleCloseAddModal = () => {
    if (addSaving) return;
    setAddModalOpen(false);
    setAddError("");
    setAddSuccess("");
    setSearchVoterId("");
    setVoterSearchStatus(null);
    setIsCustomPosition(false);
    setNewExecPosition("");
  };

  const handleCreateExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");

    if (!newExecName.trim()) {
      setAddError("Executive Name is required.");
      return;
    }
    if (!newExecPosition.trim()) {
      setAddError("Position is required.");
      return;
    }
    if (!newExecRegion.trim()) {
      setAddError("Region is required.");
      return;
    }

    setAddSaving(true);
    try {
      const payload = {
        executiveName: newExecName.trim(),
        executiveLevel: newExecLevel,
        slotStatus: newExecSlot,
        region: newExecRegion,
        constituency: newExecConstituency,
        electoralArea: newExecElectoralArea,
        pollingStation: newExecPollingStation,
        position: newExecPosition,
        gender: newExecGender,
        phone: newExecPhone,
        email: newExecEmail,
        ghanaCard: newExecGhanaCard,
        voterId: newExecVoterId,
        membershipId: newExecMembershipId,
        dateOfBirth: newExecDob,
        age: newExecAge ? parseInt(newExecAge, 10) : null,
        status: newExecStatus,
      };

      const res = await fetch("/api/admin/executives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to create executive record.");
        setAddSaving(false);
        return;
      }

      setAddSuccess("Executive record created successfully!");
      setTimeout(() => {
        setAddModalOpen(false);
        setAddSuccess("");
        // Reset form fields
        setSearchVoterId("");
        setVoterSearchStatus(null);
        setNewExecName("");
        setNewExecPosition("");
        setNewExecPhone("");
        setNewExecEmail("");
        setNewExecGhanaCard("");
        setNewExecVoterId("");
        setNewExecMembershipId("");
        setNewExecDob("");
        setNewExecAge("");
        fetchRoster();
        loadOverview();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setAddError(`Creation failed: ${msg}`);
    } finally {
      setAddSaving(false);
    }
  };

  const userRole = String(
    currentUser?.role ||
    (typeof window !== "undefined" ? localStorage.getItem("admin_user_role") : "") ||
    ""
  ).toUpperCase();
  const isAdminNational = userRole === "ADMIN_NATIONAL" || userRole === "ADMIN";

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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setAddModalOpen(true);
                  setAddError("");
                  setAddSuccess("");
                  setVoterSearchStatus(null);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                <UserPlus size={15} color="#ffffff" />
                <span>Add Executive</span>
              </button>

              {isAdminNational && (
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
              )}
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
          <style>{`
            @media (max-width: 860px) {
              .exec-col-secondary {
                display: none !important;
              }
              .exec-mobile-details {
                display: block !important;
              }
            }
            @media (min-width: 861px) {
              .exec-mobile-details {
                display: none !important;
              }
            }
          `}</style>
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
                  <th style={{ padding: "12px 16px" }}>Voter ID</th>
                  <th style={{ padding: "12px 16px" }}>Name</th>
                  <th className="exec-col-secondary" style={{ padding: "12px 16px" }}>Age</th>
                  <th className="exec-col-secondary" style={{ padding: "12px 16px" }}>Date of Birth</th>
                  <th className="exec-col-secondary" style={{ padding: "12px 16px" }}>Phone</th>
                  <th className="exec-col-secondary" style={{ padding: "12px 16px" }}>Region</th>
                  <th className="exec-col-secondary" style={{ padding: "12px 16px" }}>Constituency</th>
                  <th className="exec-col-secondary" style={{ padding: "12px 16px" }}>Position</th>
                  <th className="exec-col-secondary" style={{ padding: "12px 16px" }}>Level</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRows ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                        <Loader2 size={24} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                      Querying ec-data PostgreSQL database…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "48px", color: "#64748b" }}>
                      No executive records found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
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
                        {/* 1. Voter ID */}
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                          {row.voterId ? (
                            <span style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(59, 130, 246, 0.1)",
                              border: "1px solid rgba(59, 130, 246, 0.2)",
                              color: "#93c5fd",
                              fontSize: "12px"
                            }}>
                              {row.voterId}
                            </span>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>

                        {/* 2. Name */}
                        <td style={{ padding: "12px 16px", color: "#ffffff", fontWeight: "600" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{row.executiveName}</span>
                            {/* Minimised screen context subtitle */}
                            <div className="exec-mobile-details" style={{ display: "none", fontSize: "11px", color: "#94a3b8", marginTop: "2px", fontWeight: "normal" }}>
                              <span style={{ color: "#60a5fa", fontWeight: "600" }}>{row.position}</span>
                              {(row.region || row.executiveLevel) && (
                                <span style={{ marginLeft: "4px" }}>• {[row.executiveLevel, row.region, row.constituency].filter(Boolean).join(" / ")}</span>
                              )}
                              {row.phone && (
                                <span style={{ marginLeft: "4px" }}>• {row.phone}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Age */}
                        <td className="exec-col-secondary" style={{ padding: "12px 16px", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                          {row.age != null && row.age > 0 ? (
                            <span style={{
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: "rgba(255, 255, 255, 0.06)",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#e2e8f0"
                            }}>
                              {row.age} yrs
                            </span>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>

                        {/* 4. Date of Birth */}
                        <td className="exec-col-secondary" style={{ padding: "12px 16px", color: "#cbd5e1", whiteSpace: "nowrap", fontSize: "12px" }}>
                          {row.dateOfBirth ? (
                            <span>{row.dateOfBirth}</span>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>

                        {/* 5. Phone */}
                        <td className="exec-col-secondary" style={{ padding: "12px 16px", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                          {row.phone ? (
                            <a
                              href={`tel:${row.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                color: "#38bdf8",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                fontSize: "12px"
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                              <Phone size={12} style={{ opacity: 0.8 }} />
                              <span>{row.phone}</span>
                            </a>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>

                        {/* 6. Region */}
                        <td className="exec-col-secondary" style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                          {row.region || "—"}
                        </td>

                        {/* 7. Constituency */}
                        <td className="exec-col-secondary" style={{ padding: "12px 16px", color: "#cbd5e1", fontWeight: "500" }}>
                          {row.constituency || "—"}
                        </td>

                        {/* 8. Position */}
                        <td className="exec-col-secondary" style={{ padding: "12px 16px", fontWeight: "600", color: "#f8fafc" }}>
                          {row.position}
                        </td>

                        {/* 9. Level */}
                        <td className="exec-col-secondary" style={{ padding: "12px 16px" }}>
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

                        {/* Actions (Always visible: View/Edit + Delete) */}
                        <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(row.id);
                              }}
                              title="View or Edit Executive"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                color: "#cbd5e1",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Pencil size={12} color="#94a3b8" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeleteModal(row);
                              }}
                              title="Delete Executive"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                background: "rgba(239, 68, 68, 0.12)",
                                border: "1px solid rgba(239, 68, 68, 0.25)",
                                color: "#f87171",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Trash2 size={12} color="#f87171" />
                              <span>Delete</span>
                            </button>
                          </div>
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

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && executiveToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(5px)",
            padding: "16px",
          }}
          onClick={handleCloseDeleteModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#0f172a",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "14px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 25px rgba(239, 68, 68, 0.15)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px 24px 16px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div style={{
                  padding: "10px",
                  borderRadius: "10px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  flexShrink: 0
                }}>
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#f8fafc" }}>
                    Confirm Delete Executive
                  </h3>
                  <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#94a3b8", lineHeight: "1.4" }}>
                    Are you sure you want to permanently remove this executive from the system?
                  </p>
                </div>
              </div>

              {/* Record Summary Box */}
              <div style={{
                marginTop: "16px",
                padding: "14px",
                background: "rgba(2, 6, 23, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                fontSize: "13px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "#64748b" }}>Executive:</span>
                  <span style={{ color: "#f8fafc", fontWeight: "600" }}>{executiveToDelete.executiveName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "#64748b" }}>Position:</span>
                  <span style={{ color: "#cbd5e1" }}>{executiveToDelete.position}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "#64748b" }}>Level / Region:</span>
                  <span style={{ color: "#cbd5e1" }}>
                    {[executiveToDelete.executiveLevel, executiveToDelete.region, executiveToDelete.constituency].filter(Boolean).join(" • ")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Voter ID:</span>
                  <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{executiveToDelete.voterId || "—"}</span>
                </div>
              </div>

              {deleteError && (
                <div style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  color: "#f87171",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <AlertCircle size={16} />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div style={{
              padding: "14px 24px",
              background: "rgba(30, 41, 59, 0.6)",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px"
            }}>
              <button
                type="button"
                disabled={deleting}
                onClick={handleCloseDeleteModal}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  background: deleting ? "#7f1d1d" : "#ef4444",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: deleting ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Executive Modal with Voter ID Search & Manual Fallback */}
      {addModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            padding: "16px",
          }}
          onClick={handleCloseAddModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "840px",
              maxHeight: "92vh",
              background: "#0f172a",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "14px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(59, 130, 246, 0.15)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "rgba(30, 41, 59, 0.7)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    padding: "9px",
                    borderRadius: "8px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    color: "#60a5fa",
                  }}
                >
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#f8fafc" }}>
                    Add Executive
                  </h3>
                  <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    Search by Voter ID to auto-populate registry data, or type all details manually.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                disabled={addSaving}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {/* Voter ID Search Section */}
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.4)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: "10px",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Step 1: Voter ID Search (Optional Auto-Fill)
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={searchVoterId}
                    onChange={(e) => setSearchVoterId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchVoter();
                      }
                    }}
                    placeholder="Enter 10-digit Voter ID to search regional registry…"
                    style={{
                      flex: 1,
                      minWidth: "220px",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      background: "rgba(2, 6, 23, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontFamily: "monospace",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSearchVoter}
                    disabled={searchingVoter || !searchVoterId.trim()}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "6px",
                      background: searchingVoter ? "#1e293b" : "#2563eb",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: "600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: searchingVoter || !searchVoterId.trim() ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {searchingVoter ? (
                      <>
                        <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        <span>Searching 16 Regions…</span>
                      </>
                    ) : (
                      <>
                        <Search size={14} />
                        <span>Search Voter ID</span>
                      </>
                    )}
                  </button>
                </div>

                {voterSearchStatus && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: voterSearchStatus.found ? "rgba(16, 185, 129, 0.15)" : "rgba(234, 179, 8, 0.15)",
                      border: `1px solid ${voterSearchStatus.found ? "rgba(16, 185, 129, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
                      color: voterSearchStatus.found ? "#34d399" : "#facc15",
                    }}
                  >
                    {voterSearchStatus.found ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{voterSearchStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Add Executive Form */}
              <form id="add-executive-form" onSubmit={handleCreateExecutive}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  Step 2: Executive Details & Position
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Executive Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newExecName}
                      onChange={(e) => setNewExecName(e.target.value)}
                      placeholder="e.g. John Kwame Mensah"
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
                      Executive Level <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={newExecLevel}
                      onChange={(e) => {
                        const newLevel = e.target.value;
                        setNewExecLevel(newLevel);
                        if (!isCustomPosition) {
                          const validPositions = POSITIONS_BY_LEVEL[newLevel] || [];
                          if (!validPositions.includes(newExecPosition)) {
                            setNewExecPosition(validPositions[0] || "");
                          }
                        }
                      }}
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
                      <option value="Constituency">Constituency</option>
                      <option value="Region">Region</option>
                      <option value="National">National</option>
                      <option value="TESCON">TESCON</option>
                      <option value="Electoral Area">Electoral Area</option>
                      <option value="Polling Station">Polling Station</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600" }}>
                        Position ({newExecLevel}) <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !isCustomPosition;
                          setIsCustomPosition(nextState);
                          if (!nextState) {
                            const validPositions = POSITIONS_BY_LEVEL[newExecLevel] || [];
                            setNewExecPosition(validPositions[0] || "");
                          }
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#60a5fa",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        {isCustomPosition ? "← Select standard position" : "+ Other position"}
                      </button>
                    </div>

                    {isCustomPosition ? (
                      <input
                        type="text"
                        required
                        value={newExecPosition}
                        onChange={(e) => setNewExecPosition(e.target.value)}
                        placeholder={`Enter custom ${newExecLevel} position…`}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "6px",
                          background: "rgba(2, 6, 23, 0.8)",
                          border: "1px solid rgba(59, 130, 246, 0.4)",
                          color: "#ffffff",
                          fontSize: "13px",
                          boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <select
                        required
                        value={newExecPosition}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsCustomPosition(true);
                            setNewExecPosition("");
                          } else {
                            setNewExecPosition(e.target.value);
                          }
                        }}
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
                        <option value="">-- Select {newExecLevel} Position --</option>
                        {(POSITIONS_BY_LEVEL[newExecLevel] || []).map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                        <option value="__custom__">+ Other / Enter Custom Position…</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Slot Status
                    </label>
                    <select
                      value={newExecSlot}
                      onChange={(e) => setNewExecSlot(e.target.value)}
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
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Region <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      required
                      value={newExecRegion}
                      onChange={(e) => setNewExecRegion(e.target.value)}
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
                      <option value="">Select Region</option>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Constituency {loadingNewExecConstituencies && "(loading…)"}
                    </label>
                    {newExecConstituencyList.length > 0 ? (
                      <select
                        value={newExecConstituency}
                        onChange={(e) => setNewExecConstituency(e.target.value)}
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
                        <option value="">Select Constituency</option>
                        {newExecConstituencyList.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newExecConstituency}
                        onChange={(e) => setNewExecConstituency(e.target.value)}
                        placeholder="e.g. Dome Kwabenya"
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
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Electoral Area
                    </label>
                    <input
                      type="text"
                      value={newExecElectoralArea}
                      onChange={(e) => setNewExecElectoralArea(e.target.value)}
                      placeholder="e.g. Taifa North"
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
                      Polling Station
                    </label>
                    <input
                      type="text"
                      value={newExecPollingStation}
                      onChange={(e) => setNewExecPollingStation(e.target.value)}
                      placeholder="e.g. Presby Primary School"
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Voter ID
                    </label>
                    <input
                      type="text"
                      value={newExecVoterId}
                      onChange={(e) => setNewExecVoterId(e.target.value)}
                      placeholder="e.g. 1234567890"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "6px",
                        background: "rgba(2, 6, 23, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontFamily: "monospace",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Ghana Card (NIA)
                    </label>
                    <input
                      type="text"
                      value={newExecGhanaCard}
                      onChange={(e) => setNewExecGhanaCard(e.target.value)}
                      placeholder="e.g. GHA-712345678-9"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "6px",
                        background: "rgba(2, 6, 23, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontFamily: "monospace",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Gender
                    </label>
                    <select
                      value={newExecGender}
                      onChange={(e) => setNewExecGender(e.target.value)}
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
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Date of Birth (YYYY-MM-DD)
                    </label>
                    <input
                      type="text"
                      value={newExecDob}
                      onChange={(e) => setNewExecDob(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "6px",
                        background: "rgba(2, 6, 23, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontFamily: "monospace",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      Age
                    </label>
                    <input
                      type="number"
                      value={newExecAge}
                      onChange={(e) => setNewExecAge(e.target.value)}
                      placeholder="e.g. 42"
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
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={newExecPhone}
                      onChange={(e) => setNewExecPhone(e.target.value)}
                      placeholder="e.g. 0244123456"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "6px",
                        background: "rgba(2, 6, 23, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontFamily: "monospace",
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
                      value={newExecEmail}
                      onChange={(e) => setNewExecEmail(e.target.value)}
                      placeholder="officer@example.com"
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
                      Membership ID
                    </label>
                    <input
                      type="text"
                      value={newExecMembershipId}
                      onChange={(e) => setNewExecMembershipId(e.target.value)}
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
                </div>

                {addError && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      fontSize: "13px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{addError}</span>
                  </div>
                )}

                {addSuccess && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#34d399",
                      fontSize: "13px",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{addSuccess}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
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
                disabled={addSaving}
                onClick={handleCloseAddModal}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: addSaving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-executive-form"
                disabled={addSaving}
                style={{
                  padding: "9px 22px",
                  borderRadius: "8px",
                  background: addSaving
                    ? "#334155"
                    : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  border: "none",
                  cursor: addSaving ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                  transition: "all 0.15s ease",
                }}
              >
                {addSaving ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    <span>Saving Executive…</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Create Executive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
