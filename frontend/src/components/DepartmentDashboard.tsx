import { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserCheck,
  Sparkles,
  BookOpen,
  Award,
  UserPlus,
  Edit3,
  Trash2,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { SubstitutionDispatcherModal } from "./SubstitutionDispatcherModal";
import { CSForm6LeaveModal } from "./CSForm6LeaveModal";
import { PrincipalAIReportsCard } from "./PrincipalAIReportsCard";
import {
  api,
  type ReassignTeacherSlotsRequest,
  type UserProfile,
  type ScheduleDeploymentRecord,
} from "../api/client";
import { getPeriodHeaders } from "../utils/bellSchedule";

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  max_daily_hours: number;
  max_weekly_hours: number;
  current_load_hours: number;
  is_adviser: boolean;
  advisory_section_id?: number | null;
  status: string;
  avatar_url?: string | null;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Section {
  id: number;
  name: string;
  grade_level?: number;
  program_type?: string;
  room_number?: string;
}

interface Subject {
  id: number;
  name: string;
  department_id: number;
  grade_level: number;
  required_weekly_loads: number;
}

interface Props {
  activeDept: Department;
  teachers: Teacher[];
  sections: Section[];
  slots?: any[];
  subjects?: Subject[];
  departments?: Department[];
  currentUser?: UserProfile;
  onToggleStatus: (teacherId: number, status: string) => void;
  onExecuteRepair: () => void;
  repairLoading: boolean;
  onAddTeacher?: (deptId: number) => void;
  onEditTeacher?: (teacher: Teacher) => void;
  onDeleteTeacher?: (teacher: Teacher) => void;
  onConfirmReassign?: (payload: ReassignTeacherSlotsRequest) => Promise<void>;
  durationMinutes?: number;
}

export const DepartmentDashboard = ({
  activeDept,
  teachers,
  sections,
  slots = [],
  subjects = [],
  departments = [],
  currentUser = { username: "head", name: "Dept Head", role: "DEPARTMENT_HEAD", position: "Head Teacher", badge: "Dept" },
  onToggleStatus,
  onExecuteRepair,
  repairLoading,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  onConfirmReassign,
  durationMinutes = 60,
}: Props) => {
  const [dispatcherTeacher, setDispatcherTeacher] = useState<Teacher | null>(null);
  const [latestDeployment, setLatestDeployment] = useState<ScheduleDeploymentRecord | null>(null);
  const [showScheduleMatrix, setShowScheduleMatrix] = useState(false);
  const [isAIReportModalOpen, setIsAIReportModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveSelectedTeacher, setLeaveSelectedTeacher] = useState<Teacher | null>(null);
  const [isExportingSF7, setIsExportingSF7] = useState(false);

  const handleExportSF7 = async () => {
    setIsExportingSF7(true);
    try {
      const blob = await api.exportSF7Excel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SF7_PGCHS_School_Personnel_Assignment_2026-2027.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Failed to export DepEd SF-7: " + (err.message || "Unknown error"));
    } finally {
      setIsExportingSF7(false);
    }
  };

  useEffect(() => {
    api.getLatestDeployment().then(setLatestDeployment).catch(() => {});
  }, [slots]);

  const deptTeachers = teachers.filter((t) => t.department_id === activeDept.id);
  const secMap = new Map<number, string>(sections.map((s) => [s.id, s.name]));
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const subMap = useMemo(() => new Map((subjects || []).map((s) => [s.id, s])), [subjects]);

  const isDeployedToThisDept = useMemo(() => {
    if (!latestDeployment) return false;
    if (!latestDeployment.target_department_ids || latestDeployment.target_department_ids.length === 0) return true;
    return latestDeployment.target_department_ids.includes(activeDept.id);
  }, [latestDeployment, activeDept.id]);

  // Department specific slots
  const deptSlots = useMemo(() => {
    const teacherIds = new Set(deptTeachers.map((t) => t.id));
    return slots.filter((sl) => teacherIds.has(sl.teacher_id));
  }, [slots, deptTeachers]);

  const activeCount = deptTeachers.filter((t) => t.status === "Active").length;
  const onLeaveFaculty = deptTeachers.filter((t) => t.status !== "Active");
  const onLeaveCount = onLeaveFaculty.length;
  const totalDepartmentHours = deptTeachers.reduce((acc, t) => acc + (t.status === "Active" ? t.current_load_hours : 0), 0);
  const adviserCount = deptTeachers.filter((t) => t.is_adviser).length;

  const PERIOD_TIMES = useMemo(() => {
    return getPeriodHeaders(durationMinutes).map((h) => ({
      period: h.index,
      label: h.time,
      name: h.name,
    }));
  }, [durationMinutes]);

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  return (
    <div className="space-y-6">
      {/* Top Hero & Action Banner */}
      <div className="bg-white rounded-3xl p-6 border border-[#E5CCE3] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#F3E5F2] text-[#A91079]">
              <BookOpen className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {activeDept.name} Department Dashboard
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E5F2] text-[#A91079]">
              {activeDept.code}
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Department Head monitoring portal, faculty teaching workload allocation, and real-time substitute deployment.
          </p>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
          <button
            onClick={() => setIsAIReportModalOpen(true)}
            className="px-4 py-2.5 bg-white hover:bg-[#FAF5FA] text-[#A91079] border border-[#E5CCE3] rounded-2xl text-xs font-bold shadow-2xs flex items-center gap-2 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#A91079]" />
            <span>AI Compliance Report</span>
          </button>
          <button
            onClick={onExecuteRepair}
            disabled={repairLoading}
            className="px-4 py-2.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-2xl text-xs font-bold shadow-md shadow-[#A91079]/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{repairLoading ? "Repairing Schedule..." : "Execute Dynamic Repair"}</span>
          </button>
        </div>
      </div>

      {/* Official Deployed Master Timetable Banner */}
      {isDeployedToThisDept && latestDeployment ? (
        <div className="bg-gradient-to-r from-emerald-950 via-[#570A57] to-[#2E0249] text-white rounded-3xl p-5 border border-emerald-600/40 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20 text-emerald-300 shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black tracking-tight text-white">
                  Official Master Timetable Deployed & In Effect
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active Deployment</span>
                </span>
                <span className="text-[10px] text-[#F3E5F2] font-semibold">
                  S.Y. {latestDeployment.academic_year} ({latestDeployment.semester})
                </span>
              </div>
              <p className="text-xs text-[#F3E5F2]/90 mt-1 max-w-2xl italic font-serif">
                "{latestDeployment.memo || "Official Master Timetable deployed to Academic Departments."}"
              </p>
              <div className="text-[10px] text-[#F3E5F2]/70 mt-1 flex items-center gap-2">
                <span>Authority: {latestDeployment.deployed_by}</span>
                <span>•</span>
                <span>{deptSlots.length} Department Slots Scheduled</span>
                <span>•</span>
                <span>Released: {new Date(latestDeployment.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowScheduleMatrix(!showScheduleMatrix)}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer shadow-xs self-start md:self-auto"
          >
            <Calendar className="w-4 h-4 text-emerald-300" />
            <span>{showScheduleMatrix ? "Hide Department Timetable" : "View Department Timetable"}</span>
            {showScheduleMatrix ? (
              <ChevronUp className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-emerald-300" />
            )}
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Draft Mode:</strong> The school master timetable has not yet been officially deployed to the {activeDept.name} Department. Teaching assignments shown below are preliminary drafts.
            </span>
          </div>
          {deptSlots.length > 0 && (
            <button
              type="button"
              onClick={() => setShowScheduleMatrix(!showScheduleMatrix)}
              className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 shrink-0 ml-2 cursor-pointer"
            >
              {showScheduleMatrix ? "Hide Draft Grid" : "View Draft Grid"}
            </button>
          )}
        </div>
      )}

      {/* Department Weekly Schedule Matrix */}
      {showScheduleMatrix && (
        <div className="bg-white rounded-3xl border border-[#E5CCE3] shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 bg-slate-50 border-b border-[#E5CCE3] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#A91079]" />
              <h3 className="text-xs font-bold text-slate-900">
                {activeDept.name} Department — Weekly Instructional Schedule Matrix
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E5F2] text-[#A91079]">
                {deptSlots.length} Classes Assigned
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Monday to Friday • Periods 1–7
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-[#E5CCE3] text-slate-700 font-bold text-[11px]">
                  <th className="p-2.5 text-left border-r border-[#E5CCE3] w-36">Time / Period</th>
                  {DAYS.map((day) => (
                    <th key={day} className="p-2.5 text-center border-r border-[#E5CCE3] last:border-r-0">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {PERIOD_TIMES.map((pt) => (
                  <tr key={pt.period} className="hover:bg-slate-50/50 transition">
                    <td className="p-2.5 border-r border-[#E5CCE3] bg-slate-50/60 font-semibold text-slate-700 text-[11px]">
                      <div>{pt.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{pt.label}</div>
                    </td>
                    {DAYS.map((_, dIdx) => {
                      const periodSlots = deptSlots.filter(
                        (sl) => sl.day_of_week === dIdx && sl.period_index === pt.period
                      );

                      return (
                        <td
                          key={dIdx}
                          className="p-2 border-r border-[#E5CCE3] last:border-r-0 align-top min-w-[130px]"
                        >
                          {periodSlots.length === 0 ? (
                            <span className="text-slate-300 text-[10px] italic block text-center py-2">
                              —
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              {periodSlots.map((sl) => {
                                const teacher = teacherMap.get(sl.teacher_id);
                                const subject = subMap.get(sl.subject_id);
                                const sectionName = secMap.get(sl.section_id) || `Sec ${sl.section_id}`;

                                return (
                                  <div
                                    key={sl.id}
                                    className="p-1.5 rounded-xl bg-[#FDF2FA] border border-[#E5CCE3] text-[10px] leading-tight space-y-0.5 shadow-2xs"
                                  >
                                    <div className="font-black text-[#2E0249] truncate">
                                      {sectionName}
                                    </div>
                                    <div className="font-semibold text-[#703372] truncate">
                                      {subject?.name || "Subject"}
                                    </div>
                                    <div className="text-slate-600 truncate flex items-center justify-between pt-0.5 border-t border-[#E5CCE3]">
                                      <span className="font-medium text-[9px] text-slate-500 truncate">
                                        {teacher?.name || "Faculty"}
                                      </span>
                                      {sl.is_locked && (
                                        <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-1 rounded shrink-0">
                                          LOCKED
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics KPI Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Roster */}
        <div className="p-4 rounded-2xl border bg-white text-slate-800 border-[#E5CCE3] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="text-slate-500">Department Faculty</span>
            <Users className="w-4 h-4 text-[#A91079]" />
          </div>
          <div className="text-2xl font-black text-slate-900">{deptTeachers.length}</div>
          <div className="text-[10px] mt-1 text-slate-500">
            {activeCount} Active • {deptTeachers.length - activeCount} Unavailable
          </div>
        </div>

        {/* Teaching Volume */}
        <div className="p-4 rounded-2xl border bg-[#FDF2FA] text-slate-800 border-[#E5CCE3] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="text-[#703372]">Weekly Teaching Volume</span>
            <BookOpen className="w-4 h-4 text-[#A91079]" />
          </div>
          <div className="text-2xl font-black text-[#2E0249]">
            {totalDepartmentHours} <span className="text-sm font-semibold text-[#A91079]">hrs/week</span>
          </div>
          <div className="text-[10px] mt-1 text-[#A91079]">
            Avg {deptTeachers.length > 0 ? (totalDepartmentHours / deptTeachers.length).toFixed(1) : 0} hrs / instructor
          </div>
        </div>

        {/* On Leave / Substitute */}
        <div
          className={`p-4 rounded-2xl border shadow-2xs ${
            onLeaveCount === 0
              ? "bg-emerald-50/60 text-slate-800 border-emerald-200"
              : "bg-red-50/70 text-slate-800 border-red-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className={onLeaveCount === 0 ? "text-emerald-800" : "text-red-800"}>
              On Leave / Unavailable
            </span>
            {onLeaveCount === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
          </div>
          <div className={`text-2xl font-black ${onLeaveCount === 0 ? "text-emerald-950" : "text-red-950"}`}>
            {onLeaveCount}
          </div>
          <div className={`text-[10px] mt-1 ${onLeaveCount === 0 ? "text-emerald-700" : "text-red-700"}`}>
            {onLeaveCount === 0 ? "Full Attendance" : "Substitute reallocation needed"}
          </div>
        </div>

        {/* Advisory Assignments */}
        <div className="p-4 rounded-2xl border bg-white text-slate-800 border-[#E5CCE3] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="text-slate-500">Designated Advisers</span>
            <GraduationCap className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{adviserCount}</div>
          <div className="text-[10px] mt-1 text-slate-500">
            Assigned to Key Stage 3 Sections
          </div>
        </div>
      </div>

      {/* Active Leave Alert & Quick Dispatch Banner */}
      {onLeaveCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/15 text-amber-800 shrink-0">
              <Zap className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900 tracking-tight">
                  Class Load Prioritization & Substitution Dispatch Required
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                  {onLeaveCount} Faculty Inactive
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                Classes from absent faculty need substitute coverage. You can apply automated policies (Least Load, Higher Rank, or Assign Yourself) and manually customize each class.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDispatcherTeacher(onLeaveFaculty[0])}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer shrink-0"
          >
            <Zap className="w-4 h-4" />
            <span>Open Substitution Dispatcher</span>
          </button>
        </div>
      )}

      {/* Department Faculty Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#E5CCE3] overflow-hidden">
        <div className="p-4 border-b border-[#E5CCE3] bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#A91079]" />
              <span>Department Faculty Roster & Workload Status</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Standard 6 hrs/day daily teaching limit and substitute priority
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setLeaveSelectedTeacher(null);
                setIsLeaveModalOpen(true);
              }}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="File official Civil Service Form 6 Application for Leave & Trigger Tier 2 MPP Substitution"
            >
              <FileText className="w-3.5 h-3.5 text-[#A91079]" />
              <span>File CS Form 6 Leave</span>
            </button>

            <button
              onClick={handleExportSF7}
              disabled={isExportingSF7}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
              title="Export official DepEd School Form 7 (School Personnel Assignment List & Basic Profile)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isExportingSF7 ? "Exporting..." : "Export SF-7 (.xlsx)"}</span>
            </button>

            {onAddTeacher && (
              <button
                onClick={() => onAddTeacher(activeDept.id)}
                className="px-3 py-1.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-[#E5CCE3]">
              <tr>
                <th className="p-3">Faculty Member</th>
                <th className="p-3">Position / Rank</th>
                <th className="p-3">Class Advisory Role</th>
                <th className="p-3">Weekly Teaching Load</th>
                <th className="p-3">Availability Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-slate-400">
                    No faculty members currently registered in this department. Click "Add Member" to create one.
                  </td>
                </tr>
              ) : (
                deptTeachers.map((teacher) => {
                  const isAbsent = teacher.status !== "Active";
                  const isUnder = !isAbsent && teacher.current_load_hours < 20;
                  const isOptimal =
                    !isAbsent &&
                    teacher.current_load_hours >= 20 &&
                    teacher.current_load_hours <= 25;

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          {teacher.avatar_url ? (
                            <img
                              src={teacher.avatar_url}
                              alt={teacher.name}
                              className="w-7 h-7 rounded-lg object-cover shrink-0 border border-[#E5CCE3] bg-white"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (fallback) fallback.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <span
                            className={`w-7 h-7 rounded-lg bg-[#FDF2FA] text-[#A91079] flex items-center justify-center font-bold text-[11px] shrink-0 border border-[#E5CCE3] ${
                              teacher.avatar_url ? "hidden" : ""
                            }`}
                          >
                            {teacher.name.charAt(0)}
                          </span>
                          <span>{teacher.name}</span>
                        </div>
                      </td>

                      <td className="p-3 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          <span>{teacher.position}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        {teacher.is_adviser && teacher.advisory_section_id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A91079] bg-[#FDF2FA] px-2 py-0.5 rounded-md border border-[#E5CCE3]">
                            <UserCheck className="w-3.5 h-3.5 text-[#A91079]" />
                            <span>{secMap.get(teacher.advisory_section_id) || "Assigned"}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isAbsent
                              ? "bg-slate-100 text-slate-500"
                              : isUnder
                              ? "bg-amber-100 text-amber-800"
                              : isOptimal
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {isAbsent ? "0 hrs (On Leave)" : `${teacher.current_load_hours} hrs/week`}
                          {isUnder && " (Underloaded)"}
                          {isOptimal && " (Optimal)"}
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            teacher.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              teacher.status === "Active" ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {teacher.status}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          {onEditTeacher && (
                            <button
                              onClick={() => onEditTeacher(teacher)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#A91079] hover:bg-slate-100 transition cursor-pointer"
                              title="Edit Faculty Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {onDeleteTeacher && (
                            <button
                              onClick={() => onDeleteTeacher(teacher)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Remove Faculty Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Status Toggle Buttons */}
                          {teacher.status === "Active" ? (
                            <>
                              <button
                                onClick={() => {
                                  setLeaveSelectedTeacher(teacher);
                                  setIsLeaveModalOpen(true);
                                }}
                                className="px-2 py-1 text-[10px] font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition cursor-pointer flex items-center gap-1"
                                title="File Civil Service Form No. 6 Application for Leave & Trigger Tier 2 MPP Substitution"
                              >
                                <FileText className="w-3 h-3 text-[#A91079]" />
                                <span>CS-6 Leave</span>
                              </button>
                              <button
                                onClick={() => onToggleStatus(teacher.id, "On Leave")}
                                className="px-2 py-1 text-[10px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition cursor-pointer"
                              >
                                Quick Leave
                              </button>
                              <button
                                onClick={() => onToggleStatus(teacher.id, "Wellness Leave")}
                                className="px-2 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition cursor-pointer"
                                title="DO 002, s. 2026 Wellness Leave"
                              >
                                Wellness
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setDispatcherTeacher(teacher)}
                                className="px-2 py-1 text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition cursor-pointer flex items-center gap-1"
                                title="Open Class Load Prioritization & Substitution Dispatcher"
                              >
                                <Zap className="w-3 h-3 text-amber-700" />
                                <span>Substitute</span>
                              </button>
                              <button
                                onClick={() => onToggleStatus(teacher.id, "Active")}
                                className="px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
                              >
                                Activate
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Class Load Prioritization & Substitution Dispatcher Modal */}
      {dispatcherTeacher && (
        <SubstitutionDispatcherModal
          isOpen={!!dispatcherTeacher}
          onClose={() => setDispatcherTeacher(null)}
          absentTeacher={dispatcherTeacher}
          teachers={teachers}
          sections={sections as any}
          subjects={subjects}
          slots={slots}
          departments={departments}
          currentUser={currentUser}
          onConfirmReassign={async (payload) => {
            if (onConfirmReassign) {
              await onConfirmReassign(payload);
            }
          }}
        />
      )}

      {/* Civil Service Form 6 Application for Leave & Tier 2 MPP Modal */}
      {isLeaveModalOpen && (
        <CSForm6LeaveModal
          isOpen={isLeaveModalOpen}
          onClose={() => {
            setIsLeaveModalOpen(false);
            setLeaveSelectedTeacher(null);
          }}
          teachers={teachers}
          selectedTeacher={leaveSelectedTeacher}
          onLeaveFiled={() => {
            window.dispatchEvent(new CustomEvent("schedmaster_sections_refresh"));
          }}
        />
      )}

      {/* Department AI Reports & Statutory Audit Modal */}
      {isAIReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5CCE3] mb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#A91079]" />
                <h3 className="text-base font-extrabold text-[#2E0249]">
                  {activeDept.name} Department AI Reports & Statutory Audit
                </h3>
              </div>
              <button
                onClick={() => setIsAIReportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <PrincipalAIReportsCard
              departmentsCount={departments.length || 8}
              sectionsCount={sections.length}
              teachersCount={deptTeachers.length}
              slotsCount={slots.filter((s) => s.department_name === activeDept.name).length || slots.length}
              departmentId={activeDept.id}
              departmentName={activeDept.name}
              departmentCode={activeDept.code}
              requesterName={currentUser.name}
              requesterTitle={currentUser.position}
              isDeptHead={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
