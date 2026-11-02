import { useState, useMemo } from "react";
import { getPeriodRows } from "../utils/bellSchedule";
import {
  User,
  Printer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  AlertTriangle,
  ShieldCheck,
  Search,
  Plus
} from "lucide-react";
import { evaluateSlotConflict } from "../utils/scheduleConflictChecker";

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

interface Props {
  teachers: Teacher[];
  selectedTeacherId: number;
  onSelectTeacher: (teacherId: number) => void;
  slots: ScheduleSlot[];
  sections: Section[];
  departments: Department[];
  durationMinutes?: number;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onSlotContextMenu?: (slot: ScheduleSlot, e: React.MouseEvent) => void;
  onEmptySlotClick?: (teacherId: number, day: number, period: number) => void;
  onAddTeacher?: () => void;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

export const TeacherTimetableGrid = ({
  teachers,
  selectedTeacherId,
  onSelectTeacher,
  slots,
  sections,
  departments,
  durationMinutes = 60,
  onSlotClick,
  onSlotContextMenu,
  onEmptySlotClick,
  onAddTeacher,
}: Props) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<number | "ALL">("ALL");

  const currentTeacher =
    teachers.find((t) => t.id === selectedTeacherId) || teachers[0];

  const hasExtendedSlots = useMemo(() => {
    return slots.some((s) => s.teacher_id === currentTeacher?.id && s.period_index >= 8);
  }, [slots, currentTeacher]);

  const anySpecialTracks = useMemo(() => {
    return sections.some((s) => s.program_type && !["BEC", "REGULAR", "STANDARD", "GENERAL"].includes(s.program_type.trim().toUpperCase()));
  }, [sections]);

  const maxPeriods = hasExtendedSlots || anySpecialTracks ? 9 : 7;
  const periodRows = useMemo(() => getPeriodRows(durationMinutes, maxPeriods), [durationMinutes, maxPeriods]);

  const dept = departments.find((d) => d.id === currentTeacher?.department_id);
  const secMap = useMemo(() => new Map<number, Section>(sections.map((s) => [s.id, s])), [sections]);
  const advisorySection = currentTeacher?.advisory_section_id
    ? secMap.get(currentTeacher.advisory_section_id)
    : null;

  // Filtered teachers for combobox and quick pills
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const matchesDept = selectedDeptId === "ALL" || t.department_id === selectedDeptId;
      const q = searchQuery.toLowerCase().trim();
      const tDeptName = departments.find((d) => d.id === t.department_id)?.name || "";
      const matchesSearch =
        q.length === 0 ||
        (t.name || "").toLowerCase().includes(q) ||
        (t.position || "").toLowerCase().includes(q) ||
        tDeptName.toLowerCase().includes(q);

