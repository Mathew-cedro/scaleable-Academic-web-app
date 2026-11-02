import { useState, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  UserPlus,
  Edit3,
  Trash2,
  Calendar,
  User,
  GraduationCap,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import type { UserProfile } from "../api/client";

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

interface ScheduleSlot {
  id: number;
  teacher_id: number;
  day_of_week: number;
  period_index: number;
}

interface Props {
  teachers: Teacher[];
  departments: Department[];
  sections: Section[];
  slots: ScheduleSlot[];
  currentUser?: UserProfile | null;
  activeDepartment?: Department | null;
  onTeacherStatusToggle: (teacherId: number, newStatus: string) => void;
  onAddTeacher?: () => void;
  onEditTeacher?: (teacher: Teacher) => void;
  onDeleteTeacher?: (teacher: Teacher) => void;
  onViewTeacherSchedule?: (teacherId: number) => void;
  onViewTeacherProfile?: (teacherId: number) => void;
}

export const FacultyWorkloadView = ({
  teachers,
  departments,
  sections,
  slots,
  currentUser,
  activeDepartment,
  onTeacherStatusToggle,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  onViewTeacherSchedule,
  onViewTeacherProfile,
}: Props) => {
  const isDeptHead = currentUser?.role === "DEPARTMENT_HEAD";
  const userDeptId = currentUser?.department_id ?? null;

  const [search, setSearch] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<number | "ALL">(() => {
    if (isDeptHead && userDeptId) return userDeptId;
    return "ALL";
  });
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLIANT" | "OVERLOAD" | "ON_LEAVE">("ALL");

  // Pagination State (Fixed 30 cards per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 30;

  useEffect(() => {
    if (isDeptHead && userDeptId) {
      setSelectedDeptId(userDeptId);
    }
  }, [isDeptHead, userDeptId]);

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDeptId, statusFilter]);

  const deptMap = useMemo(() => new Map<number, Department>(departments.map((d) => [d.id, d])), [departments]);
  const secMap = useMemo(() => new Map<number, Section>(sections.map((s) => [s.id, s])), [sections]);

  const activeDeptName =
    currentUser?.department_name ||
    activeDepartment?.name ||
    (typeof selectedDeptId === "number" ? deptMap.get(selectedDeptId)?.name : null) ||
    "Department";

  // Compute daily teaching loads for each teacher across Monday-Friday
  const teacherStats = useMemo(() => {
    return teachers.map((t) => {
      const dailyLoads = [0, 1, 2, 3, 4].map(
        (day) => slots.filter((s) => s.teacher_id === t.id && s.day_of_week === day).length
      );
      const peakDailyLoad = Math.max(...dailyLoads, 0);
      const maxDaily = t.max_daily_hours || 6;
      const isOverloadedDaily = peakDailyLoad > maxDaily;

      return {
        ...t,
        dailyLoads,
        peakDailyLoad,
        maxDaily,
        isOverloadedDaily,
      };
    });
  }, [teachers, slots]);

  // Daily analytics KPIs
  const activeCount = teachers.filter((t) => t.status === "Active").length;
  const compliantDailyCount = teacherStats.filter((t) => t.status === "Active" && !t.isOverloadedDaily).length;
  const overloadDailyCount = teacherStats.filter((t) => t.status === "Active" && t.isOverloadedDaily).length;
  const onLeaveCount = teachers.filter((t) => t.status !== "Active").length;

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    return teacherStats.filter((t) => {
      const q = search.toLowerCase().trim();
      const deptName = deptMap.get(t.department_id)?.name || "";
      const advisoryName = t.advisory_section_id ? secMap.get(t.advisory_section_id)?.name || "" : "";

      const matchesSearch =
        q.length === 0 ||
        (t.name || "").toLowerCase().includes(q) ||
        (t.position || "").toLowerCase().includes(q) ||
        deptName.toLowerCase().includes(q) ||
        advisoryName.toLowerCase().includes(q);

      const matchesDept = selectedDeptId === "ALL" || t.department_id === selectedDeptId;

      let matchesStatus = true;
      if (statusFilter === "COMPLIANT") {
        matchesStatus = t.status === "Active" && !t.isOverloadedDaily;
      } else if (statusFilter === "OVERLOAD") {
        matchesStatus = t.status === "Active" && t.isOverloadedDaily;
      } else if (statusFilter === "ON_LEAVE") {
        matchesStatus = t.status !== "Active";
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [teacherStats, search, selectedDeptId, statusFilter, deptMap, secMap]);

  // Pagination Calculations
  const totalTeachers = filteredTeachers.length;
  const totalPages = Math.max(1, Math.ceil(totalTeachers / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalTeachers);

  const paginatedTeachers = useMemo(() => {
    return filteredTeachers.slice(startIndex, endIndex);
  }, [filteredTeachers, startIndex, endIndex]);

  return (
    <div className="space-y-6">
      {/* Top Hero & Action Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#F3E5F2] text-[#A91079]">
              {isDeptHead ? <Building2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {isDeptHead ? `${activeDeptName} Faculty Workload Hub` : "Faculty Workload & Directory Hub"}
            </h2>

            {isDeptHead && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E5F2] text-[#A91079]">
                Department Head Scoped
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {isDeptHead
              ? `Departmental monitoring for ${activeDeptName} faculty daily teaching loads and substitute availability.`
              : "Monitor faculty daily teaching loads, weekly distribution, and substitute availability across all departments."}
          </p>
        </div>

        {onAddTeacher && (
          <button
            onClick={() => onAddTeacher()}
            className="px-4 py-2.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-2xl text-xs font-bold shadow-md shadow-[#A91079]/20 flex items-center gap-2 transition cursor-pointer self-start md:self-auto shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Faculty Member</span>
          </button>
        )}
      </div>

      {/* Analytics KPI Tiles (Daily Load Focused) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faculty */}
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "ALL"
              ? "bg-[#2E0249] text-white border-[#570A57] shadow-sm"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className={statusFilter === "ALL" ? "text-slate-300" : "text-slate-500"}>
              Total Roster
            </span>
            <Users className={`w-4 h-4 ${statusFilter === "ALL" ? "text-[#F806CC]" : "text-slate-400"}`} />
          </div>
          <div className="text-2xl font-black">{teachers.length}</div>
          <div className={`text-[10px] mt-1 ${statusFilter === "ALL" ? "text-slate-400" : "text-slate-500"}`}>
            {activeCount} Active • {departments.length} Depts
          </div>
        </div>

        {/* Compliant Daily Load */}
        <div
          onClick={() => setStatusFilter("COMPLIANT")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "COMPLIANT"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-emerald-50/60 text-slate-800 border-emerald-200 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className={statusFilter === "COMPLIANT" ? "text-emerald-100" : "text-emerald-800"}>
              Compliant Daily Load
            </span>
            <CheckCircle2 className={`w-4 h-4 ${statusFilter === "COMPLIANT" ? "text-white" : "text-emerald-600"}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === "COMPLIANT" ? "text-white" : "text-emerald-950"}`}>
            {compliantDailyCount}
          </div>
          <div className={`text-[10px] mt-1 ${statusFilter === "COMPLIANT" ? "text-emerald-100" : "text-emerald-700"}`}>
            ≤ 6 hrs/day peak load
          </div>
        </div>

        {/* Daily Overload Alerts */}
        <div
          onClick={() => setStatusFilter("OVERLOAD")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "OVERLOAD"
              ? "bg-red-600 text-white border-red-600 shadow-sm"
              : overloadDailyCount === 0
              ? "bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300"
              : "bg-red-50/70 text-slate-800 border-red-200 hover:border-red-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className={statusFilter === "OVERLOAD" ? "text-white" : overloadDailyCount === 0 ? "text-slate-600" : "text-red-800"}>
              Daily Overloads
            </span>
            <AlertTriangle className={`w-4 h-4 ${statusFilter === "OVERLOAD" ? "text-white" : overloadDailyCount === 0 ? "text-slate-400" : "text-red-600"}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === "OVERLOAD" ? "text-white" : overloadDailyCount === 0 ? "text-slate-900" : "text-red-950"}`}>
            {overloadDailyCount}
          </div>
          <div className={`text-[10px] mt-1 ${statusFilter === "OVERLOAD" ? "text-red-100" : overloadDailyCount === 0 ? "text-slate-500" : "text-red-700"}`}>
            {overloadDailyCount === 0 ? "0 Overloads (100% Compliant)" : "> 6h/day statutory violation"}
          </div>
        </div>

        {/* On Leave */}
        <div
          onClick={() => setStatusFilter("ON_LEAVE")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "ON_LEAVE"
              ? "bg-red-600 text-white border-red-600 shadow-sm"
              : "bg-red-50/60 text-slate-800 border-red-200 hover:border-red-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className={statusFilter === "ON_LEAVE" ? "text-red-100" : "text-red-800"}>
              On Leave / Unavailable
            </span>
            <AlertTriangle className={`w-4 h-4 ${statusFilter === "ON_LEAVE" ? "text-white" : "text-red-600"}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === "ON_LEAVE" ? "text-white" : "text-red-950"}`}>
            {onLeaveCount}
          </div>
          <div className={`text-[10px] mt-1 ${statusFilter === "ON_LEAVE" ? "text-red-100" : "text-red-700"}`}>
            Substitute pool coverage
          </div>
        </div>
      </div>

      {/* Search & Department Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search faculty name, department, position, advisory..."
              className="w-full pl-9 pr-4 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
            <div>
              Showing <strong className="text-slate-900">{totalTeachers > 0 ? startIndex + 1 : 0}–{endIndex}</strong> of {totalTeachers} faculty
              {totalPages > 1 && (
                <span className="text-slate-400 font-normal ml-1">
                  (Page {safePage} of {totalPages})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Department Quick Filter Chips */}
        {isDeptHead ? (
          <div className="flex items-center gap-2 pt-1 text-xs">
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#A91079] text-white shadow-2xs flex items-center gap-1.5 shrink-0">
              <Building2 className="w-3.5 h-3.5" />
              <span>{activeDeptName} Department</span>
              <span className="bg-[#570A57] px-1.5 py-0.2 rounded-md text-[10px]">
                {filteredTeachers.length} Faculty
              </span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Scoped strictly to your assigned academic department
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedDeptId("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                selectedDeptId === "ALL"
                  ? "bg-[#A91079] text-white shadow-2xs"
                  : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
              }`}
            >
              All Departments ({teachers.length})
            </button>
            {departments.map((dept) => {
              const count = teachers.filter((t) => t.department_id === dept.id).length;
              const isSelected = selectedDeptId === dept.id;
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDeptId(dept.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-[#A91079] text-white font-bold shadow-2xs"
                      : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                  }`}
                >
                  {dept.name} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Faculty Cards Grid */}
      {filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <h4 className="text-sm font-bold text-slate-700">No Faculty Members Found</h4>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or department filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedTeachers.map((teacher) => {
            const dept = deptMap.get(teacher.department_id);
            const advisory = teacher.advisory_section_id ? secMap.get(teacher.advisory_section_id) : null;
            const isActive = teacher.status === "Active";
            const dailyPercent = Math.min(Math.round((teacher.peakDailyLoad / teacher.maxDaily) * 100), 100);

            return (
              <div
                key={teacher.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                  !isActive
                    ? "border-red-200 bg-red-50/20"
                    : teacher.isOverloadedDaily
                    ? "border-red-300 ring-1 ring-red-300"
                    : "border-[#E5CCE3] hover:border-[#A91079]"
                }`}
              >
                {/* Card Top: Avatar, Names, and Status Switch */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {teacher.avatar_url ? (
                        <img
                          src={teacher.avatar_url}
                          alt={teacher.name}
                          className="w-11 h-11 rounded-2xl object-cover shrink-0 shadow-2xs border border-slate-200 bg-slate-50"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                            const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (next) next.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-11 h-11 rounded-2xl text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs ${
                          teacher.avatar_url ? "hidden" : ""
                        } ${
                          !isActive
                            ? "bg-slate-400"
                            : teacher.isOverloadedDaily
                            ? "bg-red-600"
                            : "bg-[#A91079]"
                        }`}
                      >
                        {teacher.name
                          .split(" ")
                          .filter((n) => !n.startsWith("Dr.") && !n.startsWith("Mrs.") && !n.startsWith("Mr.") && !n.startsWith("G.") && !n.startsWith("Bb."))
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2) || "TC"}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate" title={teacher.name}>
                          {teacher.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                          <span>{teacher.position}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#A91079] truncate">{dept?.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Active / On Leave Status Toggle */}
                    <button
                      onClick={() => onTeacherStatusToggle(teacher.id, isActive ? "On Leave" : "Active")}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer shrink-0 ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      }`}
                      title="Click to toggle faculty leave status for automated substitution"
                    >
                      {isActive ? "🟢 Active" : "🔴 On Leave"}
                    </button>
                  </div>

                  {/* Advisory Tag */}
                  <div className="mb-3">
                    {advisory ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#FDF2FA] text-[#A91079] border border-[#E5CCE3]">
                        <GraduationCap className="w-3.5 h-3.5 text-[#A91079]" />
                        <span>Adviser: {advisory.name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-100">
                        Subject Teacher (No Advisory)
                      </span>
                    )}
                  </div>

                  {/* Daily Workload Progress & 5-Day Breakdown */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 mb-3 space-y-2.5">
                    {/* Daily Load Header */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-bold text-[11px] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#A91079]" />
                        <span>Daily Teaching Load</span>
                      </span>
                      <span className="font-black text-slate-900">
                        {teacher.peakDailyLoad}{" "}
                        <span className="text-[11px] font-semibold text-slate-500">
                          / {teacher.maxDaily} hrs peak
                        </span>
                        <span className="text-[10px] font-normal text-slate-400 ml-1">
                          ({dailyPercent}%)
                        </span>
                      </span>
                    </div>

                    {/* Progress Bar against Daily Cap */}
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          !isActive
                            ? "bg-slate-400"
                            : teacher.isOverloadedDaily
                            ? "bg-red-500"
                            : teacher.peakDailyLoad === 0
                            ? "bg-slate-300"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${dailyPercent}%` }}
                      />
                    </div>

                    {/* Monday through Friday Daily Distribution Chips */}
                    <div className="grid grid-cols-5 gap-1.5 pt-0.5 text-center">
                      {[
                        { key: "M", label: "Mon", load: teacher.dailyLoads[0] },
                        { key: "T", label: "Tue", load: teacher.dailyLoads[1] },
                        { key: "W", label: "Wed", load: teacher.dailyLoads[2] },
                        { key: "Th", label: "Thu", load: teacher.dailyLoads[3] },
                        { key: "F", label: "Fri", load: teacher.dailyLoads[4] },
                      ].map((d) => {
                        const isExceeded = d.load > teacher.maxDaily;
                        return (
                          <div
                            key={d.label}
                            className={`p-1.5 rounded-xl border text-center transition ${
                              isExceeded
                                ? "bg-red-50 border-red-300 text-red-900"
                                : d.load > 0
                                ? "bg-white border-slate-200 text-slate-800 shadow-2xs"
                                : "bg-slate-100/60 border-slate-200/50 text-slate-400"
                            }`}
                            title={`${d.label}: ${d.load} teaching hours`}
                          >
                            <div className="text-[9px] font-bold text-slate-400 uppercase">
                              {d.key}
                            </div>
                            <div
                              className={`text-xs font-black ${
                                isExceeded
                                  ? "text-red-600 font-extrabold"
                                  : d.load > 0
                                  ? "text-slate-900"
                                  : "text-slate-400"
                              }`}
                            >
                              {d.load}h
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Status & Compliance Note */}
                    <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-slate-200/60">
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          !isActive
                            ? "text-slate-500"
                            : teacher.isOverloadedDaily
                            ? "text-red-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {!isActive ? (
                          <span>On Leave (0h today)</span>
                        ) : teacher.isOverloadedDaily ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                            <span>Exceeds {teacher.maxDaily}h Daily Cap</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Compliant (≤ {teacher.maxDaily}h/day cap)</span>
                          </>
                        )}
                      </span>
                      <span className="text-slate-400 font-medium">
                        Avg: {(teacher.dailyLoads.reduce((a, b) => a + b, 0) / 5).toFixed(1)}h/day
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    {onViewTeacherSchedule && (
                      <button
                        onClick={() => onViewTeacherSchedule(teacher.id)}
                        className="p-1.5 rounded-lg hover:bg-[#F3E5F2] text-[#703372] hover:text-[#A91079] transition cursor-pointer"
                        title="View Individual Timetable"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    )}
                    {onViewTeacherProfile && (
                      <button
                        onClick={() => onViewTeacherProfile(teacher.id)}
                        className="p-1.5 rounded-lg hover:bg-[#F3E5F2] text-[#703372] hover:text-[#A91079] transition cursor-pointer"
                        title="View Faculty Profile & Credentials"
                      >
                        <User className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onEditTeacher && (
                      <button
                        onClick={() => onEditTeacher(teacher)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                        title="Edit Faculty Information"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {onDeleteTeacher && (
                      <button
                        onClick={() => onDeleteTeacher(teacher)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition cursor-pointer"
                        title="Delete Faculty Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{startIndex + 1}</strong> to{" "}
            <strong className="text-slate-900">{endIndex}</strong> of{" "}
            <strong className="text-slate-900">{totalTeachers}</strong> faculty records
            <span className="ml-1.5 px-2 py-0.5 rounded-md bg-[#F3E5F2] text-[#A91079] font-bold text-[10px] border border-[#E5CCE3]">
              30 Per Page
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer text-xs font-bold shadow-2xs flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && p - prev > 1;
                  return (
                    <div key={p} className="flex items-center gap-1">
                      {hasGap && <span className="px-1 text-slate-400 text-xs">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                          safePage === p
                            ? "bg-[#A91079] text-white shadow-2xs shadow-[#A91079]/30"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer text-xs font-bold shadow-2xs flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
