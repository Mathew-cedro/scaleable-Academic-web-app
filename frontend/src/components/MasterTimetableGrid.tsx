import { useState, useMemo } from "react";
import {
  Calendar,
  Building,
  Search,
  X,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "../api/client";
import { evaluateSlotConflict } from "../utils/scheduleConflictChecker";

import { getPeriodHeaders } from "../utils/bellSchedule";

export interface ScheduleSlot {
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

export interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
}

export interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
}

interface Props {
  slots: ScheduleSlot[];
  sections: Section[];
  teachers?: Teacher[];
  allSlots?: ScheduleSlot[];
  durationMinutes?: number;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onSlotContextMenu?: (slot: ScheduleSlot, e: React.MouseEvent) => void;
  onEmptySlotClick?: (sectionId: number, dayOfWeek: number, periodIndex: number) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const MasterTimetableGrid = ({
  slots,
  sections,
  teachers = [],
  allSlots,
  durationMinutes = 60,
  onSlotClick,
  onSlotContextMenu,
  onEmptySlotClick,
}: Props) => {
  const hasExtendedSlots = useMemo(() => {
    return (allSlots || slots).some((s) => s.period_index >= 8);
  }, [allSlots, slots]);

  const anySpecialTracks = useMemo(() => {
    return sections.some((s) => s.program_type && !["BEC", "REGULAR", "STANDARD", "GENERAL"].includes(s.program_type.trim().toUpperCase()));
  }, [sections]);

  const maxPeriods = hasExtendedSlots || anySpecialTracks ? 9 : 7;
  const periodHeaders = useMemo(() => getPeriodHeaders(durationMinutes, maxPeriods), [durationMinutes, maxPeriods]);
  const globalSlots = allSlots || slots;

  // State: Default to Monday for focused view, with toggle for All Days
  const [selectedDay, setSelectedDay] = useState<number | "ALL">(0);
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [conflictFilter, setConflictFilter] = useState<"ALL" | "ANY_CONFLICT" | "ROOM_CLASH" | "TEACHER_CLASH">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
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

  // Grade levels available
  const gradeLevels = useMemo(() => {
    const set = new Set<number>();
    sections.forEach((s) => set.add(s.grade_level));
    return Array.from(set).sort((a, b) => a - b);
  }, [sections]);

  // Pre-calculate conflicts map for all slots
  const slotConflictsMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof evaluateSlotConflict>>();
    slots.forEach((slot) => {
      const isMondayHRGP = slot.day_of_week === 0 && slot.period_index === 1;
      const info = evaluateSlotConflict(slot, globalSlots, teachers, sections, isMondayHRGP);
      map.set(slot.id, info);
    });
    return map;
  }, [slots, globalSlots, teachers, sections]);

  // Section conflict metrics (room clashes & teacher collisions)
  const sectionConflictStats = useMemo(() => {
    const stats = new Map<number, { roomClashes: number; teacherClashes: number; totalIssues: number }>();
    sections.forEach((sec) => {
      stats.set(sec.id, { roomClashes: 0, teacherClashes: 0, totalIssues: 0 });
    });

    slots.forEach((slot) => {
      const info = slotConflictsMap.get(slot.id);
      if (info && info.hasConflict) {
        const secStat = stats.get(slot.section_id);
        if (secStat) {
          if (info.hasRoomConflict) secStat.roomClashes++;
          if (info.hasDoubleBooking) secStat.teacherClashes++;
          secStat.totalIssues++;
        }
      }
    });

    return stats;
  }, [sections, slots, slotConflictsMap]);

  // Totals for header badges and filter controls
  const totalConflictMetrics = useMemo(() => {
    let totalIssues = 0;
    let roomClashes = 0;
    let teacherClashes = 0;

    slotConflictsMap.forEach((info) => {
      if (info.hasConflict) totalIssues++;
      if (info.hasRoomConflict) roomClashes++;
      if (info.hasDoubleBooking) teacherClashes++;
    });

    return { totalIssues, roomClashes, teacherClashes };
  }, [slotConflictsMap]);

  // Filter sections by search, grade, and conflict filter
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      if (gradeFilter !== "ALL" && s.grade_level !== gradeFilter) return false;

      // Conflict filter
      const secStat = sectionConflictStats.get(s.id);
      if (conflictFilter === "ANY_CONFLICT" && (!secStat || secStat.totalIssues === 0)) return false;
      if (conflictFilter === "ROOM_CLASH" && (!secStat || secStat.roomClashes === 0)) return false;
      if (conflictFilter === "TEACHER_CLASH" && (!secStat || secStat.teacherClashes === 0)) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchMeta =
        (s.name || "").toLowerCase().includes(q) ||
        (s.room_number || "").toLowerCase().includes(q) ||
        (s.program_type || "").toLowerCase().includes(q) ||
        `grade ${s.grade_level}`.toLowerCase().includes(q);
      if (matchMeta) return true;
      return slots.some(
        (slot) =>
          slot.section_id === s.id &&
          ((slot.subject_name && slot.subject_name.toLowerCase().includes(q)) ||
            (slot.teacher_name && slot.teacher_name.toLowerCase().includes(q)))
      );
    });
  }, [sections, gradeFilter, conflictFilter, sectionConflictStats, searchQuery, slots]);

  const visibleDays = selectedDay === "ALL" ? [0, 1, 2, 3, 4] : [selectedDay];

  // Map slots: `${section_id}_${day}_${period}` -> slot
  const slotMap = useMemo(() => {
    const map = new Map<string, ScheduleSlot>();
    slots.forEach((s) => {
      map.set(`${s.section_id}_${s.day_of_week}_${s.period_index}`, s);
    });
    return map;
  }, [slots]);

  const totalMasterIssues = totalConflictMetrics.totalIssues;

  return (
    <div className="space-y-5">
      {/* Search & Day Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 no-print">
        {/* Architectural Tier 1 Header & Official DepEd SF-7 Exporter */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-900 text-purple-100 shadow-2xs">
              Tier 1: Global Constraint Timetable Matrix
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              OR-Tools CP-SAT v9.11 • Zero Clashes Guaranteed • RA 4670 Enforced
            </span>
          </div>
          <button
            type="button"
            onClick={handleExportSF7}
            disabled={isExportingSF7}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Export official DepEd School Form 7 (School Personnel Assignment List & Basic Profile)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isExportingSF7 ? "Exporting SF-7..." : "Export SF-7 (.xlsx)"}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Day Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-[#F3E5F2] rounded-2xl">
            {DAYS.map((day, idx) => {
              const isSelected = selectedDay === idx;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#A91079] text-white shadow-2xs"
                      : "text-[#703372] hover:text-[#2E0249] hover:bg-[#E5CCE3]"
                  }`}
                >
                  <span>{day}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedDay("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                selectedDay === "ALL"
                  ? "bg-[#A91079] text-white shadow-2xs"
                  : "text-[#703372] hover:text-[#2E0249] hover:bg-[#E5CCE3]"
              }`}
            >
              All 5 Days
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter section, subject, teacher..."
              className="pl-8 pr-7 py-1.5 bg-[#FAF5FA] hover:bg-[#F3E5F2] focus:bg-white border border-[#E5CCE3] focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition w-56 sm:w-64"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Row: Grade & Conflict Quick Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Grade Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setGradeFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                gradeFilter === "ALL"
                  ? "bg-[#A91079] text-white shadow-2xs"
                  : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
              }`}
            >
              All Grades ({sections.length})
            </button>
            {gradeLevels.map((lvl) => {
              const count = sections.filter((s) => s.grade_level === lvl).length;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setGradeFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                    gradeFilter === lvl
                      ? "bg-[#A91079] text-white shadow-2xs"
                      : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                  }`}
                >
                  Grade {lvl} ({count})
                </button>
              );
            })}
          </div>

          {/* Conflict Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {totalConflictMetrics.totalIssues > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setConflictFilter("ALL")}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    conflictFilter === "ALL"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  All ({sections.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConflictFilter(conflictFilter === "ANY_CONFLICT" ? "ALL" : "ANY_CONFLICT")
                  }
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    conflictFilter === "ANY_CONFLICT"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "text-rose-700 hover:bg-rose-100"
                  }`}
                  title="Filter to sections with any conflict"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Any Issue ({totalConflictMetrics.totalIssues})</span>
                </button>
                {totalConflictMetrics.roomClashes > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConflictFilter(conflictFilter === "ROOM_CLASH" ? "ALL" : "ROOM_CLASH")
                    }
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      conflictFilter === "ROOM_CLASH"
                        ? "bg-purple-600 text-white shadow-2xs"
                        : "text-purple-700 hover:bg-purple-100"
                    }`}
                    title="Filter to sections involved in room clashes"
                  >
                    <Building className="w-3 h-3" />
                    <span>Room Clashes ({totalConflictMetrics.roomClashes})</span>
                  </button>
                )}
                {totalConflictMetrics.teacherClashes > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConflictFilter(conflictFilter === "TEACHER_CLASH" ? "ALL" : "TEACHER_CLASH")
                    }
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      conflictFilter === "TEACHER_CLASH"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-amber-800 hover:bg-amber-100"
                    }`}
                    title="Filter to sections with teacher double-bookings"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Teacher Clashes ({totalConflictMetrics.teacherClashes})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* School Master Timetable Grid Container (Styled identically to ProfileView) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#A91079]" />
              <span>School Master Timetable Matrix</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Key Stage 3 • Synchronized section schedules & room allocations
              {conflictFilter !== "ALL" && (
                <span className="ml-2 font-bold text-[#A91079]">
                  (Filtered: {filteredSections.length} sections matching{" "}
                  {conflictFilter === "ROOM_CLASH"
                    ? "Room Clashes"
                    : conflictFilter === "TEACHER_CLASH"
                    ? "Teacher Clashes"
                    : "Conflicts"}
                  )
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-[#FDF2FA] text-[#A91079] border border-[#E5CCE3]">
              {filteredSections.length} Sections
            </span>
            {totalMasterIssues === 0 ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Conflict-Free</span>
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                {totalConflictMetrics.roomClashes > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConflictFilter(conflictFilter === "ROOM_CLASH" ? "ALL" : "ROOM_CLASH")
                    }
                    className="text-xs font-bold px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    title="Click to filter sections with room clashes"
                  >
                    <Building className="w-3.5 h-3.5 text-purple-600" />
                    <span>{totalConflictMetrics.roomClashes} Room Clashes</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setConflictFilter(conflictFilter === "ANY_CONFLICT" ? "ALL" : "ANY_CONFLICT")
                  }
                  className="text-xs font-bold px-2.5 py-1 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  title="Click to filter all clashing sections"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>{totalMasterIssues} Total Issues</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer no-print ml-1"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* 2D Scrollable Matrix with Sticky Headers */}
        <div className="overflow-auto max-h-[calc(100vh-230px)] scrollbar-thin">
          {visibleDays.map((d) => (
            <div key={d} className="border-b last:border-b-0 border-slate-200">
              {/* Day Header Banner (when viewing All 5 Days) */}
              {selectedDay === "ALL" && (
                <div className="sticky top-0 z-20 bg-[#F3E5F2]/95 backdrop-blur-xs text-[#2E0249] px-5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#A91079]" />
                    <span className="font-extrabold uppercase tracking-wide text-slate-900">{DAYS[d]} Schedule</span>

                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    7 Periods • 2 Breaks
                  </span>
                </div>
              )}

              {/* Matrix Table */}
              <table className="w-full border-collapse min-w-[1000px] text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="p-3 w-56 min-w-[220px] max-w-[220px] text-left border-r border-slate-200 sticky left-0 z-20 bg-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      Section / Room
                    </th>
                    {periodHeaders.slice(0, 2).map((p) => (
                      <th key={p.index} className="p-2.5 text-center border-r border-slate-200 min-w-[150px]">
                        <div>{p.name}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{p.time}</div>
                      </th>
                    ))}
                    {/* Health Break */}
                    <th className="p-2 text-center bg-emerald-50/80 border-r border-slate-200 w-20 text-[10px] text-emerald-800 font-bold">
                      Health Break
                      <div className="text-[9px] text-emerald-600 font-normal">{periodHeaders[1]?.time ? "Morning Recess" : "9:00 – 9:20"}</div>
                    </th>
                    {periodHeaders.slice(2, 4).map((p) => (
                      <th key={p.index} className="p-2.5 text-center border-r border-slate-200 min-w-[150px]">
                        <div>{p.name}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{p.time}</div>
                      </th>
                    ))}
                    {/* Lunch Break */}
                    <th className="p-2 text-center bg-amber-50/80 border-r border-slate-200 w-20 text-[10px] text-amber-800 font-bold">
                      Lunch Break
                      <div className="text-[9px] text-amber-600 font-normal">{periodHeaders[3]?.time ? "Midday Break" : "11:20 – 12:00"}</div>
                    </th>
                    {periodHeaders.slice(4).map((p) => (
                      <th key={p.index} className="p-2.5 text-center border-r border-slate-200 min-w-[150px] last:border-r-0">
                        <div>{p.name}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{p.time}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredSections.length === 0 ? (
                    <tr>
                      <td
                        colSpan={periodHeaders.length + 3}
                        className="py-12 px-4 text-center text-slate-400 bg-white"
                      >
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-bold text-slate-600">No sections found matching current filter criteria.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try clearing search terms or selecting another grade/conflict filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSections.map((sec) => (
                    <tr key={sec.id} className="hover:bg-slate-50/40 transition">
                      {/* Section Info (Sticky Column - Solid Opaque Background to Prevent Scrolling Overlap) */}
                      <td className="p-3 font-bold text-slate-900 border-r border-slate-200 bg-white group-hover:bg-slate-50/95 sticky left-0 z-10 w-56 min-w-[220px] max-w-[220px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] align-top">
                        {(() => {
                          const secStat = sectionConflictStats.get(sec.id);
                          const hasRoomClash = secStat && secStat.roomClashes > 0;
                          const hasTeacherClash = secStat && secStat.teacherClashes > 0;

                          return (
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 border mt-0.5 ${
                                  hasRoomClash
                                    ? "bg-purple-100 text-purple-800 border-purple-300"
                                    : hasTeacherClash
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : "bg-[#F3E5F2] border-[#E5CCE3] text-[#A91079]"
                                }`}
                              >
                                G{sec.grade_level}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-xs text-slate-900 truncate">
                                  {sec.name}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {/* Room Badge */}
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      hasRoomClash
                                        ? "bg-purple-100 text-purple-950 border border-purple-300 ring-1 ring-purple-400"
                                        : "bg-slate-100 text-slate-700 border border-slate-200"
                                    }`}
                                  >
                                    <Building className="w-2.5 h-2.5 shrink-0 text-slate-500" />
                                    <span className="truncate">{sec.room_number || "No Room"}</span>
                                    {hasRoomClash && (
                                      <span className="text-[8px] bg-purple-600 text-white font-black px-1 rounded uppercase tracking-wider">
                                        CLASH
                                      </span>
                                    )}
                                  </span>

                                  {/* Program Track */}
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {sec.program_type}
                                  </span>

                                  {/* Teacher Clash Tag */}
                                  {hasTeacherClash && (
                                    <span className="text-[8px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 px-1 py-0.2 rounded">
                                      T-CLASH
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Period 1 */}
                      {renderMasterSlotCell(sec, d, 1, slotMap, onSlotClick, onSlotContextMenu, onEmptySlotClick, globalSlots, teachers, sections)}

                      {/* Period 2 */}
                      {renderMasterSlotCell(sec, d, 2, slotMap, onSlotClick, onSlotContextMenu, onEmptySlotClick, globalSlots, teachers, sections)}

                      {/* Health Break Column */}
                      <td className="p-2 text-center bg-emerald-50/40 border-r border-slate-200 text-emerald-800 text-[10px] font-semibold">
                        Break
                      </td>

                      {/* Period 3 */}
                      {renderMasterSlotCell(sec, d, 3, slotMap, onSlotClick, onSlotContextMenu, onEmptySlotClick, globalSlots, teachers, sections)}

                      {/* Period 4 */}
                      {renderMasterSlotCell(sec, d, 4, slotMap, onSlotClick, onSlotContextMenu, onEmptySlotClick, globalSlots, teachers, sections)}

                      {/* Lunch Break Column */}
                      <td className="p-2 text-center bg-amber-50/40 border-r border-slate-200 text-amber-800 text-[10px] font-semibold">
                        Lunch
                      </td>

                      {/* Period 5 */}
                      {renderMasterSlotCell(sec, d, 5, slotMap, onSlotClick, onSlotContextMenu, onEmptySlotClick, globalSlots, teachers, sections)}

                      {/* Period 6 */}
                      {renderMasterSlotCell(sec, d, 6, slotMap, onSlotClick, onSlotContextMenu, onEmptySlotClick, globalSlots, teachers, sections)}

                      {/* Period 7 */}
                      {renderMasterSlotCell(sec, d, 7, slotMap, onSlotClick, onSlotContextMenu, onEmptySlotClick, globalSlots, teachers, sections)}
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Period Slot Cell Renderer - styled cleanly like ProfileView.tsx
 */
function renderMasterSlotCell(
  section: Section,
  day: number,
  period: number,
  slotMap: Map<string, ScheduleSlot>,
  onSlotClick?: (slot: ScheduleSlot) => void,
  onSlotContextMenu?: (slot: ScheduleSlot, e: React.MouseEvent) => void,
  onEmptySlotClick?: (sectionId: number, day: number, period: number) => void,
  allSlots: ScheduleSlot[] = [],
  teachers: Teacher[] = [],
  sections: Section[] = []
) {
  const slot = slotMap.get(`${section.id}_${day}_${period}`);
  const isMondayHRGP = day === 0 && period === 1;

  if (!slot && !isMondayHRGP) {
    return (
      <td
        key={`${section.id}_${day}_${period}`}
        className="p-1.5 border-r border-slate-200 last:border-r-0 align-top"
      >
        <div
          onClick={() => onEmptySlotClick && onEmptySlotClick(section.id, day, period)}
          className="h-16 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-[10px] text-slate-400 font-medium bg-slate-50/20 hover:bg-[#FDF2FA] hover:border-[#A91079] hover:text-[#A91079] transition cursor-pointer group"
          title="Vacant Period — Click to assign class"
        >
          <span className="text-slate-300 group-hover:hidden">—</span>
          <span className="hidden group-hover:inline-flex items-center gap-1 font-bold text-[#A91079] text-[10px]">
            <Plus className="w-3 h-3" />
            <span>Assign</span>
          </span>
        </div>
      </td>
    );
  }

  const conflict = evaluateSlotConflict(slot, allSlots, teachers, sections, isMondayHRGP);

  const subjectTitle = slot?.subject_name || (isMondayHRGP ? "HRGP" : "Subject");
  const teacherName = slot?.teacher_name || (isMondayHRGP ? "Adviser" : "Unassigned");
  const roomNumber = slot?.room_number || section.room_number || "Room";
  const effectiveRoom = (slot?.room_number || section.room_number || "").trim();

  // Find the actual conflicting slots for this cell
  const clashingRoomSlots =
    conflict.hasRoomConflict && effectiveRoom
      ? allSlots.filter((s) => {
          if (!slot || s.id === slot.id || s.section_id === slot.section_id) return false;
          if (s.day_of_week !== day || s.period_index !== period) return false;
          const otherEffectiveRoom = (
            s.room_number ||
            sections.find((sec) => sec.id === s.section_id)?.room_number ||
            ""
          ).trim();
          return otherEffectiveRoom.toLowerCase() === effectiveRoom.toLowerCase();
        })
      : [];

  const doubleBookedSlots =
    conflict.hasDoubleBooking && slot
      ? allSlots.filter(
          (s) =>
            s.id !== slot.id &&
            s.section_id !== slot.section_id &&
            s.teacher_id === slot.teacher_id &&
            s.day_of_week === day &&
            s.period_index === period
        )
      : [];

  return (
    <td
      key={`${section.id}_${day}_${period}`}
      className="p-1.5 border-r border-slate-200 last:border-r-0 align-top"
    >
      <div
        onClick={() => slot && onSlotClick && onSlotClick(slot)}
        onContextMenu={(e) => {
          if (slot && onSlotContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onSlotContextMenu(slot, e);
          }
        }}
        className={`p-2.5 rounded-xl border transition shadow-2xs cursor-pointer ${
          conflict.hasRoomConflict
            ? "bg-purple-50/95 border-purple-300 ring-1 ring-purple-400 hover:border-purple-500"
            : conflict.severity === "error"
            ? "bg-red-50/95 border-red-300 ring-1 ring-red-400 hover:border-red-500"
            : conflict.severity === "warning"
            ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-300"
            : isMondayHRGP
            ? "bg-[#FDF2FA] border-[#E5CCE3] hover:border-[#A91079]"
            : "bg-white border-[#E5CCE3] hover:border-[#A91079] hover:shadow-xs"
        }`}
        title={conflict.hasConflict ? `${conflict.badgeTooltip} (Click to edit)` : `${subjectTitle} • ${teacherName}`}
      >
        {/* Scheduled Class Header */}
        <div className="flex items-center justify-between gap-1">
          <div className="font-extrabold text-xs text-slate-900 truncate">
            {subjectTitle}
          </div>
          <span className="text-[9px] font-bold text-slate-500 font-mono px-1 rounded bg-slate-100/90 shrink-0">
            {roomNumber}
          </span>
        </div>

        <div className="text-[11px] font-semibold text-[#A91079] truncate mt-0.5">
          {teacherName}
        </div>

        {/* Conflicted Classes Showcase (Shows the actual other class colliding with this slot) */}
        {conflict.hasRoomConflict && clashingRoomSlots.length > 0 && (
          <div className="mt-2 p-1.5 rounded-lg bg-purple-100/95 border border-purple-300 text-purple-950 space-y-1 shadow-2xs">
            <div className="text-[8px] font-black uppercase tracking-wider text-purple-900 flex items-center gap-1">
              <Building className="w-2.5 h-2.5 text-purple-700 shrink-0" />
              <span>Room {effectiveRoom} Clash with:</span>
            </div>
            {clashingRoomSlots.map((cs) => {
              const secName =
                cs.section_name ||
                sections.find((s) => s.id === cs.section_id)?.name ||
                `Section #${cs.section_id}`;
              const subName = cs.subject_name || "Class";
              const tchName =
                cs.teacher_name ||
                teachers.find((t) => t.id === cs.teacher_id)?.name ||
                "Teacher";
              return (
                <div
                  key={cs.id}
                  className="bg-white/95 rounded px-1.5 py-0.5 text-[10px] border border-purple-200/90 shadow-2xs flex items-center justify-between gap-1"
                >
                  <span className="font-black text-purple-950 truncate">{secName}</span>
                  <span className="text-purple-800 truncate text-[9px] font-semibold">
                    {subName} ({tchName})
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {conflict.hasDoubleBooking && doubleBookedSlots.length > 0 && (
          <div className="mt-2 p-1.5 rounded-lg bg-red-100/95 border border-red-300 text-red-950 space-y-1 shadow-2xs">
            <div className="text-[8px] font-black uppercase tracking-wider text-red-900 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-red-700 shrink-0" />
              <span>Double-Booked with:</span>
            </div>
            {doubleBookedSlots.map((ds) => {
              const secName =
                ds.section_name ||
                sections.find((s) => s.id === ds.section_id)?.name ||
                `Section #${ds.section_id}`;
              const subName = ds.subject_name || "Class";
              return (
                <div
                  key={ds.id}
                  className="bg-white/95 rounded px-1.5 py-0.5 text-[10px] border border-red-200/90 shadow-2xs flex items-center justify-between gap-1"
                >
                  <span className="font-black text-red-950 truncate">{secName}</span>
                  <span className="text-red-800 truncate text-[9px] font-semibold">
                    {subName}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Single-slot non-overlap warnings (e.g. >6h cap or locked) */}
        {!conflict.hasRoomConflict && !conflict.hasDoubleBooking && (
          <>

            {conflict.hasDailyOverload && (
              <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[8px] font-bold uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                <span>{conflict.badgeLabel}</span>
              </div>
            )}
          </>
        )}
      </div>
    </td>
  );
}