      return matchesDept && matchesSearch;
    });
  }, [teachers, selectedDeptId, searchQuery, departments]);

  // Stepper handlers
  const currentFilteredIndex = filteredTeachers.findIndex((t) => t.id === currentTeacher?.id);
  const hasPrev = currentFilteredIndex > 0;
  const hasNext = currentFilteredIndex >= 0 && currentFilteredIndex < filteredTeachers.length - 1;

  const handlePrevTeacher = () => {
    if (hasPrev) onSelectTeacher(filteredTeachers[currentFilteredIndex - 1].id);
  };

  const handleNextTeacher = () => {
    if (hasNext) onSelectTeacher(filteredTeachers[currentFilteredIndex + 1].id);
  };

  // Filter slots for this teacher
  const teacherSlots = slots.filter((s) => s.teacher_id === currentTeacher?.id);

  // Map slots: "day_period" -> slot
  const slotMap = new Map<string, ScheduleSlot>();
  teacherSlots.forEach((s) => {
    slotMap.set(`${s.day_of_week}_${s.period_index}`, s);
  });

  // Calculate daily workload
  const dailyHours = [0, 0, 0, 0, 0];
  teacherSlots.forEach((s) => {
    if (s.day_of_week >= 0 && s.day_of_week <= 4) {
      dailyHours[s.day_of_week] += 1;
    }
  });

  const maxDayLoad = Math.max(...dailyHours, 0);
  const maxAllowed = currentTeacher?.max_daily_hours || 6;
  const hasDailyOverload = maxDayLoad > maxAllowed;

  return (
    <div className="space-y-5">
      {/* Faculty Selector & Department Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-[#E5CCE3] p-4 shadow-xs space-y-3 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Steppers & Select Combobox */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevTeacher}
              disabled={!hasPrev}
              title="Previous Faculty"
              className={`p-2 rounded-xl border border-[#E5CCE3] text-slate-600 transition shadow-2xs cursor-pointer ${
                hasPrev
                  ? "hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  : "opacity-40 cursor-not-allowed bg-slate-50"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative inline-block">
              <select
                id="teacher-select"
                value={selectedTeacherId}
                onChange={(e) => onSelectTeacher(Number(e.target.value))}
                className="appearance-none pl-3.5 pr-9 py-2 bg-slate-50 hover:bg-slate-100/90 border border-slate-300 focus:border-[#A91079] rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer transition shadow-2xs min-w-[240px] sm:min-w-[320px]"
              >
                {filteredTeachers.map((t) => {
                  const tDept = departments.find((d) => d.id === t.department_id);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.position} • {tDept?.code || "Dept"})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={handleNextTeacher}
              disabled={!hasNext}
              title="Next Faculty"
              className={`p-2 rounded-xl border border-[#E5CCE3] text-slate-600 transition shadow-2xs cursor-pointer ${
                hasNext
                  ? "hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  : "opacity-40 cursor-not-allowed bg-slate-50"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search faculty name, position..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-[#E5CCE3] focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition"
            />
          </div>
        </div>

        {/* Department Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
          <button
            onClick={() => setSelectedDeptId("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              selectedDeptId === "ALL"
                ? "bg-[#A91079] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                onClick={() => {
                  setSelectedDeptId(dept.id);
                  const firstInDept = teachers.find((t) => t.department_id === dept.id);
                  if (firstInDept) onSelectTeacher(firstInDept.id);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-[#A91079] text-white font-bold shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {dept.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Timetable Schedule Grid Container */}
      <div className="bg-white rounded-2xl border border-[#E5CCE3] p-5 sm:p-6 shadow-xs text-slate-900 print:border-black print:p-0 print:shadow-none">
        {/* Clean Faculty Info Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5CCE3]">
          <div className="flex items-center gap-3">
            {currentTeacher?.avatar_url ? (
              <img
                src={currentTeacher.avatar_url}
                alt={currentTeacher.name}
                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[#E5CCE3] shadow-2xs bg-white"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.classList.remove("hidden");
                }}
              />
            ) : null}
            <div
              className={`w-10 h-10 rounded-xl bg-[#F3E5F2] border border-[#E5CCE3] flex items-center justify-center text-[#A91079] font-black shrink-0 ${
                currentTeacher?.avatar_url ? "hidden" : ""
              }`}
            >
              <User className="w-5 h-5 text-[#A91079]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  {currentTeacher?.name || "Select Instructor"}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-[#E5CCE3]">
                  {currentTeacher?.position} • {dept?.name || "Department"}
                </span>
                {currentTeacher?.status && currentTeacher.status !== "Active" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    {currentTeacher.status}
                  </span>
                )}
                {hasDailyOverload ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Overload: {maxDayLoad}h peak (&gt;{maxAllowed}h cap)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Load Compliant (≤{maxAllowed}h/day)
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                <span>
                  Daily Load: <strong className="text-slate-800">{maxDayLoad}</strong> / {maxAllowed} hrs/day peak
                </span>
                <span>•</span>
                <span>
                  Advisory: <strong className="text-slate-800">{advisorySection ? advisorySection.name : "None"}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 no-print">
            {onAddTeacher && (
              <button
                type="button"
                onClick={() => onAddTeacher()}
                className="px-3.5 py-2 bg-[#FDF2FA] hover:bg-[#F9E2F4] border border-[#E5CCE3] text-[#A91079] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#A91079]" />
                <span>+ Add Faculty</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold transition shadow-md shadow-[#A91079]/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Schedule</span>
            </button>
          </div>
        </div>

        {/* Unavailable / On Leave Alert Banner */}
        {currentTeacher?.status && currentTeacher.status !== "Active" && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-800 no-print">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              <strong>{currentTeacher.name}</strong> is currently on <strong>{currentTeacher.status}</strong>. Teaching periods below require substitution dispatch or dynamic schedule repair.
            </span>
          </div>
        )}

        {/* Timetable Matrix */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-2 border-black border-collapse text-center text-xs">
            <thead>
              <tr className="bg-slate-100/90 text-black font-extrabold border-b-2 border-black text-xs sm:text-sm">
                <th className="p-2.5 sm:p-3 border-r-2 border-black w-28 uppercase tracking-wider text-center">
                  TIME
                </th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    className="p-2.5 sm:p-3 border-r-2 border-black last:border-r-0 uppercase tracking-wider min-w-[150px] text-center"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodRows.map((row) => {
                // Fixed Breaks Row
                if (row.type === "FIXED_ALL") {
                  return (
                    <tr
                      key={row.time}
                      className="border-b-2 border-black bg-slate-50/80 font-bold"
                    >
                      <td className="p-2 border-r-2 border-black font-bold whitespace-nowrap text-slate-900 text-center text-[11px] sm:text-xs">
                        {row.time}
                      </td>
                      {DAYS.map((day) => (
                        <td
                          key={day}
                          className="p-2 border-r-2 border-black last:border-r-0 text-center font-extrabold uppercase text-[11px] sm:text-xs tracking-wide"
                        >
                          {row.label}
                        </td>
                      ))}
                    </tr>
                  );
                }

                // Afternoon Period / Remedial
                if (row.type === "SPECIAL") {
                  return (
                    <tr key={row.time} className="border-b-2 border-black font-bold">
                      <td className="p-2 border-r-2 border-black font-bold whitespace-nowrap text-slate-900 text-center text-[11px] sm:text-xs">
                        {row.time}
                      </td>
                      {DAYS.map((day, dIdx) => (
                        <td
                          key={day}
                          className="p-2 border-r-2 border-black last:border-r-0 text-center text-[11px] font-semibold text-slate-600"
                        >
                          {dIdx < 4 ? "Student Consultation / Remedial Work" : "Lesson Planning"}
                        </td>
                      ))}
                    </tr>
                  );
                }

                // Period Rows
                const periodNum = row.period!;
                return (
                  <tr
                    key={row.time}
                    className="border-b-2 border-black hover:bg-slate-50/50 transition"
                  >
                    <td className="p-2.5 border-r-2 border-black font-bold whitespace-nowrap text-slate-900 text-center text-[11px] sm:text-xs align-middle">
                      {row.time}
                    </td>

                    {DAYS.map((day, dayIdx) => {
                      const slot = slotMap.get(`${dayIdx}_${periodNum}`);
                      const isMondayHRGP =
                        dayIdx === 0 && periodNum === 1 && currentTeacher?.is_adviser;

                      if (!slot && !isMondayHRGP) {
                        return (
                          <td
                            key={day}
                            onClick={() =>
                              onEmptySlotClick &&
                              onEmptySlotClick(currentTeacher?.id || 1, dayIdx, periodNum)
                            }
                            className="p-2 sm:p-2.5 border-r-2 border-black last:border-r-0 text-center align-middle transition cursor-pointer group hover:bg-[#FDF2FA]"
                            title={`Click to assign a class to ${currentTeacher?.name || "this teacher"} on ${day} Period ${periodNum}`}
                          >
                            <div className="flex flex-col items-center justify-center py-1">
                              <span className="text-[10px] text-slate-400 font-medium italic group-hover:hidden">
                                Vacant / Prep Period
                              </span>
                              <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] font-extrabold text-[#A91079] bg-[#FDF2FA] border border-[#E5CCE3] px-2 py-0.5 rounded-md shadow-2xs">
                                <Plus className="w-3 h-3" />
                                Assign Class
                              </span>
                            </div>
                          </td>
                        );
                      }

                      const subjectName = slot?.subject_name
                        ? slot.subject_name.toUpperCase()
                        : isMondayHRGP
                        ? "HRGP"
                        : "SUBJECT";

                      const sectionDisplay = slot
                        ? `${slot.section_name} • ${slot.room_number}`
                        : isMondayHRGP
                        ? advisorySection
                          ? `${advisorySection.name} • ${advisorySection.room_number}`
                          : "Advisory Class"
                        : "";

                      // Real-time conflict & overload evaluation
                      const conflict = evaluateSlotConflict(slot, slots, teachers, sections, isMondayHRGP);

                      const cellBgClass = conflict.severity === "error"
                        ? "bg-red-50/70 ring-2 ring-red-500 ring-inset"
                        : conflict.severity === "warning"
                        ? "bg-amber-50/60 ring-2 ring-amber-400 ring-inset"
                        : isMondayHRGP
                        ? "bg-[#FDF2FA] hover:bg-[#F3E5F2]"
                        : "hover:bg-amber-50/40";

                      const cellTitle = conflict.hasConflict
                        ? `${conflict.badgeTooltip} (Click to edit or reassign)`
                        : slot
                        ? `${slot.subject_name} • ${sectionDisplay} (Click to edit)`
                        : "";

                      return (
                        <td
                          key={day}
                          onClick={() => {
                            if (slot) {
                              onSlotClick && onSlotClick(slot);
                            } else if (isMondayHRGP && onEmptySlotClick) {
                              onEmptySlotClick(currentTeacher?.id || 1, dayIdx, periodNum);
                            }
                          }}
                          onContextMenu={(e) => {
                            if (slot && onSlotContextMenu) {
                              e.preventDefault();
                              e.stopPropagation();
                              onSlotContextMenu(slot, e);
                            }
                          }}
                          className={`p-2 sm:p-2.5 border-r-2 border-black last:border-r-0 text-center align-middle transition cursor-pointer group relative ${cellBgClass}`}
                          title={cellTitle}
                        >
                          {/* In-Grid Conflict & Overload Badge (hidden on physical print) */}
                          {conflict.hasConflict && (
                            <span
                              className={`no-print absolute top-1 left-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider shadow-2xs flex items-center gap-0.5 z-10 transition ${
                                conflict.severity === "error"
                                  ? "bg-red-600 text-white ring-1 ring-red-400 animate-pulse"
                                  : conflict.severity === "warning"
                                  ? "bg-amber-600 text-white ring-1 ring-amber-400"
                                  : "bg-[#A91079] text-white ring-1 ring-[#F806CC]"
                              }`}
                              title={conflict.badgeTooltip}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>{conflict.badgeLabel}</span>
                            </span>
                          )}

                          <div className="flex flex-col items-center justify-center space-y-0.5">
                            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-black group-hover:text-[#A91079]">
                              {subjectName}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700 underline decoration-[#A91079]/80 decoration-1 underline-offset-2">
                              {sectionDisplay}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
