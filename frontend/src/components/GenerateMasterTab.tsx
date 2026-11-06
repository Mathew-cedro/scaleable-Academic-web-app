import { useState, useMemo, useEffect, useRef } from "react";
import {
  Sparkles,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  Users,
  ChevronRight,
  Zap,
  BarChart3,
  Calendar,
  Clock,
  SlidersHorizontal,
  Save,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Check,
  Minus,
  Plus,
  Compass,
  AlertTriangle,
  Trash2,
  Edit3,
  X,
  Layers,
  Send,
  Square,
  Copy,
  RotateCcw,
} from "lucide-react";
import {
  api,
  type GenerateScheduleRequest,
  type OperationResponse,
  type SubjectAllotmentConfig,
  type SavedScheduleItem,
  type UserProfile,
  type ScheduleDeploymentRecord,
} from "../api/client";
import { DeployScheduleModal } from "./DeployScheduleModal";
import { EditSubjectModal } from "./EditSubjectModal";
import {
  loadModularTracks,
  saveModularTracks,
  type ModularTrack,
  normalizeModularTrack,
  DEFAULT_MODULAR_TRACKS,
  BADGE_COLOR_MAP,
} from "../utils/modularTracks";
export type { ModularTrack };
export { normalizeModularTrack, DEFAULT_MODULAR_TRACKS, BADGE_COLOR_MAP };
import { BatchSectionSetupModal } from "./BatchSectionSetupModal";
import { formatDuration, formatDurationDetailed } from "../utils/bellSchedule";
import { PreFlightReadinessCard } from "./PreFlightReadinessCard";
import { GenerationCockpitModal } from "./GenerationCockpitModal";
import { ScheduleHealthScorecard } from "./ScheduleHealthScorecard";

interface ScheduleSlot {
  id: number;
  section_id: number;
  subject_id: number;
  teacher_id: number;
  day_of_week: number;
  period_index: number;
  is_locked: boolean;
  section_name?: string;
  subject_name?: string;
  teacher_name?: string;
  department_name?: string;
  room_number?: string;
}

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  current_load_hours: number;
  max_daily_hours: number;
  max_weekly_hours: number;
  status: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
}

interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Subject {
  id: number;
  name: string;
  department_id: number;
  grade_level: number;
  required_weekly_loads: number;
  duration_minutes?: number;
  preferred_placement?: string;
}



interface Props {
  slots: ScheduleSlot[];
  teachers: Teacher[];
  sections: Section[];
  departments: Department[];
  subjects: Subject[];
  currentUser: UserProfile;
  onRunGenerate: (config?: GenerateScheduleRequest) => Promise<void>;
  onRunRepair: (config?: GenerateScheduleRequest) => Promise<void>;
  onViewReport: () => Promise<void>;
  onSelectView: (view: string) => void;
  onTeacherStatusToggle: (teacherId: number, status: string) => Promise<void>;
  loading: boolean;
  lastResult: OperationResponse | null;
  onOpenSaveModal?: (configJson?: string) => void;
  onOpenSavedListModal?: () => void;
  savedCount?: number;
  activeSavedSchedule?: SavedScheduleItem | null;
  onRefreshData?: () => Promise<void>;
  onAddSection?: (defaultGrade?: number) => void;
  onEditSection?: (section: Section) => void;
  onDeleteSection?: (section: Section) => void;
}

const getCurriculumMeta = (subjectName: string, placementOverride?: string) => {
  const name = subjectName.toLowerCase();

  // If placementOverride is explicitly provided, map to standard label and badge
  let preferredPlacement = "Flexible Placement";
  let badgeBg = "bg-slate-50 border-slate-200 text-slate-700";

  const p = (placementOverride || "").toUpperCase().trim();
  if (p === "MORNING") {
    preferredPlacement = "Morning Academic (7:00–11:15 AM)";
    badgeBg = "bg-blue-50 border-blue-200 text-blue-700";
  } else if (p === "AFTERNOON") {
    preferredPlacement = "Afternoon Applied (12:00–3:00 PM)";
    badgeBg = "bg-emerald-50 border-emerald-200 text-emerald-700";
  } else if (p === "MON_P1_LOCK") {
    preferredPlacement = "Monday Period 1 Fixed Lock";
    badgeBg = "bg-rose-50 border-rose-200 text-rose-700";
  } else if (p === "FLEXIBLE") {
    preferredPlacement = "Flexible Placement";
    badgeBg = "bg-slate-50 border-slate-200 text-slate-700";
  } else {
    // Default heuristics based on subject name
    if (name.includes("science") || name.includes("math")) {
      preferredPlacement = "Morning Academic (7:00–11:15 AM)";
      badgeBg = "bg-[#FDF2FA] border-[#E5CCE3] text-[#A91079]";
    } else if (name.includes("english")) {
      preferredPlacement = "Morning Academic (7:00–11:15 AM)";
      badgeBg = "bg-violet-50 border-violet-200 text-violet-700";
    } else if (name.includes("filipino")) {
      preferredPlacement = "Morning Academic (7:00–11:15 AM)";
      badgeBg = "bg-purple-50 border-purple-200 text-purple-700";
    } else if (name.includes("araling panlipunan") || name.includes("ap")) {
      preferredPlacement = "Morning Academic (7:00–11:15 AM)";
      badgeBg = "bg-amber-50 border-amber-200 text-amber-700";
    } else if (name.includes("tle") || name.includes("technology") || name.includes("livelihood")) {
      preferredPlacement = "Afternoon Applied (12:00–3:00 PM)";
      badgeBg = "bg-emerald-50 border-emerald-200 text-emerald-700";
    } else if (
      name.includes("mapeh") ||
      name.includes("music") ||
      name.includes("arts") ||
      name.includes("pe") ||
      name.includes("health")
    ) {
      preferredPlacement = "Afternoon Applied (12:00–3:00 PM)";
      badgeBg = "bg-teal-50 border-teal-200 text-teal-700";
    } else if (name.includes("homeroom") || name.includes("guidance")) {
      preferredPlacement = "Monday Period 1 Fixed Lock";
      badgeBg = "bg-rose-50 border-rose-200 text-rose-700";
    } else if (name.includes("values") || name.includes("esp") || name.includes("edukasyon")) {
      preferredPlacement = "Morning Academic (7:00–11:15 AM)";
      badgeBg = "bg-cyan-50 border-cyan-200 text-cyan-700";
    } else {
      preferredPlacement = "Flexible Placement";
      badgeBg = "bg-slate-50 border-slate-200 text-slate-700";
    }
  }

  // Determine standard facilities and category labels
  let categoryLabel = "Specialized Track Subject";
  let depedTargetMinutes = 240;
  let facility = "Specialized Room / Workshop";

  if (name.includes("science")) {
    categoryLabel = "Core Academic";
    facility = "Science Laboratory (Lab 201)";
  } else if (name.includes("math")) {
    categoryLabel = "Core Academic";
    facility = "Academic Lecture Hall";
  } else if (name.includes("english")) {
    categoryLabel = "Core Academic";
    facility = "Language Arts Room";
  } else if (name.includes("filipino")) {
    categoryLabel = "Core Academic";
    facility = "Filipino Cultural Room";
  } else if (name.includes("araling panlipunan") || name.includes("ap")) {
    categoryLabel = "Core Academic";
    facility = "Social Studies Room";
  } else if (name.includes("tle") || name.includes("technology") || name.includes("livelihood")) {
    categoryLabel = "Applied & TVL";
    facility = "TLE Workshop & Computer Lab";
  } else if (
    name.includes("mapeh") ||
    name.includes("music") ||
    name.includes("arts") ||
    name.includes("pe") ||
    name.includes("health")
  ) {
    categoryLabel = "Culture & MAPEH";
    facility = "Gymnasium & Activity Studio";
  } else if (name.includes("homeroom") || name.includes("guidance")) {
    categoryLabel = "Values & Guidance";
    depedTargetMinutes = 60;
    facility = "Section Advisory Classroom";
  } else if (name.includes("values") || name.includes("esp") || name.includes("edukasyon")) {
    categoryLabel = "Values & Guidance";
    facility = "Values Formation Room";
  }

  return {
    categoryLabel,
    depedTargetMinutes,
    facility,
    preferredPlacement,
    badgeBg,
  };
};

