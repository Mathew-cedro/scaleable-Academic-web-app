import { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  User,
  LogOut,
  Building2,
  Save,
  History,
} from "lucide-react";

import { api, formatErrorDetail } from "./api/client";
import type {
  CreateSavedSchedulePayload,
  GenerateScheduleRequest,
  MasterScheduleData,
  OperationResponse,
  ReassignTeacherSlotsRequest,
  SavedScheduleItem,
  UserProfile,
} from "./api/client";
import { LoginPage } from "./components/LoginPage";
import { Sidebar } from "./components/Sidebar";
import { MasterTimetableGrid } from "./components/MasterTimetableGrid";
import { ClassTimetableGrid } from "./components/ClassTimetableGrid";
import { TeacherTimetableGrid } from "./components/TeacherTimetableGrid";
import { FacultyWorkloadView } from "./components/FacultyWorkloadView";
import { DepartmentDashboard } from "./components/DepartmentDashboard";
import { ConflictResolutionModal } from "./components/ConflictResolutionModal";
import { SlotAdjustmentModal } from "./components/SlotAdjustmentModal";
import { TeacherFormModal } from "./components/TeacherFormModal";
import { DeleteTeacherModal } from "./components/DeleteTeacherModal";
import { ProfileView } from "./components/ProfileView";
import { GenerateMasterTab } from "./components/GenerateMasterTab";
import { SectionManagerView } from "./components/SectionManagerView";
import { SectionFormModal } from "./components/SectionFormModal";
import { DeleteSectionModal } from "./components/DeleteSectionModal";
import { SaveScheduleModal } from "./components/SaveScheduleModal";
import { SavedSchedulesModal } from "./components/SavedSchedulesModal";
import { SlotContextMenu } from "./components/SlotContextMenu";
import { UnassignConfirmModal } from "./components/UnassignConfirmModal";
import { getAllRoomConflicts, type ScheduleSlot } from "./utils/scheduleConflictChecker";
import { useLanguage } from "./context/LanguageContext";

