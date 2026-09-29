"use client";

import { useEffect, useState, useCallback, useRef, useTransition } from "react";
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
  Upload,
  Image as ImageIcon,
  Copy,
  ExternalLink,
  Camera,
  RotateCw,
  Archive,
  Undo2,
  ImageOff,
  Sparkles,
} from "lucide-react";
import { AdminShell } from "@/app/admin/components/AdminShell";
import { ExecutiveAvatar, clearBrokenPhotoCache } from "@/app/admin/components/ExecutiveAvatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { getClientHeaders } from "@/lib/client-device";
import { checkClientRateLimit } from "@/lib/client-rate-limit";
import { getPositionRank } from "@/lib/position-matcher";
import { getConstituenciesForRegion, normalizeConstituency, normalizeRegionName } from "@/lib/constituency-normalizer";
import { computeExecutiveAgeAndDob, isUnder40AsOfCutoff } from "@/lib/voting-rules";
import { getTesconInstitutionsForRegion, normalizeTesconInstitution } from "@/lib/tescon-institutions";
import { logoutAndRedirect, saveClientSession, SESSION_TOKEN_KEY } from "@/lib/client-session";

type OverviewData = {
  totals: {
    total: number;
    women: number;
    nasara: number;
    appointed: number;
    elected: number;
    under_40?: number;
    missing_photos?: number;
    verified_photos?: number;
  };
  tiers: Array<{ level: string; count: number; women: number }>;
  genderDistribution: Array<{ label: string; count: number }>;
  regionalDistribution: Array<{ region: string; count: number }>;
  electoralCollege?: {
    total_delegates: number;
    general_voters: number;
    youth_voters: number;
    women_voters: number;
    nasara_voters: number;
    tescon_presidents: number;
    tescon_wocom: number;
    tescon_nasara: number;
    constituency_execs: number;
    external_branch_execs: number;
  };
  activeFilter?: {
    region: string | null;
    constituency: string | null;
    level: string | null;
    position?: string | null;
    cohort?: string | null;
    under40?: boolean | null;
  };
  user: { id: string; email: string; name: string; role: string };
};

type ProxyAssignmentInfo = {
  id: number;
  proxyExecutiveId: number;
  proxyName: string;
  proxyVoterId: string | null;
  proxyPhone: string | null;
  proxyRegion: string | null;
  proxyConstituency: string | null;
  proxyLevel: string | null;
  proxyPosition: string | null;
  assignedByEmail: string | null;
  assignedByName: string | null;
  createdAt: string;
  notes?: string | null;
  proxyExecutive?: {
    id: number;
    executiveName: string;
    voterId: string | null;
    phone: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    age: number | null;
    region: string | null;
    constituency: string | null;
    electoralArea?: string | null;
    pollingStation?: string | null;
    executiveLevel: string | null;
    position: string | null;
    slotStatus?: string | null;
    imageUrl: string | null;
  } | null;
};

type ActingProxyInfo = {
  id: number;
  principalExecutiveId: number;
  principalName: string;
  principalVoterId: string | null;
  principalPhone?: string | null;
  principalRegion: string | null;
  principalConstituency: string | null;
  principalLevel: string | null;
  principalPosition: string | null;
  createdAt?: string;
};

type ProxyCandidate = {
  id: number;
  executiveName: string;
  voterId: string | null;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  age: number | null;
  region: string | null;
  constituency: string | null;
  electoralArea: string | null;
  pollingStation: string | null;
  executiveLevel: string | null;
  position: string | null;
  slotStatus: string | null;
  imageUrl: string | null;
  alreadyAssignedToPrincipalId: number | null;
  alreadyAssignedToPrincipalName: string | null;
  alreadyAssignedToPrincipalVoterId: string | null;
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
  imageUrl?: string | null;
  proxyAssignment?: ProxyAssignmentInfo | null;
  actingAsProxyFor?: ActingProxyInfo | null;
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
  imageUrl?: string | null;
};

function sortRosterRows(rows: ExecutiveRow[], level: string): ExecutiveRow[] {
  if (level !== "Region" && level !== "Constituency" && level !== "TESCON") return rows;

  return [...rows].sort((a, b) => {
    const regionOrder = normalizeRegionName(a.region).localeCompare(normalizeRegionName(b.region));
    if (regionOrder !== 0) return regionOrder;

    if (level === "TESCON") {
      const instA = normalizeTesconInstitution(a.pollingStation, a.region, a.constituency, a.id);
      const instB = normalizeTesconInstitution(b.pollingStation, b.region, b.constituency, b.id);
      const instOrder = instA.localeCompare(instB);
      if (instOrder !== 0) return instOrder;
    }

    if (level === "Constituency") {
      const constituencyOrder = normalizeConstituency(a.constituency).localeCompare(normalizeConstituency(b.constituency));
      if (constituencyOrder !== 0) return constituencyOrder;
    }

    const positionOrder = getPositionRank(a.position, level) - getPositionRank(b.position, level);
    if (positionOrder !== 0) return positionOrder;

    const labelOrder = String(a.position || "").localeCompare(String(b.position || ""));
    return labelOrder !== 0 ? labelOrder : a.id - b.id;
  });
}

const REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
  "Greater Accra", "North East", "Northern", "Oti", "Savannah",
  "Upper East", "Upper West", "Volta", "Western", "Western North",
  "External Branch"
];

const TIERS = [
  { id: "", label: "All Levels", icon: Globe },
  { id: "National", label: "National", icon: Landmark },
  { id: "Region", label: "Regional", icon: Map },
  { id: "Constituency", label: "Constituency", icon: Building2 },
  { id: "External Branch", label: "External Branch", icon: Compass },
  { id: "Electoral Area", label: "Electoral Area", icon: Layers },
  { id: "Polling Station", label: "Polling Station", icon: Vote },
  { id: "TESCON", label: "TESCON", icon: GraduationCap },
];

const POSITIONS_BY_LEVEL: Record<string, string[]> = {
  National: [
    "President",
    "Former President",
    "Current Flagbearer / Former Vice President",
    "Flagbearer",
    "Presidential Candidate",
    "Running Mate",
    "Former Running Mate",
    "Vice-Presidential Candidate",
    "Speaker of Parliament",
    "Former Speaker of Parliament",
    "Member of Parliament",
    "National Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "3rd Vice-Chairperson",
    "General Secretary",
    "Deputy General Secretary",
    "National Treasurer",
    "Deputy National Treasurer",
    "National Organiser",
    "Deputy National Organiser",
    "National Women Organiser",
    "Deputy National Women Organiser",
    "National Youth Organiser",
    "Deputy National Youth Organiser",
    "National Nasara Coordinator",
    "Deputy National Nasara Coordinator",
    "National Nasara Organiser",
    "Deputy National Nasara Organiser",
    "Director of Finance and Administration",
    "Director of Elections",
    "Director of Research",
    "Director of Research and Elections",
    "Research Officer",
    "National Communication Director",
    "Deputy Communication Director",
    "External Relations Officer",
    "Deputy External Relations Officer",
    "Director of IT",
    "Deputy Director of IT",
    "Director of Protocol",
    "Deputy Director of Protocol",
    "Chairman of The Legal Committee",
    "Director of Legal Affairs",
    "National Council Representative",
    "Former National Chairman",
    "Past National Chairman",
    "Former General Secretary",
    "Past General Secretary",
    "Council of Elders",
    "National Council of Elders",
    "Chairman, National Council of Elders",
    "Chairman, Council of Elders",
    "Council of Elders / Past National Officer",
    "Past National Officer / Elder",
    "Council of Patrons",
    "National Council of Patrons",
    "Chairman, National Council of Patrons",
    "Chairman, Council of Patrons",
    "Foundation Member",
  ],
  Region: [
    "Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "Secretary",
    "Deputy Secretary",
    "Treasurer",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Nasara Coordinator",
    "Financial Secretary",
    "Electoral Affairs Officer",
    "Communication Officer",
    "Research Officer",
    "PWD Coordinator",
    "Deputy Organiser",
    "Deputy Women Organiser",
    "Deputy Youth Organiser",
    "Deputy Nasara Coordinator",
    "Special Duties Officer",
    "Legal Representative Officer",
  ],
  Constituency: [
    "Member of Parliament",
    "Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "Secretary",
    "Deputy Secretary",
    "Treasurer",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Nasara Organiser",
    "Financial Secretary",
    "Electoral Affairs Officer",
    "Communication Officer",
    "Research Officer",
    "PWD Coordinator",
    "Deputy Organiser",
    "Deputy Women Organiser",
    "Deputy Youth Organiser",
    "Deputy Nasara Organiser",
    "Special Duties Officer",
    "Legal Representative Officer",
  ],
  "Electoral Area": [
    "Chairperson",
    "Coordinator",
    "Secretary",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Nasara Coordinator",
    "Treasurer",
    "Financial Secretary",
  ],
  "Polling Station": [
    "Chairperson",
    "Secretary",
    "Organiser",
    "Women Organiser",
    "Youth Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Nasara Coordinator",
    "Treasurer",
    "Financial Secretary",
  ],
  "External Branch": [
    "Chairperson",
    "1st Vice-Chairperson",
    "2nd Vice-Chairperson",
    "Secretary",
    "Deputy Secretary",
    "Treasurer",
    "Financial Secretary",
    "Organiser",
    "Deputy Organiser",
    "Women Organiser",
    "Deputy Women Organiser",
    "Youth Organiser",
    "Deputy Youth Organiser",
    "Nasara Organiser",
    "Deputy Nasara Organiser",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Research Officer",
    "PWD Coordinator",
    "Special Duties Officer",
    "Legal Representative Officer",
  ],
  TESCON: [
    "President",
    "TESCON President",
    "WOCOM",
    "TESCON WOCOM",
    "Nasara Coordinator",
    "TESCON Nasara Coordinator",
    "Secretary",
    "Organiser",
    "Treasurer",
    "Financial Secretary",
    "Communication Officer",
    "Electoral Affairs Officer",
    "Patron",
    "TESCON Patron",
  ],
};

POSITIONS_BY_LEVEL["Regional"] = POSITIONS_BY_LEVEL["Region"];

function normalizeLevelKey(lvl?: string | null): string {
  if (!lvl) return "Constituency";
  const trimmed = lvl.trim();
  if (/^region/i.test(trimmed)) return "Region";
  if (/^national/i.test(trimmed)) return "National";
  if (/^constituency/i.test(trimmed)) return "Constituency";
  if (/^external/i.test(trimmed)) return "External Branch";
  if (/^tescon/i.test(trimmed)) return "TESCON";
  if (/^electoral/i.test(trimmed)) return "Electoral Area";
  if (/^polling/i.test(trimmed)) return "Polling Station";
  return trimmed;
}

const ALL_CANONICAL_POSITIONS = Array.from(
  new Set(Object.values(POSITIONS_BY_LEVEL).flat())
).sort((a, b) => a.localeCompare(b));

function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return getClientHeaders(extra);
}

function getPhotoSourceBadge(url?: string | null) {
  if (!url || !url.trim()) return null;
  const clean = url.trim().toLowerCase();
  if (clean.includes(".webp") || clean.includes("wp-content") || clean.includes("cms.newpatrioticparty.org")) {
    return {
      label: "Party CDN • WebP",
      color: "#34d399",
      bg: "rgba(16, 185, 129, 0.15)",
      border: "rgba(16, 185, 129, 0.3)",
      isWp: true,
    };
  }
  if (clean.includes("pass_voterid") || clean.includes("app.newpatrioticparty.org")) {
    return {
      label: "Party Photo Registry",
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.15)",
      border: "rgba(56, 189, 248, 0.3)",
      isWp: false,
    };
  }
  return {
    label: "Custom Photo URL",
    color: "#a78bfa",
    bg: "rgba(167, 139, 250, 0.15)",
    border: "rgba(167, 139, 250, 0.3)",
    isWp: false,
  };
}