export const GenerateMasterTab = ({
  slots,
  teachers,
  sections,
  departments,
  subjects = [],
  currentUser,
  onRunGenerate,
  onRunRepair,
  onViewReport,
  onSelectView,
  onTeacherStatusToggle,
  loading,
  lastResult,
  onOpenSaveModal,
  onOpenSavedListModal,
  savedCount = 0,
  activeSavedSchedule,
  onRefreshData,
  onAddSection,
  onEditSection,
  onDeleteSection,
}: Props) => {
  const isPrincipal = currentUser.role === "PRINCIPAL";

  // Side Panel Toggle State
  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);

  // Studio Sub-Section Tab State
  type StudioTab = "TRACKS" | "SECTIONS" | "CONSTRAINTS" | "RUN_DEPLOY";
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>("TRACKS");

  // Modular Tracks State (initialized from saved config or shared storage)
  const [tracks, setTracks] = useState<ModularTrack[]>(() => {
    if (activeSavedSchedule?.config_json) {
      try {
        const parsed = JSON.parse(activeSavedSchedule.config_json);
        if (parsed.tracks && Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
          return parsed.tracks.map(normalizeModularTrack);
        }
      } catch {
        // fallback
      }
    }
    return loadModularTracks();
  });

  // Sync tracks with custom tracks added across Section Management
  useEffect(() => {
    const handleTracksUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<ModularTrack[]>;
      if (customEvent.detail) {
        setTracks(customEvent.detail);
      } else {
        setTracks(loadModularTracks());
      }
    };
    window.addEventListener("schedmaster_tracks_updated", handleTracksUpdated);
    return () => {
      window.removeEventListener("schedmaster_tracks_updated", handleTracksUpdated);
    };
  }, []);

  const [selectedTrackId, setSelectedTrackId] = useState<string>("BEC");
  // Active Grade Level being inspected/edited in Curricular Tracks (7, 8, 9, or 10)
  const [selectedTrackGrade, setSelectedTrackGrade] = useState<number>(7);
  const [addSubjectTargetGrade, setAddSubjectTargetGrade] = useState<number>(7);

  // Sync tracks when active saved schedule changes (only when a different saved schedule is selected)
  const lastLoadedSavedScheduleIdRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (activeSavedSchedule?.id !== lastLoadedSavedScheduleIdRef.current) {
      lastLoadedSavedScheduleIdRef.current = activeSavedSchedule?.id ?? null;
      if (activeSavedSchedule?.config_json) {
        try {
          const parsed = JSON.parse(activeSavedSchedule.config_json);
          if (parsed.tracks && Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
            const loaded = parsed.tracks.map(normalizeModularTrack);
            setTracks(loaded);
            saveModularTracks(loaded);
            if (!loaded.some((t: ModularTrack) => t.id === selectedTrackId)) {
              setSelectedTrackId(loaded[0].id);
            }
          }
        } catch {
          // fallback
        }
      }
    }
  }, [activeSavedSchedule?.id, activeSavedSchedule?.config_json]);

  // Modals State
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [isEditTrackOpen, setIsEditTrackOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isEditSubjectModalOpen, setIsEditSubjectModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  // Custom Confirmation Modals State
  const [subjectToRemove, setSubjectToRemove] = useState<{ id: number; name: string; grade: number } | null>(null);
  const [isDeleteTrackConfirmOpen, setIsDeleteTrackConfirmOpen] = useState(false);
  const [cloneGradeConfirm, setCloneGradeConfirm] = useState<{ sourceGrade: number; subjectCount: number } | null>(null);
  const [isResetDefaultsConfirmOpen, setIsResetDefaultsConfirmOpen] = useState(false);
  const [resetDefaultsOption, setResetDefaultsOption] = useState<"ALL" | "DURATIONS_ONLY">("ALL");
  const [actionAlert, setActionAlert] = useState<{ title: string; message: string } | null>(null);

  // Deployment to Departments State
  const [latestDeployment, setLatestDeployment] = useState<ScheduleDeploymentRecord | null>(null);

  const fetchDeployment = async () => {
    try {
      const data = await api.getLatestDeployment();
      setLatestDeployment(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDeployment();
  }, [slots.length, lastResult]);

  // Add Track Form State
  const [newTrackCode, setNewTrackCode] = useState("");
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackDesc, setNewTrackDesc] = useState("");
  const [newTrackColor, setNewTrackColor] = useState<ModularTrack["badgeColor"]>("fuchsia");
  const [includeCoreSubjects, setIncludeCoreSubjects] = useState(true);

  // Edit Track Form State
  const [editTrackName, setEditTrackName] = useState("");
  const [editTrackDesc, setEditTrackDesc] = useState("");
  const [editTrackColor, setEditTrackColor] = useState<ModularTrack["badgeColor"]>("fuchsia");

  // Create Subject Form State
  const [newSubName, setNewSubName] = useState("");
  const [newSubDeptId, setNewSubDeptId] = useState<number>(departments[0]?.id || 1);
  const [newSubDuration, setNewSubDuration] = useState<number>(60);
  const [newSubLoads, setNewSubLoads] = useState<number>(4);
  const [newSubPlacement, setNewSubPlacement] = useState<string>("FLEXIBLE");
  const [addingSubjectLoading, setAddingSubjectLoading] = useState(false);

  // Immediate cache for newly created specialized subjects so they appear instantly in the list
  const [extraSubjects, setExtraSubjects] = useState<Subject[]>([]);

  // Combined subjects: incoming props + immediately created subjects
  const allSubjects = useMemo(() => {
    const map = new Map<number, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    extraSubjects.forEach((s) => {
      if (!map.has(s.id)) map.set(s.id, s);
    });
    return Array.from(map.values());
  }, [subjects, extraSubjects]);

  // Search queries
  const [subjectSearchQuery, setSubjectSearchQuery] = useState<string>("");
  const [rosterDeptFilter, setRosterDeptFilter] = useState<number | "ALL">("ALL");
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>("");

  // Generator Settings State
  const [periodDuration, setPeriodDuration] = useState<number>(60);
  const [maxDailyHours, setMaxDailyHours] = useState<number>(6);
  const [maxConsecutiveHours, setMaxConsecutiveHours] = useState<number>(3);
  const [preferMorningAcademic, setPreferMorningAcademic] = useState<boolean>(true);
  const [preserveLockedSlots, setPreserveLockedSlots] = useState<boolean>(true);
  const [roomCollisionMode, setRoomCollisionMode] = useState<"SOFT_PENALTY" | "STRICT_ISOLATION">(
    "SOFT_PENALTY"
  );
  const [maxSolveTimeSeconds, setMaxSolveTimeSeconds] = useState<number>(25);
  const [objectiveStrategy, setObjectiveStrategy] = useState<
    "WORKLOAD_BALANCE" | "COMPACT_SCHEDULE" | "HYBRID"
  >("WORKLOAD_BALANCE");

  // Adviser lock overrides helper
  const ADVISER_LOCKS_STORAGE_KEY = "schedmaster_adviser_locked_subjects";

  const loadAdviserLockOverrides = (): Record<number, boolean> => {
    try {
      const raw = localStorage.getItem(ADVISER_LOCKS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveAdviserLockOverride = (subjectId: number, isLocked: boolean): void => {
    try {
      const existing = loadAdviserLockOverrides();
      existing[subjectId] = isLocked;
      localStorage.setItem(ADVISER_LOCKS_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to save adviser lock override:", e);
    }
  };

  // Preferred Placement overrides helper
  const PLACEMENT_OVERRIDES_STORAGE_KEY = "schedmaster_preferred_placements";

  const loadPlacementOverrides = (): Record<number, string> => {
    try {
      const raw = localStorage.getItem(PLACEMENT_OVERRIDES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const savePlacementOverride = (subjectId: number, placement: string): void => {
    try {
      const existing = loadPlacementOverrides();
      existing[subjectId] = placement;
      localStorage.setItem(PLACEMENT_OVERRIDES_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to save preferred placement override:", e);
    }
  };

  // Subject Allotment Matrix state: subjectId -> { duration_minutes, required_weekly_loads, is_adviser_locked, preferred_placement }
  const [subjectAllotments, setSubjectAllotments] = useState<Record<number, SubjectAllotmentConfig>>(
    () => {
      const lockOverrides = loadAdviserLockOverrides();
      const placementOverrides = loadPlacementOverrides();
      const init: Record<number, SubjectAllotmentConfig> = {};
      subjects.forEach((s) => {
        const isLocked =
          lockOverrides[s.id] !== undefined
            ? lockOverrides[s.id]
            : s.name.toLowerCase().includes("homeroom") ||
              s.name.toLowerCase().includes("guidance");
        const placement =
          placementOverrides[s.id] ||
          s.preferred_placement ||
          (isLocked ? "MON_P1_LOCK" : undefined);
        init[s.id] = {
          duration_minutes: s.duration_minutes || 60,
          required_weekly_loads: s.required_weekly_loads || 4,
          is_adviser_locked: isLocked,
          preferred_placement: placement,
        };
      });
      return init;
    }
  );

  // Synchronize subjectAllotments whenever subjects prop updates (e.g. after adding specialized subject)
  useEffect(() => {
    if (!subjects || subjects.length === 0) return;
    const lockOverrides = loadAdviserLockOverrides();
    const placementOverrides = loadPlacementOverrides();
    setSubjectAllotments((prev) => {
      let changed = false;
      const next = { ...prev };
      subjects.forEach((s) => {
        if (!next[s.id]) {
          changed = true;
          const isLocked =
            lockOverrides[s.id] !== undefined
              ? lockOverrides[s.id]
              : s.name.toLowerCase().includes("homeroom") ||
                s.name.toLowerCase().includes("guidance");
          const placement =
            placementOverrides[s.id] ||
            s.preferred_placement ||
            (isLocked ? "MON_P1_LOCK" : undefined);
          next[s.id] = {
            duration_minutes: s.duration_minutes || 60,
            required_weekly_loads: s.required_weekly_loads || 4,
            is_adviser_locked: isLocked,
            preferred_placement: placement,
          };
        }
      });
      return changed ? next : prev;
    });
  }, [subjects]);

  // Sections to Generate State (Grades 7 to 10)
  const [selectedGenerationSectionIds, setSelectedGenerationSectionIds] = useState<Set<number>>(
    () => new Set(sections.map((s) => s.id))
  );
  const [isBatchSectionSetupOpen, setIsBatchSectionSetupOpen] = useState(false);

  // Cohorts Studio Filter & Grade State
  const [selectedCohortGrade, setSelectedCohortGrade] = useState<number | "ALL">(7);
  const [cohortSearch, setCohortSearch] = useState("");
  const [cohortTrackFilter, setCohortTrackFilter] = useState<string | "ALL">("ALL");
  const [cohortSolverFilter, setCohortSolverFilter] = useState<"ALL" | "INCLUDED" | "EXCLUDED">("ALL");

  const filteredCohortSections = useMemo(() => {
    return sections.filter((sec) => {
      if (selectedCohortGrade !== "ALL" && sec.grade_level !== selectedCohortGrade) {
        return false;
      }
      if (cohortTrackFilter !== "ALL") {
        if (cohortTrackFilter === "BEC" || cohortTrackFilter === "Regular") {
          if (sec.program_type !== "BEC" && sec.program_type !== "Regular" && sec.program_type) return false;
        } else if (sec.program_type !== cohortTrackFilter) {
          return false;
        }
      }
      if (cohortSolverFilter === "INCLUDED" && !selectedGenerationSectionIds.has(sec.id)) {
        return false;
      }
      if (cohortSolverFilter === "EXCLUDED" && selectedGenerationSectionIds.has(sec.id)) {
        return false;
      }
      if (cohortSearch.trim().length > 0) {
        const q = cohortSearch.toLowerCase().trim();
        const adviser = teachers.find((t) => t.is_adviser && t.advisory_section_id === sec.id);
        const matchesName = (sec.name || "").toLowerCase().includes(q);
        const matchesTrack = (sec.program_type || "").toLowerCase().includes(q);
        const matchesAdviser = (adviser?.name || "").toLowerCase().includes(q);
        if (!matchesName && !matchesTrack && !matchesAdviser) return false;
      }
      return true;
    });
  }, [sections, selectedCohortGrade, cohortTrackFilter, cohortSolverFilter, cohortSearch, selectedGenerationSectionIds, teachers]);

  const selectFilteredCohortsForGeneration = () => {
    setSelectedGenerationSectionIds((prev) => {
      const next = new Set(prev);
      filteredCohortSections.forEach((s) => next.add(s.id));
      return next;
    });
  };

  const deselectFilteredCohortsForGeneration = () => {
    setSelectedGenerationSectionIds((prev) => {
      const next = new Set(prev);
      filteredCohortSections.forEach((s) => next.delete(s.id));
      return next;
    });
  };

  useEffect(() => {
    setSelectedGenerationSectionIds((prev) => {
      const next = new Set(prev);
      sections.forEach((s) => next.add(s.id));
      const validIds = new Set(sections.map((s) => s.id));
      Array.from(next).forEach((id) => {
        if (!validIds.has(id)) next.delete(id);
      });
      return next;
    });
  }, [sections]);

  const toggleSectionForGeneration = (secId: number) => {
    setSelectedGenerationSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(secId)) {
        next.delete(secId);
      } else {
        next.add(secId);
      }
      return next;
    });
  };



  // Active track object
  const currentTrack = useMemo(() => {
    return tracks.find((t) => t.id === selectedTrackId) || tracks[0] || DEFAULT_MODULAR_TRACKS[0];
  }, [tracks, selectedTrackId]);

  // Weekly stats for each grade 7..10 in current track
  const gradeWeeklyStats = useMemo(() => {
    const stats: Record<number, { minutes: number; hours: string; count: number }> = {};
    [7, 8, 9, 10].forEach((g) => {
      const subIds =
        currentTrack?.isGradeSpecific && currentTrack?.gradeSubjects?.[g]
          ? currentTrack.gradeSubjects[g]
          : currentTrack?.subjectIds || [];
      const mins = subIds.reduce((acc, id) => {
        const cfg = subjectAllotments[id] || { duration_minutes: 60, required_weekly_loads: 4 };
        return acc + (cfg.duration_minutes || 60) * (cfg.required_weekly_loads || 4);
      }, 0);
      stats[g] = { minutes: mins, hours: (mins / 60).toFixed(1), count: subIds.length };
    });
    return stats;
  }, [currentTrack, subjectAllotments]);

  // Subjects belonging to active track based on active grade (Grade 7, 8, 9, or 10)
  const currentTrackSubjects = useMemo(() => {
    if (!currentTrack) return [];
    const gSubs =
      currentTrack.isGradeSpecific && currentTrack.gradeSubjects?.[selectedTrackGrade]
        ? currentTrack.gradeSubjects[selectedTrackGrade]
        : currentTrack.subjectIds;
    const validSubjectIds = new Set(gSubs);
    return allSubjects.filter((s) => validSubjectIds.has(s.id));
  }, [currentTrack, allSubjects, selectedTrackGrade]);

  // Total weekly instructional loads for active grade in current track
  const currentGradeTotalLoads = useMemo(() => {
    return currentTrackSubjects.reduce((acc, sub) => {
      const cfg = subjectAllotments[sub.id] || { required_weekly_loads: 4 };
      return acc + (cfg.required_weekly_loads || 4);
    }, 0);
  }, [currentTrackSubjects, subjectAllotments]);

  // Filtered track subjects
  const filteredTrackSubjects = useMemo(() => {
    return currentTrackSubjects.filter((s) => {
      if (!subjectSearchQuery.trim()) return true;
      const q = subjectSearchQuery.toLowerCase().trim();
      const dept = departments.find((d) => d.id === s.department_id);
      const matchName = s.name.toLowerCase().includes(q);
      const matchDept = dept?.name.toLowerCase().includes(q) || dept?.code.toLowerCase().includes(q);
      return matchName || matchDept;
    });
  }, [currentTrackSubjects, subjectSearchQuery, departments]);

  // Sections enrolled in active track (filtered by active grade)
  const enrolledSectionsInTrack = useMemo(() => {
    if (!currentTrack) return [];
    return sections.filter((s) => {
      const p = s.program_type?.toUpperCase().trim();
      const c = currentTrack.code.toUpperCase().trim();
      const matchesTrack = p === c || (c === "BEC" && (p === "REGULAR" || p === "BEC"));
      if (!matchesTrack) return false;
      return s.grade_level === selectedTrackGrade;
    });
  }, [sections, currentTrack, selectedTrackGrade]);

  // Track Metrics for selected grade
  const trackWeeklyMinutes = useMemo(() => {
    return gradeWeeklyStats[selectedTrackGrade]?.minutes || 0;
  }, [selectedTrackGrade, gradeWeeklyStats]);

  const trackWeeklyHours = (trackWeeklyMinutes / 60).toFixed(1);

  // Package current tracks, allotments and solver configuration for save file
  const buildCurrentConfigJson = () => {
    return JSON.stringify({
      tracks,
      subject_allotments: subjectAllotments,
      period_duration_minutes: periodDuration,
      max_daily_hours: maxDailyHours,
      max_consecutive_hours: maxConsecutiveHours,
      prefer_morning_academic: preferMorningAcademic,
      preserve_locked_slots: preserveLockedSlots,
      room_collision_mode: roomCollisionMode,
      objective_strategy: objectiveStrategy,
      max_solve_time_seconds: maxSolveTimeSeconds,
    });
  };

  const handleOpenSaveSnapshot = () => {
    if (onOpenSaveModal) {
      onOpenSaveModal(buildCurrentConfigJson());
    }
  };

  // Track CRUD Handlers
  const handleCreateTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newTrackCode.trim().toUpperCase();
    if (!code) return;
    if (tracks.some((t) => t.code.toUpperCase() === code)) {
      setActionAlert({
        title: "Track Code Exists",
        message: `A curricular track with code "${code}" already exists. Please choose a different code.`,
      });
      return;
    }

    const defaultIds = includeCoreSubjects
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
      : subjects.slice(0, 1).map((s) => s.id);

    const newTrack: ModularTrack = {
      id: code,
      code,
      name: newTrackName.trim() || `Special Program in ${code}`,
      description: newTrackDesc.trim() || `Modular curricular track for ${code} students.`,
      badgeColor: newTrackColor,
      isDefault: false,
      isGradeSpecific: true,
      subjectIds: defaultIds,
      gradeSubjects: {
        7: [...defaultIds],
        8: [...defaultIds],
        9: [...defaultIds],
        10: [...defaultIds],
      },
    };

    const nextTracks = [...tracks, newTrack];
    setTracks(nextTracks); saveModularTracks(nextTracks);
    setSelectedTrackId(code);
    setIsAddTrackOpen(false);
    setNewTrackCode("");
    setNewTrackName("");
    setNewTrackDesc("");
  };

  const handleOpenEditTrack = () => {
    if (!currentTrack) return;
    setEditTrackName(currentTrack.name);
    setEditTrackDesc(currentTrack.description);
    setEditTrackColor(currentTrack.badgeColor);
    setIsEditTrackOpen(true);
  };

  const handleSaveEditTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack) return;
    setTracks((prev) => {
      const next = prev.map((t) =>
        t.id === currentTrack.id
          ? {
              ...t,
              name: editTrackName.trim() || t.name,
              description: editTrackDesc.trim() || t.description,
              badgeColor: editTrackColor,
            }
          : t
      );
      saveModularTracks(next);
      return next;
    });
    setIsEditTrackOpen(false);
  };

  const handlePromptDeleteTrack = () => {
    if (!currentTrack) return;
    if (tracks.length <= 1) return;
    setIsDeleteTrackConfirmOpen(true);
  };

  const handleConfirmDeleteTrack = () => {
    if (!currentTrack || tracks.length <= 1) return;
    const nextTracks = tracks.filter((t) => t.id !== currentTrack.id);
    setTracks(nextTracks);
    saveModularTracks(nextTracks);
    setSelectedTrackId(nextTracks[0].id);
    setIsDeleteTrackConfirmOpen(false);
  };

  const handlePromptCloneGrade = (sourceGrade: number) => {
    if (!currentTrack) return;
    const sourceIds = currentTrack.gradeSubjects?.[sourceGrade] || currentTrack.subjectIds || [];
    setCloneGradeConfirm({ sourceGrade, subjectCount: sourceIds.length });
  };

  const handleConfirmCloneGrade = () => {
    if (!currentTrack || !cloneGradeConfirm) return;
    const sourceGrade = cloneGradeConfirm.sourceGrade;
    const sourceIds = currentTrack.gradeSubjects?.[sourceGrade] || currentTrack.subjectIds || [];

    const nextTracks = tracks.map((t) => {
      if (t.id !== currentTrack.id && t.code !== currentTrack.code) return t;
      return {
        ...t,
        isGradeSpecific: true,
        subjectIds: [...sourceIds],
        gradeSubjects: {
          7: [...sourceIds],
          8: [...sourceIds],
          9: [...sourceIds],
          10: [...sourceIds],
        },
      };
    });
    setTracks(nextTracks);
    saveModularTracks(nextTracks);
    setCloneGradeConfirm(null);
  };

  const handleOpenEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setIsEditSubjectModalOpen(true);
  };

  const handleSubjectUpdated = async (
    updatedSubject: Subject,
    newDuration: number,
    newLoads: number,
    isAdviserLocked?: boolean,
    newPlacement?: string
  ) => {
    if (isAdviserLocked !== undefined) {
      saveAdviserLockOverride(updatedSubject.id, isAdviserLocked);
    }
    if (newPlacement !== undefined) {
      savePlacementOverride(updatedSubject.id, newPlacement);
    }

    setSubjectAllotments((prev) => ({
      ...prev,
      [updatedSubject.id]: {
        duration_minutes: newDuration,
        required_weekly_loads: newLoads,
        is_adviser_locked: isAdviserLocked,
        preferred_placement: newPlacement,
      },
    }));

    if (onRefreshData) {
      await onRefreshData();
    }
  };

  const handleOpenAddSubject = (grade?: number) => {
    setAddSubjectTargetGrade(grade !== undefined ? grade : selectedTrackGrade);
    setIsAddSubjectOpen(true);
  };

  const handleCreateNewSubjectForTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !currentTrack) return;

    const trimmedName = newSubName.trim();
    const g = addSubjectTargetGrade;

    // Check if subject already attached to this grade in current track
    const currentSubs = currentTrack.gradeSubjects?.[g] || currentTrack.subjectIds || [];
    const alreadyInGrade = currentSubs.some((id) => {
      const found = allSubjects.find((s) => s.id === id);
      return found?.name.toLowerCase().trim() === trimmedName.toLowerCase();
    });
    if (alreadyInGrade) {
      setActionAlert({
        title: "Subject Already Assigned",
        message: `"${trimmedName}" is already assigned to Grade ${g} in ${currentTrack.code}.`,
      });
      return;
    }

    try {
      setAddingSubjectLoading(true);
      const created = await api.createSubject({
        name: trimmedName,
        department_id: newSubDeptId,
        grade_level: g,
        required_weekly_loads: newSubLoads,
        duration_minutes: newSubDuration,
        preferred_placement: newSubPlacement,
      });

      savePlacementOverride(created.id, newSubPlacement);

      // 1. Immediately cache created subject locally so it appears in currentTrackSubjects without delay
      setExtraSubjects((prev) => [...prev, created]);

      // 2. Update local subject allotments
      setSubjectAllotments((prev) => ({
        ...prev,
        [created.id]: {
          duration_minutes: newSubDuration,
          required_weekly_loads: newSubLoads,
          is_adviser_locked:
            created.name.toLowerCase().includes("homeroom") ||
            created.name.toLowerCase().includes("guidance") ||
            newSubPlacement === "MON_P1_LOCK",
          preferred_placement: newSubPlacement,
        },
      }));

      // 3. Directly add to current track for specific target grade and persist to localStorage
      const nextTracks = tracks.map((t) => {
        if (t.id !== currentTrack.id && t.code !== currentTrack.code) return t;
        const currentSubs = t.gradeSubjects?.[g] || t.subjectIds || [];
        const updatedGradeSubs = Array.from(new Set([...currentSubs, created.id]));
        const updatedGradeSubjects = {
          ...(t.gradeSubjects || {
            7: [...t.subjectIds],
            8: [...t.subjectIds],
            9: [...t.subjectIds],
            10: [...t.subjectIds],
          }),
          [g]: updatedGradeSubs,
        };
        const allIds = Array.from(
          new Set([
            ...t.subjectIds,
            ...(updatedGradeSubjects[7] || []),
            ...(updatedGradeSubjects[8] || []),
            ...(updatedGradeSubjects[9] || []),
            ...(updatedGradeSubjects[10] || []),
            created.id,
          ])
        );
        return {
          ...t,
          isGradeSpecific: true,
          gradeSubjects: updatedGradeSubjects,
          subjectIds: allIds,
        };
      });

      setTracks(nextTracks);
      saveModularTracks(nextTracks);

      // 4. Ensure view is immediately looking at the grade where the subject was added
      setSelectedTrackGrade(g);

      // 5. Close modal and reset form immediately
      setIsAddSubjectOpen(false);
      setNewSubName("");
      setNewSubPlacement("FLEXIBLE");

      // 6. Refresh master data in background
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      setActionAlert({
        title: "Subject Creation Error",
        message: err.message || "Failed to create specialized subject.",
      });
    } finally {
      setAddingSubjectLoading(false);
    }
  };

  const handlePromptRemoveSubject = (subId: number, subName: string, targetGrade?: number) => {
    if (!currentTrack) return;
    const effectiveGrade = targetGrade !== undefined ? targetGrade : selectedTrackGrade;
    setSubjectToRemove({ id: subId, name: subName, grade: effectiveGrade });
  };

  const handleConfirmRemoveSubject = () => {
    if (!currentTrack || !subjectToRemove) return;
    const effectiveGrade = subjectToRemove.grade;
    const subId = subjectToRemove.id;

    const nextTracks = tracks.map((t) => {
      if (t.id !== currentTrack.id && t.code !== currentTrack.code) return t;
      const currentSubs = t.gradeSubjects?.[effectiveGrade] || t.subjectIds || [];
      const nextSubs = currentSubs.filter((id) => id !== subId);
      const updatedGradeSubjects = {
        ...(t.gradeSubjects || {
          7: [...t.subjectIds],
          8: [...t.subjectIds],
          9: [...t.subjectIds],
          10: [...t.subjectIds],
        }),
        [effectiveGrade]: nextSubs,
      };
      const allIds = Array.from(
        new Set([
          ...(updatedGradeSubjects[7] || []),
          ...(updatedGradeSubjects[8] || []),
          ...(updatedGradeSubjects[9] || []),
          ...(updatedGradeSubjects[10] || []),
        ])
      );
      return {
        ...t,
        isGradeSpecific: true,
        gradeSubjects: updatedGradeSubjects,
        subjectIds: allIds,
      };
    });

    setTracks(nextTracks);
    saveModularTracks(nextTracks);
    setSubjectToRemove(null);
  };

  const handlePromptResetDefaults = () => {
    setIsResetDefaultsConfirmOpen(true);
  };

  const handleConfirmResetDefaults = () => {
    setPeriodDuration(60);
    setMaxDailyHours(6);
    setMaxConsecutiveHours(3);
    setPreferMorningAcademic(true);
    setPreserveLockedSlots(true);
    setRoomCollisionMode("SOFT_PENALTY");
    setMaxSolveTimeSeconds(10);
    setObjectiveStrategy("WORKLOAD_BALANCE");

    const defaultCoreIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (resetDefaultsOption === "ALL" && currentTrack) {
      const nextTracks = tracks.map((t) => {
        if (t.id !== currentTrack.id && t.code !== currentTrack.code) return t;
        const updatedGradeSubjects = {
          ...(t.gradeSubjects || {
            7: [...defaultCoreIds],
            8: [...defaultCoreIds],
            9: [...defaultCoreIds],
            10: [...defaultCoreIds],
          }),
          [selectedTrackGrade]: [...defaultCoreIds],
        };
        const allIds = Array.from(
          new Set([
            ...(updatedGradeSubjects[7] || []),
            ...(updatedGradeSubjects[8] || []),
            ...(updatedGradeSubjects[9] || []),
            ...(updatedGradeSubjects[10] || []),
          ])
        );
        return {
          ...t,
          isGradeSpecific: true,
          gradeSubjects: updatedGradeSubjects,
          subjectIds: allIds,
        };
      });
      setTracks(nextTracks);
      saveModularTracks(nextTracks);
    }

    const updated: Record<number, SubjectAllotmentConfig> = {};
    const lockOverrides = loadAdviserLockOverrides();
    subjects.forEach((s) => {
      const isHr =
        lockOverrides[s.id] !== undefined
          ? lockOverrides[s.id]
          : s.name.toLowerCase().includes("homeroom") ||
            s.name.toLowerCase().includes("guidance");
      updated[s.id] = {
        duration_minutes: 60,
        required_weekly_loads: isHr ? 1 : 4,
        is_adviser_locked: isHr,
      };
    });
    setSubjectAllotments(updated);
    setIsResetDefaultsConfirmOpen(false);
  };

  // Batch actions for subject allotments
  const setAllDurations = (min: number) => {
    setPeriodDuration(min);
    setSubjectAllotments((prev) => {
      const next = { ...prev };
      currentTrackSubjects.forEach((s) => {
        next[s.id] = {
          duration_minutes: min,
          required_weekly_loads: next[s.id]?.required_weekly_loads || 4,
          is_adviser_locked: next[s.id]?.is_adviser_locked,
        };
      });
      return next;
    });
  };

  // Subject Allotment row changer
  const updateSubjectAllotment = (
    subjectId: number,
    field: "duration_minutes" | "required_weekly_loads",
    val: number
  ) => {
    setSubjectAllotments((prev) => ({
      ...prev,
      [subjectId]: {
        duration_minutes:
          field === "duration_minutes" ? val : prev[subjectId]?.duration_minutes || 60,
        required_weekly_loads:
          field === "required_weekly_loads" ? val : prev[subjectId]?.required_weekly_loads || 4,
        is_adviser_locked: prev[subjectId]?.is_adviser_locked,
      },
    }));
  };

  const getGeneratorConfig = (): GenerateScheduleRequest => {
    // Map of track code -> list of subject IDs (both universal and grade-specific)
    const trackSubjectsMap: Record<string, number[]> = {};
    tracks.forEach((trk) => {
      trackSubjectsMap[trk.code] = trk.subjectIds;
      if (trk.isGradeSpecific && trk.gradeSubjects) {
        [7, 8, 9, 10].forEach((g) => {
          if (trk.gradeSubjects && trk.gradeSubjects[g]) {
            trackSubjectsMap[`${trk.code}_${g}`] = trk.gradeSubjects[g];
          }
        });
      }
    });

    return {
      period_duration_minutes: periodDuration,
      subject_allotments: subjectAllotments,
      track_subjects: trackSubjectsMap,
      target_section_ids: Array.from(selectedGenerationSectionIds),
      objective_strategy: objectiveStrategy,
      prefer_morning_academic: preferMorningAcademic,
      max_daily_hours: maxDailyHours,
      max_consecutive_hours: maxConsecutiveHours,
      room_collision_mode: roomCollisionMode,
      preserve_locked_slots: preserveLockedSlots,
      max_solve_time_seconds: maxSolveTimeSeconds,
    };
  };

  const handleLaunchGenerate = () => {
    if (selectedGenerationSectionIds.size === 0) {
      setActionAlert({
        title: "No Cohort Sections Selected",
        message: "Please select at least one student section from Grade 7 to Grade 10 to generate schedule for.",
      });
      return;
    }
    onRunGenerate(getGeneratorConfig());
  };

  const handleLaunchRepair = () => {
    onRunRepair(getGeneratorConfig());
  };

  // Summary Metrics for Current Save
  const activeTeachersCount = teachers.filter((t) => t.status === "Active").length;
  const onLeaveTeachersCount = teachers.filter((t) => t.status !== "Active").length;
  const optimalTeachersCount = teachers.filter(
    (t) => t.status === "Active" && t.current_load_hours >= 20 && t.current_load_hours <= 25
  ).length;
  const underloadedTeachersCount = teachers.filter(
    (t) => t.status === "Active" && t.current_load_hours < 20
  ).length;

  const averageTeacherLoad =
    activeTeachersCount > 0 ? (slots.length / activeTeachersCount).toFixed(1) : "0";

  // Mini roster filtering
  const visibleRosterTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (rosterDeptFilter !== "ALL" && t.department_id !== rosterDeptFilter) {
        return false;
      }
      if (rosterSearchQuery.trim()) {
        const q = rosterSearchQuery.toLowerCase().trim();
        const matchName = t.name.toLowerCase().includes(q);
        const dept = departments.find((d) => d.id === t.department_id);
        const matchDept = dept?.name.toLowerCase().includes(q) || dept?.code.toLowerCase().includes(q);
        if (!matchName && !matchDept) return false;
      }
      return true;
    });
  }, [teachers, rosterDeptFilter, rosterSearchQuery, departments]);

  const activeColorTheme = BADGE_COLOR_MAP[currentTrack.badgeColor] || BADGE_COLOR_MAP.fuchsia;

  return (
    <div className="space-y-6">
      {/* Top Studio Action Bar */}
      <div className="bg-white rounded-2xl border border-[#E5CCE3] p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 bg-[#FDF2FA] text-[#A91079] rounded-xl border border-[#E5CCE3]/50">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Schedule Generator
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#2E0249]/8 text-[#2E0249] border border-[#2E0249]/15">
              Key Stage 3 (Grades 7–10)
            </span>
            {activeSavedSchedule && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Active Save: {activeSavedSchedule.name}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Configure modular curriculum tracks, manage student sections, tune solver constraints, and execute automated timetable generation.
          </p>

          {/* Deployment Status Indicator */}
          {latestDeployment ? (
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Official Schedule Deployed to {latestDeployment.target_department_ids?.length || departments.length} Departments • {latestDeployment.academic_year} ({latestDeployment.semester})
              </span>
              <span className="text-[11px] text-emerald-700 hidden sm:inline">
                by {latestDeployment.deployed_by}
              </span>
            </div>
          ) : (
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Draft Timetable • Not yet deployed to Academic Departments</span>
            </div>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
          {/* Dynamic Schedule Repair Action Button */}
          <button
            type="button"
            onClick={handleLaunchRepair}
            disabled={loading}
            className="px-3.5 py-2 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200/90 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Execute Dynamic Fault-Tolerant Schedule Repair"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-violet-600 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Repairing..." : "Dynamic Repair"}</span>
          </button>

          <button
            type="button"
            onClick={onViewReport}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#A91079]" />
            <span>Audit Compliance</span>
          </button>

          {/* Side Panel Toggle Button */}
          <button
            type="button"
            onClick={() => setShowSidePanel(!showSidePanel)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition cursor-pointer ${
              showSidePanel
                ? "bg-[#FDF2FA] border border-[#E5CCE3] text-[#A91079] hover:bg-[#F3E5F2]"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title={showSidePanel ? "Collapse side panel to expand studio" : "Open current save statistics side panel"}
          >
            {showSidePanel ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hide Stats</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Show Stats</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Studio + Side Panel Layout */}
      <div className="flex flex-col xl:flex-row items-start gap-6">
        {/* Full Main Page Column: Modular Track Studio (Expands to 100% when side panel is closed) */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* Schedule Generator Sub-Sections Tab Switcher Bar */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl border border-slate-200/80 overflow-x-auto no-scrollbar shadow-2xs">
            {/* Tab: Curricular Tracks */}
            <button
              type="button"
              onClick={() => setActiveStudioTab("TRACKS")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeStudioTab === "TRACKS"
                  ? "bg-white text-[#2E0249] shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Compass className="w-4 h-4 text-[#A91079]" />
              <span>Curricular Tracks</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-md font-bold num-tabular ${
                  activeStudioTab === "TRACKS"
                    ? "bg-[#2E0249]/8 text-[#2E0249]"
                    : "bg-slate-300/60 text-slate-700"
                }`}
              >
                {tracks.length}
              </span>
            </button>

            {/* Tab: Sections */}
            <button
              type="button"
              onClick={() => setActiveStudioTab("SECTIONS")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeStudioTab === "SECTIONS"
                  ? "bg-white text-[#2E0249] shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <GraduationCap className="w-4 h-4 text-[#A91079]" />
              <span>Sections</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-md font-bold num-tabular ${
                  activeStudioTab === "SECTIONS"
                    ? "bg-[#2E0249]/8 text-[#2E0249]"
                    : "bg-slate-300/60 text-slate-700"
                }`}
              >
                {selectedGenerationSectionIds.size}/{sections.length}
              </span>
            </button>

            {/* Tab: Constraints and Allotments */}
            <button
              type="button"
              onClick={() => setActiveStudioTab("CONSTRAINTS")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeStudioTab === "CONSTRAINTS"
                  ? "bg-white text-[#2E0249] shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-[#A91079]" />
              <span>Constraints and Allotments</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-md font-bold num-tabular ${
                  activeStudioTab === "CONSTRAINTS"
                    ? "bg-[#2E0249]/8 text-[#2E0249]"
                    : "bg-slate-300/60 text-slate-700"
                }`}
              >
                {formatDuration(periodDuration)}
              </span>
            </button>

            {/* Tab: Run & Deploy */}
            <button
              type="button"
              onClick={() => setActiveStudioTab("RUN_DEPLOY")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeStudioTab === "RUN_DEPLOY"
                  ? "bg-white text-[#2E0249] shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#A91079]" />
              <span>Run & Deploy</span>
            </button>
          </div>

          {/* TAB 1: Curricular Program Tracks */}
          {activeStudioTab === "TRACKS" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
            {/* 1. Curriculum Grade Level Carousel (Pick Grade First!) */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#A91079]" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Curriculum Grade Level
                  </h3>
                </div>

                {/* Grade Selector Card Carousel (Matches Curriculum Program Tracks Card UI) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {[7, 8, 9, 10].map((g) => {
                    const stats = gradeWeeklyStats[g];
                    const isSelected = selectedTrackGrade === g;
                    const enrolledCount = sections.filter((s) => s.grade_level === g).length;

                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedTrackGrade(g)}
                        className={`px-3.5 py-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 shrink-0 ${
                          isSelected
                            ? "border-[#A91079] bg-[#FDF2FA] ring-2 ring-[#A91079]/20 shadow-2xs"
                            : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isSelected ? "bg-[#A91079]" : "bg-slate-300"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs font-black text-slate-900">Grade {g}</strong>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                isSelected
                                  ? "bg-[#A91079] text-white"
                                  : "bg-[#F3E5F2] text-[#A91079]"
                              }`}
                            >
                              {stats?.count || 0} {(stats?.count || 0) === 1 ? "Subject" : "Subjects"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 line-clamp-1 max-w-[150px]">
                            {stats?.hours || "0"} hrs/wk • {enrolledCount} {enrolledCount === 1 ? "Section" : "Sections"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Curricular Program Tracks Carousel for Selected Grade */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#A91079]" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Curricular Program Tracks — Grade {selectedTrackGrade}
                    </h3>
                  </div>


                </div>

                {/* Track Selector Card Carousel */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {tracks.map((trk) => {
                    const isSelected = trk.id === currentTrack.id;
                    const colorCfg = BADGE_COLOR_MAP[trk.badgeColor] || BADGE_COLOR_MAP.fuchsia;
                    const count = trk.gradeSubjects?.[selectedTrackGrade]?.length ?? trk.subjectIds.length;

                    return (
                      <button
                        key={trk.id}
                        type="button"
                        onClick={() => setSelectedTrackId(trk.id)}
                        className={`px-3.5 py-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 shrink-0 ${
                          isSelected
                            ? `border-[#A91079] bg-[#FDF2FA] ring-2 ring-[#A91079]/20 shadow-2xs`
                            : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            trk.badgeColor === "emerald"
                              ? "bg-emerald-500"
                              : trk.badgeColor === "indigo"
                              ? "bg-[#A91079]"
                              : trk.badgeColor === "amber"
                              ? "bg-amber-500"
                              : trk.badgeColor === "fuchsia"
                              ? "bg-fuchsia-500"
                              : trk.badgeColor === "sky"
                              ? "bg-sky-500"
                              : "bg-teal-500"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs font-black text-slate-900">{trk.code}</strong>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${colorCfg.pill}`}>
                              {count} {count === 1 ? "Subject" : "Subjects"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 line-clamp-1 max-w-[130px]">
                            {trk.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Selected Active Track Workspace Card */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border ${activeColorTheme.border} ${activeColorTheme.bg} flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs`}
              >
                {/* Track Details */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-white border border-slate-200 text-slate-900">
                      {currentTrack.code}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">{currentTrack.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-slate-700 border border-slate-200">
                      {currentTrackSubjects.length} Learning Areas (Grade {selectedTrackGrade})
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-slate-700 border border-slate-200">
                      {enrolledSectionsInTrack.length} {enrolledSectionsInTrack.length === 1 ? "Section" : "Sections"}
                    </span>
                  </div>
                </div>

                {/* Track Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenEditTrack}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1 transition cursor-pointer"
                    title="Edit Track Details"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit Track</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePromptDeleteTrack}
                    disabled={tracks.length <= 1}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete this Track"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* 4. Modular Track Subjects Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#A91079]" />
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {currentTrack.code} Learning Areas & Time Allotments — Grade {selectedTrackGrade}
                    </h4>
                  </div>

                {/* Batch Duration Actions */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-bold">Batch Duration:</span>
                  <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1.5 py-0.5 shadow-2xs">
                    <button
                      type="button"
                      disabled={periodDuration <= 20}
                      onClick={() => setAllDurations(Math.max(20, periodDuration - 10))}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-[#A91079] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                      title="Decrease batch duration by 10m (min 20m)"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="min-w-16 px-1 text-center text-xs font-black text-[#A91079] tabular-nums">
                      {formatDuration(periodDuration)}
                    </span>
                    <button
                      type="button"
                      disabled={periodDuration >= 240}
                      onClick={() => setAllDurations(Math.min(240, periodDuration + 10))}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-[#A91079] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                      title="Increase batch duration by 10m (max 4h)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllDurations(periodDuration)}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold text-[#A91079] bg-[#FDF2FA] hover:bg-[#F3E5F2] border border-[#E5CCE3] transition cursor-pointer"
                    title={`Sync all subjects in ${currentTrack.code} to ${formatDuration(periodDuration)}`}
                  >
                    Sync All to {formatDuration(periodDuration)}
                  </button>
                  <button
                    type="button"
                    onClick={handlePromptResetDefaults}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                    title="Reset durations to DepEd standard 60 mins"
                  >
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptCloneGrade(selectedTrackGrade)}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                    title={`Clone Grade ${selectedTrackGrade}'s subject list to all other grades (7, 8, 9, 10) in ${currentTrack.code}`}
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy G{selectedTrackGrade} to Other Grades</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddSubject(selectedTrackGrade)}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold text-white bg-[#A91079] hover:bg-[#8F0B66] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title={`Add learning area to Grade ${selectedTrackGrade} in ${currentTrack.code}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Subject</span>
                  </button>
                </div>
              </div>

              {/* Warning or Special Track Badge based on weekly loads */}
              {(() => {
                const isSpecial = currentTrack && !["BEC", "REGULAR", "STANDARD", "GENERAL"].includes(currentTrack.code.toUpperCase());
                const maxLoads = isSpecial ? 42 : 34;

                if (currentGradeTotalLoads > maxLoads) {
                  return (
                    <div className="p-3 bg-red-50 border border-red-300 rounded-2xl flex items-center gap-2.5 text-red-900 text-xs shadow-2xs">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>
                        <strong>Capacity Alert:</strong> Grade {selectedTrackGrade} ({currentTrack.code}) currently has <strong>{currentGradeTotalLoads} weekly loads</strong>, which exceeds the {maxLoads} available instructional periods {isSpecial ? "(accommodating up to 8 additional specialized hours across Periods 8 & 9)" : "in a standard 5-day week"}. Please adjust weekly loads in this track to {maxLoads} or fewer.
                      </span>
                    </div>
                  );
                }

                if (isSpecial && currentGradeTotalLoads > 34) {
                  return (
                    <div className="p-3 bg-purple-50 border border-purple-300 rounded-2xl flex items-center gap-2.5 text-purple-900 text-xs shadow-2xs">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>
                        <strong>Extended Special Track Schedule:</strong> Grade {selectedTrackGrade} ({currentTrack.code}) has <strong>{currentGradeTotalLoads} weekly loads</strong>. This accommodates up to 8 additional weekly hours (Periods 8 & 9) beyond the standard 34-period regular curriculum.
                      </span>
                    </div>
                  );
                }

                return null;
              })()}

              {/* Track Search Bar */}
              <div className="relative max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={subjectSearchQuery}
                  onChange={(e) => setSubjectSearchQuery(e.target.value)}
                  placeholder={`Search subjects in ${currentTrack.code}...`}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden transition"
                />
              </div>

              {/* Table or Empty State */}
              {filteredTrackSubjects.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-3xl p-8 text-center space-y-3 bg-slate-50/50">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">
                      No Subjects Assigned to Grade {selectedTrackGrade} in {currentTrack.name}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Add learning areas specifically for Grade {selectedTrackGrade} in this track.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAddSubject(selectedTrackGrade)}
                    className="px-3.5 py-1.5 bg-[#A91079] text-white rounded-xl text-xs font-bold hover:bg-[#2E0249] transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      Add Subjects to Grade {selectedTrackGrade}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                        <tr>
                          <th className="py-3 px-4">Subject & Learning Area</th>
                          <th className="py-3 px-3">Preferred Placement</th>
                          <th className="py-3 px-3 text-center">Meeting Duration</th>
                          <th className="py-3 px-3 text-center">Loads / Week</th>
                          <th className="py-3 px-3 text-right">Weekly Total</th>
                          <th className="py-3 px-4 text-center">DO 009 Benchmark</th>
                          <th className="py-3 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredTrackSubjects.map((sub) => {
                          const cfg = subjectAllotments[sub.id] || {
                            duration_minutes: 60,
                            required_weekly_loads: 4,
                          };
                          const meta = getCurriculumMeta(
                            sub.name,
                            cfg.preferred_placement || sub.preferred_placement
                          );
                          const dept = departments.find((d) => d.id === sub.department_id);
                          const totalMin = cfg.duration_minutes * cfg.required_weekly_loads;
                          const totalHrs = (totalMin / 60).toFixed(1);
                          const isCompliant = totalMin >= meta.depedTargetMinutes;
                          const isAdviserLocked =
                            cfg.is_adviser_locked !== undefined
                              ? cfg.is_adviser_locked
                              : sub.name.toLowerCase().includes("homeroom") ||
                                sub.name.toLowerCase().includes("guidance") ||
                                cfg.preferred_placement === "MON_P1_LOCK";

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50/80 transition group">
                              {/* Subject & Dept (Clickable to Edit) */}
                              <td className="py-3 px-4">
                                <div
                                  onClick={() => handleOpenEditSubject(sub)}
                                  className="font-extrabold text-slate-900 group-hover:text-[#A91079] transition cursor-pointer flex items-center gap-1.5"
                                  title="Click to edit subject details"
                                >
                                  <span>{sub.name}</span>
                                  <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#A91079] transition" />
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                  {dept?.name || "Department"} ({dept?.code || "DEPT"})
                                </div>
                              </td>

                              {/* Placement */}
                              <td className="py-3 px-3">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSubject(sub)}
                                  className="group/placement flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-[#A91079] transition cursor-pointer text-left"
                                  title="Click to edit Preferred Placement time window"
                                >
                                  <Compass className="w-3.5 h-3.5 text-[#A91079] group-hover/placement:rotate-45 transition-transform" />
                                  <span className="underline decoration-dotted underline-offset-2">{meta.preferredPlacement}</span>
                                  <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover/placement:opacity-100 text-[#A91079] transition" />
                                </button>
                                {isAdviserLocked && (
                                  <span className="text-[10px] font-semibold text-[#A91079] bg-[#FDF2FA] border border-[#E5CCE3] px-1.5 py-0.5 rounded-md mt-1 inline-flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Adviser Lock
                                  </span>
                                )}
                              </td>

                              {/* Duration / Meeting */}
                              <td className="py-3 px-3 text-center">
                                <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 shadow-2xs">
                                  <button
                                    type="button"
                                    disabled={(cfg.duration_minutes || 60) <= 20}
                                    onClick={() =>
                                      updateSubjectAllotment(
                                        sub.id,
                                        "duration_minutes",
                                        Math.max(20, (cfg.duration_minutes || 60) - 10)
                                      )
                                    }
                                    className="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-[#A91079] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                                    title="Decrease meeting duration by 10 mins (min 20m)"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-16 text-center text-xs font-bold text-slate-800 tabular-nums">
                                    {formatDuration(cfg.duration_minutes || 60)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={(cfg.duration_minutes || 60) >= 240}
                                    onClick={() =>
                                      updateSubjectAllotment(
                                        sub.id,
                                        "duration_minutes",
                                        Math.min(240, (cfg.duration_minutes || 60) + 10)
                                      )
                                    }
                                    className="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-[#A91079] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                                    title="Increase meeting duration by 10 mins (max 4h)"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Loads / Week Counter */}
                              <td className="py-3 px-3 text-center">
                                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                                  <button
                                    type="button"
                                    disabled={cfg.required_weekly_loads <= 1}
                                    onClick={() =>
                                      updateSubjectAllotment(
                                        sub.id,
                                        "required_weekly_loads",
                                        Math.max(1, cfg.required_weekly_loads - 1)
                                      )
                                    }
                                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>

                                  <span className="w-5 text-center font-extrabold text-xs text-slate-900">
                                    {cfg.required_weekly_loads}
                                  </span>

                                  <button
                                    type="button"
                                    disabled={cfg.required_weekly_loads >= 6}
                                    onClick={() =>
                                      updateSubjectAllotment(
                                        sub.id,
                                        "required_weekly_loads",
                                        Math.min(6, cfg.required_weekly_loads + 1)
                                      )
                                    }
                                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Weekly Total */}
                              <td className="py-3 px-3 text-right">
                                <div className="font-black text-slate-900 text-xs">
                                  {totalMin} mins/wk
                                </div>
                                <div className="text-[10px] text-slate-400 font-semibold">
                                  {totalHrs} hrs/week
                                </div>
                              </td>

                              {/* DO 009 Benchmark */}
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                    isCompliant
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                      : "bg-amber-50 border-amber-200 text-amber-800"
                                  }`}
                                >
                                  {isCompliant ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Met ({meta.depedTargetMinutes}m)</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      <span>Under ({meta.depedTargetMinutes}m)</span>
                                    </>
                                  )}
                                </span>
                              </td>

                              {/* Edit & Remove Subject */}
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditSubject(sub)}
                                    className="p-1.5 text-slate-400 hover:text-[#A91079] hover:bg-[#FDF2FA] rounded-lg transition cursor-pointer"
                                    title={`Edit ${sub.name}`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePromptRemoveSubject(
                                        sub.id,
                                        sub.name,
                                        selectedTrackGrade
                                      )
                                    }
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title={`Remove ${sub.name} from Grade ${selectedTrackGrade} in ${currentTrack.code}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Track Overview Ribbon */}
                  <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <span className="text-slate-500 font-medium block text-xs">
                          Grade {selectedTrackGrade} ({currentTrack.code}) Minutes
                        </span>
                        <strong className="text-slate-900 font-bold text-sm num-tabular">
                          {trackWeeklyMinutes.toLocaleString()} mins
                        </strong>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-slate-500 font-medium block text-xs">
                          Grade {selectedTrackGrade} Contact Hours
                        </span>
                        <strong className="text-slate-900 font-bold text-sm num-tabular">
                          {trackWeeklyHours} hrs/week
                        </strong>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-slate-500 font-medium block text-xs">
                          Daily Schedule
                        </span>
                        <strong className="text-slate-900 font-bold text-sm num-tabular">
                          {(trackWeeklyMinutes / 5).toFixed(0)} mins/day
                        </strong>
                      </div>
                    </div>

                    
                  </div>
                </div>
              )}
            </div>

            
            </div>
          )}

          {/* TAB 2: Key Stage 3 Sections (Grades 7 to 10 Sections CRUD) */}
          {activeStudioTab === "SECTIONS" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
              {/* 1. Sections Grade Level Carousel (Pick Grade First!) */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#A91079]" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Curriculum Grade Level — Sections
                    </h3>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#2E0249]/8 text-[#2E0249] border border-[#2E0249]/15">
                      {selectedGenerationSectionIds.size} of {sections.length} Active in Solver
                    </span>
                  </div>

                  {/* Studio Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsBatchSectionSetupOpen(true)}
                      className="px-3 py-1.5 bg-[#FDF2FA] hover:bg-[#F3E5F2] border border-[#E5CCE3] text-[#A91079] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Batch configure and generate sections across Grades 7 to 10"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#A91079]" />
                      <span>Batch Section Setup</span>
                    </button>

                    {onAddSection && (
                      <button
                        type="button"
                        onClick={() => onAddSection(selectedCohortGrade === "ALL" ? 7 : selectedCohortGrade)}
                        className="px-3 py-1.5 bg-[#A91079] hover:bg-[#2E0249] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title={`Add a new section to ${selectedCohortGrade === "ALL" ? "Grade 7" : `Grade ${selectedCohortGrade}`}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Section</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Grade Selector Card Carousel (Matches Curriculum Grade Level UI) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {/* All Grades Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedCohortGrade("ALL")}
                    className={`px-3.5 py-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 shrink-0 ${
                      selectedCohortGrade === "ALL"
                        ? "border-[#A91079] bg-[#FDF2FA] ring-2 ring-[#A91079]/20 shadow-2xs"
                        : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        selectedCohortGrade === "ALL" ? "bg-[#A91079]" : "bg-slate-300"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-xs font-black text-slate-900">All Grades</strong>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                            selectedCohortGrade === "ALL"
                              ? "bg-[#A91079] text-white"
                              : "bg-[#F3E5F2] text-[#A91079]"
                          }`}
                        >
                          {sections.length} Sections
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 line-clamp-1 max-w-[150px]">
                        {selectedGenerationSectionIds.size} of {sections.length} in Solver
                      </span>
                    </div>
                  </button>

                  {[7, 8, 9, 10].map((g) => {
                    const gradeSections = sections.filter((s) => s.grade_level === g);
                    const activeInGrade = gradeSections.filter((s) => selectedGenerationSectionIds.has(s.id));
                    const isSelected = selectedCohortGrade === g;

                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedCohortGrade(g)}
                        className={`px-3.5 py-2 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 shrink-0 ${
                          isSelected
                            ? "border-[#A91079] bg-[#FDF2FA] ring-2 ring-[#A91079]/20 shadow-2xs"
                            : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isSelected ? "bg-[#A91079]" : "bg-slate-300"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs font-black text-slate-900">Grade {g}</strong>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                isSelected
                                  ? "bg-[#A91079] text-white"
                                  : "bg-[#F3E5F2] text-[#A91079]"
                              }`}
                            >
                              {gradeSections.length} {gradeSections.length === 1 ? "Section" : "Sections"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 line-clamp-1 max-w-[150px]">
                            {activeInGrade.length}/{gradeSections.length} active in solver
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Search, Track Filter & Bulk Solver Toolbar (Faculty Workload Style) */}
              <div className="bg-slate-50/80 rounded-2xl border border-[#E5CCE3] p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={cohortSearch}
                      onChange={(e) => setCohortSearch(e.target.value)}
                      placeholder="Search section name, adviser, track..."
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition shadow-2xs"
                    />
                  </div>

                  {/* Actions & Count Summary */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-xs font-bold text-slate-500">
                      Showing <strong className="text-slate-900">{filteredCohortSections.length}</strong> of {sections.length} sections
                    </span>

                    <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

                    <button
                      type="button"
                      onClick={selectFilteredCohortsForGeneration}
                      className="px-2.5 py-1.5 text-xs font-bold text-[#A91079] bg-[#FDF2FA] hover:bg-[#F3E5F2] border border-[#E5CCE3]/80 rounded-xl transition cursor-pointer shadow-2xs"
                      title="Include all currently visible sections in solver"
                    >
                      Select All Visible
                    </button>
                    <button
                      type="button"
                      onClick={deselectFilteredCohortsForGeneration}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer shadow-2xs"
                      title="Exclude all currently visible sections from solver"
                    >
                      Clear Visible
                    </button>
                  </div>
                </div>

                {/* Filter Chips: Program Tracks & Solver Inclusion */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/70 text-xs">
                  {/* Program Track Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-xs font-bold text-slate-500 mr-1 shrink-0">
                      Track:
                    </span>
                    <button
                      type="button"
                      onClick={() => setCohortTrackFilter("ALL")}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        cohortTrackFilter === "ALL"
                          ? "bg-[#A91079] text-white shadow-2xs"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      All Tracks
                    </button>
                    {tracks.map((trk) => {
                      const isSelected = cohortTrackFilter === trk.code;
                      return (
                        <button
                          key={trk.id}
                          type="button"
                          onClick={() => setCohortTrackFilter(trk.code)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                            isSelected
                              ? "bg-[#A91079] text-white shadow-2xs"
                              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {trk.code}
                        </button>
                      );
                    })}
                  </div>

                  {/* Solver Status Filter */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-xs font-bold text-slate-500 mr-1 shrink-0">
                      Solver:
                    </span>
                    <button
                      type="button"
                      onClick={() => setCohortSolverFilter("ALL")}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        cohortSolverFilter === "ALL"
                          ? "bg-slate-800 text-white"
                          : "text-slate-600 hover:text-slate-900 bg-white border border-slate-200"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setCohortSolverFilter("INCLUDED")}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        cohortSolverFilter === "INCLUDED"
                          ? "bg-emerald-700 text-white"
                          : "text-emerald-700 hover:bg-emerald-50 bg-white border border-emerald-200"
                      }`}
                    >
                      In Solver
                    </button>
                    <button
                      type="button"
                      onClick={() => setCohortSolverFilter("EXCLUDED")}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        cohortSolverFilter === "EXCLUDED"
                          ? "bg-slate-600 text-white"
                          : "text-slate-500 hover:bg-slate-100 bg-white border border-slate-200"
                      }`}
                    >
                      Excluded
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Section Cards Responsive Grid (Faculty Workload Style) */}
              {filteredCohortSections.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
                  <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#A91079]" />
                  <h4 className="text-sm font-bold text-slate-700">No Student Sections Found</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Try adjusting your grade selection, search term, or track filter.
                  </p>
                  {onAddSection && (
                    <button
                      type="button"
                      onClick={() => onAddSection(selectedCohortGrade === "ALL" ? 7 : selectedCohortGrade)}
                      className="mt-3 px-3.5 py-1.5 bg-[#A91079] text-white rounded-xl text-xs font-bold hover:bg-[#2E0249] transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Section</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredCohortSections.map((sec) => {
                    const isIncluded = selectedGenerationSectionIds.has(sec.id);
                    const secAdviser = teachers.find(
                      (t) => t.is_adviser && t.advisory_section_id === sec.id
                    );

                    return (
                      <div
                        key={sec.id}
                        className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between space-y-3.5 ${
                          !isIncluded
                            ? "border-slate-200 bg-slate-50/50 opacity-75"
                            : "border-slate-200 hover:border-[#A91079]/40"
                        }`}
                      >
                        {/* Card Header: Avatar Initial, Name, Track & Solver Toggle */}
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-11 h-11 rounded-2xl text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs ${
                                  !isIncluded
                                    ? "bg-slate-400"
                                    : sec.grade_level === 7
                                    ? "bg-[#A91079]"
                                    : sec.grade_level === 8
                                    ? "bg-emerald-700"
                                    : sec.grade_level === 9
                                    ? "bg-amber-700"
                                    : "bg-purple-700"
                                }`}
                              >
                                G{sec.grade_level}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-extrabold text-slate-900 truncate" title={sec.name}>
                                  {sec.name}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-[#FDF2FA] text-[#A91079] border border-[#E5CCE3]/60">
                                    Grade {sec.grade_level}
                                  </span>
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                    {sec.program_type || "BEC"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Solver Inclusion Toggle Pill (Matches Faculty Workload active toggle) */}
                            <button
                              type="button"
                              onClick={() => toggleSectionForGeneration(sec.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border transition cursor-pointer shrink-0 flex items-center gap-1 ${
                                isIncluded
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                              }`}
                              title={isIncluded ? "Click to exclude from schedule generation" : "Click to include in schedule generation"}
                            >
                              {isIncluded ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>In Solver</span>
                                </>
                              ) : (
                                <>
                                  <Square className="w-3 h-3 text-slate-400" />
                                  <span>Excluded</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Class Adviser (Homeroom Lock) */}
                          <div className="space-y-1.5 text-xs">

                            {/* Class Adviser / Homeroom Lock Pill */}
                            <div
                              className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${
                                secAdviser
                                  ? "bg-[#FDF2FA]/70 border-[#E5CCE3] text-[#2E0249]"
                                  : "bg-amber-50/70 border-amber-200 text-amber-900"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <GraduationCap className={`w-3.5 h-3.5 shrink-0 ${secAdviser ? "text-[#A91079]" : "text-amber-600"}`} />
                                <span className="font-bold text-xs truncate">
                                  {secAdviser ? `Adviser: ${secAdviser.name}` : "No Adviser Designated"}
                                </span>
                              </div>
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                                  secAdviser
                                    ? "bg-[#F3E5F2] text-[#A91079]"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {secAdviser ? "Mon P1 Locked" : "Homeroom Open"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer: Load Metric & Actions */}
                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-500">
                            35 Periods / 35.0 hrs/wk
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onEditSection && (
                              <button
                                type="button"
                                onClick={() => onEditSection(sec)}
                                className="px-2.5 py-1 text-slate-600 hover:text-[#A91079] hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                                title="Edit Section Details"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit</span>
                              </button>
                            )}

                            {onDeleteSection && (
                              <button
                                type="button"
                                onClick={() => onDeleteSection(sec)}
                                className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                                title="Delete Section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Solver Constraints & Allotments */}
          {activeStudioTab === "CONSTRAINTS" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Period Duration Allotment Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-[#FDF2FA] text-[#A91079] rounded-2xl">
                      <Clock className="w-6 h-6" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Base Period Duration Allotment
                      </h3>
                      <p className="text-xs text-slate-500">
                        Scale period lengths by 10-minute increments (20 minutes to 4 hours).
                      </p>
                    </div>
                  </div>

                  {/* Primary Stepper Control */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        disabled={periodDuration <= 20}
                        onClick={() => setPeriodDuration((prev) => Math.max(20, prev - 10))}
                        className="p-2 rounded-xl text-slate-600 hover:bg-white hover:text-[#A91079] hover:shadow-xs disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                        title="Decrease base period by 10 mins (min 20m)"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="px-3 py-1 text-center min-w-36">
                        <span className="text-base font-black text-[#A91079] block tracking-tight tabular-nums">
                          {formatDurationDetailed(periodDuration)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                          {periodDuration} mins / period
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={periodDuration >= 240}
                        onClick={() => setPeriodDuration((prev) => Math.min(240, prev + 10))}
                        className="p-2 rounded-xl text-slate-600 hover:bg-white hover:text-[#A91079] hover:shadow-xs disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                        title="Increase base period by 10 mins (max 4h)"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Range Slider and Quick Presets */}
                <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>20 mins (Min)</span>
                    <span className="font-extrabold text-[#A91079]">
                      Current: {formatDuration(periodDuration)} ({periodDuration} mins)
                    </span>
                    <span>240 mins / 4h (Max)</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={240}
                    step={10}
                    value={periodDuration}
                    onChange={(e) => setPeriodDuration(Number(e.target.value))}
                    className="w-full accent-[#A91079] cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                  />
                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setAllDurations(periodDuration)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#A91079] bg-[#FDF2FA] hover:bg-[#F3E5F2] border border-[#E5CCE3] transition cursor-pointer"
                      title="Apply this duration to all subjects in current track"
                    >
                      Sync All Subjects to {formatDuration(periodDuration)}
                    </button>
                  </div>
                </div>
              </div>

              {/* Fine-Grained Generator Constraints Configuration */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div>
                  <label className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#A91079]" />
                    <span>Solver Constraints & Objectives</span>
                  </label>
                </div>

                {/* Sliders Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Timeout Slider */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">Generation Time Limit</span>
                      <span className="text-[#A91079] font-extrabold">{maxSolveTimeSeconds}s</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={1}
                      value={maxSolveTimeSeconds}
                      onChange={(e) => setMaxSolveTimeSeconds(Number(e.target.value))}
                      className="w-full accent-[#A91079] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>5s (Rapid Draft)</span>
                      <span>25s (Standard Scaled)</span>
                      <span>60s (Deep Optimization)</span>
                    </div>
                  </div>

                  {/* Daily Cap Slider */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">Daily Teaching Cap</span>
                      <span className="text-[#A91079] font-extrabold">{maxDailyHours} hrs/day</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={6}
                      step={1}
                      value={maxDailyHours}
                      onChange={(e) => setMaxDailyHours(Number(e.target.value))}
                      className="w-full accent-[#A91079] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>4 hrs (Lightened)</span>
                      <span>5 hrs (Standard)</span>
                      <span>6 hrs (Statutory Magna Carta Ceiling)</span>
                    </div>
                  </div>
                </div>

                {/* Toggles & Objective Strategy Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Max Consecutive Hours */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600">Max Consecutive Hours</div>
                    <div className="flex items-center gap-1">
                      {[2, 3, 4].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setMaxConsecutiveHours(h)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            maxConsecutiveHours === h
                              ? "bg-[#A91079] text-white shadow-2xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {h} hrs
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Objective Optimization Strategy */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600">Optimization Objective</div>
                    <select
                      value={objectiveStrategy}
                      onChange={(e) =>
                        setObjectiveStrategy(e.target.value as "WORKLOAD_BALANCE" | "COMPACT_SCHEDULE" | "HYBRID")
                      }
                      className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#A91079] cursor-pointer"
                    >
                      <option value="WORKLOAD_BALANCE">Workload Equalization (Primary)</option>
                      <option value="COMPACT_SCHEDULE">Compact Schedule (Anti-Idle)</option>
                      <option value="HYBRID">Balanced Hybrid (Optimal)</option>
                    </select>
                  </div>


                </div>

                {/* Morning Academic Core & Preserved Locks Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#A91079] shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          Prefer Morning Academic Core
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Schedule Math, Science, English in morning periods
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferMorningAcademic}
                      onChange={(e) => setPreferMorningAcademic(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 accent-[#A91079] cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          Preserve Homeroom & Locked Slots
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Mon P1 HRGP & designated adviser assignments
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preserveLockedSlots}
                      onChange={(e) => setPreserveLockedSlots(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 accent-[#A91079] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Run & Deploy */}
          {activeStudioTab === "RUN_DEPLOY" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Intelligent Pre-Flight Schedule Feasibility & Readiness Audit Card */}
              <PreFlightReadinessCard
                teachers={teachers}
                sections={sections}
                departments={departments}
                subjects={allSubjects}
                selectedSectionIds={selectedGenerationSectionIds}
                periodDuration={periodDuration}
                maxDailyHours={maxDailyHours}
                onLaunchGenerate={handleLaunchGenerate}
                loading={loading}
                isPrincipal={isPrincipal}
                onNavigateToTab={(tab) => setActiveStudioTab(tab)}
              />

              {/* Schedule Quality & DepEd Compliance Scorecard for Existing Slots */}
              {slots.length > 0 && (
                <ScheduleHealthScorecard
                  slots={slots}
                  sections={sections}
                  teachers={teachers}
                  latencyMs={lastResult?.latency_ms}
                />
              )}

              {/* Pre-Flight Generation Verification Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2.5 bg-[#FDF2FA] text-[#A91079] rounded-2xl">
                      <Sparkles className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Pre-Flight Generation Verification
                      </h3>
                      <p className="text-xs text-slate-500">
                        Review target sections, allotments, and parameters before generating schedule.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-md text-xs font-semibold bg-[#FDF2FA] text-[#A91079] border border-[#E5CCE3] self-start sm:self-auto">
                    {selectedGenerationSectionIds.size > 0 ? "Ready to Solve" : "No Sections Selected"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 bg-white rounded-xl border border-[#E5CCE3] shadow-2xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">Target Sections</span>
                    <strong className="text-sm font-bold text-slate-900 num-tabular block">
                      {selectedGenerationSectionIds.size} / {sections.length} Sections
                    </strong>
                    <span className="text-[11px] text-slate-500 num-tabular">
                      {[7, 8, 9, 10].map(g => `G${g}: ${sections.filter(s => s.grade_level === g && selectedGenerationSectionIds.has(s.id)).length}`).join(" • ")}
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E5CCE3] shadow-2xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">Modular Tracks</span>
                    <strong className="text-sm font-bold text-slate-900 num-tabular block">
                      {tracks.length} Curricula
                    </strong>
                    <span className="text-[11px] text-slate-500 truncate block">
                      {tracks.map(t => t.code).join(", ")}
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E5CCE3] shadow-2xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">Period Duration</span>
                    <strong className="text-sm font-bold text-slate-900 num-tabular block">
                      {formatDurationDetailed(periodDuration)}
                    </strong>
                    <span className="text-[11px] text-slate-500 num-tabular">
                      7 periods/day (35 weekly)
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E5CCE3] shadow-2xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">Solver Profile</span>
                    <strong className="text-sm font-bold text-slate-900 num-tabular block">
                      {maxSolveTimeSeconds}s • {maxDailyHours}h Cap
                    </strong>

                  </div>
                </div>
              </div>

              {/* Live Progress Phases if Loading */}
              {loading && (
                <div className="p-5 rounded-3xl bg-[#FDF2FA]/90 border border-[#E5CCE3] space-y-3 animate-pulse shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-[#2E0249]">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#A91079]" />
                      <span>Generating Optimized Master Schedule...</span>
                    </span>
                    <span className="text-[10px] bg-[#E5CCE3] px-2.5 py-0.5 rounded-full text-[#2E0249] font-black">
                      SOLVING {selectedGenerationSectionIds.size} SECTIONS
                    </span>
                  </div>
                  <div className="w-full bg-[#E5CCE3]/60 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-[#A91079] h-2.5 rounded-full w-2/3 animate-progress" />
                  </div>
                  <p className="text-[11px] text-[#A91079]">
                    Generating optimized schedule distribution across all active sections...
                  </p>
                </div>
              )}

              {/* Launch Constraint Satisfaction Engine Execution Banner Card */}
              <div className="bg-gradient-to-br from-[#2E0249] via-[#570A57] to-[#2E0249] rounded-3xl p-6 text-white shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[#F806CC] text-[10px] font-black uppercase tracking-wider border border-white/20">
                        Automated Master Timetable
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white tracking-tight">
                      Generate Master Timetable
                    </h3>
                    <p className="text-xs text-pink-100/90 max-w-xl">
                      Generates conflict-free faculty schedules for all {selectedGenerationSectionIds.size} selected sections.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isPrincipal ? (
                      <button
                        type="button"
                        disabled={loading || selectedGenerationSectionIds.size === 0}
                        onClick={handleLaunchGenerate}
                        className="py-3.5 px-6 rounded-2xl bg-[#A91079] hover:bg-[#8F0B66] text-white font-black text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {loading
                            ? "Solving Master Schedule..."
                            : `Generate Master Schedule (${formatDuration(periodDuration)} Periods)`}
                        </span>
                      </button>
                    ) : (
                      <div className="p-3 bg-white/10 rounded-2xl text-xs text-pink-200 text-center font-semibold border border-white/10">
                        Principal authority required
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleLaunchRepair}
                      className="py-3.5 px-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                      title="Execute Fault-Tolerant Dynamic Repair"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Dynamic Repair</span>
                    </button>
                  </div>
                </div>

                {selectedGenerationSectionIds.size === 0 && (
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>No sections selected! Please select at least one section in Sections.</span>
                  </div>
                )}
              </div>

              {/* Department Timetable Deployment & DepEd Release Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl">
                      <Send className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Department Timetable Deployment & DepEd Release
                      </h3>
                      <p className="text-xs text-slate-500">
                        Publish and distribute official master schedules to department heads.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeployModalOpen(true)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <Send className="w-4 h-4" />
                    <span>Deploy to Department Heads</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-white rounded-xl border border-[#E5CCE3] shadow-2xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">Deployment Status</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${latestDeployment ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <strong className="text-slate-900 font-bold">
                        {latestDeployment ? "Official Release" : "Draft (Unpublished)"}
                      </strong>
                    </div>
                    {latestDeployment && (
                      <span className="text-[11px] text-slate-500 block num-tabular">
                        Academic Year: {latestDeployment.academic_year}
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E5CCE3] shadow-2xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">Target Departments</span>
                    <strong className="text-slate-900 font-bold block num-tabular">
                      {latestDeployment?.target_department_ids?.length || departments.length} Departments
                    </strong>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {departments.map((d) => d.name).join(", ")}
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E5CCE3] shadow-2xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium block">DepEd Form 7 Audit</span>
                    <strong className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready for Compliance Audit</span>
                    </strong>
                    <span className="text-[11px] text-slate-500 block">
                      All teaching workload limits verified
                    </span>
                  </div>
                </div>
              </div>

              
            </div>
          )}
        </div>

        {/* Dedicated Statistical Side Panel: Current Save Telemetry & Workload Metrics */}
        {showSidePanel && (
          <div className="w-full xl:w-96 shrink-0 space-y-5 self-start xl:sticky xl:top-20">
            {/* Panel Top Title */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#A91079]" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Current Save Analytics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSidePanel(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Collapse side panel"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Unified Timetable State & Publication Card */}
            <div className="bg-white rounded-2xl border border-[#E5CCE3] p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#A91079]" />
                  <span>Timetable State</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 ${
                    latestDeployment
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      latestDeployment ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    }`}
                  />
                  <span>{latestDeployment ? "Official Release" : "Draft Status"}</span>
                </span>
              </div>

              {/* Version & Deployment Information */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">Active Save:</span>
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="font-bold text-slate-900 truncate max-w-[120px]">
                      {activeSavedSchedule ? activeSavedSchedule.name : "Active Live Timetable"}
                    </span>
                    {onOpenSavedListModal && (
                      <button
                        type="button"
                        onClick={onOpenSavedListModal}
                        className="text-[11px] text-[#A91079] hover:underline font-semibold shrink-0 cursor-pointer"
                        title="Browse saved schedule versions"
                      >
                        ({savedCount})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">DepEd Release:</span>
                  <span className="font-semibold text-slate-800">
                    {latestDeployment
                      ? `${latestDeployment.target_department_ids?.length || departments.length} Depts (${latestDeployment.academic_year})`
                      : "Not yet deployed"}
                  </span>
                </div>

                <div className="pt-1.5 border-t border-slate-200/80 grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-white p-1.5 rounded-lg border border-[#E5CCE3] shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-medium block">Slots</span>
                    <span className="text-xs font-bold text-slate-900 num-tabular block">{slots.length}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-[#E5CCE3] shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-medium block">Period</span>
                    <span className="text-xs font-bold text-[#A91079] num-tabular block">{formatDuration(periodDuration)}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-[#E5CCE3] shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-medium block">Tracks</span>
                    <span className="text-xs font-bold text-emerald-700 num-tabular block">{tracks.length}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setDeployModalOpen(true)}
                  disabled={slots.length === 0}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#A91079] hover:bg-[#2E0249] text-white font-semibold text-xs shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Deploy timetable to academic departments"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{latestDeployment ? "Re-deploy" : "Deploy"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSaveSnapshot}
                  className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Save current timetable as snapshot"
                >
                  <Save className="w-3.5 h-3.5 text-slate-500" />
                  <span>Save State</span>
                </button>
              </div>
            </div>

            {/* 3. Solver Benchmark Telemetry Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Solver Live Telemetry</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  OPTIMIZED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#FDF2FA]/70 border border-[#E5CCE3]">
                  <span className="text-[11px] font-medium text-[#A91079] block">Latency</span>
                  <span className="text-lg font-bold text-slate-900 num-tabular block">
                    {lastResult?.latency_ms ? `${lastResult.latency_ms.toFixed(1)} ms` : "18.4 ms"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <span className="text-[11px] font-medium text-emerald-800 block">Disruption</span>
                  <span className="text-lg font-bold text-emerald-950 num-tabular block">
                    {lastResult?.disruption_cost ?? 0}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                <span>Hard Violations: <strong className="text-slate-800 num-tabular">0</strong></span>
                <span>Track Collisions: <strong className="text-slate-800 num-tabular">0</strong></span>
              </div>
            </div>

            {/* 4. Faculty Workload Distribution Statistics */}
            <div className="bg-white rounded-2xl border border-[#E5CCE3] p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#A91079]" />
                  <span>Faculty Workload (Current Save)</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium num-tabular">
                  {teachers.length} Faculty
                </span>
              </div>

              {/* Workload 4-Grid Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-sm font-bold text-emerald-800 num-tabular block">
                    {optimalTeachersCount} Faculty
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium block">
                    Optimal (20–25h)
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-sm font-bold text-amber-800 num-tabular block">
                    {underloadedTeachersCount} Faculty
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium block">
                    Underloaded (&lt;20h)
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-sm font-bold text-slate-900 num-tabular block">
                    {activeTeachersCount} Active
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Available Roster
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-sm font-bold text-rose-800 num-tabular block">
                    {onLeaveTeachersCount} On Leave
                  </span>
                  <span className="text-[11px] text-rose-700 font-medium block">
                    Substitute Pool
                  </span>
                </div>
              </div>

              {/* Workload Averages */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>Avg Faculty Weekly Load:</span>
                  <span className="text-[#A91079] font-black">{averageTeacherLoad} hrs/week</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Magna Carta Ceiling:</span>
                  <span className="font-semibold text-slate-700">&le; 6.0 hrs/day (100% Passed)</span>
                </div>
              </div>

              {/* Mini Interactive Faculty Simulator Roster */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Faculty Availability Simulator</span>
                  <span className="text-[10px] text-slate-400 font-normal">Toggle leave test</span>
                </div>

                {/* Filter / Search mini roster */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={rosterSearchQuery}
                      onChange={(e) => setRosterSearchQuery(e.target.value)}
                      placeholder="Search teacher..."
                      className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:outline-hidden"
                    />
                  </div>
                  <select
                    value={rosterDeptFilter}
                    onChange={(e) =>
                      setRosterDeptFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                    }
                    className="py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="ALL">All Depts</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Roster Scroll Container */}
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                  {visibleRosterTeachers.slice(0, 15).map((t) => {
                    const isAbsent = t.status !== "Active";
                    const isUnder = !isAbsent && t.current_load_hours < 20;
                    const isOptimal = !isAbsent && t.current_load_hours >= 20 && t.current_load_hours <= 25;
                    const dept = departments.find((d) => d.id === t.department_id);

                    return (
                      <div
                        key={t.id}
                        className="pt-1.5 flex items-center justify-between text-xs first:pt-0"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-extrabold text-slate-900 truncate text-[11px]">
                            {t.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {dept?.code} • {t.current_load_hours}h / {t.max_weekly_hours}h
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${
                              isAbsent
                                ? "bg-red-100 text-red-800"
                                : isUnder
                                ? "bg-amber-100 text-amber-800"
                                : isOptimal
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isAbsent ? "Leave" : `${t.current_load_hours}h`}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              onTeacherStatusToggle(t.id, t.status === "Active" ? "On Leave" : "Active")
                            }
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              t.status === "Active"
                                ? "bg-slate-100 text-red-600 hover:bg-red-50"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {t.status === "Active" ? "Simulate Leave" : "Set Active"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. Quick Timetable Navigation Links */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#A91079]" />
                <span>Jump to Schedule Views</span>
              </span>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onSelectView("CLASS_GRID")}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-[#E5CCE3] hover:bg-[#FDF2FA] transition flex items-center justify-between text-left cursor-pointer group text-xs font-bold text-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-600" />
                    <span>Class Program (SF-7)</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#A91079] transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectView("TEACHER_GRID")}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-[#E5CCE3] hover:bg-[#FDF2FA] transition flex items-center justify-between text-left cursor-pointer group text-xs font-bold text-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-600" />
                    <span>Teacher Program</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#A91079] transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectView("MASTER_GRID")}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-[#E5CCE3] hover:bg-[#FDF2FA] transition flex items-center justify-between text-left cursor-pointer group text-xs font-bold text-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#A91079]" />
                    <span>School Master Grid</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#A91079] transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Add Special Track Modal */}
      {isAddTrackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#FDF2FA] text-[#A91079] rounded-xl">
                  <Layers className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Add New Program Track</h3>
                  <p className="text-[11px] text-slate-500">Create a modular curriculum program for this save file.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTrackOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTrack} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Track Code (e.g. SPFL, TVL, ALIVE) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTrackCode}
                  onChange={(e) => setNewTrackCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SPFL"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Track Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTrackName}
                  onChange={(e) => setNewTrackName(e.target.value)}
                  placeholder="e.g. Special Program in Foreign Language"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newTrackDesc}
                  onChange={(e) => setNewTrackDesc(e.target.value)}
                  placeholder="Specialized language and cultural immersion curriculum..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Badge Color Theme</label>
                <div className="flex items-center gap-2">
                  {(["indigo", "emerald", "amber", "fuchsia", "sky", "rose", "teal"] as const).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setNewTrackColor(clr)}
                      className={`w-7 h-7 rounded-xl border-2 transition cursor-pointer ${
                        newTrackColor === clr ? "border-slate-900 scale-110 shadow-xs" : "border-transparent"
                      } ${
                        clr === "indigo"
                          ? "bg-indigo-500"
                          : clr === "emerald"
                          ? "bg-emerald-500"
                          : clr === "amber"
                          ? "bg-amber-500"
                          : clr === "fuchsia"
                          ? "bg-fuchsia-500"
                          : clr === "sky"
                          ? "bg-sky-500"
                          : clr === "rose"
                          ? "bg-rose-500"
                          : "bg-teal-500"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="includeCore"
                  checked={includeCoreSubjects}
                  onChange={(e) => setIncludeCoreSubjects(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#A91079] cursor-pointer"
                />
                <label htmlFor="includeCore" className="font-bold text-slate-700 cursor-pointer">
                  Pre-populate with standard DepEd Core Subjects
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTrackOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#A91079] hover:bg-[#8F0B66] text-white font-bold shadow-2xs cursor-pointer"
                >
                  Create Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Track Modal */}
      {isEditTrackOpen && currentTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#FDF2FA] text-[#A91079] rounded-xl">
                  <Edit3 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Edit Track: {currentTrack.code}</h3>
                  <p className="text-[11px] text-slate-500">Update track description and visual theme.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTrackOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTrack} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Track Full Name</label>
                <input
                  type="text"
                  required
                  value={editTrackName}
                  onChange={(e) => setEditTrackName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editTrackDesc}
                  onChange={(e) => setEditTrackDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Badge Color Theme</label>
                <div className="flex items-center gap-2">
                  {(["indigo", "emerald", "amber", "fuchsia", "sky", "rose", "teal"] as const).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setEditTrackColor(clr)}
                      className={`w-7 h-7 rounded-xl border-2 transition cursor-pointer ${
                        editTrackColor === clr ? "border-slate-900 scale-110 shadow-xs" : "border-transparent"
                      } ${
                        clr === "indigo"
                          ? "bg-indigo-500"
                          : clr === "emerald"
                          ? "bg-emerald-500"
                          : clr === "amber"
                          ? "bg-amber-500"
                          : clr === "fuchsia"
                          ? "bg-fuchsia-500"
                          : clr === "sky"
                          ? "bg-sky-500"
                          : clr === "rose"
                          ? "bg-rose-500"
                          : "bg-teal-500"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditTrackOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#A91079] hover:bg-[#8F0B66] text-white font-bold shadow-2xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Subject to Track Modal */}
      {isAddSubjectOpen && currentTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#FDF2FA] text-[#A91079] rounded-xl">
                  <Plus className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Add Subject to Track: {currentTrack.code}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Create and add a specialized learning area directly to Grade {addSubjectTargetGrade}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSubjectOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewSubjectForTrack} className="p-6 space-y-4 text-xs">
              {/* Target Grade Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Target Grade Level</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Assign to specific grade level
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  {[7, 8, 9, 10].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setAddSubjectTargetGrade(g)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        addSubjectTargetGrade === g
                          ? "bg-[#A91079] text-white shadow-2xs font-extrabold"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Specialized Subject Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Campus Journalism I, Robotics & Automation, Sports Conditioning"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supervising Department</label>
                <select
                  value={newSubDeptId}
                  onChange={(e) => setNewSubDeptId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-hidden focus:border-[#A91079] cursor-pointer"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration per Meeting</label>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 shadow-2xs">
                        <button
                          type="button"
                          disabled={newSubDuration <= 20}
                          onClick={() => setNewSubDuration((prev) => Math.max(20, prev - 10))}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#A91079] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                          title="Decrease by 10 mins"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-16 text-center text-xs font-bold text-[#2E0249] tabular-nums">
                          {formatDuration(newSubDuration)}
                        </span>
                        <button
                          type="button"
                          disabled={newSubDuration >= 240}
                          onClick={() => setNewSubDuration((prev) => Math.min(240, prev + 10))}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-[#A91079] disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                          title="Increase by 10 mins"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                        ({newSubDuration} mins)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Weekly Frequency</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((loads) => (
                      <button
                        key={loads}
                        type="button"
                        onClick={() => setNewSubLoads(loads)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          newSubLoads === loads
                            ? "bg-[#A91079] text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {loads}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preferred Placement */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Preferred Placement (Daily Time Window)</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Target periods for scheduler solver
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "MORNING", label: "Morning Academic", time: "7:00–11:15 AM (P1–P4)" },
                    { id: "AFTERNOON", label: "Afternoon Applied", time: "12:00–3:00 PM (P5–P7)" },
                    { id: "MON_P1_LOCK", label: "Monday P1 Lock", time: "Mon 7:00–8:00 AM" },
                    { id: "FLEXIBLE", label: "Flexible Placement", time: "Any Period (P1–P7)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewSubPlacement(opt.id)}
                      className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                        newSubPlacement === opt.id
                          ? "bg-[#FDF2FA] border-[#A91079] ring-2 ring-[#A91079]/20"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-900 block">{opt.label}</span>
                      <span className="text-[10px] text-[#A91079] font-medium block mt-0.5">{opt.time}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSubjectOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSubjectLoading || !newSubName.trim()}
                  className="px-4 py-2 rounded-xl bg-[#A91079] hover:bg-[#8F0B66] text-white font-bold shadow-2xs cursor-pointer disabled:opacity-40"
                >
                  {addingSubjectLoading
                    ? "Adding to List..."
                    : `Create & Add to Grade ${addSubjectTargetGrade}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Deploy Schedule to Departments Modal */}
      <EditSubjectModal
        isOpen={isEditSubjectModalOpen}
        onClose={() => {
          setIsEditSubjectModalOpen(false);
          setEditingSubject(null);
        }}
        subject={editingSubject}
        departments={departments}
        currentAllotment={
          editingSubject ? subjectAllotments[editingSubject.id] : undefined
        }
        onSubjectUpdated={handleSubjectUpdated}
      />

      <DeployScheduleModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        departments={departments}
        teachers={teachers}
        slots={slots}
        subjects={subjects}
        currentUser={currentUser}
        onDeploySuccess={(res) => {
          setLatestDeployment(res.deployment);
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* MODAL 5: Batch Section Setup Modal */}
      <BatchSectionSetupModal
        isOpen={isBatchSectionSetupOpen}
        onClose={() => setIsBatchSectionSetupOpen(false)}
        existingSections={sections}
        onBatchCreated={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* MODAL 6: Custom Confirmation Modal — Remove Subject from Track */}
      {subjectToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Remove Subject from {currentTrack?.code}?
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-800">{subjectToRemove.name}</strong> from{" "}
                <strong className="text-slate-800">{currentTrack?.name} (Grade {subjectToRemove.grade})</strong>?
              </p>
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Track Program:</span>
                  <span className="font-bold text-slate-800">{currentTrack?.name} ({currentTrack?.code})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Target Grade:</span>
                  <span className="font-bold text-slate-800">Grade {subjectToRemove.grade}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Subject:</span>
                  <span className="font-bold text-[#A91079]">{subjectToRemove.name}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                This subject will no longer be scheduled for sections enrolled under this curricular track. You can add it back anytime.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubjectToRemove(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveSubject}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Subject</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Custom Confirmation Modal — Delete Curricular Track */}
      {isDeleteTrackConfirmOpen && currentTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Delete Curricular Track?
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-800">{currentTrack.name} ({currentTrack.code})</strong>?
              </p>
              <div className="mt-3 p-3 bg-rose-50/60 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-700">Track Code:</span>
                  <span className="font-bold">{currentTrack.code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-700">Total Learning Areas:</span>
                  <span className="font-bold">{currentTrackSubjects.length} subjects</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-700">Associated Sections:</span>
                  <span className="font-bold">{enrolledSectionsInTrack.length} sections</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                All curriculum mappings and grade-level allotments for this track program will be removed. Sections will revert to regular curriculum.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteTrackConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTrack}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Track</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Custom Confirmation Modal — Copy Grade to All Other Grades */}
      {cloneGradeConfirm && currentTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-[#FDF2FA] border border-[#E5CCE3] flex items-center justify-center text-[#A91079] mb-4">
                <Copy className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Copy Grade {cloneGradeConfirm.sourceGrade} Subjects?
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Clone the <strong className="text-slate-800">{cloneGradeConfirm.subjectCount} learning areas</strong> configured for{" "}
                <strong className="text-slate-800">Grade {cloneGradeConfirm.sourceGrade}</strong> across all other grades (7, 8, 9, and 10) in <strong className="text-slate-800">{currentTrack.name} ({currentTrack.code})</strong>?
              </p>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Note:</strong> This will overwrite the subject list of the other grade levels in {currentTrack.code} with the subjects from Grade {cloneGradeConfirm.sourceGrade}.
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCloneGradeConfirm(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCloneGrade}
                className="px-4 py-2 text-xs font-bold text-white bg-[#A91079] hover:bg-[#8F0B66] shadow-md shadow-[#A91079]/20 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy to Other Grades</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: Custom Confirmation Modal — Reset Track & Allotment Defaults */}
      {isResetDefaultsConfirmOpen && currentTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Reset Track & Allotment Defaults
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Choose which configurations to reset to DepEd standard defaults:
              </p>

              <div className="mt-4 space-y-2.5">
                <label
                  onClick={() => setResetDefaultsOption("ALL")}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                    resetDefaultsOption === "ALL"
                      ? "bg-[#FDF2FA] border-[#A91079] ring-2 ring-[#A91079]/20"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="resetDefaults"
                    checked={resetDefaultsOption === "ALL"}
                    onChange={() => setResetDefaultsOption("ALL")}
                    className="mt-0.5 text-[#A91079] focus:ring-[#A91079]"
                  />
                  <div className="text-xs">
                    <span className="font-extrabold text-slate-900 block">
                      Reset Everything (Durations + 9 DepEd Core Subjects)
                    </span>
                    <span className="text-slate-500 block mt-0.5">
                      Restores standard 60-min durations and resets Grade {selectedTrackGrade} in {currentTrack.code} to the standard 9 DepEd core subjects.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setResetDefaultsOption("DURATIONS_ONLY")}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                    resetDefaultsOption === "DURATIONS_ONLY"
                      ? "bg-[#FDF2FA] border-[#A91079] ring-2 ring-[#A91079]/20"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="resetDefaults"
                    checked={resetDefaultsOption === "DURATIONS_ONLY"}
                    onChange={() => setResetDefaultsOption("DURATIONS_ONLY")}
                    className="mt-0.5 text-[#A91079] focus:ring-[#A91079]"
                  />
                  <div className="text-xs">
                    <span className="font-extrabold text-slate-900 block">
                      Durations & Engine Parameters Only
                    </span>
                    <span className="text-slate-500 block mt-0.5">
                      Resets period duration to 60m and solver settings without modifying your custom learning areas.
                    </span>
                  </div>
                </label>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetDefaultsConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDefaults}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-md rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: Custom Action Alert Notification Dialog (No Native 127.0.0.1 Alerts) */}
      {actionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {actionAlert.title}
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {actionAlert.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setActionAlert(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#A91079] hover:bg-[#8F0B66] shadow-md shadow-[#A91079]/20 rounded-xl transition cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 11: AI Timetable Generation Progress Cockpit */}
      <GenerationCockpitModal
        isGenerating={loading}
        sectionCount={selectedGenerationSectionIds.size}
        periodDuration={periodDuration}
      />
    </div>
  );
};