export default function App() {
  const { t, language, setLanguage, isTagalog } = useLanguage();
  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("schedmaster_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Verify and refresh session token on app mount
  useEffect(() => {
    const token = localStorage.getItem("schedmaster_token");
    if (token) {
      api.verifyToken(token).then((res) => {
        setCurrentUser(res.user);
        localStorage.setItem("schedmaster_user", JSON.stringify(res.user));
      }).catch((err) => {
        console.warn("Session expired or invalid, signing out:", err);
        localStorage.removeItem("schedmaster_user");
        localStorage.removeItem("schedmaster_token");
        setCurrentUser(null);
      });
    }
  }, []);

  // Core Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Real-time Schedule Assignment State
  const [emptySlotToAssign, setEmptySlotToAssign] = useState<{
    section_id?: number;
    teacher_id?: number;
    day_of_week: number;
    period_index: number;
  } | null>(null);

  // Active View and Selected Department
  // activeView: "CLASS_GRID" | "TEACHER_GRID" | "MASTER_GRID" | "FACULTY_LOAD" | "DEPT_DASHBOARD" | "DEPT_GRID" | "PROFILE"
  const [activeView, setActiveView] = useState<string>("MASTER_GRID");
  const [selectedDeptId, setSelectedDeptId] = useState<number | "ALL">("ALL");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Selected Section & Teacher for Class and Teacher Timetable Displays
  const [selectedSectionIdForClass, setSelectedSectionIdForClass] = useState<number>(1);
  const [selectedTeacherIdForProgram, setSelectedTeacherIdForProgram] = useState<number>(1);

  // Inspected Teacher for Profile Tab
  const [inspectedTeacherId, setInspectedTeacherId] = useState<number | null>(null);

  // Modals State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>("Optimization & Workload Report");
  const [modalLatency, setModalLatency] = useState<number>(0);
  const [modalDisruptionCost, setModalDisruptionCost] = useState<number>(0);
  const [modalDiff, setModalDiff] = useState<any>(undefined);
  const [modalReport, setModalReport] = useState<string | undefined>(undefined);
  const [lastSolverResult, setLastSolverResult] = useState<OperationResponse | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [slotModalOpen, setSlotModalOpen] = useState<boolean>(false);

  // Teacher CRUD Modals State
  const [teacherFormOpen, setTeacherFormOpen] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [teacherFormDefaultDept, setTeacherFormDefaultDept] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deletingTeacher, setDeletingTeacher] = useState<any | null>(null);

  // Section CRUD Modals State
  const [sectionFormOpen, setSectionFormOpen] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [deleteSectionModalOpen, setDeleteSectionModalOpen] = useState<boolean>(false);
  const [deletingSection, setDeletingSection] = useState<any | null>(null);

  // Right-Click Context Menu & Slot Unassign State
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuSlot, setContextMenuSlot] = useState<ScheduleSlot | null>(null);
  const [unassignTargetSlot, setUnassignTargetSlot] = useState<ScheduleSlot | null>(null);
  const [unassignModalOpen, setUnassignModalOpen] = useState<boolean>(false);

  // Saved Schedules State
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [savedListModalOpen, setSavedListModalOpen] = useState<boolean>(false);
  const [savedSchedulesCount, setSavedSchedulesCount] = useState<number>(0);
  const [activeSavedSchedule, setActiveSavedSchedule] = useState<SavedScheduleItem | null>(null);
  const [currentConfigJson, setCurrentConfigJson] = useState<string | undefined>(undefined);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Real-time Room Collision Incidents across school schedule
  const allRoomIncidents = useMemo(() => {
    return getAllRoomConflicts(slots, sections, teachers);
  }, [slots, sections, teachers]);

  const showToast = (message: any, type: "success" | "error" | "info" = "success") => {
    const formatted = typeof message === "string" ? message : formatErrorDetail(message, "An unexpected event occurred");
    setToast({ message: formatted, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Sync active view based on logged-in user role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === "DEPARTMENT_HEAD" && currentUser.department_id) {
        setSelectedDeptId(currentUser.department_id);
        setActiveView("CLASS_GRID");
      } else {
        setSelectedDeptId("ALL");
        setActiveView("CLASS_GRID");
      }
    }
  }, [currentUser]);

  // Fetch Master Data
  const fetchData = async (showLoadingSpinner: boolean = false) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const data: MasterScheduleData = await api.getMasterSchedule();
      setSlots(data.slots || []);
      setSections(data.sections || []);
      setTeachers(data.teachers || []);
      setDepartments(data.departments || []);
      setSubjects(data.subjects || []);

      if (data.sections && data.sections.length > 0) {
        setSelectedSectionIdForClass((prev) =>
          data.sections.some((s) => s.id === prev) ? prev : data.sections[0].id
        );
      }
      if (data.teachers && data.teachers.length > 0) {
        setSelectedTeacherIdForProgram((prev) =>
          data.teachers.some((t) => t.id === prev) ? prev : data.teachers[0].id
        );
      }

      // Refresh saved schedules count & active version
      try {
        const savedList = await api.listSavedSchedules();
        setSavedSchedulesCount(savedList.length);
        const active = savedList.find((s) => s.is_active) || (savedList.length > 0 ? savedList[0] : null);
        setActiveSavedSchedule(active);
      } catch {
        // Silently continue
      }
    } catch (err: any) {
      console.error("Failed to fetch schedule data:", err);
      showToast(err.message || "Failed to connect to backend", "error");
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  const handleSaveSchedule = async (payload: CreateSavedSchedulePayload) => {
    try {
      const saved = await api.createSavedSchedule(payload);
      showToast(`Saved schedule "${saved.name}" successfully!`, "success");
      const list = await api.listSavedSchedules();
      setSavedSchedulesCount(list.length);
      setActiveSavedSchedule(saved);
    } catch (err: any) {
      showToast(err.message || "Failed to save schedule snapshot", "error");
      throw err;
    }
  };

  const handleRestoreSchedule = async (id: number) => {
    try {
      setActionLoading(true);
      const res = await api.restoreSavedSchedule(id);
      await fetchData();
      showToast(res.message || "Schedule snapshot successfully loaded!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to restore schedule", "error");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const activePeriodDuration = useMemo(() => {
    if (subjects && subjects.length > 0) {
      const firstWithDur = subjects.find((s: any) => s.duration_minutes);
      if (firstWithDur && (firstWithDur as any).duration_minutes) {
        return (firstWithDur as any).duration_minutes;
      }
    }
    return 60;
  }, [subjects]);

  useEffect(() => {
    if (currentUser) {
      fetchData(true);
    }
  }, [currentUser]);

  // Real-time Multi-Client & Cross-Tab Synchronization
  useEffect(() => {
    if (!currentUser) return;

    // 1. Cross-Tab Local BroadcastChannel
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel("deped_academic_scheduler_sync");
      broadcastChannel.onmessage = () => {
        fetchData();
      };
    } catch {
      // Ignored if unsupported
    }

    // 2. Real-time WebSocket connection to Backend
    const host = window.location.hostname || "127.0.0.1";
    const wsUrl = `ws://${host}:8000/api/schedule/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          console.log("[Realtime Sync] Connected to scheduler WebSocket.");
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("[Realtime Sync] Received event:", data);
            fetchData();
            if (data.event === "TEACHERS_UPDATED") {
              showToast(
                `Real-time sync: Faculty roster updated (${data.teacher_name || "Faculty"})`,
                "info"
              );
            } else if (data.event === "SCHEDULE_DEPLOYED_TO_DEPARTMENTS") {
              showToast(
                data.message || "Real-time sync: Master schedule deployed to Academic Departments!",
                "success"
              );
            } else if (data.event === "SCHEDULE_UPDATED") {
              showToast(
                data.message || "Real-time sync: Schedule updated across system",
                "info"
              );
            }
          } catch (err) {
            console.error("Failed to parse realtime event", err);
          }
        };
        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        console.warn("WebSocket initialization error:", err);
      }
    };

    connect();

    return () => {
      if (broadcastChannel) broadcastChannel.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [currentUser]);

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("schedmaster_user");
    localStorage.removeItem("schedmaster_token");
    setCurrentUser(null);
    showToast("Signed out successfully. Session closed securely.", "info");
  };

  // Handler: Master Schedule Generation (OR-Tools CP-SAT)
  const handleGenerateSchedule = async (config?: GenerateScheduleRequest) => {
    try {
      setActionLoading(true);
      const res: OperationResponse = await api.generateSchedule(config);
      setLastSolverResult(res);
      await fetchData();

      setModalTitle("Master Schedule Generation Engine");
      setModalLatency(res.latency_ms);
      setModalDisruptionCost(res.disruption_cost);
      setModalDiff(res.diff);
      setModalReport(res.llm_report);
      setModalOpen(true);

      if (!res.success) {
        showToast(res.message || "Solver could not find a feasible schedule.", "error");
        return;
      }

      showToast(`Master schedule generated: ${res.slots_count} slots created in ${res.latency_ms.toFixed(0)}ms!`, "success");
    } catch (err: any) {
      console.error("Schedule generation failed:", err);
      showToast(err.message || "Failed to generate schedule", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Class Load Prioritization & Substitution Dispatch
  const handleReassignTeacherSlots = async (payload: ReassignTeacherSlotsRequest) => {
    try {
      setActionLoading(true);
      const res: OperationResponse = await api.reassignTeacherSlots(payload);
      setLastSolverResult(res);
      await fetchData();

      setModalTitle("Substitution & Class Load Prioritization Dispatch");
      setModalLatency(res.latency_ms);
      setModalDisruptionCost(res.disruption_cost);
      setModalDiff(res.diff);
      setModalReport(res.llm_report);
      setModalOpen(true);

      showToast(res.message || "Substitution dispatched successfully!", "success");
    } catch (err: any) {
      console.error("Substitution dispatch failed:", err);
      showToast(err.message || "Failed to dispatch substitution", "error");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Dynamic Schedule Repair (OR-Tools Disruption Minimization)
  const handleRepairSchedule = async (config?: GenerateScheduleRequest) => {
    try {
      setActionLoading(true);
      const res: OperationResponse = await api.repairSchedule(config);
      setLastSolverResult(res);
      await fetchData();

      setModalTitle("Fault-Tolerant Dynamic Schedule Repair");
      setModalLatency(res.latency_ms);
      setModalDisruptionCost(res.disruption_cost);
      setModalDiff(res.diff);
      setModalReport(res.llm_report);
      setModalOpen(true);

      if (!res.success) {
        showToast(res.message || "Dynamic schedule repair could not find a feasible solution.", "error");
        return;
      }

      showToast(
        `Dynamic repair completed in ${res.latency_ms.toFixed(0)}ms with disruption cost ${res.disruption_cost}!`,
        "success"
      );
    } catch (err: any) {
      console.error("Schedule repair failed:", err);
      showToast(err.message || "Dynamic schedule repair failed", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: View DepEd Form 7 Compliance Report
  const handleViewComplianceReport = async () => {
    try {
      setActionLoading(true);
      const reportRes = await api.getComplianceReport();
      setModalTitle("DepEd Form 7 Workload Compliance & Faculty Distribution");
      setModalLatency(0);
      setModalDisruptionCost(0);
      setModalDiff(undefined);
      setModalReport(reportRes.report);
      setModalOpen(true);
    } catch (err: any) {
      console.error("Failed to load compliance report:", err);
      showToast(err.message || "Failed to load report", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Toggle Teacher Status (Active, On Leave, Wellness Leave)
  const handleTeacherStatusToggle = async (teacherId: number, newStatus: string) => {
    try {
      await api.updateTeacher(teacherId, { status: newStatus });
      await fetchData();
      showToast(
        `Teacher status updated to "${newStatus}". Click "Dynamic Repair" to reassign affected slots.`,
        "info"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update teacher status", "error");
    }
  };

  // Handler: Open Add Teacher Modal
  const handleOpenAddTeacher = (deptId?: number | unknown) => {
    const validDept = typeof deptId === "number" ? deptId : null;
    const defaultDept =
      currentUser?.role === "DEPARTMENT_HEAD" && currentUser.department_id
        ? currentUser.department_id
        : validDept || (typeof selectedDeptId === "number" ? selectedDeptId : null);

    setEditingTeacher(null);
    setTeacherFormDefaultDept(defaultDept);
    setTeacherFormOpen(true);
  };

  // Handler: Open Edit Teacher Modal
  const handleOpenEditTeacher = (teacher: any) => {
    setEditingTeacher(teacher);
    setTeacherFormDefaultDept(teacher.department_id);
    setTeacherFormOpen(true);
  };

  // Handler: Open Delete Teacher Modal
  const handleOpenDeleteTeacher = (teacher: any) => {
    setDeletingTeacher(teacher);
    setDeleteModalOpen(true);
  };

  // Handler: View Teacher Detailed Profile
  const handleViewTeacherProfile = (teacher: any) => {
    const id = typeof teacher === "number" ? teacher : teacher.id;
    setInspectedTeacherId(id);
    setSelectedTeacherIdForProgram(id);
    setActiveView("PROFILE");
  };

  // Handler: Save Teacher (Create or Update)
  const handleSaveTeacher = async (data: any, isEdit: boolean, teacherId?: number) => {
    try {
      setActionLoading(true);
      if (isEdit && teacherId) {
        await api.updateTeacher(teacherId, data);
        showToast(`Faculty profile for ${data.name} updated successfully!`, "success");
      } else {
        await api.createTeacher(data);
        showToast(`New faculty member ${data.name} added to roster!`, "success");
      }
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Delete Teacher
  const handleConfirmDeleteTeacher = async (teacherId: number) => {
    try {
      setActionLoading(true);
      const res = await api.deleteTeacher(teacherId);
      setDeleteModalOpen(false);
      setDeletingTeacher(null);
      await fetchData();
      showToast(
        `${res.message} ${res.removed_slots_count > 0 ? `(${res.removed_slots_count} slots unassigned). Click "Dynamic Repair" to balance.` : ""}`,
        "info"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to delete teacher", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Section CRUD Handlers
  const [defaultSectionGrade, setDefaultSectionGrade] = useState<number>(7);

  const handleOpenAddSection = (defaultGrade?: number | unknown) => {
    setEditingSection(null);
    if (typeof defaultGrade === "number") setDefaultSectionGrade(defaultGrade);
    setSectionFormOpen(true);
  };

  const handleOpenEditSection = (section: any) => {
    setEditingSection(section);
    setSectionFormOpen(true);
  };

  const handleOpenDeleteSection = (section: any) => {
    setDeletingSection(section);
    setDeleteSectionModalOpen(true);
  };

  const handleSaveSection = async (data: any) => {
    try {
      setActionLoading(true);
      if (editingSection) {
        await api.updateSection(editingSection.id, data);
        showToast(`Section "${data.name}" updated successfully!`, "success");
      } else {
        await api.createSection(data);
        showToast(`New section "${data.name}" registered successfully!`, "success");
      }
      await fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to save section", "error");
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteSection = async () => {
    if (!deletingSection) return;
    try {
      setActionLoading(true);
      const res = await api.deleteSection(deletingSection.id);
      setDeleteSectionModalOpen(false);
      setDeletingSection(null);
      await fetchData();
      showToast(
        `${res.message} ${res.removed_slots_count > 0 ? `(${res.removed_slots_count} timetable slots removed).` : ""}`,
        "info"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to delete section", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewSectionClassTimetable = (sectionId: number) => {
    setSelectedSectionIdForClass(sectionId);
    setActiveView("CLASS_GRID");
  };

  // Handler: Open Assign Slot on Empty/Vacant Period (Class Grid or Master Grid)
  const handleOpenAssignEmptySlot = (sectionId: number, day: number, period: number) => {
    setSelectedSlot(null);
    setEmptySlotToAssign({ section_id: sectionId, day_of_week: day, period_index: period });
    setSlotModalOpen(true);
  };

  // Handler: Open Assign Slot on Empty/Vacant Period (Teacher Grid)
  const handleOpenAssignTeacherEmptySlot = (teacherId: number, day: number, period: number) => {
    setSelectedSlot(null);
    setEmptySlotToAssign({ teacher_id: teacherId, day_of_week: day, period_index: period });
    setSlotModalOpen(true);
  };

  // Handler: Change Section Adviser directly from Timetable
  const handleChangeAdviser = async (sectionId: number, teacherId: number) => {
    try {
      setActionLoading(true);
      await api.updateSection(sectionId, { adviser_id: teacherId });
      await fetchData();
      const teacherObj = teachers.find((t) => t.id === teacherId);
      const sectionObj = sections.find((s) => s.id === sectionId);
      showToast(
        `${teacherObj ? teacherObj.name : "Faculty"} is now the official Class Adviser for ${
          sectionObj ? sectionObj.name : "Section"
        }!`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update Class Adviser", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Real-time Slot Save (Assign or Update)
  const handleSaveSlot = async (slotData: {
    slot_id?: number;
    section_id: number;
    subject_id: number;
    teacher_id: number;
    day_of_week: number;
    period_index: number;
    allow_room_override?: boolean;
  }) => {
    try {
      setActionLoading(true);
      const res = await api.assignOrUpdateSlot(slotData);
      await fetchData();
      showToast(res.message || "Schedule slot saved in real time!", "success");
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Unassign / Clear Slot
  const handleUnassignSlot = async (slotId: number) => {
    try {
      setActionLoading(true);
      const res = await api.unassignSlot(slotId);
      await fetchData();
      showToast(res.message || "Schedule period unassigned successfully.", "info");
    } finally {
      setActionLoading(false);
    }
  };

  // Context Menu Handlers for Right-Clicking Timetable Slots
  const handleSlotContextMenu = (slot: ScheduleSlot, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 288;
    const menuHeight = 250;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 16);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 16);
    setContextMenuPos({ x: Math.max(16, x), y: Math.max(16, y) });
    setContextMenuSlot(slot);
  };

  const handleCloseContextMenu = () => {
    setContextMenuPos(null);
    setContextMenuSlot(null);
  };

  const handleTriggerUnassignFromMenu = (slot: ScheduleSlot) => {
    handleCloseContextMenu();
    setUnassignTargetSlot(slot);
    setUnassignModalOpen(true);
  };

  const handleEditFromContextMenu = (slot: ScheduleSlot) => {
    handleCloseContextMenu();
    setSelectedSlot(slot);
    setEmptySlotToAssign(null);
    setSlotModalOpen(true);
  };

  const handleConfirmRightClickUnassign = async () => {
    if (!unassignTargetSlot) return;
    try {
      await handleUnassignSlot(unassignTargetSlot.id);
      setUnassignModalOpen(false);
      setUnassignTargetSlot(null);
    } catch (err) {
      console.error("Failed to unassign slot from context menu", err);
    }
  };

  // Handler: Quick Add Teacher inline
  const handleQuickAddTeacher = async (teacherData: any) => {
    try {
      setActionLoading(true);
      const created = await api.createTeacher(teacherData);
      await fetchData();
      showToast(`Faculty member ${created.name} registered and synced in real time!`, "success");
      return created;
    } finally {
      setActionLoading(false);
    }
  };

  // If user is not logged in, render the Login Page!
  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // Active department object for department views
  const activeDepartment =
    typeof selectedDeptId === "number"
      ? departments.find((d) => d.id === selectedDeptId)
      : currentUser.department_id
      ? departments.find((d) => d.id === currentUser.department_id)
      : null;

  return (
    <div className="min-h-screen flex bg-[#FAF5FA] text-[#2E0249]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border bg-white text-xs font-semibold animate-fadeIn max-w-md">
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          {toast.type === "info" && <Sparkles className="w-5 h-5 text-[#A91079] shrink-0" />}
          <span className="text-slate-800">{toast.message}</span>
        </div>
      )}

      {/* Modern Sidebar Navigation */}
      <Sidebar
        currentUser={currentUser}
        activeView={activeView}
        onSelectView={(v) => {
          if (v === "PROFILE") {
            setInspectedTeacherId(null);
          }
          setActiveView(v);
        }}
        departments={departments}
        selectedDeptId={selectedDeptId}
        onSelectDepartment={(id) => setSelectedDeptId(id)}
        onLogout={handleLogout}
        onGenerateMaster={handleGenerateSchedule}
        onDynamicRepair={handleRepairSchedule}
        onViewReport={handleViewComplianceReport}
        actionLoading={actionLoading}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
        {/* Top Workspace Header Bar */}
        <header className="bg-white/95 backdrop-blur-md border-b border-[#E5CCE3] sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between gap-4 shadow-2xs no-print">
          {/* Breadcrumb Title */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#2E0249] text-sm sm:text-base tracking-tight">
                  {activeView === "PROFILE"
                    ? inspectedTeacherId
                      ? `${teachers.find((t) => t.id === inspectedTeacherId)?.name || (isTagalog ? "Guro" : "Faculty")} • ${isTagalog ? "Talaan at mga Klase" : "Profile & Classes"}`
                      : currentUser.role === "PRINCIPAL"
                      ? (isTagalog ? "Talaan ng Pangasiwaan ng Punong-Guro" : "Principal Administration Profile")
                      : `${currentUser.department_name} • ${isTagalog ? "Talaan ng Puno ng Kagawaran" : "Department Head Profile"}`
                    : activeView === "SECTIONS"
                    ? (isTagalog ? "Pamamahala ng mga Pangkat" : "Section Management Hub")
                    : activeView === "GENERATE_MASTER"
                    ? t.nav.generateMaster
                    : activeView === "CLASS_GRID"
                    ? (isTagalog ? "Talaorasan ng Programa ng Klase (SF-7)" : "Class Program Timetable (SF-7)")
                    : activeView === "TEACHER_GRID"
                    ? (isTagalog ? "Talaorasan ng Guro" : "Teacher Program Timetable")
                    : activeView === "MASTER_GRID"
                    ? (isTagalog ? "Pangkalahatang Talaorasan ng Paaralan" : "School Master Grid")
                    : activeView === "FACULTY_LOAD"
                    ? t.nav.facultyWorkload
                    : activeView === "DEPT_DASHBOARD"
                    ? `${currentUser.department_name} • ${isTagalog ? "Kagawaran ng Pagtuturo" : "Department Dashboard"}`
                    : activeView === "DEPT_GRID"
                    ? `${currentUser.department_name} • ${isTagalog ? "Talaorasan ng mga Klase" : "Classes Timetable"}`
                    : currentUser.role === "PRINCIPAL"
                    ? (isTagalog ? "Pangkalahatang Talaorasan ng Punong-Guro" : "Principal Master Schedule")
                    : `${currentUser.department_name} ${isTagalog ? "Lagusan ng Kagawaran" : "Department Portal"}`}
                </span>
                {currentUser.role !== "PRINCIPAL" && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#F3E5F2] text-[#A91079] border border-[#E5CCE3]">
                    {currentUser.department_code}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Clean Top Action Bar: Save Files, Language Switcher, Sign Out */}
          <div className="flex items-center gap-2">
            {/* Save Current Schedule Snapshot */}
            <button
              onClick={() => setSaveModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDF2FA] hover:bg-[#F9E2F4] text-[#A91079] border border-[#E5CCE3] rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
              title={isTagalog ? "I-save ang kasalukuyang talaorasan bilang snapshot" : "Save current timetable as a named snapshot version"}
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isTagalog ? "I-save ang Snapshot" : "Save Snapshot"}</span>
            </button>

            {/* Saved Schedule Versions Manager */}
            <button
              onClick={() => setSavedListModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F3E5F2] text-[#2E0249] border border-[#E5CCE3] rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
              title={isTagalog ? "Tingnan, ibalik, at pamahalaan ang mga naka-save na bersyon" : "Browse, restore, export, and manage saved schedule versions"}
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">{isTagalog ? "Mga Bersyon" : "Saved Versions"}</span>
              {savedSchedulesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#A91079] text-white">
                  {savedSchedulesCount}
                </span>
              )}
            </button>

            {/* Bilingual Language Switcher Toggle */}
            <div className="flex items-center bg-[#F3E5F2] p-0.5 rounded-lg border border-[#E5CCE3]">
              <button
                onClick={() => setLanguage("fil")}
                className={`px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  language === "fil"
                    ? "bg-[#A91079] text-white shadow-xs"
                    : "text-[#570A57] hover:text-[#2E0249]"
                }`}
                title="Pumili ng Wikang Filipino (Strictly Tagalog)"
              >
                <span>🇵🇭</span>
                <span className="hidden sm:inline">Filipino</span>
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  language === "en"
                    ? "bg-[#A91079] text-white shadow-xs"
                    : "text-[#570A57] hover:text-[#2E0249]"
                }`}
                title="Switch to English"
              >
                <span>🇺🇸</span>
                <span className="hidden sm:inline">English</span>
              </button>
            </div>

            {/* Quick Sign Out / Switch Dept */}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer border border-transparent hover:border-red-200"
              title={isTagalog ? "Lumabas sa Sistema" : "Sign Out / Switch Department"}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5">
          {/* Global Room Collision Alert Banner */}
          {allRoomIncidents.length > 0 && activeView !== "MASTER_GRID" && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950 animate-in fade-in shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-rose-600 text-white shrink-0">
                  <Building2 className="w-4 h-4" />
                </span>
                <div>
                  <span className="font-bold">Physical Facility Notice:</span> {allRoomIncidents.length}{" "}
                  room collision{allRoomIncidents.length > 1 ? "s" : ""} detected in the schedule (e.g.{" "}
                  <strong>{allRoomIncidents[0].roomNumber}</strong> occupied by multiple sections on{" "}
                  {allRoomIncidents[0].dayName} Period {allRoomIncidents[0].periodIndex}).
                </div>
              </div>
              <button
                onClick={() => setActiveView("MASTER_GRID")}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
              >
                <span>View in School Master Grid</span>
              </button>
            </div>
          )}

          {/* Timetable Format Switcher Pills (Only shown on timetable layout views) */}
          {(activeView === "CLASS_GRID" || activeView === "TEACHER_GRID" || activeView === "MASTER_GRID" || activeView === "DEPT_GRID") && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-[#E5CCE3] shadow-2xs no-print">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Format:
                </span>

                {/* School Master Grid */}
                <button
                  onClick={() => setActiveView("MASTER_GRID")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeView === "MASTER_GRID" || activeView === "DEPT_GRID"
                      ? "bg-[#A91079] text-white shadow-sm"
                      : "text-[#703372] hover:text-[#2E0249] hover:bg-[#F3E5F2]"
                  }`}
                  title="School-wide Multi-Section Master Grid"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>School Master Grid</span>
                  {allRoomIncidents.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#570A57] text-[#F806CC] border border-[#F806CC]/30 font-mono font-black animate-pulse">
                      {allRoomIncidents.length} Clashes
                    </span>
                  )}
                </button>

                {/* Class Timetable (Photo layout) */}
                <button
                  onClick={() => setActiveView("CLASS_GRID")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeView === "CLASS_GRID"
                      ? "bg-[#A91079] text-white shadow-sm"
                      : "text-[#703372] hover:text-[#2E0249] hover:bg-[#F3E5F2]"
                  }`}
                  title="Class Program Timetable (SF-7)"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Class Timetable (SF-7)</span>
                </button>

                {/* Teacher's Timetable */}
                <button
                  onClick={() => setActiveView("TEACHER_GRID")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeView === "TEACHER_GRID"
                      ? "bg-[#A91079] text-white shadow-sm"
                      : "text-[#703372] hover:text-[#2E0249] hover:bg-[#F3E5F2]"
                  }`}
                  title="Individual Teacher's Program Timetable"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Teacher's Timetable</span>
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="w-full flex flex-col items-center justify-center min-h-[400px]">
              <RefreshCw className="w-8 h-8 text-[#A91079] animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-700">Connecting to Academic Scheduler Engine...</p>
              <p className="text-xs text-slate-400 mt-1">Loading faculty profiles & DepEd Key Stage 3 matrices</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Option 1: Class Timetable View (DepEd Photo Layout) */}
              {activeView === "CLASS_GRID" && (
                <ClassTimetableGrid
                  sections={sections}
                  selectedSectionId={selectedSectionIdForClass}
                  onSelectSection={setSelectedSectionIdForClass}
                  slots={slots}
                  teachers={teachers}
                  durationMinutes={activePeriodDuration}
                  onSlotClick={(slot) => {
                    setSelectedSlot(slot);
                    setEmptySlotToAssign(null);
                    setSlotModalOpen(true);
                  }}
                  onSlotContextMenu={handleSlotContextMenu}
                  onEmptySlotClick={handleOpenAssignEmptySlot}
                  onAddTeacher={() => handleOpenAddTeacher()}
                  onChangeAdviser={handleChangeAdviser}
                />
              )}

              {/* Option 2: Teacher Timetable View */}
              {activeView === "TEACHER_GRID" && (
                <TeacherTimetableGrid
                  teachers={teachers}
                  selectedTeacherId={selectedTeacherIdForProgram}
                  onSelectTeacher={setSelectedTeacherIdForProgram}
                  slots={slots}
                  sections={sections}
                  departments={departments}
                  durationMinutes={activePeriodDuration}
                  onSlotClick={(slot) => {
                    setSelectedSlot(slot);
                    setEmptySlotToAssign(null);
                    setSlotModalOpen(true);
                  }}
                  onSlotContextMenu={handleSlotContextMenu}
                  onEmptySlotClick={handleOpenAssignTeacherEmptySlot}
                  onAddTeacher={() => handleOpenAddTeacher()}
                />
              )}

              {/* Option 3: Master Timetable View (Compact & 2D Scrollable Matrix) */}
              {activeView === "MASTER_GRID" && (
                <div className="w-full space-y-4">
                  <MasterTimetableGrid
                    slots={slots}
                    sections={sections}
                    teachers={teachers}
                    allSlots={slots}
                    durationMinutes={activePeriodDuration}
                    onSlotClick={(slot) => {
                      setSelectedSlot(slot);
                      setSlotModalOpen(true);
                    }}
                    onSlotContextMenu={handleSlotContextMenu}
                    onEmptySlotClick={handleOpenAssignEmptySlot}
                  />
                </div>
              )}

              {/* Option 4: Dedicated Solver Studio Tab (Generate Master Engine) */}
              {activeView === "GENERATE_MASTER" && (
                <GenerateMasterTab
                  slots={slots}
                  teachers={teachers}
                  sections={sections}
                  departments={departments}
                  subjects={subjects}
                  currentUser={currentUser}
                  onRunGenerate={handleGenerateSchedule}
                  onRunRepair={handleRepairSchedule}
                  onViewReport={handleViewComplianceReport}
                  onSelectView={(v) => {
                    if (v === "PROFILE") setInspectedTeacherId(null);
                    setActiveView(v);
                  }}
                  onTeacherStatusToggle={handleTeacherStatusToggle}
                  loading={actionLoading}
                  lastResult={lastSolverResult}
                  onOpenSaveModal={(configJson?: string) => {
                    if (configJson) setCurrentConfigJson(configJson);
                    setSaveModalOpen(true);
                  }}
                  onOpenSavedListModal={() => setSavedListModalOpen(true)}
                  savedCount={savedSchedulesCount}
                  activeSavedSchedule={activeSavedSchedule}
                  onRefreshData={fetchData}
                  onAddSection={handleOpenAddSection}
                  onEditSection={handleOpenEditSection}
                  onDeleteSection={handleOpenDeleteSection}
                />
              )}

              {/* Profile Tab View */}
              {activeView === "PROFILE" && (
                <ProfileView
                  teacher={
                    inspectedTeacherId
                      ? teachers.find((t) => t.id === inspectedTeacherId) || null
                      : currentUser.department_id
                      ? teachers.find((t) => t.name.toLowerCase() === currentUser.name.toLowerCase()) ||
                        teachers.find((t) => t.department_id === currentUser.department_id) ||
                        null
                      : null
                  }
                  currentUser={currentUser}
                  departments={departments}
                  sections={sections}
                  slots={slots}
                  teachers={teachers}
                  onEditTeacher={handleOpenEditTeacher}
                  onToggleStatus={handleTeacherStatusToggle}
                  onUpdateCurrentUser={(updated) => {
                    setCurrentUser(updated);
                    localStorage.setItem("schedmaster_user", JSON.stringify(updated));
                    showToast("Principal profile updated successfully.", "success");
                  }}
                  onBack={() => {
                    setInspectedTeacherId(null);
                    setActiveView(currentUser.role === "PRINCIPAL" ? "MASTER_GRID" : "DEPT_DASHBOARD");
                  }}
                />
              )}

              {/* Department Dashboard View (Department Heads Only) */}
              {activeView === "DEPT_DASHBOARD" && currentUser.role !== "PRINCIPAL" && activeDepartment && (
                <div className="space-y-6">
                  <DepartmentDashboard
                    activeDept={activeDepartment}
                    teachers={teachers}
                    sections={sections}
                    slots={slots}
                    subjects={subjects}
                    departments={departments}
                    currentUser={currentUser}
                    durationMinutes={activePeriodDuration}
                    onToggleStatus={handleTeacherStatusToggle}
                    onExecuteRepair={handleRepairSchedule}
                    repairLoading={actionLoading}
                    onAddTeacher={() => handleOpenAddTeacher()}
                    onEditTeacher={handleOpenEditTeacher}
                    onDeleteTeacher={handleOpenDeleteTeacher}
                    onConfirmReassign={handleReassignTeacherSlots}
                  />
                </div>
              )}

              {/* Department Timetable Standalone View */}
              {activeView === "DEPT_GRID" && activeDepartment && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {activeDepartment.name} Timetable Matrix
                      </h2>
                      <p className="text-xs text-slate-500">
                        Assigned classes across Grades 7 to 10 sections
                      </p>
                    </div>
                  </div>

                  <MasterTimetableGrid
                    slots={slots.filter((s) => s.department_name === activeDepartment.name)}
                    sections={sections}
                    teachers={teachers}
                    allSlots={slots}
                    onSlotClick={(slot) => {
                      setSelectedSlot(slot);
                      setSlotModalOpen(true);
                    }}
                  />
                </div>
              )}

              {/* Faculty Workload & Directory Unified View */}
              {activeView === "FACULTY_LOAD" && (
                <FacultyWorkloadView
                  teachers={
                    currentUser.role === "DEPARTMENT_HEAD" && activeDepartment
                      ? teachers.filter((t) => t.department_id === activeDepartment.id)
                      : teachers
                  }
                  departments={departments}
                  sections={sections}
                  slots={slots}
                  currentUser={currentUser}
                  activeDepartment={activeDepartment}
                  onTeacherStatusToggle={handleTeacherStatusToggle}
                  onAddTeacher={() => handleOpenAddTeacher()}
                  onEditTeacher={handleOpenEditTeacher}
                  onDeleteTeacher={handleOpenDeleteTeacher}
                  onViewTeacherSchedule={(teacherId) => {
                    setSelectedTeacherIdForProgram(teacherId);
                    setActiveView("TEACHER_GRID");
                  }}
                  onViewTeacherProfile={handleViewTeacherProfile}
                />
              )}

              {/* Section Management Hub (CRUD across all departments) */}
              {activeView === "SECTIONS" && (
                <SectionManagerView
                  sections={sections}
                  teachers={teachers}
                  departments={departments}
                  slots={slots}
                  onAddSection={handleOpenAddSection}
                  onEditSection={handleOpenEditSection}
                  onDeleteSection={handleOpenDeleteSection}
                  onViewClassTimetable={handleViewSectionClassTimetable}
                  onRefreshData={fetchData}
                />
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-xs text-slate-400 no-print flex flex-col sm:flex-row items-center justify-end gap-2">

          <span className="font-semibold text-slate-500">
            Logged in as: {currentUser.name} ({currentUser.badge})
          </span>
        </footer>
      </div>

      {/* Optimization & Diff Modal */}
      <ConflictResolutionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        latencyMs={modalLatency}
        disruptionCost={modalDisruptionCost}
        diff={modalDiff}
        llmReport={modalReport}
        title={modalTitle}
      />

      {/* Real-Time Slot Assignment & Override Modal */}
      <SlotAdjustmentModal
        isOpen={slotModalOpen}
        onClose={() => {
          setSlotModalOpen(false);
          setSelectedSlot(null);
          setEmptySlotToAssign(null);
        }}
        slot={selectedSlot}
        emptySlotInfo={emptySlotToAssign}
        sections={sections}
        subjects={subjects}
        teachers={teachers}
        departments={departments}
        slots={slots}
        onSaveSlot={handleSaveSlot}
        onUnassignSlot={handleUnassignSlot}
        onQuickAddTeacher={handleQuickAddTeacher}
        loading={actionLoading}
      />

      {/* Teacher Form Modal (Add / Edit) */}
      <TeacherFormModal
        isOpen={teacherFormOpen}
        onClose={() => {
          setTeacherFormOpen(false);
          setEditingTeacher(null);
        }}
        teacher={editingTeacher}
        departments={departments}
        sections={sections}
        teachers={teachers}
        defaultDeptId={teacherFormDefaultDept}
        isDeptHead={currentUser.role === "DEPARTMENT_HEAD"}
        onSave={handleSaveTeacher}
        loading={actionLoading}
      />

      {/* Delete Teacher Modal */}
      <DeleteTeacherModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingTeacher(null);
        }}
        teacher={deletingTeacher}
        departmentName={
          departments.find((d) => d.id === deletingTeacher?.department_id)?.name
        }
        onConfirmDelete={handleConfirmDeleteTeacher}
        loading={actionLoading}
      />

      {/* Section Form Modal (Create / Edit) */}
      <SectionFormModal
        isOpen={sectionFormOpen}
        onClose={() => {
          setSectionFormOpen(false);
          setEditingSection(null);
        }}
        sectionToEdit={editingSection}
        defaultGradeLevel={defaultSectionGrade}
        sections={sections}
        teachers={teachers}
        departments={departments}
        onSubmit={handleSaveSection}
        loading={actionLoading}
      />

      {/* Delete Section Modal */}
      <DeleteSectionModal
        isOpen={deleteSectionModalOpen}
        onClose={() => {
          setDeleteSectionModalOpen(false);
          setDeletingSection(null);
        }}
        section={deletingSection}
        slotsCount={
          deletingSection
            ? slots.filter((s) => s.section_id === deletingSection.id).length
            : 0
        }
        onConfirm={handleConfirmDeleteSection}
        loading={actionLoading}
      />

      {/* Save Schedule Snapshot Modal */}
      <SaveScheduleModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        slotsCount={slots.length}
        periodDurationMinutes={activePeriodDuration}
        configJson={currentConfigJson}
        onSave={handleSaveSchedule}
      />

      {/* Saved Schedules Version History & Management Modal */}
      <SavedSchedulesModal
        isOpen={savedListModalOpen}
        onClose={() => setSavedListModalOpen(false)}
        onOpenSaveCurrent={() => {
          setSavedListModalOpen(false);
          setSaveModalOpen(true);
        }}
        onRestoreSchedule={handleRestoreSchedule}
        currentDurationMinutes={activePeriodDuration}
        currentSlotsCount={slots.length}
      />

      {/* Right-click Floating Context Menu for Timetable Slots */}
      {contextMenuPos && contextMenuSlot && (
        <SlotContextMenu
          isOpen={Boolean(contextMenuPos && contextMenuSlot)}
          position={contextMenuPos}
          slot={contextMenuSlot}
          durationMinutes={activePeriodDuration}
          onClose={handleCloseContextMenu}
          onUnassign={handleTriggerUnassignFromMenu}
          onEdit={handleEditFromContextMenu}
        />
      )}

      {/* Confirmation Modal when unassigning a teacher via Right-Click */}
      {unassignTargetSlot && (
        <UnassignConfirmModal
          isOpen={unassignModalOpen}
          onClose={() => {
            setUnassignModalOpen(false);
            setUnassignTargetSlot(null);
          }}
          onConfirm={handleConfirmRightClickUnassign}
          teacherName={unassignTargetSlot.teacher_name}
          subjectName={unassignTargetSlot.subject_name}
          sectionName={unassignTargetSlot.section_name}
          dayName={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][unassignTargetSlot.day_of_week]}
          periodName={`Period ${unassignTargetSlot.period_index}`}
          roomNumber={unassignTargetSlot.room_number}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