export default function NationalAdminDashboard() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const rosterRequestId = useRef(0);

  const [currentUser, setCurrentUser] = useState<OverviewData["user"] | null>(null);
  const [authError, setAuthError] = useState<string>("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [cachedRole, setCachedRole] = useState<string>("");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin_user_role");
      if (saved) setCachedRole(saved);
    } catch {
      // ignore
    }
  }, []);

  const userRole = String(currentUser?.role || cachedRole || "").toUpperCase();
  const isAdminNational = userRole === "ADMIN_NATIONAL" || userRole === "ADMIN";
  const isC1 = userRole === "C1";

  // Filters
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedConstituency, setSelectedConstituency] = useState<string>("");
  const [constituencyList, setConstituencyList] = useState<string[]>([]);
  const [loadingConstituencies, setLoadingConstituencies] = useState<boolean>(false);
  const [selectedInstitution, setSelectedInstitution] = useState<string>("");
  const [tesconInstitutions, setTesconInstitutions] = useState<string[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<string>("");
  const [positionList, setPositionList] = useState<string[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Missing images filter & reload state
  const [filterMissingImages, setFilterMissingImages] = useState<boolean>(false);
  const [rosterImageReloadKey, setRosterImageReloadKey] = useState<number>(0);

  // Under 40 (Youth) filter state
  const [filterUnder40, setFilterUnder40] = useState<boolean>(false);
  const isUnder40Active = filterUnder40 || selectedCohort === "under_40";

  const handleToggleUnder40 = () => {
    if (isUnder40Active) {
      setFilterUnder40(false);
      if (selectedCohort === "under_40") setSelectedCohort("");
    } else {
      setFilterUnder40(true);
    }
    setPage(1);
  };

  // Full data reload state
  const [reloadingFullData, setReloadingFullData] = useState<boolean>(false);
  const [fullReloadToast, setFullReloadToast] = useState<string>("");

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
  const [editSearchVoterId, setEditSearchVoterId] = useState("");
  const [editSearchingVoter, setEditSearchingVoter] = useState(false);
  const [editVoterSearchStatus, setEditVoterSearchStatus] = useState<{
    found: boolean;
    message: string;
  } | null>(null);
  const [editUploadingImage, setEditUploadingImage] = useState(false);
  const [editImageSuccess, setEditImageSuccess] = useState("");
  const [editConstituencyList, setEditConstituencyList] = useState<string[]>([]);
  const [loadingEditConstituencies, setLoadingEditConstituencies] = useState(false);
  const [isEditCustomPosition, setIsEditCustomPosition] = useState(false);
  const [editPositionList, setEditPositionList] = useState<string[]>([]);
  const [loadingEditPositions, setLoadingEditPositions] = useState(false);
  const [addUploadingImage, setAddUploadingImage] = useState(false);
  const [addImageSuccess, setAddImageSuccess] = useState("");
  const [copiedPhotoUrl, setCopiedPhotoUrl] = useState(false);
  const [editAvatarReloadKey, setEditAvatarReloadKey] = useState<number>(0);
  const [addAvatarReloadKey, setAddAvatarReloadKey] = useState<number>(0);
  const [reloadingEditPhoto, setReloadingEditPhoto] = useState(false);
  const [reloadingAddPhoto, setReloadingAddPhoto] = useState(false);
  const [editDraggingImage, setEditDraggingImage] = useState(false);
  const [addDraggingImage, setAddDraggingImage] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [executiveToDelete, setExecutiveToDelete] = useState<ExecutiveRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Deleted Voters / Revert State (Super User Only)
  const [deletedModalOpen, setDeletedModalOpen] = useState(false);
  const [deletedRows, setDeletedRows] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [deletedSearch, setDeletedSearch] = useState("");
  const [deletedTotal, setDeletedTotal] = useState(0);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [revertMessage, setRevertMessage] = useState("");

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
  const [newExecImageUrl, setNewExecImageUrl] = useState<string | null>(null);
  const [newExecConstituencyList, setNewExecConstituencyList] = useState<string[]>([]);
  const [loadingNewExecConstituencies, setLoadingNewExecConstituencies] = useState(false);
  const [addPositionList, setAddPositionList] = useState<string[]>(
    POSITIONS_BY_LEVEL["Constituency"] || []
  );
  const [loadingAddPositions, setLoadingAddPositions] = useState(false);
  const [addExecHoneypot, setAddExecHoneypot] = useState("");
  const [exportCooldownSec, setExportCooldownSec] = useState(0);

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

    const fallbackList = getConstituenciesForRegion(selectedRegion);
    if (fallbackList.length > 0) {
      setConstituencyList(fallbackList);
    }

    setLoadingConstituencies(true);
    const params = new URLSearchParams({ region: selectedRegion });

    fetch(`/api/admin/constituencies?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { constituencies: [] }))
      .then((data) => {
        const rawList: string[] = Array.isArray(data.constituencies) ? data.constituencies : [];
        const normalizedList = Array.from(
          new Set(
            rawList
              .map((c) => (selectedRegion === "External Branch" ? String(c || "").trim() : normalizeConstituency(c)))
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
        setConstituencyList(normalizedList);
        setLoadingConstituencies(false);
      })
      .catch(() => {
        setConstituencyList(fallbackList);
        setLoadingConstituencies(false);
      });
  }, [selectedRegion]);

  // Load TESCON institutions tied to selectedRegion whenever selectedLevel === "TESCON"
  useEffect(() => {
    if (selectedLevel !== "TESCON") {
      setTesconInstitutions([]);
      setSelectedInstitution("");
      return;
    }

    const fallbackList = getTesconInstitutionsForRegion(selectedRegion);
    setTesconInstitutions(fallbackList);
    setSelectedInstitution((prev) => (prev && !fallbackList.includes(prev) ? "" : prev));

    setLoadingInstitutions(true);
    const params = new URLSearchParams();
    if (selectedRegion) params.set("region", selectedRegion);

    fetch(`/api/admin/tescon/institutions?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { institutions: fallbackList }))
      .then((data) => {
        const list: string[] =
          Array.isArray(data.institutions) && data.institutions.length > 0
            ? data.institutions
            : fallbackList;
        setTesconInstitutions(list);
        setLoadingInstitutions(false);
        // Clear selected institution if it is not present in the new region's institution list
        setSelectedInstitution((prev) => (prev && !list.includes(prev) ? "" : prev));
      })
      .catch(() => {
        setTesconInstitutions(fallbackList);
        setLoadingInstitutions(false);
      });
  }, [selectedLevel, selectedRegion]);

  // Load positions tied to selectedLevel
  useEffect(() => {
    const initial = selectedLevel && POSITIONS_BY_LEVEL[selectedLevel]
      ? POSITIONS_BY_LEVEL[selectedLevel]
      : ALL_CANONICAL_POSITIONS;
    setPositionList(initial);

    // Region and Constituency use the prescribed hierarchy exactly as listed.
    if (selectedLevel === "Region" || selectedLevel === "Constituency") return;

    const params = new URLSearchParams();
    if (selectedLevel) params.set("level", selectedLevel);

    fetch(`/api/admin/positions?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { positions: [] }))
      .then((data) => {
        if (data.positions && Array.isArray(data.positions) && data.positions.length > 0) {
          const merged = Array.from(new Set([...initial, ...data.positions]));
          setPositionList(merged);
        }
      })
      .catch(() => {});
  }, [selectedLevel]);

  // Helper to fetch and merge dynamic positions for a specific executive level
  const fetchPositionsForLevel = useCallback(async (level: string): Promise<string[]> => {
    const norm = normalizeLevelKey(level);
    const fallback = POSITIONS_BY_LEVEL[norm] || POSITIONS_BY_LEVEL[level] || [];
    try {
      const params = new URLSearchParams();
      params.set("level", level);
      const res = await fetch(`/api/admin/positions?${params.toString()}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      if (data.positions && Array.isArray(data.positions) && data.positions.length > 0) {
        return Array.from(new Set([...fallback, ...data.positions]));
      }
      return fallback;
    } catch {
      return fallback;
    }
  }, []);

  // Load positions for Add Executive modal when level changes
  useEffect(() => {
    if (!newExecLevel) return;
    const norm = normalizeLevelKey(newExecLevel);
    const initial = POSITIONS_BY_LEVEL[norm] || POSITIONS_BY_LEVEL[newExecLevel] || [];
    setAddPositionList(initial);

    let active = true;
    setLoadingAddPositions(true);

    fetchPositionsForLevel(newExecLevel)
      .then((positions) => {
        if (active && positions.length > 0) {
          setAddPositionList(positions);
        }
      })
      .finally(() => {
        if (active) setLoadingAddPositions(false);
      });

    return () => {
      active = false;
    };
  }, [newExecLevel, fetchPositionsForLevel]);

  // Load positions for Edit Executive modal when level changes or modal opens
  useEffect(() => {
    if (!modalOpen || !activeExecutive?.executiveLevel) {
      setEditPositionList([]);
      return;
    }
    const level = activeExecutive.executiveLevel;
    const norm = normalizeLevelKey(level);
    const initial = POSITIONS_BY_LEVEL[norm] || POSITIONS_BY_LEVEL[level] || [];
    setEditPositionList(initial);

    let active = true;
    setLoadingEditPositions(true);

    fetchPositionsForLevel(level)
      .then((positions) => {
        if (active && positions.length > 0) {
          setEditPositionList(positions);
        }
      })
      .finally(() => {
        if (active) setLoadingEditPositions(false);
      });

    return () => {
      active = false;
    };
  }, [modalOpen, activeExecutive?.executiveLevel, fetchPositionsForLevel]);

  // Auth check & Overview data fetch
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("admin_cached_user");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.email) {
          setCurrentUser(parsed);
        }
      }
    } catch {
      // ignore
    }

    const headers = getAuthHeaders();
    fetch("/api/admin/auth/me", {
      credentials: "include",
      headers,
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          logoutAndRedirect("expired");
          return null;
        }
        if (!res.ok) {
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (!data.authenticated) {
          logoutAndRedirect("expired");
          return;
        }
        setCurrentUser(data.user);
        try {
          if (data.user) {
            sessionStorage.setItem("admin_cached_user", JSON.stringify(data.user));
          }
        } catch {
          // ignore
        }
        if (data.expiresAt && typeof window !== "undefined") {
          saveClientSession(localStorage.getItem(SESSION_TOKEN_KEY) || "", data.expiresAt, data.user?.role);
        }
        if (typeof window !== "undefined" && data.user?.role) {
          localStorage.setItem("admin_user_role", String(data.user.role).toUpperCase());
        }
      })
      .catch(() => {
        // Network error — keep cached session if present
      });
  }, []);

  const loadOverview = useCallback((reg?: string, consti?: string, lvl?: string, pos?: string, forceFresh?: boolean, inst?: string) => {
    setLoadingOverview(true);
    const params = new URLSearchParams();
    const r = reg !== undefined ? reg : selectedRegion;
    const c = consti !== undefined ? consti : selectedConstituency;
    const l = lvl !== undefined ? lvl : selectedLevel;
    const p = pos !== undefined ? pos : selectedPosition;
    const i = inst !== undefined ? inst : (selectedLevel === "TESCON" ? selectedInstitution : "");
    if (r) params.set("region", r);
    if (c) params.set("constituency", c);
    if (l) params.set("level", l);
    if (p) params.set("position", p);
    if (i) params.set("institution", i);
    if (forceFresh) params.set("_t", String(Date.now()));

    return fetch(`/api/admin/overview?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
      cache: forceFresh ? "no-store" : "default",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.totals) {
          setOverview(data);
        }
        setLoadingOverview(false);
        return data;
      })
      .catch((err) => {
        setLoadingOverview(false);
        throw err;
      });
  }, [selectedRegion, selectedConstituency, selectedLevel, selectedPosition, selectedInstitution]);

  useEffect(() => {
    if (currentUser) {
      loadOverview();
    }
  }, [currentUser, selectedRegion, selectedConstituency, selectedLevel, selectedPosition, selectedInstitution, loadOverview]);

  // Fetch paginated roster
  const fetchRoster = useCallback((forceFresh?: boolean) => {
    const requestId = ++rosterRequestId.current;
    setLoadingRows(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (selectedLevel) params.set("level", selectedLevel);
    if (selectedRegion) params.set("region", selectedRegion);
    if (selectedConstituency) params.set("constituency", selectedConstituency);
    if (selectedLevel === "TESCON" && selectedInstitution) params.set("institution", selectedInstitution);
    if (selectedPosition) params.set("position", selectedPosition);
    if (selectedCohort) params.set("cohort", selectedCohort);
    if (selectedSlot) params.set("slot", selectedSlot);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterMissingImages) params.set("missingImages", "true");
    if (filterUnder40 || selectedCohort === "under_40") params.set("under40", "true");
    if (forceFresh) params.set("_t", String(Date.now()));

    return fetch(`/api/admin/executives?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
      cache: forceFresh ? "no-store" : "default",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load directory");
        return res.json();
      })
      .then((res) => {
        if (requestId !== rosterRequestId.current) return res;
        setRows(sortRosterRows(res.data || [], selectedLevel));
        setTotalRows(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        setLoadingRows(false);
        return res;
      })
      .catch((err) => {
        if (requestId !== rosterRequestId.current) return;
        setLoadingRows(false);
        throw err;
      });
  }, [page, limit, selectedLevel, selectedRegion, selectedConstituency, selectedInstitution, selectedPosition, selectedCohort, selectedSlot, debouncedSearch, filterMissingImages, filterUnder40]);

  useEffect(() => {
    if (currentUser) {
      fetchRoster();
    }
  }, [currentUser, fetchRoster]);

  // Toggle missing images filter & reload missing portraits
  const handleToggleMissingImages = () => {
    const nextState = !filterMissingImages;
    setFilterMissingImages(nextState);
    setPage(1);
    clearBrokenPhotoCache();
    setRosterImageReloadKey(Date.now());
    if (nextState) {
      setFullReloadToast("Missing images filter enabled • Retrying portraits");
    } else {
      setFullReloadToast("Showing all executives");
    }
    setTimeout(() => {
      setFullReloadToast("");
    }, 3000);
  };

  // Force reload full data from database and reset client image cache
  const handleReloadFullData = async () => {
    if (reloadingFullData) return;
    setReloadingFullData(true);
    setFullReloadToast("Refreshing database records and statistics...");
    try {
      clearBrokenPhotoCache();
      const freshTimestamp = Date.now();
      setRosterImageReloadKey(freshTimestamp);

      // Parallel fresh fetch of overview and roster
      await Promise.all([
        loadOverview(undefined, undefined, undefined, undefined, true),
        fetchRoster(true),
      ]);
      setFullReloadToast("Full data & statistics successfully reloaded!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reload";
      setFullReloadToast(`Reload notice: ${msg}`);
    } finally {
      setReloadingFullData(false);
      setTimeout(() => {
        setFullReloadToast("");
      }, 3500);
    }
  };

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
        const exec = data.executive;
        if (exec) {
          const normReg = exec.region ? normalizeRegionName(exec.region) : "";
          const normConst =
            normReg === "External Branch"
              ? String(exec.constituency || "").trim()
              : exec.constituency
              ? normalizeConstituency(exec.constituency)
              : "";
          setActiveExecutive({
            ...exec,
            region: normReg,
            constituency: normConst,
          });
        } else {
          setActiveExecutive(null);
        }
        setEditSearchVoterId(data.executive?.voterId || "");
        setEditVoterSearchStatus(null);
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
    setEditSearchVoterId("");
    setEditVoterSearchStatus(null);
    setEditUploadingImage(false);
    setEditImageSuccess("");
    setCopiedPhotoUrl(false);
    setModalError("");
    setModalSuccess("");
    setIsEditCustomPosition(false);
    setEditConstituencyList([]);
    setEditDraggingImage(false);
  };

  // Handle Form Change
  const handleFieldChange = (field: keyof ExecutiveDetail, value: string) => {
    if (!activeExecutive) return;

    if (field === "dateOfBirth") {
      const { age, dob } = computeExecutiveAgeAndDob(
        value,
        activeExecutive.position,
        activeExecutive.executiveLevel,
        activeExecutive.region
      );
      setActiveExecutive({
        ...activeExecutive,
        dateOfBirth: dob,
        age: age !== null ? age : activeExecutive.age,
      });
      return;
    }

    if (field === "position") {
      const { age, dob } = computeExecutiveAgeAndDob(
        activeExecutive.dateOfBirth,
        value,
        activeExecutive.executiveLevel,
        activeExecutive.region
      );
      setActiveExecutive({
        ...activeExecutive,
        position: value,
        dateOfBirth: dob,
        age: age !== null ? age : activeExecutive.age,
      });
      return;
    }

    if (field === "executiveLevel") {
      const isExt = value === "External Branch";
      const nextRegion = isExt ? "External Branch" : activeExecutive.region;
      const normLevel = normalizeLevelKey(value);
      const levelPositions = POSITIONS_BY_LEVEL[normLevel] || POSITIONS_BY_LEVEL[value] || [];

      // If switching levels, update position to the new level's valid positions
      let nextPos = activeExecutive.position;
      if (!isEditCustomPosition) {
        if (!levelPositions.includes(activeExecutive.position)) {
          nextPos = levelPositions[0] || "";
        }
      }
      setEditPositionList(levelPositions);

      const { age, dob } = computeExecutiveAgeAndDob(
        activeExecutive.dateOfBirth,
        nextPos,
        value,
        nextRegion
      );
      setActiveExecutive({
        ...activeExecutive,
        executiveLevel: value,
        position: nextPos,
        region: nextRegion,
        dateOfBirth: dob,
        age: age !== null ? age : activeExecutive.age,
      });
      return;
    }

    if (field === "region") {
      const isExt = value === "External Branch";
      const nextLevel = isExt ? "External Branch" : activeExecutive.executiveLevel;
      let nextPos = activeExecutive.position;
      if (isExt && !isEditCustomPosition) {
        const extPositions = POSITIONS_BY_LEVEL["External Branch"] || [];
        if (!extPositions.includes(activeExecutive.position)) {
          nextPos = extPositions[0] || "";
        }
      }
      const { age, dob } = computeExecutiveAgeAndDob(
        activeExecutive.dateOfBirth,
        nextPos,
        nextLevel,
        value
      );
      setActiveExecutive({
        ...activeExecutive,
        region: value,
        executiveLevel: nextLevel,
        position: nextPos,
        dateOfBirth: dob,
        age: age !== null ? age : activeExecutive.age,
      });
      return;
    }

    setActiveExecutive({
      ...activeExecutive,
      [field]: value,
    });
  };

  const handleAddDobChange = (val: string) => {
    const { age, dob } = computeExecutiveAgeAndDob(val, newExecPosition, newExecLevel, newExecRegion);
    setNewExecDob(dob);
    if (age !== null) {
      setNewExecAge(String(age));
    } else if (!val) {
      setNewExecAge("");
    }
  };

  const handleAddPositionChange = (pos: string) => {
    setNewExecPosition(pos);
    if (newExecDob) {
      const { age, dob } = computeExecutiveAgeAndDob(newExecDob, pos, newExecLevel, newExecRegion);
      setNewExecDob(dob);
      if (age !== null) setNewExecAge(String(age));
    }
  };

  // Submit Executive Update Form
  const handleSaveExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExecutive) return;

    const rateCheck = checkClientRateLimit("MUTATION");
    if (!rateCheck.allowed) {
      setModalError(rateCheck.message || "Action throttled. Please wait before saving again.");
      return;
    }

    const { age: calculatedAge, dob: calculatedDob } = computeExecutiveAgeAndDob(
      activeExecutive.dateOfBirth,
      activeExecutive.position,
      activeExecutive.executiveLevel,
      activeExecutive.region
    );
    const updatedExecutive = {
      ...activeExecutive,
      dateOfBirth: calculatedDob,
      age: calculatedAge !== null ? calculatedAge : activeExecutive.age,
    };

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
        body: JSON.stringify(updatedExecutive),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Update failed.");
      }

      setModalSuccess("Executive record updated successfully in ec-data database.");
      setModalSaving(false);

      // Optimistically update row in table
      setRows((prev) =>
        sortRosterRows(
          prev.map((r) =>
            r.id === activeExecutive.id
              ? {
                  ...r,
                  executiveName: updatedExecutive.executiveName,
                  position: updatedExecutive.position,
                  executiveLevel: updatedExecutive.executiveLevel,
                  slotStatus: updatedExecutive.slotStatus,
                  region: updatedExecutive.region,
                  constituency: updatedExecutive.constituency,
                  electoralArea: updatedExecutive.electoralArea,
                  pollingStation: updatedExecutive.pollingStation,
                  gender: updatedExecutive.gender,
                  voterId: updatedExecutive.voterId,
                  status: updatedExecutive.status,
                  phone: updatedExecutive.phone,
                  dateOfBirth: updatedExecutive.dateOfBirth,
                  age: updatedExecutive.age,
                  imageUrl: updatedExecutive.imageUrl,
                }
              : r
          ),
          selectedLevel
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
    const fallbackList = getConstituenciesForRegion(newExecRegion);
    if (fallbackList.length > 0) {
      setNewExecConstituencyList(fallbackList);
    }
    setLoadingNewExecConstituencies(true);
    const params = new URLSearchParams({ region: newExecRegion });
    fetch(`/api/admin/constituencies?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { constituencies: [] }))
      .then((data) => {
        if (Array.isArray(data.constituencies) && data.constituencies.length > 0) {
          setNewExecConstituencyList(data.constituencies);
        }
        setLoadingNewExecConstituencies(false);
      })
      .catch(() => {
        setLoadingNewExecConstituencies(false);
      });
  }, [newExecRegion]);

  // Load constituencies for Edit Executive modal
  useEffect(() => {
    if (!activeExecutive?.region) {
      setEditConstituencyList([]);
      return;
    }
    const fallbackList = getConstituenciesForRegion(activeExecutive.region);
    if (fallbackList.length > 0) {
      setEditConstituencyList(fallbackList);
    }
    setLoadingEditConstituencies(true);
    const params = new URLSearchParams({ region: activeExecutive.region });
    fetch(`/api/admin/constituencies?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { constituencies: [] }))
      .then((data) => {
        if (Array.isArray(data.constituencies) && data.constituencies.length > 0) {
          setEditConstituencyList(data.constituencies);
        }
        setLoadingEditConstituencies(false);
      })
      .catch(() => {
        setLoadingEditConstituencies(false);
      });
  }, [activeExecutive?.region]);

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

    const rateCheck = checkClientRateLimit("MUTATION");
    if (!rateCheck.allowed) {
      setDeleteError(rateCheck.message || "Action throttled. Please wait before deleting.");
      return;
    }

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
      fetchDeletedRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setDeleteError(`Deletion failed: ${msg}`);
      setDeleting(false);
    }
  };

  // Deleted Records & Revert Handlers (Super User Only)
  const fetchDeletedRecords = useCallback(async (searchQuery = "") => {
    if (!isAdminNational) return;
    setLoadingDeleted(true);
    try {
      const q = searchQuery.trim();
      const res = await fetch(`/api/admin/executives/deleted?search=${encodeURIComponent(q)}&limit=100`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setDeletedRows(data.records || []);
        setDeletedTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load deleted records:", err);
    } finally {
      setLoadingDeleted(false);
    }
  }, [isAdminNational]);

  useEffect(() => {
    if (currentUser && isAdminNational) {
      fetchDeletedRecords();
    }
  }, [currentUser, isAdminNational, fetchDeletedRecords]);

  const handleOpenDeletedModal = () => {
    setDeletedModalOpen(true);
    setRevertMessage("");
    fetchDeletedRecords(deletedSearch);
  };

  const handleCloseDeletedModal = () => {
    setDeletedModalOpen(false);
    setRevertMessage("");
  };

  const handleRevert = async (deletionId: number, execName: string) => {
    setRevertingId(deletionId);
    setRevertMessage("");
    try {
      const res = await fetch(`/api/admin/executives/deleted/${deletionId}/revert`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setRevertMessage(`Failed: ${data.error || "Unable to restore executive."}`);
      } else {
        setRevertMessage(`Restored: "${execName}" has been successfully restored to the active register!`);
        fetchDeletedRecords(deletedSearch);
        fetchRoster();
        loadOverview();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setRevertMessage(`Error: ${msg}`);
    } finally {
      setRevertingId(null);
    }
  };

  // Search Voter by Voter ID
  const handleSearchVoter = async () => {
    const cleanId = searchVoterId.trim();
    if (!cleanId) return;

    const rateCheck = checkClientRateLimit("LOOKUP");
    if (!rateCheck.allowed) {
      setVoterSearchStatus({
        found: false,
        message: rateCheck.message || "Search rate limit reached. Please wait before searching again.",
      });
      return;
    }

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
        const { age: calculatedAge, dob: calculatedDob } = computeExecutiveAgeAndDob(
          v.dateOfBirth || "",
          newExecPosition,
          newExecLevel,
          v.region || newExecRegion
        );
        setNewExecDob(calculatedDob || v.dateOfBirth || "");
        setNewExecAge(calculatedAge !== null ? String(calculatedAge) : (v.age ? String(v.age) : ""));
        setNewExecPhone(v.phone || "");
        if (v.region) setNewExecRegion(v.region);
        if (v.constituency) setNewExecConstituency(v.constituency);
        if (v.electoralArea) setNewExecElectoralArea(v.electoralArea);
        if (v.pollingStation) setNewExecPollingStation(v.pollingStation);
        setNewExecImageUrl(v.imageUrl || null);

        setVoterSearchStatus({
          found: true,
          message: `Voter record found for "${v.name}"! Details auto-populated below.`,
        });
      } else {
        setNewExecVoterId(cleanId);
        setNewExecImageUrl(null);
        setVoterSearchStatus({
          found: false,
          message: data.message || `No voter record found for "${cleanId}". You can enter details manually below.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      setNewExecImageUrl(null);
      setVoterSearchStatus({
        found: false,
        message: `Voter registry search error: ${msg}. You can enter details manually.`,
      });
    } finally {
      setSearchingVoter(false);
    }
  };

  // Search Voter by Voter ID in Edit Modal
  const handleEditSearchVoter = async () => {
    const cleanId = editSearchVoterId.trim();
    if (!cleanId || !activeExecutive) return;

    const rateCheck = checkClientRateLimit("LOOKUP");
    if (!rateCheck.allowed) {
      setEditVoterSearchStatus({
        found: false,
        message: rateCheck.message || "Search rate limit reached. Please wait before searching again.",
      });
      return;
    }

    setEditSearchingVoter(true);
    setEditVoterSearchStatus(null);
    setModalError("");

    try {
      const res = await fetch(`/api/admin/voters/lookup?voterId=${encodeURIComponent(cleanId)}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (res.ok && data.found && data.voter) {
        const v = data.voter;
        const { age: calculatedAge, dob: calculatedDob } = computeExecutiveAgeAndDob(
          v.dateOfBirth || "",
          activeExecutive.position,
          activeExecutive.executiveLevel,
          v.region || activeExecutive.region
        );
        setActiveExecutive((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            executiveName: v.name || prev.executiveName,
            voterId: v.voterId || cleanId,
            ghanaCard: v.ghanaCard || prev.ghanaCard,
            gender: v.gender || prev.gender,
            dateOfBirth: calculatedDob || v.dateOfBirth || prev.dateOfBirth,
            age: calculatedAge !== null ? calculatedAge : (v.age ? Number(v.age) : prev.age),
            phone: v.phone || prev.phone,
            region: v.region || prev.region,
            constituency: v.constituency || prev.constituency,
            electoralArea: v.electoralArea || prev.electoralArea,
            pollingStation: v.pollingStation || prev.pollingStation,
            imageUrl:
              prev.imageUrl && !/app\.newpatrioticparty\.org/i.test(prev.imageUrl) && (!v.imageUrl || /app\.newpatrioticparty\.org/i.test(v.imageUrl))
                ? prev.imageUrl
                : (v.imageUrl || prev.imageUrl || null),
          };
        });

        setEditVoterSearchStatus({
          found: true,
          message: `Voter record found for "${v.name}"! Details auto-populated into form.`,
        });
      } else {
        setActiveExecutive((prev) => (prev ? { ...prev, voterId: cleanId } : null));
        setEditVoterSearchStatus({
          found: false,
          message: data.message || `No voter record found for "${cleanId}". You can enter or update details manually.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      setEditVoterSearchStatus({
        found: false,
        message: `Voter registry search error: ${msg}. You can enter details manually.`,
      });
    } finally {
      setEditSearchingVoter(false);
    }
  };

  // Upload and process image file in Edit Modal
  const processEditImageFile = async (file: File) => {
    if (!file || !activeExecutive) return;
    if (!file.type.startsWith("image/")) {
      setModalError("Please select or drop a valid image file (JPEG, PNG, or WebP).");
      return;
    }
    setEditUploadingImage(true);
    setEditImageSuccess("");
    setModalError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (activeExecutive.voterId) formData.append("voterId", activeExecutive.voterId);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image upload failed");
      handleFieldChange("imageUrl", data.imageUrl);
      const sizeKb = data.size ? `${(data.size / 1024).toFixed(1)} KB` : "";
      setEditImageSuccess(`Photo converted to .webp & saved to Party CDN!${sizeKb ? ` (${sizeKb})` : ""}`);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setEditUploadingImage(false);
    }
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processEditImageFile(file);
    }
    e.target.value = "";
  };

  // Upload and process image file in Add Modal
  const processAddImageFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAddError("Please select or drop a valid image file (JPEG, PNG, or WebP).");
      return;
    }
    setAddUploadingImage(true);
    setAddImageSuccess("");
    setAddError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (newExecVoterId) formData.append("voterId", newExecVoterId);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image upload failed");
      setNewExecImageUrl(data.imageUrl);
      const sizeKb = data.size ? `${(data.size / 1024).toFixed(1)} KB` : "";
      setAddImageSuccess(`Photo converted to .webp & saved to Party CDN!${sizeKb ? ` (${sizeKb})` : ""}`);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setAddUploadingImage(false);
    }
  };

  const handleAddImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processAddImageFile(file);
    }
    e.target.value = "";
  };

  const handleCloseAddModal = () => {
    if (addSaving) return;
    setAddModalOpen(false);
    setAddError("");
    setAddSuccess("");
    setAddImageSuccess("");
    setCopiedPhotoUrl(false);
    setSearchVoterId("");
    setVoterSearchStatus(null);
    setIsCustomPosition(false);
    setNewExecPosition("");
    setNewExecImageUrl(null);
    setAddDraggingImage(false);
  };

  const handleCreateExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");

    // Anti-bot honeypot check
    if (addExecHoneypot.trim() !== "") {
      setAddError("Automated bot submission detected.");
      return;
    }

    // Client rate limit check
    const rateCheck = checkClientRateLimit("MUTATION");
    if (!rateCheck.allowed) {
      setAddError(rateCheck.message || "Action throttled. Please wait before creating another executive.");
      return;
    }

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
      const { age: calculatedAge, dob: calculatedDob } = computeExecutiveAgeAndDob(
        newExecDob,
        newExecPosition,
        newExecLevel,
        newExecRegion
      );
      const finalAge = calculatedAge !== null ? calculatedAge : (newExecAge ? parseInt(newExecAge, 10) : null);
      const finalDob = calculatedDob || newExecDob;

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
        dateOfBirth: finalDob,
        age: finalAge,
        status: newExecStatus,
        imageUrl: newExecImageUrl || undefined,
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
        setNewExecImageUrl(null);
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

  // =========================================================================
  // PROXY VOTING MODAL STATE & HANDLERS
  // =========================================================================
  const [proxyModalOpen, setProxyModalOpen] = useState(false);
  const [proxyModalPrincipal, setProxyModalPrincipal] = useState<ExecutiveRow | null>(null);
  const [proxyModalLoading, setProxyModalLoading] = useState(false);
  const [proxyModalAssignment, setProxyModalAssignment] = useState<ProxyAssignmentInfo | null>(null);
  const [proxyModalActingFor, setProxyModalActingFor] = useState<ActingProxyInfo | null>(null);
  const [proxyModalViewMode, setProxyModalViewMode] = useState<"details" | "search">("search");

  // Search filters inside Proxy Modal
  const [proxySearchQuery, setProxySearchQuery] = useState("");
  const [debouncedProxySearch, setDebouncedProxySearch] = useState("");
  const [proxyFilterLevel, setProxyFilterLevel] = useState("");
  const [proxyFilterRegion, setProxyFilterRegion] = useState("");
  const [proxyFilterConstituency, setProxyFilterConstituency] = useState("");
  const [proxyConstituencyList, setProxyConstituencyList] = useState<string[]>([]);
  const [loadingProxyConstituencies, setLoadingProxyConstituencies] = useState(false);

  // Candidate results & mutation status
  const [proxyCandidates, setProxyCandidates] = useState<ProxyCandidate[]>([]);
  const [proxySearching, setProxySearching] = useState(false);
  const [proxyAssigningId, setProxyAssigningId] = useState<number | null>(null);
  const [proxyRevoking, setProxyRevoking] = useState(false);
  const [proxyConfirmRevoke, setProxyConfirmRevoke] = useState(false);
  const [proxyModalError, setProxyModalError] = useState("");
  const [proxyModalSuccess, setProxyModalSuccess] = useState("");
  const [copiedProxyVoterId, setCopiedProxyVoterId] = useState(false);

  // Debounce proxy search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProxySearch(proxySearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [proxySearchQuery]);

  // Load constituencies when proxyFilterRegion changes
  useEffect(() => {
    if (!proxyFilterRegion) {
      setProxyConstituencyList([]);
      setProxyFilterConstituency("");
      setLoadingProxyConstituencies(false);
      return;
    }

    const fallbackList = getConstituenciesForRegion(proxyFilterRegion);
    if (fallbackList.length > 0) {
      setProxyConstituencyList(fallbackList);
    }

    setLoadingProxyConstituencies(true);
    const params = new URLSearchParams({ region: proxyFilterRegion });
    fetch(`/api/admin/constituencies?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : { constituencies: [] }))
      .then((data) => {
        const rawList: string[] = Array.isArray(data.constituencies) ? data.constituencies : [];
        const normalizedList = Array.from(
          new Set(
            rawList
              .map((c) =>
                proxyFilterRegion === "External Branch"
                  ? String(c || "").trim()
                  : normalizeConstituency(c)
              )
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
        if (normalizedList.length > 0) {
          setProxyConstituencyList(normalizedList);
        }
        setLoadingProxyConstituencies(false);
      })
      .catch(() => {
        setProxyConstituencyList(fallbackList);
        setLoadingProxyConstituencies(false);
      });
  }, [proxyFilterRegion]);

  // Search proxy candidates when modal is open in "search" mode
  useEffect(() => {
    if (!proxyModalOpen || proxyModalViewMode !== "search" || !proxyModalPrincipal) {
      return;
    }

    let active = true;
    setProxySearching(true);

    const params = new URLSearchParams({
      mode: "search",
      excludeId: String(proxyModalPrincipal.id),
      limit: "35",
    });
    if (debouncedProxySearch.trim()) params.set("search", debouncedProxySearch.trim());
    if (proxyFilterRegion) params.set("region", proxyFilterRegion);
    if (proxyFilterConstituency) params.set("constituency", proxyFilterConstituency);
    if (proxyFilterLevel) params.set("level", proxyFilterLevel);

    fetch(`/api/admin/proxies?${params.toString()}`, {
      credentials: "include",
      headers: getAuthHeaders(),
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : { candidates: [] }))
      .then((data) => {
        if (!active) return;
        setProxyCandidates(Array.isArray(data.candidates) ? data.candidates : []);
        setProxySearching(false);
      })
      .catch(() => {
        if (!active) return;
        setProxyCandidates([]);
        setProxySearching(false);
      });

    return () => {
      active = false;
    };
  }, [
    proxyModalOpen,
    proxyModalViewMode,
    proxyModalPrincipal,
    debouncedProxySearch,
    proxyFilterRegion,
    proxyFilterConstituency,
    proxyFilterLevel,
  ]);

  const mapAssignmentFromApi = (raw: any): ProxyAssignmentInfo | null => {
    if (!raw) return null;
    const pe = raw.proxyExecutive || null;
    return {
      id: Number(raw.id),
      proxyExecutiveId: Number(raw.proxy_executive_id ?? raw.proxyExecutiveId),
      proxyName: String(raw.proxy_name ?? raw.proxyName ?? pe?.executiveName ?? ""),
      proxyVoterId: raw.proxy_voter_id ?? raw.proxyVoterId ?? pe?.voterId ?? null,
      proxyPhone: raw.proxy_phone ?? raw.proxyPhone ?? pe?.phone ?? null,
      proxyRegion: raw.proxy_region ?? raw.proxyRegion ?? pe?.region ?? null,
      proxyConstituency: raw.proxy_constituency ?? raw.proxyConstituency ?? pe?.constituency ?? null,
      proxyLevel: raw.proxy_level ?? raw.proxyLevel ?? pe?.executiveLevel ?? null,
      proxyPosition: raw.proxy_position ?? raw.proxyPosition ?? pe?.position ?? null,
      assignedByEmail: raw.assigned_by_email ?? raw.assignedByEmail ?? null,
      assignedByName: raw.assigned_by_name ?? raw.assignedByName ?? null,
      createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
      notes: raw.notes ?? null,
      proxyExecutive: pe
        ? {
            id: Number(pe.id),
            executiveName: String(pe.executiveName || ""),
            voterId: pe.voterId || null,
            phone: pe.phone || null,
            gender: pe.gender || null,
            dateOfBirth: pe.dateOfBirth || null,
            age: pe.age != null ? Number(pe.age) : null,
            region: pe.region || null,
            constituency: pe.constituency || null,
            electoralArea: pe.electoralArea || null,
            pollingStation: pe.pollingStation || null,
            executiveLevel: pe.executiveLevel || null,
            position: pe.position || null,
            slotStatus: pe.slotStatus || null,
            imageUrl: pe.imageUrl || null,
          }
        : null,
    };
  };

  const handleOpenProxyModal = async (row: ExecutiveRow) => {
    setProxyModalPrincipal(row);
    setProxyModalOpen(true);
    setProxyModalError("");
    setProxyModalSuccess("");
    setProxyConfirmRevoke(false);
    setCopiedProxyVoterId(false);

    const initialAssignment = row.proxyAssignment || null;
    setProxyModalAssignment(initialAssignment);
    setProxyModalActingFor(row.actingAsProxyFor || null);
    setProxyModalViewMode(initialAssignment ? "details" : "search");

    // Reset search filters (default to principal's region if no proxy assigned so relevant voters appear immediately, while still allowing full search)
    setProxySearchQuery("");
    setDebouncedProxySearch("");
    setProxyFilterRegion(row.region ? normalizeRegionName(row.region) : "");
    setProxyFilterConstituency(
      row.constituency
        ? normalizeRegionName(row.region) === "External Branch"
          ? row.constituency
          : normalizeConstituency(row.constituency)
        : ""
    );
    setProxyFilterLevel("");

    setProxyModalLoading(true);
    try {
      const res = await fetch(`/api/admin/proxies?principalId=${row.id}`, {
        credentials: "include",
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const freshAssignment = mapAssignmentFromApi(data.assignment);
        setProxyModalAssignment(freshAssignment);
        if (data.actingAsProxyFor) {
          setProxyModalActingFor({
            id: Number(data.actingAsProxyFor.id),
            principalExecutiveId: Number(data.actingAsProxyFor.principal_executive_id),
            principalName: String(data.actingAsProxyFor.principal_name || ""),
            principalVoterId: data.actingAsProxyFor.principal_voter_id || null,
            principalPhone: data.actingAsProxyFor.principal_phone || null,
            principalRegion: data.actingAsProxyFor.principal_region || null,
            principalConstituency: data.actingAsProxyFor.principal_constituency || null,
            principalLevel: data.actingAsProxyFor.principal_level || null,
            principalPosition: data.actingAsProxyFor.principal_position || null,
            createdAt: data.actingAsProxyFor.created_at || "",
          });
        } else {
          setProxyModalActingFor(null);
        }
        setProxyModalViewMode(freshAssignment ? "details" : "search");
      }
    } catch {
      // Keep initial row state if network request fails
    } finally {
      setProxyModalLoading(false);
    }
  };

  const handleCloseProxyModal = () => {
    if (proxyAssigningId !== null || proxyRevoking) return;
    setProxyModalOpen(false);
    setProxyModalPrincipal(null);
    setProxyModalAssignment(null);
    setProxyModalActingFor(null);
    setProxyModalError("");
    setProxyModalSuccess("");
    setProxyConfirmRevoke(false);
  };

  const handleAssignProxy = async (candidate: ProxyCandidate) => {
    if (!proxyModalPrincipal) return;
    setProxyAssigningId(candidate.id);
    setProxyModalError("");
    setProxyModalSuccess("");

    try {
      const res = await fetch("/api/admin/proxies", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          principalExecutiveId: proxyModalPrincipal.id,
          proxyExecutiveId: candidate.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProxyModalError(data.error || "Failed to assign proxy voter.");
        setProxyAssigningId(null);
        return;
      }

      const newAssignment = mapAssignmentFromApi(data.assignment);
      setProxyModalAssignment(newAssignment);
      setProxyModalViewMode("details");
      setProxyModalSuccess(
        `Assigned ${candidate.executiveName} (${candidate.voterId || "No Voter ID"}) as proxy voter for ${proxyModalPrincipal.executiveName}.`
      );

      // Update rows optimistically & refresh roster
      setRows((prev) =>
        prev.map((r) => {
          if (r.id === proxyModalPrincipal.id) {
            return { ...r, proxyAssignment: newAssignment };
          }
          if (r.id === candidate.id && newAssignment) {
            return {
              ...r,
              actingAsProxyFor: {
                id: newAssignment.id,
                principalExecutiveId: proxyModalPrincipal.id,
                principalName: proxyModalPrincipal.executiveName,
                principalVoterId: proxyModalPrincipal.voterId || null,
                principalRegion: proxyModalPrincipal.region || null,
                principalConstituency: proxyModalPrincipal.constituency || null,
                principalLevel: proxyModalPrincipal.executiveLevel || null,
                principalPosition: proxyModalPrincipal.position || null,
              },
            };
          }
          return r;
        })
      );
      fetchRoster(true);
    } catch (err: unknown) {
      setProxyModalError(err instanceof Error ? err.message : "Network error while assigning proxy.");
    } finally {
      setProxyAssigningId(null);
    }
  };

  const handleRemoveProxy = async () => {
    if (!proxyModalPrincipal) return;
    setProxyRevoking(true);
    setProxyModalError("");
    setProxyModalSuccess("");

    const previousProxyExecId = proxyModalAssignment?.proxyExecutiveId;

    try {
      const res = await fetch(`/api/admin/proxies?principalId=${proxyModalPrincipal.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setProxyModalError(data.error || "Failed to revoke proxy assignment.");
        setProxyRevoking(false);
        return;
      }

      setProxyModalAssignment(null);
      setProxyConfirmRevoke(false);
      setProxyModalViewMode("search");
      setProxyModalSuccess("Proxy assignment removed. You can now search and assign a new proxy voter.");

      setRows((prev) =>
        prev.map((r) => {
          if (r.id === proxyModalPrincipal.id) {
            return { ...r, proxyAssignment: null };
          }
          if (previousProxyExecId && r.id === previousProxyExecId) {
            return { ...r, actingAsProxyFor: null };
          }
          return r;
        })
      );
      fetchRoster(true);
    } catch (err: unknown) {
      setProxyModalError(err instanceof Error ? err.message : "Network error while revoking proxy.");
    } finally {
      setProxyRevoking(false);
    }
  };

  const visibleTiers = isC1
    ? TIERS.filter((t) => t.id !== "Electoral Area" && t.id !== "Polling Station")
    : TIERS;

  const exportUrl = `/api/admin/export?level=${encodeURIComponent(selectedLevel)}&region=${encodeURIComponent(selectedRegion)}&constituency=${encodeURIComponent(selectedConstituency)}&position=${encodeURIComponent(selectedPosition)}&cohort=${encodeURIComponent(selectedCohort)}&slot=${encodeURIComponent(selectedSlot)}&search=${encodeURIComponent(debouncedSearch)}${filterMissingImages ? "&missingImages=true" : ""}${isUnder40Active ? "&under40=true" : ""}${selectedLevel === "TESCON" && selectedInstitution ? `&institution=${encodeURIComponent(selectedInstitution)}` : ""}`;

  const handleExportClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (exportCooldownSec > 0) {
      e.preventDefault();
      return;
    }
    const rateCheck = checkClientRateLimit("EXPORT");
    if (!rateCheck.allowed) {
      e.preventDefault();
      alert(rateCheck.message || "Export rate limit reached. Please wait before exporting again.");
      return;
    }
    setExportCooldownSec(5);
    const interval = setInterval(() => {
      setExportCooldownSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (authError && !currentUser) {
    if (typeof window !== "undefined") {
      logoutAndRedirect("expired");
    }
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
      title={isC1 ? "Aspirant page" : "Executives Directory & Command Centre"}
      subtitle={
        isC1
          ? "All Women in Electoral College — Constituency, Region, External Branches, TESCON (Presidents & WOCOM), and National"
          : "Comprehensive nationwide registry of all 261,553 party executives across all 6 administrative tiers"
      }
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      <style>{`
        .dash-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 28px 32px;
        }
        .dash-tier-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
        }
        .dash-tier-card {
          padding: 16px 18px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dash-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 28px;
        }
        .dash-toolbar-card {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 12px;
          padding: 18px 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 20px;
        }
        .dash-toolbar-row1 {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }
        .dash-search-container {
          flex: 1 1 320px;
          position: relative;
          display: flex;
          align-items: center;
        }
        .dash-actions-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dash-filters-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }
        .dash-region-cluster {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 3px 6px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
        }
        .dash-matches-count {
          margin-left: auto;
          font-size: 13px;
          color: #94a3b8;
        }
        .dash-scroll-hint {
          display: none;
        }
        .dash-table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }
        .dash-table {
          width: 100%;
          min-width: 1020px;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        .dash-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: rgba(30, 41, 59, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          fontSize: 13px;
          color: #94a3b8;
        }
        .dash-pagination-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dash-pagination-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Light Theme Overrides for All Women / Aspirant Page */
        .dash-light-theme {
          background: #ffffff !important;
          color: #0f172a !important;
        }
        .dash-light-theme .dash-toolbar-card {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
        }
        .dash-light-theme .dash-search-container input {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .dash-light-theme .dash-filter-select {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .dash-light-theme .dash-filter-select:disabled {
          background: #f1f5f9 !important;
          color: #94a3b8 !important;
        }
        .dash-light-theme .dash-region-cluster {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
        }
        .dash-light-theme .dash-matches-count {
          color: #475569 !important;
        }
        .dash-light-theme .dash-matches-count strong {
          color: #0f172a !important;
        }
        .dash-light-theme .dash-scroll-hint {
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
          color: #475569 !important;
        }
        .dash-light-theme .dash-pagination {
          background: #ffffff !important;
          border-top: 1px solid #e2e8f0 !important;
          color: #475569 !important;
        }
        .dash-light-theme .dash-pagination strong {
          color: #0f172a !important;
        }
        .dash-light-theme .dash-pagination select,
        .dash-light-theme .dash-pagination button {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .dash-light-theme .dash-pagination button:disabled {
          background: #f8fafc !important;
          color: #94a3b8 !important;
          border-color: #e2e8f0 !important;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .dash-container {
            padding: 20px 18px;
          }
          .dash-scroll-hint {
            display: flex !important;
            align-items: center;
            gap: 8px;
            padding: 9px 14px;
            background: rgba(30, 41, 59, 0.85);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 12px;
            color: #94a3b8;
          }
        }

        @media (max-width: 768px) {
          .dash-tier-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
            gap: 10px !important;
          }
          .dash-tier-card {
            padding: 12px 14px !important;
          }
          .dash-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 18px !important;
          }
          .dash-matches-count {
            margin-left: 0 !important;
            width: 100% !important;
            padding-top: 4px !important;
          }
        }

        @media (max-width: 640px) {
          .dash-container {
            padding: 14px 10px !important;
          }
          .dash-tier-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .dash-kpi-grid {
            grid-template-columns: 1fr !important;
          }
          .dash-toolbar-card {
            padding: 14px 12px !important;
          }
          .dash-toolbar-row1 {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .dash-search-container {
            flex: 1 1 100% !important;
            width: 100% !important;
          }
          .dash-actions-group {
            width: 100% !important;
            display: flex !important;
            gap: 8px !important;
          }
          .dash-actions-group > * {
            flex: 1 1 0 !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .dash-filters-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .dash-filters-row select,
          .dash-filters-row button {
            width: 100% !important;
            max-width: none !important;
          }
          .dash-region-cluster {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            gap: 6px !important;
            padding: 8px !important;
            box-sizing: border-box !important;
          }
          .dash-region-cluster select {
            width: 100% !important;
            max-width: none !important;
          }
          .dash-region-arrow {
            display: none !important;
          }
          .dash-pagination {
            flex-direction: column !important;
            gap: 12px !important;
            padding: 12px 14px !important;
            align-items: stretch !important;
          }
          .dash-pagination-left {
            justify-content: space-between !important;
          }
          .dash-pagination-right {
            justify-content: space-between !important;
          }
          .dash-modal-overlay {
            padding: 10px 8px !important;
          }
          .dash-modal-container {
            max-height: 94vh !important;
            border-radius: 10px !important;
          }
          .dash-modal-header {
            padding: 14px 16px !important;
          }
          .dash-modal-body {
            padding: 14px 14px !important;
          }
          .dash-modal-footer {
            padding: 12px 14px !important;
            flex-direction: column-reverse !important;
            gap: 8px !important;
          }
          .dash-modal-footer button {
            width: 100% !important;
            justify-content: center !important;
          }
          .dash-modal-grid-2 {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
      `}</style>
      <div className={`dash-container ${isC1 ? "dash-light-theme" : ""}`}>
        {/* Tier Cards Grid (6 Levels) with Grey Lucide Icons */}
        <section style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: isC1 ? "#334155" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
              {isC1 ? "All Women Electoral Levels" : "Executive Levels Command Selector"}
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Click a level card to filter directory roster</span>
          </div>

          <div className="dash-tier-grid">
            {visibleTiers.map((tier) => {
              const isActive = selectedLevel === tier.id;
              const count = getTierCount(tier.id);
              const IconComp = tier.icon;
              return (
                <div
                  key={tier.id}
                  className="dash-tier-card"
                  onClick={() => {
                    setSelectedLevel(tier.id);
                    setPage(1);
                  }}
                  style={{
                    background: isC1
                      ? (isActive ? "#fdf2f8" : "#ffffff")
                      : (isActive ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(15, 23, 42, 0.8) 100%)" : "rgba(15, 23, 42, 0.6)"),
                    border: isC1
                      ? (isActive ? "2px solid #db2777" : "1px solid #e2e8f0")
                      : (isActive ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.08)"),
                    boxShadow: isC1
                      ? (isActive ? "0 4px 14px rgba(219, 39, 119, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.05)")
                      : (isActive ? "0 8px 20px -4px rgba(16, 185, 129, 0.2)" : "none")
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: isC1 ? (isActive ? "#fce7f3" : "#f1f5f9") : "rgba(255, 255, 255, 0.04)",
                      border: isC1 ? (isActive ? "1px solid #fbcfe8" : "1px solid #e2e8f0") : "1px solid rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <IconComp size={20} color={isC1 ? (isActive ? "#db2777" : "#64748b") : "#94a3b8"} />
                    </div>
                    {isActive && (
                      <span style={{
                        fontSize: "10px",
                        background: isC1 ? "#db2777" : "#10b981",
                        color: "#ffffff",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: "700"
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: isC1 ? (isActive ? "#be185d" : "#334155") : (isActive ? "#34d399" : "#cbd5e1") }}>
                    {tier.label}
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: isC1 ? "#0f172a" : "#ffffff", marginTop: "2px" }}>
                    {loadingOverview ? "…" : count.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    {tier.id === "" ? (isC1 ? "Total across electoral college levels" : "Total across all 6 levels") : `Registered ${tier.label.toLowerCase()} officers`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Executive Directorate & Electoral College KPI Metrics Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: isC1 ? "#334155" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
              {selectedConstituency ? (
                <span>Metrics for <strong style={{ color: isC1 ? "#0284c7" : "#38bdf8" }}>{selectedConstituency}</strong> <span style={{ color: "#64748b" }}>({selectedRegion})</span></span>
              ) : selectedRegion ? (
                <span>Metrics for <strong style={{ color: isC1 ? "#0284c7" : "#38bdf8" }}>{selectedRegion} Region</strong></span>
              ) : selectedPosition ? (
                <span>Metrics for <strong style={{ color: isC1 ? "#0284c7" : "#38bdf8" }}>{selectedPosition}</strong></span>
              ) : (
                <span>{isC1 ? "All Women Directorate & Electoral College Metrics" : "Nationwide Directorate & Electoral College Metrics"}</span>
              )}
            </h2>
            {(selectedRegion || selectedConstituency || selectedPosition) && (
              <span style={{ fontSize: "11px", background: isC1 ? "#e0f2fe" : "rgba(56, 189, 248, 0.15)", color: isC1 ? "#0284c7" : "#38bdf8", padding: "2px 8px", borderRadius: "4px", border: isC1 ? "1px solid #bae6fd" : "1px solid rgba(56, 189, 248, 0.3)", fontWeight: "600" }}>
                FILTERED {selectedPosition ? `· ${selectedPosition}` : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {(selectedRegion || selectedConstituency || selectedPosition) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRegion("");
                  setSelectedConstituency("");
                  setSelectedPosition("");
                  setPage(1);
                }}
                style={{
                  background: isC1 ? "#f1f5f9" : "transparent",
                  border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  color: isC1 ? "#334155" : "#94a3b8",
                  fontSize: "12px",
                  padding: "5px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  transition: "all 0.15s ease"
                }}
              >
                <RotateCcw size={12} /> Reset to Nationwide
              </button>
            )}
            <a
              href="/exports/national_election_electoral_college_metrics.xlsx"
              download
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: isC1 ? "#f0fdf4" : "rgba(30, 41, 59, 0.8)",
                border: isC1 ? "1px solid #bbf7d0" : "1px solid rgba(255, 255, 255, 0.15)",
                color: isC1 ? "#15803d" : "#34d399",
                fontSize: "12px",
                fontWeight: "600",
                padding: "5px 12px",
                borderRadius: "6px",
                textDecoration: "none"
              }}
            >
              <Download size={13} color={isC1 ? "#15803d" : "#34d399"} />
              <span>Metrics Excel (.xlsx)</span>
            </a>
          </div>
        </div>

        {/* Executive Directorate KPI Metrics */}
        {overview && (
          <section className="dash-kpi-grid">
            <div style={{ background: isC1 ? "#ffffff" : "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.06)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: isC1 ? "#475569" : "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
                  {selectedConstituency ? "Constituency Officers" : selectedRegion ? "Regional Officers" : (isC1 ? "Total Women in Directory" : "Total Nationwide Officers")}
                </span>
                <Users size={15} color={isC1 ? "#64748b" : "#94a3b8"} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: isC1 ? "#0f172a" : "#ffffff" }}>{overview.totals.total.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {selectedConstituency ? selectedConstituency : selectedRegion ? `${selectedRegion} Region` : (isC1 ? "All Women Electoral College" : "Across 6 executive levels")}
              </span>
            </div>

            <div style={{ background: isC1 ? "#ffffff" : "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.06)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: isC1 ? "#475569" : "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Elected Officers</span>
                <Vote size={15} color={isC1 ? "#16a34a" : "#94a3b8"} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: isC1 ? "#16a34a" : "#34d399" }}>{overview.totals.elected.toLocaleString()}</span>
                <span style={{ fontSize: "12px", color: isC1 ? "#16a34a" : "#34d399" }}>
                  ({overview.totals.total > 0 ? Math.round((overview.totals.elected / overview.totals.total) * 100) : 0}%)
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Formally elected slates</span>
            </div>

            <div style={{ background: isC1 ? "#ffffff" : "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.06)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: isC1 ? "#475569" : "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Appointed Officers</span>
                <FileCheck size={15} color={isC1 ? "#d97706" : "#94a3b8"} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: isC1 ? "#d97706" : "#fbbf24" }}>{overview.totals.appointed.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Deputies, Officers & Patrons</span>
            </div>

            <div
              onClick={handleToggleUnder40}
              style={{
                background: isC1
                  ? (isUnder40Active ? "#f0fdf4" : "#ffffff")
                  : (isUnder40Active ? "rgba(16, 185, 129, 0.15)" : "rgba(30, 41, 59, 0.5)"),
                padding: "16px",
                borderRadius: "10px",
                border: isC1
                  ? (isUnder40Active ? "2px solid #16a34a" : "1px solid #e2e8f0")
                  : (isUnder40Active ? "1px solid rgba(52, 211, 153, 0.5)" : "1px solid rgba(255, 255, 255, 0.06)"),
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isC1
                  ? (isUnder40Active ? "0 4px 12px rgba(22, 163, 74, 0.12)" : "0 1px 3px rgba(0,0,0,0.05)")
                  : (isUnder40Active ? "0 0 12px rgba(16, 185, 129, 0.2)" : "none")
              }}
              title="Click to toggle Under 40 (Youth) filter"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: isC1 ? (isUnder40Active ? "#15803d" : "#475569") : (isUnder40Active ? "#6ee7b7" : "#94a3b8"), textTransform: "uppercase", fontWeight: "600" }}>
                  Under 40 (Youth)
                </span>
                <Sparkles size={15} color={isC1 ? "#16a34a" : (isUnder40Active ? "#34d399" : "#94a3b8")} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: isC1 ? "#16a34a" : "#34d399" }}>
                  {(overview.totals.under_40 ?? 0).toLocaleString()}
                </span>
                <span style={{ fontSize: "12px", color: isC1 ? "#16a34a" : "#34d399" }}>
                  ({overview.totals.total > 0 ? Math.round(((overview.totals.under_40 ?? 0) / overview.totals.total) * 100) : 0}%)
                </span>
              </div>
              <span style={{ fontSize: "11px", color: isC1 ? (isUnder40Active ? "#15803d" : "#64748b") : (isUnder40Active ? "#a7f3d0" : "#64748b") }}>
                Cutoff: 21 Aug 2026 {isUnder40Active ? "• Active" : "• Click to filter"}
              </span>
            </div>

            <div style={{ background: isC1 ? "#ffffff" : "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.06)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: isC1 ? "#475569" : "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Women Executives</span>
                <UserCheck size={15} color={isC1 ? "#db2777" : "#94a3b8"} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: isC1 ? "#db2777" : "#f472b6" }}>{overview.totals.women.toLocaleString()}</span>
                <span style={{ fontSize: "12px", color: isC1 ? "#db2777" : "#f472b6" }}>
                  ({overview.totals.total > 0 ? Math.round((overview.totals.women / overview.totals.total) * 100) : 0}%)
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Female officers in directory</span>
            </div>

            <div style={{ background: isC1 ? "#ffffff" : "rgba(30, 41, 59, 0.5)", padding: "16px", borderRadius: "10px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.06)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: isC1 ? "#475569" : "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Nasara Directorate</span>
                <Compass size={15} color={isC1 ? "#0284c7" : "#94a3b8"} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "22px", fontWeight: "700", color: isC1 ? "#0284c7" : "#38bdf8" }}>{overview.totals.nasara.toLocaleString()}</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Coordinators & Organisers</span>
            </div>
          </section>
        )}

        {/* National Election Electoral College Voting Metrics */}
        {overview?.electoralCollege && (
          <div style={{ marginTop: "14px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: isC1 ? "#0284c7" : "#38bdf8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                National election eligibility ({selectedConstituency || (selectedRegion ? `${selectedRegion} Region` : "Nationwide Pool")})
              </span>
              <span style={{ fontSize: "11px", color: isC1 ? "#475569" : "#64748b" }}>
                Master Pool: <strong style={{ color: isC1 ? "#0f172a" : "#ffffff" }}>{overview.electoralCollege.total_delegates.toLocaleString()}</strong> delegates
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "12px"
            }}>
              {/* General Positions */}
              <div style={{ background: isC1 ? "#ffffff" : "rgba(15, 23, 42, 0.7)", padding: "14px", borderRadius: "8px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
                <div style={{ fontSize: "10px", color: isC1 ? "#475569" : "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>General Positions</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: isC1 ? "#0f172a" : "#ffffff", marginTop: "4px" }}>
                  {overview.electoralCollege.general_voters.toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: isC1 ? "#64748b" : "#94a3b8", marginTop: "2px" }}>Constituency, regional, national + TESCON Presidents</div>
              </div>

              {/* Youth Organiser */}
              <div style={{ background: isC1 ? "#ffffff" : "rgba(15, 23, 42, 0.7)", padding: "14px", borderRadius: "8px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
                <div style={{ fontSize: "10px", color: isC1 ? "#0284c7" : "#38bdf8", textTransform: "uppercase", fontWeight: "700" }}>Youth Organiser</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: isC1 ? "#0284c7" : "#38bdf8", marginTop: "4px" }}>
                  {overview.electoralCollege.youth_voters.toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: isC1 ? "#64748b" : "#94a3b8", marginTop: "2px" }}>Below 40 + all TESCON except patrons</div>
              </div>

              {/* Women Organiser */}
              <div style={{ background: isC1 ? "#ffffff" : "rgba(15, 23, 42, 0.7)", padding: "14px", borderRadius: "8px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
                <div style={{ fontSize: "10px", color: isC1 ? "#be185d" : "#f472b6", textTransform: "uppercase", fontWeight: "700" }}>Women Organiser</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: isC1 ? "#be185d" : "#f472b6", marginTop: "4px" }}>
                  {overview.electoralCollege.women_voters.toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: isC1 ? "#64748b" : "#94a3b8", marginTop: "2px" }}>Female constituency, regional, national + TESCON WOCOM, female presidents & female Nasara</div>
              </div>

              {/* Nasara Coordinator */}
              <div style={{ background: isC1 ? "#ffffff" : "rgba(15, 23, 42, 0.7)", padding: "14px", borderRadius: "8px", border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)", boxShadow: isC1 ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
                <div style={{ fontSize: "10px", color: isC1 ? "#b45309" : "#fbbf24", textTransform: "uppercase", fontWeight: "700" }}>Nasara Organiser</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: isC1 ? "#b45309" : "#fbbf24", marginTop: "4px" }}>
                  {overview.electoralCollege.nasara_voters.toLocaleString()}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>Nasara Execs + TESCON Nasara</div>
              </div>
            </div>
          </div>
        )}

        <p><Link href="/admin/voting" style={{ color: isC1 ? "#db2777" : undefined, fontWeight: isC1 ? "600" : undefined }}>View all nine contests, regional metrics, constituency metrics and electorate details →</Link></p>

        {isC1 && (
          <div
            style={{
              marginBottom: "16px",
              padding: "14px 18px",
              borderRadius: "10px",
              background: "#fdf2f8",
              border: "1px solid #fbcfe8",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              color: "#be185d",
              fontSize: "13px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <span style={{ fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#9d174d" }}>
              All Women Electorate Active:
            </span>
            <span style={{ color: "#831843" }}>
              Directory is filtered strictly to female executives in the Electoral College (Constituency, Regional, External Branches, National, and TESCON female Presidents &amp; WOCOM). Non-electoral tiers and non-female executives are restricted.
            </span>
          </div>
        )}

        {/* Multi-Dimensional Filter & Search Toolbar */}
        <section className="dash-toolbar-card">
          <div className="dash-toolbar-row1">
            {/* Search Input with Grey Search Icon */}
            <div className="dash-search-container">
              <div style={{ position: "absolute", left: "12px", pointerEvents: "none", display: "flex" }}>
                <Search size={15} color={isC1 ? "#64748b" : "#94a3b8"} />
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
                  background: isC1 ? "#f8fafc" : "rgba(2, 6, 23, 0.8)",
                  border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  color: isC1 ? "#0f172a" : "#ffffff",
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
            <div className="dash-actions-group">
              <button
                type="button"
                onClick={() => {
                  setAddModalOpen(true);
                  setAddError("");
                  setAddSuccess("");
                  setVoterSearchStatus(null);
                  if (selectedLevel && selectedLevel !== "All") {
                    const norm = normalizeLevelKey(selectedLevel);
                    if (POSITIONS_BY_LEVEL[norm]) {
                      setNewExecLevel(norm);
                      if (!isCustomPosition) {
                        const validPositions = POSITIONS_BY_LEVEL[norm] || [];
                        setNewExecPosition(validPositions[0] || "");
                      }
                    }
                  } else if (!newExecPosition && !isCustomPosition) {
                    const norm = normalizeLevelKey(newExecLevel);
                    const validPositions = POSITIONS_BY_LEVEL[norm] || POSITIONS_BY_LEVEL[newExecLevel] || [];
                    setNewExecPosition(validPositions[0] || "");
                  }
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
                  onClick={handleExportClick}
                  download
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 14px",
                    borderRadius: "8px",
                    background:
                      exportCooldownSec > 0
                        ? "#334155"
                        : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "600",
                    textDecoration: "none",
                    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
                    cursor: exportCooldownSec > 0 ? "not-allowed" : "pointer",
                    pointerEvents: exportCooldownSec > 0 ? "none" : "auto",
                    opacity: exportCooldownSec > 0 ? 0.7 : 1,
                  }}
                >
                  <Download size={14} color="#ffffff" />
                  {exportCooldownSec > 0
                    ? `Cooldown (${exportCooldownSec}s)`
                    : "Export Filtered CSV"}
                </a>
              )}

              {isAdminNational && (
                <button
                  type="button"
                  onClick={handleOpenDeletedModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 14px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#fca5a5",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.22)";
                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                  }}
                  title="Super User Only: View and revert deleted voters/executives"
                >
                  <Archive size={14} color="#fca5a5" />
                  <span>Deleted Voters / Revert</span>
                  {deletedTotal > 0 && (
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "10px",
                        background: "#ef4444",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: "700",
                      }}
                    >
                      {deletedTotal}
                    </span>
                  )}
                </button>
              )}

              {/* Toggle to Reload Missing Images */}
              <button
                type="button"
                role="switch"
                aria-checked={filterMissingImages}
                onClick={handleToggleMissingImages}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 13px",
                  borderRadius: "8px",
                  background: filterMissingImages
                    ? isC1 ? "#fffbeb" : "rgba(245, 158, 11, 0.18)"
                    : isC1 ? "#f8fafc" : "rgba(15, 23, 42, 0.8)",
                  border: filterMissingImages
                    ? isC1 ? "1px solid #f59e0b" : "1px solid rgba(245, 158, 11, 0.55)"
                    : isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  color: filterMissingImages ? (isC1 ? "#b45309" : "#fbbf24") : (isC1 ? "#334155" : "#cbd5e1"),
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: filterMissingImages ? "0 0 10px rgba(245, 158, 11, 0.25)" : "none",
                }}
                title={
                  filterMissingImages
                    ? "Missing images mode active. Click to show all executives."
                    : "Toggle to filter and reload executives with missing, unmigrated, or broken portraits"
                }
              >
                {/* Visual switch indicator */}
                <div
                  style={{
                    width: "26px",
                    height: "15px",
                    borderRadius: "10px",
                    background: filterMissingImages ? "#f59e0b" : isC1 ? "#cbd5e1" : "rgba(255, 255, 255, 0.2)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: "11px",
                      height: "11px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      position: "absolute",
                      top: "2px",
                      left: filterMissingImages ? "13px" : "2px",
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  />
                </div>
                <ImageOff size={14} color={filterMissingImages ? (isC1 ? "#b45309" : "#fbbf24") : "#64748b"} />
                <span>{filterMissingImages ? "Missing Images" : "Reload Missing Images"}</span>
                {overview?.totals?.missing_photos != null && overview.totals.missing_photos > 0 && (
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: filterMissingImages ? "#b45309" : isC1 ? "#e2e8f0" : "rgba(255, 255, 255, 0.1)",
                      color: filterMissingImages ? "#ffffff" : isC1 ? "#475569" : "#94a3b8",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}
                  >
                    {overview.totals.missing_photos.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Toggle to Filter Under 40 (Youth) */}
              <button
                type="button"
                role="switch"
                aria-checked={isUnder40Active}
                onClick={handleToggleUnder40}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 13px",
                  borderRadius: "8px",
                  background: isUnder40Active
                    ? isC1 ? "#ecfdf5" : "rgba(16, 185, 129, 0.18)"
                    : isC1 ? "#f8fafc" : "rgba(15, 23, 42, 0.8)",
                  border: isUnder40Active
                    ? isC1 ? "1px solid #10b981" : "1px solid rgba(52, 211, 153, 0.55)"
                    : isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  color: isUnder40Active ? (isC1 ? "#047857" : "#34d399") : (isC1 ? "#334155" : "#cbd5e1"),
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isUnder40Active ? "0 0 10px rgba(16, 185, 129, 0.25)" : "none",
                }}
                title={
                  isUnder40Active
                    ? "Under 40 (Youth) filter active. Click to show all age cohorts."
                    : "Toggle to filter executives strictly under 40 as at 21st August 2026"
                }
              >
                {/* Visual switch indicator */}
                <div
                  style={{
                    width: "26px",
                    height: "15px",
                    borderRadius: "10px",
                    background: isUnder40Active ? "#10b981" : isC1 ? "#cbd5e1" : "rgba(255, 255, 255, 0.2)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: "11px",
                      height: "11px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      position: "absolute",
                      top: "2px",
                      left: isUnder40Active ? "13px" : "2px",
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  />
                </div>
                <Sparkles size={14} color={isUnder40Active ? (isC1 ? "#059669" : "#34d399") : "#64748b"} />
                <span>Under 40</span>
                {overview?.totals?.under_40 != null && (
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: isUnder40Active ? "#047857" : isC1 ? "#e2e8f0" : "rgba(255, 255, 255, 0.1)",
                      color: isUnder40Active ? "#ffffff" : isC1 ? "#475569" : "#94a3b8",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}
                  >
                    {overview.totals.under_40.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Reload Full Data Button */}
              <button
                type="button"
                onClick={handleReloadFullData}
                disabled={reloadingFullData}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  background: reloadingFullData
                    ? isC1 ? "#eff6ff" : "rgba(59, 130, 246, 0.2)"
                    : isC1 ? "#f8fafc" : "rgba(30, 41, 59, 0.8)",
                  border: isC1 ? "1px solid #bfdbfe" : "1px solid rgba(59, 130, 246, 0.35)",
                  color: isC1 ? "#1d4ed8" : "#93c5fd",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: reloadingFullData ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isC1 ? "0 1px 2px rgba(0, 0, 0, 0.05)" : "0 2px 6px rgba(0, 0, 0, 0.2)",
                  opacity: reloadingFullData ? 0.75 : 1,
                }}
                title="Reload full roster data and overview statistics directly from the database"
              >
                <RotateCw
                  size={14}
                  color={isC1 ? "#2563eb" : "#60a5fa"}
                  style={{
                    animation: reloadingFullData ? "spin 1s linear infinite" : undefined,
                  }}
                />
                <span>{reloadingFullData ? "Reloading..." : "Reload Full Data"}</span>
              </button>

              {fullReloadToast && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    background: isC1 ? "#ecfdf5" : "rgba(16, 185, 129, 0.15)",
                    border: isC1 ? "1px solid #a7f3d0" : "1px solid rgba(16, 185, 129, 0.35)",
                    color: isC1 ? "#047857" : "#34d399",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  <CheckCircle2 size={13} color={isC1 ? "#059669" : "#34d399"} />
                  <span>{fullReloadToast}</span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="dash-filters-row">
            {/* Level Filter Dropdown */}
            <select
              className="dash-filter-select"
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
              <option value="">{isC1 ? "All Electoral College Levels" : "All Levels"}</option>
              <option value="National">National Level</option>
              <option value="Region">Regional Level</option>
              <option value="Constituency">Constituency Level</option>
              <option value="External Branch">External Branch Level</option>
              {!isC1 && <option value="Electoral Area">Electoral Area Level</option>}
              {!isC1 && <option value="Polling Station">Polling Station Level</option>}
              <option value="TESCON">TESCON Level</option>
            </select>

            {/* Region ➔ Constituency / TESCON Institution Tied Cluster */}
            <div className="dash-region-cluster" style={{
              border: (selectedRegion || (selectedLevel === "TESCON" && selectedInstitution)) ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)"
            }}>
              {/* Region Dropdown */}
              <select
                className="dash-filter-select"
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedConstituency("");
                  setSelectedInstitution("");
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
                <option value="">All Regions</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <div className="dash-region-arrow" style={{ display: "flex", alignItems: "center" }}>
                <ArrowRight size={13} color={(selectedRegion || (selectedLevel === "TESCON" && selectedInstitution)) ? "#10b981" : "#64748b"} />
              </div>

              {/* Dynamic Branch: TESCON Institutions Dropdown vs Constituency Dropdown */}
              {selectedLevel === "TESCON" ? (
                <select
                  className="dash-filter-select"
                  value={selectedInstitution}
                  onChange={(e) => {
                    setSelectedInstitution(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: "6px",
                    background: selectedInstitution ? "rgba(16, 185, 129, 0.18)" : selectedRegion ? "rgba(2, 6, 23, 0.85)" : "rgba(15, 23, 42, 0.5)",
                    border: selectedInstitution
                      ? "1.5px solid #10b981"
                      : selectedRegion
                      ? "1px solid rgba(52, 211, 153, 0.35)"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    color: selectedInstitution ? "#34d399" : "#ffffff",
                    fontSize: "13px",
                    fontWeight: selectedInstitution ? "600" : "normal",
                    outline: "none",
                    cursor: "pointer",
                    maxWidth: "340px",
                    transition: "all 0.15s ease",
                    boxShadow: selectedInstitution ? "0 0 10px rgba(16, 185, 129, 0.25)" : "none"
                  }}
                  title={selectedInstitution ? `Active Institution: ${selectedInstitution}` : "Select TESCON Institution"}
                >
                  {loadingInstitutions ? (
                    <option value="">
                      {selectedRegion
                        ? `Loading ${selectedRegion} TESCON institutions…`
                        : "Loading TESCON institutions…"}
                    </option>
                  ) : (
                    <>
                      <option value="">
                        {selectedRegion
                          ? `🏛️ All ${selectedRegion} Institutions (${tesconInstitutions.length})`
                          : `🏛️ All Nationwide Institutions (${tesconInstitutions.length || 253})`}
                      </option>
                      {tesconInstitutions.map((inst) => (
                        <option key={inst} value={inst}>{inst}</option>
                      ))}
                    </>
                  )}
                </select>
              ) : (
                /* Constituency Filter Dropdown (Strictly Tied to Region) */
                <select
                  className="dash-filter-select"
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
                    <option value="">
                      {selectedRegion === "External Branch"
                        ? "Loading External Branch countries…"
                        : `Loading ${selectedRegion} constituencies…`}
                    </option>
                  ) : (
                    <>
                      <option value="">
                        {selectedRegion === "External Branch"
                          ? `All Countries / Branches (${constituencyList.length})`
                          : `All ${selectedRegion} Constituencies (${constituencyList.length})`}
                      </option>
                      {constituencyList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </>
                  )}
                </select>
              )}
            </div>

            {/* Position Filter Dropdown */}
            <select
              className="dash-filter-select"
              value={selectedPosition}
              onChange={(e) => {
                setSelectedPosition(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                background: selectedPosition ? "rgba(16, 185, 129, 0.15)" : "rgba(2, 6, 23, 0.8)",
                border: selectedPosition ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.12)",
                color: selectedPosition ? "#34d399" : "#ffffff",
                fontSize: "13px",
                outline: "none",
                cursor: "pointer",
                maxWidth: "230px",
                transition: "all 0.15s ease"
              }}
            >
              <option value="">
                {selectedPosition ? "All Positions" : `All Positions (${positionList.length})`}
              </option>
              {selectedLevel === "National" ? (
                <>
                  <optgroup label="⭐ Directors & Directorate">
                    {positionList
                      .filter((p) => /director|relations officer|legal committee/i.test(p))
                      .map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                  </optgroup>
                  <optgroup label="🏛️ National Council & Elders">
                    {positionList
                      .filter((p) => /council|elder|patron|foundation/i.test(p))
                      .map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                  </optgroup>
                  <optgroup label="👑 Executive Leadership & Dignitaries">
                    {positionList
                      .filter(
                        (p) =>
                          !/director|relations officer|legal committee|council|elder|patron|foundation/i.test(p) &&
                          /president|flagbearer|running mate|chair|secretary|treasurer|organiser|organizer/i.test(p) &&
                          !/women|youth|nasara/i.test(p)
                      )
                      .map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                  </optgroup>
                  <optgroup label="🦅 Wings & Other National Positions">
                    {positionList
                      .filter(
                        (p) =>
                          !/director|relations officer|legal committee|council|elder|patron|foundation/i.test(p) &&
                          (/women|youth|nasara|parliament|research officer/i.test(p) ||
                            !/president|flagbearer|running mate|chair|secretary|treasurer|organiser|organizer/i.test(p))
                      )
                      .map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                  </optgroup>
                </>
              ) : (
                positionList.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))
              )}
            </select>

            {/* Demographics Cohort Filter */}
            <select
              className="dash-filter-select"
              value={selectedCohort}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCohort(val);
                if (val === "under_40") {
                  setFilterUnder40(true);
                } else if (filterUnder40 && val !== "under_40") {
                  setFilterUnder40(false);
                }
                setPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                background: selectedCohort ? "rgba(16, 185, 129, 0.15)" : "rgba(2, 6, 23, 0.8)",
                border: selectedCohort ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.12)",
                color: selectedCohort ? "#34d399" : "#ffffff",
                fontSize: "13px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="">Demographics: All</option>
              <option value="under_40">Under 40 (Youth)</option>
              <option value="women">Women Executives</option>
              <option value="nasara">Nasara Officers</option>
            </select>

            {/* Dedicated Quick Under 40 Button in Filter Row */}
            <button
              type="button"
              onClick={handleToggleUnder40}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 13px",
                borderRadius: "6px",
                background: isUnder40Active
                  ? isC1 ? "#ecfdf5" : "rgba(16, 185, 129, 0.25)"
                  : isC1 ? "#f8fafc" : "rgba(2, 6, 23, 0.8)",
                border: isUnder40Active ? "1.5px solid #10b981" : isC1 ? "1px solid #a7f3d0" : "1px solid rgba(52, 211, 153, 0.4)",
                color: isUnder40Active ? (isC1 ? "#047857" : "#34d399") : (isC1 ? "#059669" : "#a7f3d0"),
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                boxShadow: isUnder40Active ? "0 0 10px rgba(16, 185, 129, 0.3)" : "none"
              }}
              title="Click to toggle Under 40 (Youth) filter"
            >
              <Sparkles size={14} color={isC1 ? "#059669" : "#34d399"} />
              <span>Under 40 {isUnder40Active ? "✓ Active" : ""}</span>
              {overview?.totals?.under_40 != null && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "1px 6px",
                    borderRadius: "8px",
                    background: isUnder40Active ? "#047857" : isC1 ? "#d1fae5" : "rgba(52, 211, 153, 0.2)",
                    color: isUnder40Active ? "#ffffff" : isC1 ? "#065f46" : "#6ee7b7"
                  }}
                >
                  {overview.totals.under_40.toLocaleString()}
                </span>
              )}
            </button>

            {/* Slot Type */}
            <select
              className="dash-filter-select"
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
            {(selectedLevel || selectedRegion || selectedConstituency || selectedInstitution || selectedPosition || selectedCohort || selectedSlot || debouncedSearch || filterMissingImages || filterUnder40) && (
              <button
                className="dash-filter-select"
                onClick={() => {
                  setSelectedLevel("");
                  setSelectedRegion("");
                  setSelectedConstituency("");
                  setSelectedInstitution("");
                  setSelectedPosition("");
                  setSelectedCohort("");
                  setSelectedSlot("");
                  setSearchQuery("");
                  setDebouncedSearch("");
                  setFilterMissingImages(false);
                  setFilterUnder40(false);
                  setPage(1);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
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

            <div className="dash-matches-count">
              Showing <strong>{rows.length.toLocaleString()}</strong> of <strong>{totalRows.toLocaleString()}</strong> matches
            </div>
          </div>
        </section>

        {/* Missing Images Active Notice */}
        {filterMissingImages && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 18px",
              borderRadius: "8px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              color: "#fbbf24",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ImageOff size={18} color="#fbbf24" />
              <div>
                <span style={{ fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Missing Images Filter Active:
                </span>{" "}
                <span style={{ color: "#fef3c7" }}>
                  Displaying executives whose portraits are missing, unmigrated, or pending reload.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  clearBrokenPhotoCache();
                  setRosterImageReloadKey(Date.now());
                  setFullReloadToast("Retrying all visible portraits with fresh cache...");
                  setTimeout(() => setFullReloadToast(""), 3000);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(245, 158, 11, 0.25)",
                  border: "1px solid rgba(245, 158, 11, 0.5)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <RotateCw size={13} color="#fef3c7" />
                <span>Force Retry Photos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMissingImages(false);
                  setPage(1);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fde68a",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Show All Executives
              </button>
            </div>
          </div>
        )}

        {/* Executive Roster Grid Table with 'Level' Column and Action Buttons */}
        <section style={{
          background: isC1 ? "#ffffff" : "rgba(15, 23, 42, 0.8)",
          borderRadius: "12px",
          border: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: isC1 ? "0 1px 3px rgba(0, 0, 0, 0.05)" : "none",
          overflow: "hidden"
        }}>
          <div className="dash-scroll-hint">
            <span>👉</span>
            <span>Swipe horizontally to view all columns (Age, Date of Birth, Phone, Region, Constituency, etc.)</span>
          </div>
          <div className="dash-table-wrapper">
            <Table className="dash-table w-full">
              <TableHeader>
                <TableRow style={{
                  background: isC1 ? "#f8fafc" : "rgba(30, 41, 59, 0.8)",
                  borderBottom: isC1 ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)",
                  color: isC1 ? "#475569" : "#94a3b8",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  <TableHead style={{ padding: "12px 14px", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Voter ID</TableHead>
                  <TableHead style={{ padding: "12px 14px", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Name</TableHead>
                  <TableHead style={{ padding: "12px 14px", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Age / DOB</TableHead>
                  <TableHead style={{ padding: "12px 14px", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Phone / Gender</TableHead>
                  <TableHead style={{ padding: "12px 14px", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Region</TableHead>
                  <TableHead style={{ padding: "12px 14px", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Constituency</TableHead>
                  <TableHead style={{ padding: "12px 14px", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Level</TableHead>
                  <TableHead style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap", color: isC1 ? "#475569" : "#94a3b8" }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRows ? (
                  <TableRow>
                    <TableCell colSpan={8} style={{ textAlign: "center", padding: "48px", color: isC1 ? "#64748b" : "#94a3b8" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                        <Loader2 size={24} color={isC1 ? "#64748b" : "#94a3b8"} style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                      Querying ec-data PostgreSQL database…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} style={{ textAlign: "center", padding: "48px", color: "#64748b" }}>
                      No executive records found matching your filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isTesconRow = String(row.executiveLevel || "").toUpperCase() === "TESCON";
                    const unitDetail = isTesconRow && row.pollingStation
                      ? normalizeTesconInstitution(row.pollingStation, row.region, row.constituency, row.id)
                      : row.pollingStation || row.electoralArea;

                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => handleOpenModal(row.id)}
                        style={{
                          borderBottom: isC1 ? "1px solid #f1f5f9" : "1px solid rgba(255, 255, 255, 0.04)",
                          transition: "background 0.15s ease",
                          cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isC1 ? "#f8fafc" : "rgba(255, 255, 255, 0.03)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        {/* 1. Voter ID */}
                        <TableCell style={{ padding: "12px 16px", fontFamily: "monospace", color: isC1 ? "#334155" : "#cbd5e1", whiteSpace: "nowrap" }}>
                          {row.voterId ? (
                            <span style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isC1 ? "#eff6ff" : "rgba(59, 130, 246, 0.1)",
                              border: isC1 ? "1px solid #bfdbfe" : "1px solid rgba(59, 130, 246, 0.2)",
                              color: isC1 ? "#1d4ed8" : "#93c5fd",
                              fontSize: "12px"
                            }}>
                              {row.voterId}
                            </span>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </TableCell>

                        {/* 2. Name & Position */}
                        <TableCell style={{ padding: "10px 16px", color: isC1 ? "#0f172a" : "#ffffff", fontWeight: "600" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ position: "relative", flexShrink: 0 }} title="Click row to view or update executive profile & photo">
                              <ExecutiveAvatar
                                imageUrl={row.imageUrl}
                                name={row.executiveName}
                                voterId={row.voterId}
                                region={row.region}
                                constituency={row.constituency}
                                size={40}
                                reloadKey={rosterImageReloadKey}
                              />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                              <span style={{ color: isC1 ? "#0f172a" : "#ffffff", fontWeight: 600 }}>{row.executiveName}</span>
                              {row.position && (
                                <div style={{ fontSize: "11px", color: isC1 ? "#be185d" : "#60a5fa", marginTop: "2px", fontWeight: "500" }}>
                                  {row.position}
                                </div>
                              )}
                              {(row.proxyAssignment || row.actingAsProxyFor) && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                  {row.proxyAssignment && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenProxyModal(row);
                                      }}
                                      title={`Proxy assigned to ${row.proxyAssignment.proxyName} (${row.proxyAssignment.proxyVoterId || "No Voter ID"}). Click to view proxy details.`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        background: isC1 ? "#f3e8ff" : "rgba(168, 85, 247, 0.16)",
                                        border: isC1 ? "1px solid #d8b4fe" : "1px solid rgba(168, 85, 247, 0.38)",
                                        color: isC1 ? "#7e22ce" : "#d8b4fe",
                                        fontSize: "10px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <UserCheck size={10} color={isC1 ? "#7e22ce" : "#c084fc"} />
                                      <span>Proxy: {row.proxyAssignment.proxyName}</span>
                                    </span>
                                  )}
                                  {row.actingAsProxyFor && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenProxyModal(row);
                                      }}
                                      title={`Acting as proxy voter for ${row.actingAsProxyFor.principalName} (${row.actingAsProxyFor.principalVoterId || "No Voter ID"})`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        background: isC1 ? "#e0f2fe" : "rgba(14, 165, 233, 0.15)",
                                        border: isC1 ? "1px solid #bae6fd" : "1px solid rgba(14, 165, 233, 0.35)",
                                        color: isC1 ? "#0369a1" : "#7dd3fc",
                                        fontSize: "10px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Vote size={10} color={isC1 ? "#0284c7" : "#38bdf8"} />
                                      <span>Voting for: {row.actingAsProxyFor.principalName}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* 3. Age & Date of Birth */}
                        <TableCell style={{ padding: "10px 14px", color: isC1 ? "#334155" : "#cbd5e1", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {row.age != null && row.age > 0 ? (
                                <span style={{
                                  padding: "2px 7px",
                                  borderRadius: "4px",
                                  background: isC1 ? "#f1f5f9" : "rgba(255, 255, 255, 0.06)",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  color: isC1 ? "#1e293b" : "#e2e8f0"
                                }}>
                                  {row.age} yrs
                                </span>
                              ) : (
                                <span style={{ color: "#64748b" }}>—</span>
                              )}
                              {isUnder40AsOfCutoff(row.dateOfBirth, row.age) && (
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: isC1 ? "#d1fae5" : "rgba(52, 211, 153, 0.15)",
                                    border: isC1 ? "1px solid #6ee7b7" : "1px solid rgba(52, 211, 153, 0.3)",
                                    color: isC1 ? "#047857" : "#34d399",
                                    fontSize: "10px",
                                    fontWeight: "700",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px"
                                  }}
                                  title="Under 40 as at 21st August 2026"
                                >
                                  <Sparkles size={10} color={isC1 ? "#059669" : "#34d399"} />
                                  <span>&lt; 40</span>
                                </span>
                              )}
                            </div>
                            {row.dateOfBirth && (
                              <span style={{ fontSize: "11px", color: isC1 ? "#64748b" : "#94a3b8", fontFamily: "monospace" }}>
                                {row.dateOfBirth}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 4. Phone & Gender */}
                        <TableCell style={{ padding: "10px 14px", color: isC1 ? "#334155" : "#cbd5e1", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            {row.phone ? (
                              <a
                                href={`tel:${row.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: isC1 ? "#0284c7" : "#38bdf8",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  fontSize: "12px",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                              >
                                <Phone size={12} style={{ opacity: 0.8 }} />
                                <span>{row.phone}</span>
                              </a>
                            ) : (
                              <span style={{ color: "#64748b", fontSize: "12px" }}>—</span>
                            )}
                            {row.gender && row.gender.trim() !== "" ? (
                              <div style={{ display: "inline-flex", alignItems: "center" }}>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 500,
                                    color:
                                      row.gender.toLowerCase() === "female"
                                        ? isC1 ? "#be185d" : "#f472b6"
                                        : row.gender.toLowerCase() === "male"
                                        ? isC1 ? "#1d4ed8" : "#60a5fa"
                                        : isC1 ? "#475569" : "#94a3b8",
                                    backgroundColor:
                                      row.gender.toLowerCase() === "female"
                                        ? isC1 ? "#fdf2f8" : "rgba(244, 114, 182, 0.12)"
                                        : row.gender.toLowerCase() === "male"
                                        ? isC1 ? "#eff6ff" : "rgba(96, 165, 250, 0.12)"
                                        : isC1 ? "#f1f5f9" : "rgba(148, 163, 184, 0.1)",
                                    border:
                                      row.gender.toLowerCase() === "female"
                                        ? isC1 ? "1px solid #fbcfe8" : "1px solid rgba(244, 114, 182, 0.25)"
                                        : row.gender.toLowerCase() === "male"
                                        ? isC1 ? "1px solid #bfdbfe" : "1px solid rgba(96, 165, 250, 0.25)"
                                        : isC1 ? "1px solid #cbd5e1" : "1px solid rgba(148, 163, 184, 0.2)",
                                    borderRadius: "4px",
                                    padding: "1px 6px",
                                    textTransform: "capitalize",
                                    lineHeight: "1.3",
                                    display: "inline-block",
                                  }}
                                >
                                  {row.gender}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* 5. Region */}
                        <TableCell style={{ padding: "12px 14px", color: isC1 ? "#334155" : "#cbd5e1", whiteSpace: "nowrap" }}>
                          {row.region ? normalizeRegionName(row.region) : "—"}
                        </TableCell>

                        {/* 6. Constituency */}
                        <TableCell style={{ padding: "12px 14px", color: isC1 ? "#1e293b" : "#cbd5e1", fontWeight: "500", whiteSpace: "nowrap" }}>
                          {row.constituency
                            ? normalizeRegionName(row.region) === "External Branch"
                              ? row.constituency
                              : normalizeConstituency(row.constituency)
                            : "—"}
                        </TableCell>

                        {/* 9. Level */}
                        <TableCell style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{
                              fontSize: "11px",
                              padding: "2px 7px",
                              borderRadius: "5px",
                              fontWeight: "600",
                              width: "fit-content",
                              background: row.executiveLevel === "National" ? (isC1 ? "#f3e8ff" : "rgba(168, 85, 247, 0.2)") :
                                          row.executiveLevel === "Region" ? (isC1 ? "#eff6ff" : "rgba(59, 130, 246, 0.2)") :
                                          row.executiveLevel === "Constituency" ? (isC1 ? "#ecfdf5" : "rgba(16, 185, 129, 0.2)") :
                                          row.executiveLevel === "External Branch" ? (isC1 ? "#ecfeff" : "rgba(6, 182, 212, 0.2)") :
                                          row.executiveLevel === "TESCON" ? (isC1 ? "#fefce8" : "rgba(234, 179, 8, 0.2)") : (isC1 ? "#f1f5f9" : "rgba(148, 163, 184, 0.12)"),
                              color: row.executiveLevel === "National" ? (isC1 ? "#7e22ce" : "#c084fc") :
                                     row.executiveLevel === "Region" ? (isC1 ? "#1d4ed8" : "#60a5fa") :
                                     row.executiveLevel === "Constituency" ? (isC1 ? "#047857" : "#34d399") :
                                     row.executiveLevel === "External Branch" ? (isC1 ? "#0e7490" : "#22d3ee") :
                                     row.executiveLevel === "TESCON" ? (isC1 ? "#a16207" : "#facc15") : (isC1 ? "#475569" : "#cbd5e1")
                            }}>
                              {row.executiveLevel}
                            </span>
                            {unitDetail && (
                              <span style={{ fontSize: "11px", color: isC1 ? "#64748b" : "#94a3b8" }}>
                                {unitDetail}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions (Always visible: Proxy + View/Edit + Delete) */}
                        <TableCell style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProxyModal(row);
                              }}
                              title={
                                row.proxyAssignment
                                  ? `Proxy Assigned: ${row.proxyAssignment.proxyName} — Click to view proxy voter details`
                                  : "Assign Proxy Voter"
                              }
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                background: row.proxyAssignment
                                  ? isC1 ? "#f3e8ff" : "rgba(168, 85, 247, 0.18)"
                                  : isC1 ? "#eef2ff" : "rgba(99, 102, 241, 0.12)",
                                border: row.proxyAssignment
                                  ? isC1 ? "1px solid #d8b4fe" : "1px solid rgba(168, 85, 247, 0.45)"
                                  : isC1 ? "1px solid #c7d2fe" : "1px solid rgba(99, 102, 241, 0.3)",
                                color: row.proxyAssignment ? (isC1 ? "#7e22ce" : "#e9d5ff") : (isC1 ? "#4338ca" : "#a5b4fc"),
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <UserCheck
                                size={12}
                                color={row.proxyAssignment ? (isC1 ? "#7e22ce" : "#c084fc") : (isC1 ? "#4f46e5" : "#818cf8")}
                              />
                              <span>{row.proxyAssignment ? "Proxy Assigned" : "Proxy"}</span>
                            </button>

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
                                background: isC1 ? "#f8fafc" : "rgba(255, 255, 255, 0.06)",
                                border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.12)",
                                color: isC1 ? "#334155" : "#cbd5e1",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Pencil size={12} color={isC1 ? "#64748b" : "#94a3b8"} />
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
                                background: isC1 ? "#fef2f2" : "rgba(239, 68, 68, 0.12)",
                                border: isC1 ? "1px solid #fecaca" : "1px solid rgba(239, 68, 68, 0.25)",
                                color: isC1 ? "#dc2626" : "#f87171",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Trash2 size={12} color={isC1 ? "#dc2626" : "#f87171"} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls Footer */}
          <div className="dash-pagination">
            <div className="dash-pagination-left">
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
                  background: isC1 ? "#ffffff" : "rgba(2, 6, 23, 0.8)",
                  border: isC1 ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.12)",
                  color: isC1 ? "#0f172a" : "#ffffff",
                  fontSize: "12px"
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="dash-pagination-right">
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
                  background: page <= 1 ? (isC1 ? "#f8fafc" : "rgba(255, 255, 255, 0.03)") : (isC1 ? "#ffffff" : "rgba(255, 255, 255, 0.1)"),
                  color: page <= 1 ? (isC1 ? "#94a3b8" : "#475569") : (isC1 ? "#0f172a" : "#ffffff"),
                  border: isC1 ? "1px solid #cbd5e1" : "none",
                  cursor: page <= 1 ? "not-allowed" : "pointer"
                }}
              >
                <ChevronLeft size={14} color={page <= 1 ? (isC1 ? "#94a3b8" : "#475569") : (isC1 ? "#475569" : "#94a3b8")} /> Previous
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
                  background: page >= totalPages ? (isC1 ? "#f8fafc" : "rgba(255, 255, 255, 0.03)") : (isC1 ? "#ffffff" : "rgba(255, 255, 255, 0.1)"),
                  color: page >= totalPages ? (isC1 ? "#94a3b8" : "#475569") : (isC1 ? "#0f172a" : "#ffffff"),
                  border: isC1 ? "1px solid #cbd5e1" : "none",
                  cursor: page >= totalPages ? "not-allowed" : "pointer"
                }}
              >
                Next <ChevronRight size={14} color={page >= totalPages ? (isC1 ? "#94a3b8" : "#475569") : (isC1 ? "#475569" : "#94a3b8")} />
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
          className="dash-modal-overlay"
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
            className="dash-modal-container"
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
              className="dash-modal-header"
              style={{
                padding: "20px 28px",
                background: "rgba(30, 41, 59, 0.7)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {activeExecutive && (
                  <ExecutiveAvatar
                    imageUrl={activeExecutive.imageUrl}
                    name={activeExecutive.executiveName}
                    voterId={activeExecutive.voterId}
                    region={activeExecutive.region}
                    constituency={activeExecutive.constituency}
                    size={48}
                    reloadKey={rosterImageReloadKey}
                  />
                )}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
            <div className="dash-modal-body" style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
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
                      Voter ID Search (Auto-Fill & Verification)
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        value={editSearchVoterId}
                        onChange={(e) => setEditSearchVoterId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleEditSearchVoter();
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
                        onClick={handleEditSearchVoter}
                        disabled={editSearchingVoter || !editSearchVoterId.trim()}
                        style={{
                          padding: "9px 18px",
                          borderRadius: "6px",
                          background: editSearchingVoter ? "#1e293b" : "#2563eb",
                          border: "none",
                          color: "#ffffff",
                          fontSize: "13px",
                          fontWeight: "600",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: editSearchingVoter || !editSearchVoterId.trim() ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {editSearchingVoter ? (
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

                    {editVoterSearchStatus && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          background: editVoterSearchStatus.found ? "rgba(16, 185, 129, 0.15)" : "rgba(234, 179, 8, 0.15)",
                          border: `1px solid ${editVoterSearchStatus.found ? "rgba(16, 185, 129, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
                          color: editVoterSearchStatus.found ? "#34d399" : "#facc15",
                        }}
                      >
                        {editVoterSearchStatus.found ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        <span>{editVoterSearchStatus.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Profile Photo (URL or File Upload) */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "10px",
                      padding: "16px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "#38bdf8",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <ImageIcon size={15} />
                        <span>Profile Photo (URL or File Upload)</span>
                      </div>
                      {(() => {
                        const badge = getPhotoSourceBadge(activeExecutive.imageUrl);
                        if (!badge) return null;
                        return (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              color: badge.color,
                              background: badge.bg,
                              border: `1px solid ${badge.border}`,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <CheckCircle2 size={12} />
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>

                    {editImageSuccess && (
                      <div
                        style={{
                          padding: "8px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          background: "rgba(16, 185, 129, 0.15)",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                          color: "#34d399",
                          marginBottom: "12px",
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>{editImageSuccess}</span>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Live Avatar Preview with Camera Overlay & Drag-Drop */}
                      <label
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!editUploadingImage) setEditDraggingImage(true);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!editUploadingImage) setEditDraggingImage(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditDraggingImage(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditDraggingImage(false);
                          if (editUploadingImage) return;
                          const file = e.dataTransfer.files?.[0];
                          if (file) processEditImageFile(file);
                        }}
                        style={{
                          position: "relative",
                          flexShrink: 0,
                          cursor: editUploadingImage ? "not-allowed" : "pointer",
                          borderRadius: "50%",
                          overflow: "hidden",
                          display: "inline-block",
                          outline: editDraggingImage ? "3px solid #38bdf8" : "none",
                          boxShadow: editDraggingImage ? "0 0 16px rgba(56, 189, 248, 0.6)" : "none",
                          transition: "all 0.15s ease",
                        }}
                        title="Click or drag & drop a photo file here"
                      >
                        <ExecutiveAvatar
                          imageUrl={activeExecutive.imageUrl}
                          name={activeExecutive.executiveName}
                          voterId={activeExecutive.voterId}
                          region={activeExecutive.region}
                          constituency={activeExecutive.constituency}
                          size={64}
                          reloadKey={editAvatarReloadKey}
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0, 0, 0, 0.45)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0,
                            transition: "opacity 0.15s ease",
                            color: "#ffffff",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                        >
                          <Camera size={18} />
                          <span style={{ fontSize: "9px", fontWeight: "600", marginTop: "2px" }}>Upload</span>
                        </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={editUploadingImage}
                          onChange={handleEditImageUpload}
                          style={{ display: "none" }}
                        />
                      </label>

                      {/* Controls: URL and File Upload */}
                      <div style={{ flex: 1, minWidth: "240px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "11px",
                              fontWeight: "600",
                              color: "#94a3b8",
                              marginBottom: "4px",
                            }}
                          >
                            Image URL or Party CDN Address
                          </label>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <input
                              type="text"
                              value={activeExecutive.imageUrl || ""}
                              onChange={(e) => handleFieldChange("imageUrl", e.target.value)}
                              placeholder="https://cms.newpatrioticparty.org/... or https://..."
                              style={{
                                flex: 1,
                                minWidth: "180px",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                background: "rgba(2, 6, 23, 0.8)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                color: "#ffffff",
                                fontSize: "12px",
                              }}
                            />
                            {activeExecutive.imageUrl && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditAvatarReloadKey(Date.now());
                                    setReloadingEditPhoto(true);
                                    setTimeout(() => setReloadingEditPhoto(false), 1200);
                                  }}
                                  title="Reload and renew photo from server"
                                  style={{
                                    padding: "8px 10px",
                                    borderRadius: "6px",
                                    background: "rgba(255, 255, 255, 0.08)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    color: reloadingEditPhoto ? "#60a5fa" : "#cbd5e1",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <RotateCw
                                    size={13}
                                    style={{ animation: reloadingEditPhoto ? "spin 1s linear infinite" : "none" }}
                                  />
                                  <span>{reloadingEditPhoto ? "Reloading…" : "Reload"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(activeExecutive.imageUrl || "");
                                    setCopiedPhotoUrl(true);
                                    setTimeout(() => setCopiedPhotoUrl(false), 2000);
                                  }}
                                  title="Copy image link"
                                  style={{
                                    padding: "8px 10px",
                                    borderRadius: "6px",
                                    background: "rgba(255, 255, 255, 0.08)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    color: copiedPhotoUrl ? "#34d399" : "#cbd5e1",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {copiedPhotoUrl ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                  <span>{copiedPhotoUrl ? "Copied" : "Copy"}</span>
                                </button>
                                <a
                                  href={activeExecutive.imageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View full image in new tab"
                                  style={{
                                    padding: "8px 10px",
                                    borderRadius: "6px",
                                    background: "rgba(255, 255, 255, 0.08)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    color: "#cbd5e1",
                                    fontSize: "12px",
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <ExternalLink size={13} />
                                  <span>View</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange("imageUrl", "")}
                                  title="Remove photo"
                                  style={{
                                    padding: "8px 10px",
                                    borderRadius: "6px",
                                    background: "rgba(239, 68, 68, 0.15)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    color: "#f87171",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Clear
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Drag and Drop Upload Zone */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!editUploadingImage) setEditDraggingImage(true);
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!editUploadingImage) setEditDraggingImage(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditDraggingImage(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditDraggingImage(false);
                            if (editUploadingImage) return;
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              processEditImageFile(file);
                            }
                          }}
                          onClick={() => {
                            if (!editUploadingImage) editFileInputRef.current?.click();
                          }}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "14px 18px",
                            borderRadius: "8px",
                            border: editDraggingImage
                              ? "2px dashed #38bdf8"
                              : "1.5px dashed rgba(255, 255, 255, 0.2)",
                            background: editDraggingImage
                              ? "rgba(56, 189, 248, 0.12)"
                              : "rgba(2, 6, 23, 0.4)",
                            cursor: editUploadingImage ? "not-allowed" : "pointer",
                            transition: "all 0.18s ease",
                            textAlign: "center",
                            gap: "5px",
                          }}
                        >
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={editUploadingImage}
                            onChange={handleEditImageUpload}
                            style={{ display: "none" }}
                          />
                          {editUploadingImage ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontSize: "12px", fontWeight: "600" }}>
                              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                              <span>Converting to WebP & Uploading to Party CDN…</span>
                            </div>
                          ) : editDraggingImage ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontSize: "13px", fontWeight: "600" }}>
                              <Upload size={16} />
                              <span>Drop photo here to upload immediately</span>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#e2e8f0", fontSize: "12px" }}>
                                <Upload size={14} style={{ color: "#38bdf8" }} />
                                <span>
                                  <strong style={{ color: "#38bdf8" }}>Drag & drop</strong> photo here, or <span style={{ textDecoration: "underline", color: "#60a5fa" }}>browse files</span>
                                </span>
                              </div>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                JPEG, PNG or WEBP (Max 8MB). Automatically converted to WebP on Party CDN.
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

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
                      className="dash-modal-grid-2"
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
                          <option value="External Branch">External Branch Level</option>
                          <option value="Electoral Area">Electoral Area Level</option>
                          <option value="Polling Station">Polling Station Level</option>
                          <option value="TESCON">TESCON Level</option>
                        </select>
                      </div>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                          <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600" }}>
                            Position / Role ({activeExecutive.executiveLevel || "Executive"}) *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !isEditCustomPosition;
                              setIsEditCustomPosition(nextState);
                              if (!nextState) {
                                const norm = normalizeLevelKey(activeExecutive.executiveLevel);
                                const valid = editPositionList.length > 0 ? editPositionList : (POSITIONS_BY_LEVEL[norm] || []);
                                if (!valid.includes(activeExecutive.position || "")) {
                                  handleFieldChange("position", valid[0] || "");
                                }
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
                            {isEditCustomPosition ? "← Select standard position" : "+ Other position"}
                          </button>
                        </div>

                        {isEditCustomPosition ? (
                          <input
                            type="text"
                            required
                            value={activeExecutive.position || ""}
                            onChange={(e) => handleFieldChange("position", e.target.value)}
                            placeholder={`Enter custom ${activeExecutive.executiveLevel || ""} position…`}
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
                            value={activeExecutive.position || ""}
                            onChange={(e) => {
                              if (e.target.value === "__custom__") {
                                setIsEditCustomPosition(true);
                              } else {
                                handleFieldChange("position", e.target.value);
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
                            <option value="">
                              {loadingEditPositions
                                ? `Loading ${activeExecutive.executiveLevel || "Executive"} Positions…`
                                : `-- Select ${activeExecutive.executiveLevel || "Executive"} Position --`}
                            </option>
                            {activeExecutive.position &&
                              !editPositionList.includes(activeExecutive.position) && (
                                <option value={activeExecutive.position}>{activeExecutive.position}</option>
                              )}
                            {editPositionList.map((pos) => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                            <option value="__custom__">+ Other / Custom position…</option>
                          </select>
                        )}
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
                      className="dash-modal-grid-2"
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
                          {activeExecutive.region === "External Branch" ? "Country (External Branch)" : "Constituency"} {loadingEditConstituencies ? "(Loading...)" : ""}
                        </label>
                        {editConstituencyList.length > 0 ? (
                          <select
                            value={activeExecutive.constituency || ""}
                            onChange={(e) => handleFieldChange("constituency", e.target.value)}
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
                            <option value="">{activeExecutive.region === "External Branch" ? "Select Country" : "Select Constituency"}</option>
                            {activeExecutive.constituency && !editConstituencyList.includes(activeExecutive.constituency) && (
                              <option value={activeExecutive.constituency}>{activeExecutive.constituency}</option>
                            )}
                            {editConstituencyList.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={activeExecutive.constituency || ""}
                            onChange={(e) => handleFieldChange("constituency", e.target.value)}
                            placeholder={activeExecutive.region === "External Branch" ? "e.g. United Kingdom" : "e.g. ABLEKUMA WEST"}
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
                          {activeExecutive.executiveLevel === "TESCON" ? "Institution (TESCON Tertiary Campus)" : "Polling Station"}
                        </label>
                        {activeExecutive.executiveLevel === "TESCON" ? (
                          <select
                            value={activeExecutive.pollingStation || ""}
                            onChange={(e) => handleFieldChange("pollingStation", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "9px 12px",
                              borderRadius: "6px",
                              background: "rgba(2, 6, 23, 0.8)",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                              color: "#ffffff",
                              fontSize: "13px",
                              boxSizing: "border-box",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            <option value="">Select Accredited TESCON Institution</option>
                            {activeExecutive.pollingStation &&
                              !getTesconInstitutionsForRegion(activeExecutive.region).includes(activeExecutive.pollingStation) && (
                                <option value={activeExecutive.pollingStation}>
                                  {activeExecutive.pollingStation} (Current Record)
                                </option>
                              )}
                            {getTesconInstitutionsForRegion(activeExecutive.region).map((inst) => (
                              <option key={inst} value={inst}>{inst}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={activeExecutive.pollingStation || ""}
                            onChange={(e) => handleFieldChange("pollingStation", e.target.value)}
                            placeholder="e.g. D/A Primary School"
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
                      className="dash-modal-grid-2"
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
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{activeExecutive.age !== null ? `${activeExecutive.age} years` : "—"}</span>
                          {activeExecutive.position &&
                            /youth/i.test(activeExecutive.position) &&
                            activeExecutive.age === 39 &&
                            !/external\s*branch/i.test(activeExecutive.executiveLevel || "") &&
                            !/external\s*branch/i.test(activeExecutive.region || "") && (
                            <span style={{ fontSize: "11px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "1px 6px", borderRadius: "4px" }}>
                              Youth Quota Capped (&le;39)
                            </span>
                          )}
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
                      className="dash-modal-grid-2"
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
              className="dash-modal-footer"
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
          className="dash-modal-overlay"
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
            className="dash-modal-container"
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

            <div
              className="dash-modal-footer"
              style={{
                padding: "14px 24px",
                background: "rgba(30, 41, 59, 0.6)",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px"
              }}
            >
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

      {/* Super User Deleted Voters & Revert Modal */}
      {deletedModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="dash-modal-overlay"
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
          onClick={handleCloseDeletedModal}
        >
          <div
            className="dash-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "1050px",
              maxHeight: "90vh",
              background: "#0f172a",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "14px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(30, 41, 59, 0.5)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    padding: "9px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                  }}
                >
                  <Archive size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#f8fafc" }}>
                    Deleted Voters &amp; Executives Archive (Super User Revert)
                  </h3>
                  <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    Review deleted records and restore them back into the active register with their exact original details.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDeletedModal}
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

            {/* Search & Status Bar */}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search deleted voter by name, voter ID, constituency, or phone…"
                  value={deletedSearch}
                  onChange={(e) => {
                    setDeletedSearch(e.target.value);
                    fetchDeletedRecords(e.target.value);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    borderRadius: "6px",
                    background: "rgba(2, 6, 23, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => fetchDeletedRecords(deletedSearch)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RotateCw size={13} />
                Refresh
              </button>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Total in Archive: <strong style={{ color: "#f8fafc" }}>{deletedTotal}</strong>
              </div>
            </div>

            {/* Notification Banner */}
            {revertMessage && (
              <div
                style={{
                  margin: "12px 24px 0 24px",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: revertMessage.startsWith("Restored") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  border: revertMessage.startsWith("Restored") ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                  color: revertMessage.startsWith("Restored") ? "#34d399" : "#fca5a5",
                }}
              >
                {revertMessage.startsWith("Restored") ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{revertMessage}</span>
              </div>
            )}

            {/* Table Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {loadingDeleted ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px auto" }} />
                  Loading deleted records from archive…
                </div>
              ) : deletedRows.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
                  <Archive size={32} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "14px" }}>No deleted voters found in the auxiliary archive.</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>Whenever an executive or voter is deleted, a full backup snapshot is stored here for super-user revert.</p>
                </div>
              ) : (
                <div style={{ borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)", overflow: "hidden" }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: "rgba(30, 41, 59, 0.7)" }}>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px" }}># Orig ID</TableHead>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px" }}>Voter ID</TableHead>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px" }}>Name &amp; Position</TableHead>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px" }}>Level</TableHead>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px" }}>Region / Constituency</TableHead>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px" }}>Deleted When</TableHead>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px" }}>Deleted By</TableHead>
                        <TableHead style={{ color: "#94a3b8", fontSize: "12px", textAlign: "right" }}>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedRows.map((row) => (
                        <TableRow key={row.deletion_id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                          <TableCell style={{ fontSize: "12px", fontFamily: "monospace", color: "#94a3b8" }}>
                            {row.original_id}
                          </TableCell>
                          <TableCell style={{ fontSize: "12px", fontFamily: "monospace", color: "#93c5fd" }}>
                            {row.voter_id || "—"}
                          </TableCell>
                          <TableCell>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ color: "#ffffff", fontWeight: 600, fontSize: "13px" }}>
                                {row.executive_name}
                              </span>
                              <span style={{ color: "#60a5fa", fontSize: "11px", marginTop: "2px" }}>
                                {row.position || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell style={{ fontSize: "12px", color: "#cbd5e1" }}>
                            {row.executive_level || "—"}
                          </TableCell>
                          <TableCell style={{ fontSize: "12px", color: "#cbd5e1" }}>
                            {[row.constituency, row.region].filter(Boolean).join(" / ") || "—"}
                          </TableCell>
                          <TableCell style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                            {row.deleted_at ? new Date(row.deleted_at).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell style={{ fontSize: "12px", color: "#cbd5e1" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span>{row.deleted_by_name || "Admin"}</span>
                              <span style={{ fontSize: "10px", color: "#64748b" }}>{row.deleted_by_role || "ADMIN"}</span>
                            </div>
                          </TableCell>
                          <TableCell style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              disabled={revertingId === row.deletion_id}
                              onClick={() => handleRevert(row.deletion_id, row.executive_name)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                border: "none",
                                color: "#ffffff",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: revertingId === row.deletion_id ? "not-allowed" : "pointer",
                                opacity: revertingId === row.deletion_id ? 0.7 : 1,
                                boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
                              }}
                            >
                              {revertingId === row.deletion_id ? (
                                <>
                                  <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                  <span>Restoring…</span>
                                </>
                              ) : (
                                <>
                                  <Undo2 size={12} />
                                  <span>Revert</span>
                                </>
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.6)",
              }}
            >
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Reverting restores the executive record to the active database with their original IDs, voter details, and quotas.
              </span>
              <button
                type="button"
                onClick={handleCloseDeletedModal}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
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
          className="dash-modal-overlay"
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
            className="dash-modal-container"
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
              className="dash-modal-header"
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
            <div className="dash-modal-body" style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {/* Anti-Bot Honeypot Trap - hidden from human view */}
              <div
                style={{
                  position: "absolute",
                  left: "-9999px",
                  top: "-9999px",
                  opacity: 0,
                  height: 0,
                  width: 0,
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                <label htmlFor="modal_bot_trap_check">Security Verification Token</label>
                <input
                  type="text"
                  id="modal_bot_trap_check"
                  name="modal_bot_trap_check"
                  value={addExecHoneypot}
                  onChange={(e) => setAddExecHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

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

                {voterSearchStatus?.found && newExecName && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.7)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <ExecutiveAvatar
                      imageUrl={newExecImageUrl}
                      name={newExecName}
                      voterId={newExecVoterId}
                      region={newExecRegion}
                      constituency={newExecConstituency}
                      size={44}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc" }}>
                        {newExecName}
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                        <span style={{ color: "#38bdf8", fontFamily: "monospace" }}>Voter ID: {newExecVoterId}</span>
                        {(newExecRegion || newExecConstituency) && (
                          <span style={{ marginLeft: "6px" }}>• {[newExecRegion, newExecConstituency].filter(Boolean).join(" / ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Add Executive Form */}
              <form id="add-executive-form" onSubmit={handleCreateExecutive}>
                {/* Profile Photo (URL or File Upload) */}
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "10px",
                    padding: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#38bdf8",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <ImageIcon size={15} />
                      <span>Profile Photo (URL or File Upload)</span>
                    </div>
                    {(() => {
                      const badge = getPhotoSourceBadge(newExecImageUrl);
                      if (!badge) return null;
                      return (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: badge.color,
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <CheckCircle2 size={12} />
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  {addImageSuccess && (
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        color: "#34d399",
                        marginBottom: "12px",
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>{addImageSuccess}</span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Live Avatar Preview with Camera Overlay & Drag-Drop */}
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!addUploadingImage) setAddDraggingImage(true);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!addUploadingImage) setAddDraggingImage(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAddDraggingImage(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAddDraggingImage(false);
                        if (addUploadingImage) return;
                        const file = e.dataTransfer.files?.[0];
                        if (file) processAddImageFile(file);
                      }}
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        cursor: addUploadingImage ? "not-allowed" : "pointer",
                        borderRadius: "50%",
                        overflow: "hidden",
                        display: "inline-block",
                        outline: addDraggingImage ? "3px solid #38bdf8" : "none",
                        boxShadow: addDraggingImage ? "0 0 16px rgba(56, 189, 248, 0.6)" : "none",
                        transition: "all 0.15s ease",
                      }}
                      title="Click or drag & drop a photo file here"
                    >
                      <ExecutiveAvatar
                        imageUrl={newExecImageUrl}
                        name={newExecName}
                        voterId={newExecVoterId}
                        region={newExecRegion}
                        constituency={newExecConstituency}
                        size={64}
                        reloadKey={addAvatarReloadKey}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0, 0, 0, 0.45)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0,
                          transition: "opacity 0.15s ease",
                          color: "#ffffff",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                      >
                        <Camera size={18} />
                        <span style={{ fontSize: "9px", fontWeight: "600", marginTop: "2px" }}>Upload</span>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={addUploadingImage}
                        onChange={handleAddImageUpload}
                        style={{ display: "none" }}
                      />
                    </label>

                    {/* Controls: URL and File Upload */}
                    <div style={{ flex: 1, minWidth: "240px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#94a3b8",
                            marginBottom: "4px",
                          }}
                        >
                          Image URL or Party CDN Address
                        </label>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <input
                            type="text"
                            value={newExecImageUrl || ""}
                            onChange={(e) => setNewExecImageUrl(e.target.value)}
                            placeholder="https://cms.newpatrioticparty.org/... or https://..."
                            style={{
                              flex: 1,
                              minWidth: "180px",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              background: "rgba(2, 6, 23, 0.8)",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                              color: "#ffffff",
                              fontSize: "12px",
                            }}
                          />
                          {newExecImageUrl && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddAvatarReloadKey(Date.now());
                                  setReloadingAddPhoto(true);
                                  setTimeout(() => setReloadingAddPhoto(false), 1200);
                                }}
                                title="Reload and renew photo from server"
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  background: "rgba(255, 255, 255, 0.08)",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  color: reloadingAddPhoto ? "#60a5fa" : "#cbd5e1",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <RotateCw
                                  size={13}
                                  style={{ animation: reloadingAddPhoto ? "spin 1s linear infinite" : "none" }}
                                />
                                <span>{reloadingAddPhoto ? "Reloading…" : "Reload"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(newExecImageUrl || "");
                                  setCopiedPhotoUrl(true);
                                  setTimeout(() => setCopiedPhotoUrl(false), 2000);
                                }}
                                title="Copy image link"
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  background: "rgba(255, 255, 255, 0.08)",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  color: copiedPhotoUrl ? "#34d399" : "#cbd5e1",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {copiedPhotoUrl ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                <span>{copiedPhotoUrl ? "Copied" : "Copy"}</span>
                              </button>
                              <a
                                href={newExecImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View full image in new tab"
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  background: "rgba(255, 255, 255, 0.08)",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  color: "#cbd5e1",
                                  fontSize: "12px",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <ExternalLink size={13} />
                                <span>View</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => setNewExecImageUrl(null)}
                                title="Remove photo"
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  background: "rgba(239, 68, 68, 0.15)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  color: "#f87171",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Clear
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Drag and Drop Upload Zone */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!addUploadingImage) setAddDraggingImage(true);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!addUploadingImage) setAddDraggingImage(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setAddDraggingImage(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setAddDraggingImage(false);
                          if (addUploadingImage) return;
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            processAddImageFile(file);
                          }
                        }}
                        onClick={() => {
                          if (!addUploadingImage) addFileInputRef.current?.click();
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "14px 18px",
                          borderRadius: "8px",
                          border: addDraggingImage
                            ? "2px dashed #38bdf8"
                            : "1.5px dashed rgba(255, 255, 255, 0.2)",
                          background: addDraggingImage
                            ? "rgba(56, 189, 248, 0.12)"
                            : "rgba(2, 6, 23, 0.4)",
                          cursor: addUploadingImage ? "not-allowed" : "pointer",
                          transition: "all 0.18s ease",
                          textAlign: "center",
                          gap: "5px",
                        }}
                      >
                        <input
                          ref={addFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={addUploadingImage}
                          onChange={handleAddImageUpload}
                          style={{ display: "none" }}
                        />
                        {addUploadingImage ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontSize: "12px", fontWeight: "600" }}>
                            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                            <span>Converting to WebP & Uploading to Party CDN…</span>
                          </div>
                        ) : addDraggingImage ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontSize: "13px", fontWeight: "600" }}>
                            <Upload size={16} />
                            <span>Drop photo here to upload immediately</span>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#e2e8f0", fontSize: "12px" }}>
                              <Upload size={14} style={{ color: "#38bdf8" }} />
                              <span>
                                <strong style={{ color: "#38bdf8" }}>Drag & drop</strong> photo here, or <span style={{ textDecoration: "underline", color: "#60a5fa" }}>browse files</span>
                              </span>
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              JPEG, PNG or WEBP (Max 8MB). Automatically converted to WebP on Party CDN.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "12px", fontWeight: "700", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  Step 2: Executive Details & Position
                </div>

                <div
                  className="dash-modal-grid-2"
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
                        const effectiveRegion = newLevel === "External Branch" ? "External Branch" : newExecRegion;
                        if (newLevel === "External Branch") {
                          setNewExecRegion("External Branch");
                        }
                        const norm = normalizeLevelKey(newLevel);
                        const validPositions = POSITIONS_BY_LEVEL[norm] || POSITIONS_BY_LEVEL[newLevel] || [];
                        setAddPositionList(validPositions);
                        let nextPos = newExecPosition;
                        if (!isCustomPosition) {
                          if (!validPositions.includes(newExecPosition)) {
                            nextPos = validPositions[0] || "";
                            handleAddPositionChange(nextPos);
                          }
                        }
                        if (newExecDob) {
                          const { age, dob } = computeExecutiveAgeAndDob(newExecDob, nextPos, newLevel, effectiveRegion);
                          setNewExecDob(dob);
                          if (age !== null) setNewExecAge(String(age));
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
                      <option value="External Branch">External Branch</option>
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
                            const norm = normalizeLevelKey(newExecLevel);
                            const validPositions = addPositionList.length > 0 ? addPositionList : (POSITIONS_BY_LEVEL[norm] || []);
                            handleAddPositionChange(validPositions[0] || "");
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
                        onChange={(e) => handleAddPositionChange(e.target.value)}
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
                            handleAddPositionChange("");
                          } else {
                            handleAddPositionChange(e.target.value);
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
                        <option value="">
                          {loadingAddPositions
                            ? `Loading ${newExecLevel} Positions…`
                            : `-- Select ${newExecLevel} Position --`}
                        </option>
                        {newExecPosition &&
                          !addPositionList.includes(newExecPosition) && (
                            <option value={newExecPosition}>{newExecPosition}</option>
                          )}
                        {addPositionList.map((pos) => (
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
                  className="dash-modal-grid-2"
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
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewExecRegion(val);
                        const effectiveLevel = val === "External Branch" ? "External Branch" : newExecLevel;
                        if (val === "External Branch") {
                          setNewExecLevel("External Branch");
                          if (!isCustomPosition) {
                            const validPositions = POSITIONS_BY_LEVEL["External Branch"] || [];
                            if (!validPositions.includes(newExecPosition)) {
                              handleAddPositionChange(validPositions[0] || "");
                            }
                          }
                        }
                        if (newExecDob) {
                          const { age, dob } = computeExecutiveAgeAndDob(newExecDob, newExecPosition, effectiveLevel, val);
                          setNewExecDob(dob);
                          if (age !== null) setNewExecAge(String(age));
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
                      <option value="">Select Region</option>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "5px", fontWeight: "600" }}>
                      {newExecRegion === "External Branch" ? "Country (External Branch)" : "Constituency"} {loadingNewExecConstituencies && "(loading…)"}
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
                        <option value="">{newExecRegion === "External Branch" ? "Select Country" : "Select Constituency"}</option>
                        {newExecConstituencyList.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newExecConstituency}
                        onChange={(e) => setNewExecConstituency(e.target.value)}
                        placeholder={newExecRegion === "External Branch" ? "e.g. United Kingdom" : "e.g. Dome Kwabenya"}
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
                      {newExecLevel === "TESCON" ? "Institution (Accredited Tertiary Institution)" : "Polling Station"}
                    </label>
                    {newExecLevel === "TESCON" ? (
                      <select
                        value={newExecPollingStation}
                        onChange={(e) => setNewExecPollingStation(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "6px",
                          background: "rgba(2, 6, 23, 0.8)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#ffffff",
                          fontSize: "13px",
                          boxSizing: "border-box",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">Select Accredited TESCON Institution</option>
                        {getTesconInstitutionsForRegion(newExecRegion).map((inst) => (
                          <option key={inst} value={inst}>{inst}</option>
                        ))}
                      </select>
                    ) : (
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
                    )}
                  </div>
                </div>

                <div
                  className="dash-modal-grid-2"
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
                      onChange={(e) => handleAddDobChange(e.target.value)}
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
                  className="dash-modal-grid-2"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600" }}>
                        Age
                      </label>
                      {newExecPosition &&
                        /youth/i.test(newExecPosition) &&
                        Number(newExecAge) === 39 &&
                        !/external\s*branch/i.test(newExecLevel || "") &&
                        !/external\s*branch/i.test(newExecRegion || "") && (
                        <span style={{ fontSize: "11px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "1px 6px", borderRadius: "4px" }}>
                          Youth Quota Capped (&le;39)
                        </span>
                      )}
                    </div>
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
              className="dash-modal-footer"
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

      {/* ===================================================================== */}
      {/* PROXY VOTING MODAL (View Assigned Proxy Details OR Search & Assign)   */}
      {/* ===================================================================== */}
      {proxyModalOpen && proxyModalPrincipal && (
        <div
          className="dash-modal-backdrop"
          onClick={handleCloseProxyModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3, 7, 18, 0.84)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="dash-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "860px",
              maxHeight: "90vh",
              background: "#0f172a",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: "16px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.75)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                background: "linear-gradient(135deg, rgba(88, 28, 135, 0.35) 0%, rgba(30, 41, 59, 0.9) 100%)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "rgba(168, 85, 247, 0.2)",
                    border: "1px solid rgba(168, 85, 247, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#c084fc",
                  }}
                >
                  <UserCheck size={20} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc" }}>
                      {proxyModalAssignment && proxyModalViewMode === "details"
                        ? "Assigned Proxy Voter Details"
                        : "Assign Proxy Voter"}
                    </h3>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: proxyModalAssignment
                          ? "rgba(16, 185, 129, 0.18)"
                          : "rgba(148, 163, 184, 0.15)",
                        border: proxyModalAssignment
                          ? "1px solid rgba(16, 185, 129, 0.4)"
                          : "1px solid rgba(148, 163, 184, 0.25)",
                        color: proxyModalAssignment ? "#34d399" : "#cbd5e1",
                      }}
                    >
                      {proxyModalAssignment ? "Proxy Assigned" : "No Proxy Assigned"}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    Rule: Each voter may only hold a maximum of one (1) proxy assignment.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseProxyModal}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  width: "34px",
                  height: "34px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Principal Executive Banner */}
            <div
              style={{
                padding: "14px 24px",
                background: "rgba(15, 23, 42, 0.9)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <ExecutiveAvatar
                  imageUrl={proxyModalPrincipal.imageUrl}
                  name={proxyModalPrincipal.executiveName}
                  voterId={proxyModalPrincipal.voterId}
                  region={proxyModalPrincipal.region}
                  constituency={proxyModalPrincipal.constituency}
                  size={44}
                  reloadKey={rosterImageReloadKey}
                />
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Principal Voter (Delegating Vote)
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                    {proxyModalPrincipal.executiveName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px", fontSize: "12px", color: "#94a3b8" }}>
                    <span style={{ color: "#60a5fa", fontWeight: 600 }}>{proxyModalPrincipal.position || "Executive"}</span>
                    <span>•</span>
                    <span>{proxyModalPrincipal.executiveLevel}</span>
                    {proxyModalPrincipal.region && (
                      <>
                        <span>•</span>
                        <span>{normalizeRegionName(proxyModalPrincipal.region)}</span>
                      </>
                    )}
                    {proxyModalPrincipal.constituency && (
                      <>
                        <span>•</span>
                        <span>{normalizeConstituency(proxyModalPrincipal.constituency)}</span>
                      </>
                    )}
                    {proxyModalPrincipal.voterId && (
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: "rgba(59, 130, 246, 0.14)",
                          border: "1px solid rgba(59, 130, 246, 0.3)",
                          color: "#93c5fd",
                          fontFamily: "monospace",
                          fontSize: "11px",
                        }}
                      >
                        Voter ID: {proxyModalPrincipal.voterId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {proxyModalAssignment && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setProxyModalError("");
                      setProxyModalSuccess("");
                      setProxyConfirmRevoke(false);
                      setProxyModalViewMode(proxyModalViewMode === "details" ? "search" : "details");
                    }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      background:
                        proxyModalViewMode === "search"
                          ? "rgba(168, 85, 247, 0.2)"
                          : "rgba(255, 255, 255, 0.07)",
                      border:
                        proxyModalViewMode === "search"
                          ? "1px solid rgba(168, 85, 247, 0.45)"
                          : "1px solid rgba(255, 255, 255, 0.14)",
                      color: proxyModalViewMode === "search" ? "#e9d5ff" : "#e2e8f0",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {proxyModalViewMode === "details" ? (
                      <>
                        <Search size={13} />
                        <span>Change Proxy Voter</span>
                      </>
                    ) : (
                      <>
                        <UserCheck size={13} />
                        <span>Back to Assigned Proxy Details</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Notice if Principal is also acting as a proxy for someone else */}
            {proxyModalActingFor && (
              <div
                style={{
                  padding: "10px 24px",
                  background: "rgba(14, 165, 233, 0.12)",
                  borderBottom: "1px solid rgba(14, 165, 233, 0.25)",
                  color: "#7dd3fc",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Vote size={15} color="#38bdf8" />
                <span>
                  Note: <strong>{proxyModalPrincipal.executiveName}</strong> is currently assigned to vote as a proxy on behalf of{" "}
                  <strong>{proxyModalActingFor.principalName}</strong>
                  {proxyModalActingFor.principalVoterId ? ` (Voter ID: ${proxyModalActingFor.principalVoterId})` : ""}.
                </span>
              </div>
            )}

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {proxyModalError && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.14)",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    color: "#fca5a5",
                    fontSize: "13px",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
                  <span>{proxyModalError}</span>
                </div>
              )}

              {proxyModalSuccess && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.14)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    color: "#6ee7b7",
                    fontSize: "13px",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0 }} />
                  <span>{proxyModalSuccess}</span>
                </div>
              )}

              {proxyModalLoading ? (
                <div style={{ padding: "48px 20px", textAlign: "center", color: "#94a3b8" }}>
                  <Loader2 size={28} style={{ animation: "spin 1s linear infinite", margin: "0 auto 10px" }} />
                  <div>Loading proxy voter assignment details…</div>
                </div>
              ) : proxyModalAssignment && proxyModalViewMode === "details" ? (
                /* ========================================================= */
                /* VIEW 1: ASSIGNED PROXY VOTER DETAILS                      */
                /* ========================================================= */
                <div>
                  <div
                    style={{
                      borderRadius: "14px",
                      background: "linear-gradient(145deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)",
                      border: "1px solid rgba(168, 85, 247, 0.35)",
                      padding: "22px",
                      boxShadow: "0 12px 30px -10px rgba(0, 0, 0, 0.5)",
                    }}
                  >
                    {/* Top Status & Timestamp Row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "10px",
                        paddingBottom: "16px",
                        marginBottom: "18px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: "rgba(168, 85, 247, 0.2)",
                            border: "1px solid rgba(168, 85, 247, 0.45)",
                            color: "#e9d5ff",
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.4px",
                            textTransform: "uppercase",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <UserCheck size={13} color="#c084fc" />
                          <span>Authorized Proxy Voter</span>
                        </span>
                        {proxyModalAssignment.proxyExecutive?.slotStatus && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "rgba(59, 130, 246, 0.14)",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              color: "#93c5fd",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            {proxyModalAssignment.proxyExecutive.slotStatus}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {proxyModalAssignment.createdAt && (
                          <span>
                            Assigned on{" "}
                            <strong style={{ color: "#cbd5e1" }}>
                              {new Date(proxyModalAssignment.createdAt).toLocaleString()}
                            </strong>
                          </span>
                        )}
                        {(proxyModalAssignment.assignedByName || proxyModalAssignment.assignedByEmail) && (
                          <span>
                            {" "}
                            by{" "}
                            <strong style={{ color: "#cbd5e1" }}>
                              {proxyModalAssignment.assignedByName || proxyModalAssignment.assignedByEmail}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Proxy Voter Profile Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "18px",
                        flexWrap: "wrap",
                        marginBottom: "20px",
                      }}
                    >
                      <ExecutiveAvatar
                        imageUrl={proxyModalAssignment.proxyExecutive?.imageUrl || null}
                        name={proxyModalAssignment.proxyExecutive?.executiveName || proxyModalAssignment.proxyName}
                        voterId={proxyModalAssignment.proxyExecutive?.voterId || proxyModalAssignment.proxyVoterId || ""}
                        region={proxyModalAssignment.proxyExecutive?.region || proxyModalAssignment.proxyRegion || ""}
                        constituency={
                          proxyModalAssignment.proxyExecutive?.constituency ||
                          proxyModalAssignment.proxyConstituency ||
                          ""
                        }
                        size={74}
                        reloadKey={rosterImageReloadKey}
                      />

                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }}>
                          {proxyModalAssignment.proxyExecutive?.executiveName || proxyModalAssignment.proxyName}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginTop: "6px",
                          }}
                        >
                          {(proxyModalAssignment.proxyExecutive?.position || proxyModalAssignment.proxyPosition) && (
                            <span
                              style={{
                                padding: "3px 9px",
                                borderRadius: "6px",
                                background: "rgba(59, 130, 246, 0.16)",
                                border: "1px solid rgba(59, 130, 246, 0.35)",
                                color: "#60a5fa",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              {proxyModalAssignment.proxyExecutive?.position || proxyModalAssignment.proxyPosition}
                            </span>
                          )}
                          {(proxyModalAssignment.proxyExecutive?.executiveLevel || proxyModalAssignment.proxyLevel) && (
                            <span
                              style={{
                                padding: "3px 9px",
                                borderRadius: "6px",
                                background: "rgba(16, 185, 129, 0.15)",
                                border: "1px solid rgba(16, 185, 129, 0.35)",
                                color: "#34d399",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              {proxyModalAssignment.proxyExecutive?.executiveLevel || proxyModalAssignment.proxyLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Proxy Voter Details Grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {/* Voter ID */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "rgba(15, 23, 42, 0.75)",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>
                          VOTER ID NUMBER
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "15px",
                              fontWeight: 700,
                              color: "#93c5fd",
                            }}
                          >
                            {proxyModalAssignment.proxyExecutive?.voterId || proxyModalAssignment.proxyVoterId || "—"}
                          </span>
                          {(proxyModalAssignment.proxyExecutive?.voterId || proxyModalAssignment.proxyVoterId) && (
                            <button
                              type="button"
                              onClick={() => {
                                const vid =
                                  proxyModalAssignment.proxyExecutive?.voterId ||
                                  proxyModalAssignment.proxyVoterId ||
                                  "";
                                if (vid && navigator.clipboard) {
                                  navigator.clipboard.writeText(vid);
                                  setCopiedProxyVoterId(true);
                                  setTimeout(() => setCopiedProxyVoterId(false), 1800);
                                }
                              }}
                              style={{
                                padding: "3px 7px",
                                borderRadius: "5px",
                                background: "rgba(255, 255, 255, 0.07)",
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                color: copiedProxyVoterId ? "#34d399" : "#cbd5e1",
                                fontSize: "11px",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Copy size={11} />
                              <span>{copiedProxyVoterId ? "Copied" : "Copy"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "rgba(15, 23, 42, 0.75)",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>
                          PHONE NUMBER
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
                          {proxyModalAssignment.proxyExecutive?.phone || proxyModalAssignment.proxyPhone ? (
                            <a
                              href={`tel:${proxyModalAssignment.proxyExecutive?.phone || proxyModalAssignment.proxyPhone}`}
                              style={{
                                color: "#38bdf8",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Phone size={13} />
                              <span>{proxyModalAssignment.proxyExecutive?.phone || proxyModalAssignment.proxyPhone}</span>
                            </a>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </div>
                      </div>

                      {/* Region */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "rgba(15, 23, 42, 0.75)",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>
                          REGION
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
                          {proxyModalAssignment.proxyExecutive?.region || proxyModalAssignment.proxyRegion
                            ? normalizeRegionName(
                                proxyModalAssignment.proxyExecutive?.region || proxyModalAssignment.proxyRegion || ""
                              )
                            : "—"}
                        </div>
                      </div>

                      {/* Constituency */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "rgba(15, 23, 42, 0.75)",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>
                          CONSTITUENCY / BRANCH
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
                          {proxyModalAssignment.proxyExecutive?.constituency || proxyModalAssignment.proxyConstituency
                            ? normalizeConstituency(
                                proxyModalAssignment.proxyExecutive?.constituency ||
                                  proxyModalAssignment.proxyConstituency ||
                                  ""
                              )
                            : "—"}
                        </div>
                      </div>

                      {/* Gender & Age */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "rgba(15, 23, 42, 0.75)",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>
                          GENDER & AGE
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
                          <span>{proxyModalAssignment.proxyExecutive?.gender || "—"}</span>
                          {proxyModalAssignment.proxyExecutive?.age != null && (
                            <>
                              <span>•</span>
                              <span>{proxyModalAssignment.proxyExecutive.age} yrs</span>
                            </>
                          )}
                          {proxyModalAssignment.proxyExecutive?.dateOfBirth && (
                            <span style={{ fontSize: "12px", color: "#94a3b8", fontFamily: "monospace" }}>
                              ({proxyModalAssignment.proxyExecutive.dateOfBirth})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Polling Station / Institution */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "rgba(15, 23, 42, 0.75)",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>
                          POLLING STATION / INSTITUTION
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc" }}>
                          {proxyModalAssignment.proxyExecutive?.pollingStation ||
                            proxyModalAssignment.proxyExecutive?.electoralArea ||
                            "—"}
                        </div>
                      </div>
                    </div>

                    {/* Actions on Assigned Proxy Card */}
                    <div
                      style={{
                        marginTop: "20px",
                        paddingTop: "16px",
                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const execId =
                              proxyModalAssignment.proxyExecutive?.id || proxyModalAssignment.proxyExecutiveId;
                            if (execId) {
                              handleCloseProxyModal();
                              handleOpenModal(execId);
                            }
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            background: "rgba(59, 130, 246, 0.14)",
                            border: "1px solid rgba(59, 130, 246, 0.35)",
                            color: "#93c5fd",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <ExternalLink size={13} />
                          <span>Open Full Voter Profile</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setProxyModalError("");
                            setProxyModalSuccess("");
                            setProxyConfirmRevoke(false);
                            setProxyModalViewMode("search");
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            background: "rgba(168, 85, 247, 0.16)",
                            border: "1px solid rgba(168, 85, 247, 0.4)",
                            color: "#e9d5ff",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Search size={13} />
                          <span>Reassign / Change Proxy</span>
                        </button>
                      </div>

                      {!proxyConfirmRevoke ? (
                        <button
                          type="button"
                          onClick={() => setProxyConfirmRevoke(true)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#fca5a5",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Remove Proxy Assignment</span>
                        </button>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", color: "#fca5a5", fontWeight: 600 }}>
                            Confirm removal?
                          </span>
                          <button
                            type="button"
                            disabled={proxyRevoking}
                            onClick={handleRemoveProxy}
                            style={{
                              padding: "7px 12px",
                              borderRadius: "7px",
                              background: "#ef4444",
                              border: "none",
                              color: "#ffffff",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: proxyRevoking ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            {proxyRevoking ? (
                              <>
                                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                <span>Removing…</span>
                              </>
                            ) : (
                              <span>Yes, Remove</span>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={proxyRevoking}
                            onClick={() => setProxyConfirmRevoke(false)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: "7px",
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "none",
                              color: "#cbd5e1",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ========================================================= */
                /* VIEW 2: SEARCH & ASSIGN PROXY VOTER                       */
                /* ========================================================= */
                <div>
                  {/* Search & Filter Controls */}
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: "rgba(30, 41, 59, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      marginBottom: "16px",
                    }}
                  >
                    {/* Search Input */}
                    <div style={{ position: "relative", marginBottom: "12px" }}>
                      <Search
                        size={16}
                        color="#94a3b8"
                        style={{
                          position: "absolute",
                          left: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                        }}
                      />
                      <input
                        type="text"
                        value={proxySearchQuery}
                        onChange={(e) => setProxySearchQuery(e.target.value)}
                        placeholder="Search proxy candidate by Name, Voter ID, or Phone number…"
                        autoFocus
                        style={{
                          width: "100%",
                          padding: "10px 36px 10px 38px",
                          borderRadius: "8px",
                          background: "#0f172a",
                          border: "1px solid rgba(168, 85, 247, 0.4)",
                          color: "#f8fafc",
                          fontSize: "13px",
                          outline: "none",
                        }}
                      />
                      {proxySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setProxySearchQuery("")}
                          style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Region, Constituency, Level Filters */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      {/* Level Filter */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: "4px",
                          }}
                        >
                          Filter by Level
                        </label>
                        <select
                          value={proxyFilterLevel}
                          onChange={(e) => setProxyFilterLevel(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "7px",
                            background: "#0f172a",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#e2e8f0",
                            fontSize: "12px",
                          }}
                        >
                          <option value="">All Levels</option>
                          <option value="National">National</option>
                          <option value="Region">Regional</option>
                          <option value="Constituency">Constituency</option>
                          <option value="External Branch">External Branch</option>
                          <option value="Electoral Area">Electoral Area</option>
                          <option value="Polling Station">Polling Station</option>
                          <option value="TESCON">TESCON</option>
                        </select>
                      </div>

                      {/* Region Filter */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: "4px",
                          }}
                        >
                          Filter by Region
                        </label>
                        <select
                          value={proxyFilterRegion}
                          onChange={(e) => {
                            setProxyFilterRegion(e.target.value);
                            setProxyFilterConstituency("");
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "7px",
                            background: "#0f172a",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#e2e8f0",
                            fontSize: "12px",
                          }}
                        >
                          <option value="">All Regions</option>
                          {REGIONS.map((reg) => (
                            <option key={reg} value={reg}>
                              {reg}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Constituency Filter */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#94a3b8",
                            marginBottom: "4px",
                          }}
                        >
                          Filter by Constituency
                        </label>
                        <select
                          value={proxyFilterConstituency}
                          onChange={(e) => setProxyFilterConstituency(e.target.value)}
                          disabled={!proxyFilterRegion || loadingProxyConstituencies}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "7px",
                            background: "#0f172a",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: !proxyFilterRegion ? "#64748b" : "#e2e8f0",
                            fontSize: "12px",
                          }}
                        >
                          <option value="">
                            {!proxyFilterRegion
                              ? "Select Region First"
                              : loadingProxyConstituencies
                              ? "Loading Constituencies…"
                              : "All Constituencies"}
                          </option>
                          {proxyConstituencyList.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Filter Chips */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginTop: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setProxyFilterRegion(
                              proxyModalPrincipal.region ? normalizeRegionName(proxyModalPrincipal.region) : ""
                            );
                            setProxyFilterConstituency(
                              proxyModalPrincipal.constituency
                                ? normalizeRegionName(proxyModalPrincipal.region) === "External Branch"
                                  ? proxyModalPrincipal.constituency
                                  : normalizeConstituency(proxyModalPrincipal.constituency)
                                : ""
                            );
                          }}
                          style={{
                            padding: "4px 9px",
                            borderRadius: "6px",
                            background: "rgba(59, 130, 246, 0.12)",
                            border: "1px solid rgba(59, 130, 246, 0.28)",
                            color: "#93c5fd",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Same Region/Constituency as Principal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProxySearchQuery("");
                            setProxyFilterLevel("");
                            setProxyFilterRegion("");
                            setProxyFilterConstituency("");
                          }}
                          style={{
                            padding: "4px 9px",
                            borderRadius: "6px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#cbd5e1",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Search All Nationwide
                        </button>
                      </div>

                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        Showing up to 35 matching voters
                      </div>
                    </div>
                  </div>

                  {/* Candidate Results List */}
                  {proxySearching ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}>
                      <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                      <div>Searching eligible proxy voters…</div>
                    </div>
                  ) : proxyCandidates.length === 0 ? (
                    <div
                      style={{
                        padding: "36px 20px",
                        textAlign: "center",
                        color: "#94a3b8",
                        background: "rgba(15, 23, 42, 0.5)",
                        borderRadius: "10px",
                        border: "1px dashed rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      No matching voters found for the selected filters. Try clearing Region/Constituency filters or searching by Voter ID / Name / Phone.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {proxyCandidates.map((candidate) => {
                        const isAlreadyAssignedToOther =
                          candidate.alreadyAssignedToPrincipalId !== null &&
                          candidate.alreadyAssignedToPrincipalId !== proxyModalPrincipal.id;
                        const isCurrentlyAssignedToThis =
                          candidate.alreadyAssignedToPrincipalId === proxyModalPrincipal.id;
                        const isAssigningThis = proxyAssigningId === candidate.id;

                        return (
                          <div
                            key={candidate.id}
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              background: isAlreadyAssignedToOther
                                ? "rgba(15, 23, 42, 0.45)"
                                : "rgba(30, 41, 59, 0.65)",
                              border: isAlreadyAssignedToOther
                                ? "1px solid rgba(239, 68, 68, 0.22)"
                                : isCurrentlyAssignedToThis
                                ? "1px solid rgba(16, 185, 129, 0.45)"
                                : "1px solid rgba(255, 255, 255, 0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "12px",
                              flexWrap: "wrap",
                              opacity: isAlreadyAssignedToOther ? 0.72 : 1,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "240px", flex: 1 }}>
                              <ExecutiveAvatar
                                imageUrl={candidate.imageUrl}
                                name={candidate.executiveName}
                                voterId={candidate.voterId || ""}
                                region={candidate.region || ""}
                                constituency={candidate.constituency || ""}
                                size={42}
                                reloadKey={rosterImageReloadKey}
                              />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
                                    {candidate.executiveName}
                                  </span>
                                  {candidate.voterId && (
                                    <span
                                      style={{
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        background: "rgba(59, 130, 246, 0.14)",
                                        border: "1px solid rgba(59, 130, 246, 0.28)",
                                        color: "#93c5fd",
                                        fontFamily: "monospace",
                                        fontSize: "11px",
                                      }}
                                    >
                                      {candidate.voterId}
                                    </span>
                                  )}
                                  {candidate.phone && (
                                    <span style={{ fontSize: "11px", color: "#38bdf8" }}>
                                      • {candidate.phone}
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    flexWrap: "wrap",
                                    marginTop: "3px",
                                    fontSize: "11px",
                                    color: "#94a3b8",
                                  }}
                                >
                                  {candidate.position && (
                                    <span style={{ color: "#60a5fa", fontWeight: 600 }}>{candidate.position}</span>
                                  )}
                                  {candidate.executiveLevel && (
                                    <>
                                      <span>•</span>
                                      <span style={{ color: "#cbd5e1" }}>{candidate.executiveLevel}</span>
                                    </>
                                  )}
                                  {candidate.region && (
                                    <>
                                      <span>•</span>
                                      <span>{normalizeRegionName(candidate.region)}</span>
                                    </>
                                  )}
                                  {candidate.constituency && (
                                    <>
                                      <span>•</span>
                                      <span>{normalizeConstituency(candidate.constituency)}</span>
                                    </>
                                  )}
                                </div>

                                {isAlreadyAssignedToOther && (
                                  <div
                                    style={{
                                      marginTop: "5px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "2px 8px",
                                      borderRadius: "5px",
                                      background: "rgba(239, 68, 68, 0.14)",
                                      border: "1px solid rgba(239, 68, 68, 0.3)",
                                      color: "#fca5a5",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    <Lock size={11} color="#f87171" />
                                    <span>
                                      Already assigned as proxy for {candidate.alreadyAssignedToPrincipalName}
                                      {candidate.alreadyAssignedToPrincipalVoterId
                                        ? ` (${candidate.alreadyAssignedToPrincipalVoterId})`
                                        : ""}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action Button */}
                            <div>
                              {isAlreadyAssignedToOther ? (
                                <button
                                  type="button"
                                  disabled
                                  title="One person cannot hold two proxy assignments"
                                  style={{
                                    padding: "7px 12px",
                                    borderRadius: "7px",
                                    background: "rgba(239, 68, 68, 0.1)",
                                    border: "1px solid rgba(239, 68, 68, 0.25)",
                                    color: "#f87171",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "not-allowed",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                  }}
                                >
                                  <Lock size={12} />
                                  <span>Has Proxy</span>
                                </button>
                              ) : isCurrentlyAssignedToThis ? (
                                <button
                                  type="button"
                                  onClick={() => setProxyModalViewMode("details")}
                                  style={{
                                    padding: "7px 12px",
                                    borderRadius: "7px",
                                    background: "rgba(16, 185, 129, 0.2)",
                                    border: "1px solid rgba(16, 185, 129, 0.4)",
                                    color: "#34d399",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                  }}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Current Proxy (View)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={proxyAssigningId !== null}
                                  onClick={() => handleAssignProxy(candidate)}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: "8px",
                                    background: isAssigningThis
                                      ? "#475569"
                                      : "linear-gradient(135deg, #9333ea 0%, #6366f1 100%)",
                                    border: "none",
                                    color: "#ffffff",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: proxyAssigningId !== null ? "not-allowed" : "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    boxShadow: "0 4px 12px rgba(147, 51, 234, 0.3)",
                                  }}
                                >
                                  {isAssigningThis ? (
                                    <>
                                      <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                      <span>Assigning…</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck size={13} />
                                      <span>Assign Proxy</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                background: "rgba(15, 23, 42, 0.9)",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Table: <code style={{ color: "#c084fc" }}>proxy_voter_assignments</code>
              </div>
              <button
                type="button"
                onClick={handleCloseProxyModal}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

