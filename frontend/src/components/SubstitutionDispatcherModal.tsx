import { useState, useMemo, useEffect } from "react";
import {
  X,
  AlertTriangle,
  Sparkles,
  Award,
  Zap,
  UserCheck,
  CheckCircle2,
  Clock,
  BookOpen,
  Building2,
  AlertCircle
} from "lucide-react";
import type { ReassignTeacherSlotsRequest, SlotReassignmentItem, UserProfile } from "../api/client";

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
  max_daily_hours: number;
  max_weekly_hours: number;
  current_load_hours: number;
  is_adviser: boolean;
  advisory_section_id?: number | null;
  status: string;
  avatar_url?: string | null;
}

interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
}

interface Subject {
  id: number;
  name: string;
  department_id: number;
  grade_level: number;
  required_weekly_loads: number;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  absentTeacher: Teacher | null;
  teachers: Teacher[];
  sections: Section[];
  subjects: Subject[];
  slots: ScheduleSlot[];
  departments: Department[];
  currentUser: UserProfile;
  onConfirmReassign: (payload: ReassignTeacherSlotsRequest) => Promise<void>;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function getRankScore(position: string): number {
  const p = (position || "").toLowerCase();
  if (p.includes("master teacher ii") || p.includes("mt-ii") || p.includes("master ii")) return 5;
  if (p.includes("master teacher i") || p.includes("mt-i") || p.includes("master i")) return 4;
  if (p.includes("special science") || p.includes("sst") || p.includes("head teacher")) return 3;
  if (p.includes("teacher iii") || p.includes("t-iii")) return 2;
  if (p.includes("teacher ii") || p.includes("t-ii")) return 1;
  return 0;
}

export const SubstitutionDispatcherModal = ({
  isOpen,
  onClose,
  absentTeacher,
  teachers,
  sections,
  subjects,
  slots,
  departments,
  currentUser,
  onConfirmReassign,
}: Props) => {
  if (!isOpen || !absentTeacher) return null;

  // Department Head teacher record (if any matching currentUser in department)
  const deptHeadTeacher = useMemo(() => {
    return (
      teachers.find(
        (t) =>
          t.department_id === absentTeacher.department_id &&
          t.name.toLowerCase().includes(currentUser.name.toLowerCase().split(" ")[0])
      ) ||
      teachers.find((t) => t.department_id === absentTeacher.department_id && t.position.includes("Master")) ||
      teachers.find((t) => t.department_id === absentTeacher.department_id)
    );
  }, [teachers, absentTeacher, currentUser]);

  // Active eligible substitutes in the same department
  const departmentFaculty = useMemo(() => {
    return teachers.filter(
      (t) => t.department_id === absentTeacher.department_id && t.id !== absentTeacher.id && t.status === "Active"
    );
  }, [teachers, absentTeacher]);

  // Orphaned slots belonging to the absent teacher
  const orphanedSlots = useMemo(() => {
    return slots.filter((s) => s.teacher_id === absentTeacher.id);
  }, [slots, absentTeacher]);

  // Active policy state: 'LEAST_LOAD' | 'HIGHER_RANK' | 'SELF_ASSIGN'
  const [selectedStrategy, setSelectedStrategy] = useState<"LEAST_LOAD" | "HIGHER_RANK" | "SELF_ASSIGN">("LEAST_LOAD");

  // State: Map of slotId -> assigned substitute teacher ID
  const [manualSlotMap, setManualSlotMap] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Computes default assignment for a slot given a policy
  const getSuggestedSubstitute = (
    slot: ScheduleSlot,
    strategy: "LEAST_LOAD" | "HIGHER_RANK" | "SELF_ASSIGN"
  ): number => {
    if (departmentFaculty.length === 0) return absentTeacher.id;

    // Filter faculty who are free at this slot's time
    const freeFaculty = departmentFaculty.filter((t) => {
      const hasClash = slots.some(
        (s) => s.teacher_id === t.id && s.day_of_week === slot.day_of_week && s.period_index === slot.period_index
      );
      return !hasClash;
    });

    const candidates = freeFaculty.length > 0 ? freeFaculty : departmentFaculty;

    if (strategy === "SELF_ASSIGN" && deptHeadTeacher && candidates.some((t) => t.id === deptHeadTeacher.id)) {
      return deptHeadTeacher.id;
    }

    if (strategy === "HIGHER_RANK") {
      const sorted = [...candidates].sort((a, b) => getRankScore(b.position) - getRankScore(a.position));
      return sorted[0].id;
    }

    // Default: LEAST_LOAD
    const sorted = [...candidates].sort((a, b) => a.current_load_hours - b.current_load_hours);
    return sorted[0].id;
  };

  // Populate or re-populate suggestions based on strategy
  const applyStrategy = (strategy: "LEAST_LOAD" | "HIGHER_RANK" | "SELF_ASSIGN") => {
    setSelectedStrategy(strategy);
    const newMap: Record<number, number> = {};
    orphanedSlots.forEach((slot) => {
      newMap[slot.id] = getSuggestedSubstitute(slot, strategy);
    });
    setManualSlotMap(newMap);
    setErrorMsg(null);
  };

  // Initialize slot map when modal opens or absentTeacher changes
  useEffect(() => {
    if (isOpen && absentTeacher) {
      applyStrategy("LEAST_LOAD");
    }
  }, [isOpen, absentTeacher?.id]);

  // Handle single slot manual override change
  const handleSlotTeacherChange = (slotId: number, teacherId: number) => {
    setManualSlotMap((prev) => ({
      ...prev,
      [slotId]: teacherId,
    }));
  };

  // Evaluates clash and daily cap status for an assignment
  const evaluateAssignment = (slot: ScheduleSlot, teacherId: number) => {
    const candidate = teachers.find((t) => t.id === teacherId);
    if (!candidate) return { hasClash: false, exceedsDailyCap: false, msg: "Unknown" };

    // Check collision at exact same day and period
    const hasClash = slots.some(
      (s) =>
        s.teacher_id === teacherId &&
        s.id !== slot.id &&
        s.day_of_week === slot.day_of_week &&
        s.period_index === slot.period_index
    );

    // Check daily hours
    const dailyHours = slots.filter(
      (s) => s.teacher_id === teacherId && s.id !== slot.id && s.day_of_week === slot.day_of_week
    ).length;

    const exceedsDailyCap = dailyHours + 1 > Math.min(candidate.max_daily_hours || 6, 6);

    return {
      hasClash,
      exceedsDailyCap,
      candidate,
    };
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      // Build manual assignments payload
      const manualItems: SlotReassignmentItem[] = Object.entries(manualSlotMap).map(([slotIdStr, tId]) => {
        const slot = orphanedSlots.find((s) => s.id === Number(slotIdStr));
        return {
          slot_id: Number(slotIdStr),
          substitute_teacher_id: tId,
          section_id: slot?.section_id,
          subject_id: slot?.subject_id,
          day_of_week: slot?.day_of_week,
          period_index: slot?.period_index,
        };
      });

      const payload: ReassignTeacherSlotsRequest = {
        absent_teacher_id: absentTeacher.id,
        strategy: selectedStrategy,
        dept_head_teacher_id: deptHeadTeacher?.id,
        manual_assignments: manualItems,
      };

      await onConfirmReassign(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to commit substitution dispatch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deptObj = departments.find((d) => d.id === absentTeacher.department_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Class Load Prioritization & Substitution Dispatcher
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {orphanedSlots.length} Orphaned Slots
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Substitute coverage for <strong className="text-slate-800">{absentTeacher.name}</strong> (
                {absentTeacher.position}) • {deptObj?.name || "Department"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Teacher Status Alert */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-950">
                  Faculty Unavailable: {absentTeacher.name} ({absentTeacher.status})
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  Currently holds {absentTeacher.current_load_hours} hrs/week across {orphanedSlots.length} schedule periods. Assign qualified substitutes below.
                </div>
              </div>
            </div>
            <span className="text-xs font-black text-amber-900 px-3 py-1 bg-amber-200/60 rounded-xl shrink-0 self-start sm:self-auto">
              Workload Balancing Mode
            </span>
          </div>

          {/* Step 1: Policy Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#A91079]" />
                <span>Step 1: Choose Automated Prioritization Policy (1-Click Fill)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                You can fine-tune any slot manually afterwards
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Policy 1: Least Load First */}
              <button
                type="button"
                onClick={() => applyStrategy("LEAST_LOAD")}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedStrategy === "LEAST_LOAD"
                    ? "border-[#A91079] bg-[#FDF2FA]/70 ring-2 ring-[#A91079]/20 shadow-xs"
                    : "border-[#E5CCE3] bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#A91079]" />
                      <span>Least Load First</span>
                    </span>
                    {selectedStrategy === "LEAST_LOAD" && (
                      <CheckCircle2 className="w-4 h-4 text-[#A91079]" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Prioritizes underloaded teachers with fewer teaching hours.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-[#A91079] bg-[#F3E5F2]/60 px-2 py-0.5 rounded-md inline-block w-fit">
                  Least Load First
                </div>
              </button>

              {/* Policy 2: Higher Rank First */}
              <button
                type="button"
                onClick={() => applyStrategy("HIGHER_RANK")}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedStrategy === "HIGHER_RANK"
                    ? "border-[#A91079] bg-[#FDF2FA]/70 ring-2 ring-[#A91079]/20 shadow-xs"
                    : "border-[#E5CCE3] bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>Higher Rank First</span>
                    </span>
                    {selectedStrategy === "HIGHER_RANK" && (
                      <CheckCircle2 className="w-4 h-4 text-[#A91079]" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Prioritizes Master Teachers (MT-II, MT-I) for senior academic delivery and mentoring.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded-md inline-block w-fit">
                  Seniority & MTs
                </div>
              </button>

              {/* Policy 3: Dept Head Self-Assignment */}
              <button
                type="button"
                onClick={() => applyStrategy("SELF_ASSIGN")}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedStrategy === "SELF_ASSIGN"
                    ? "border-[#A91079] bg-[#FDF2FA]/70 ring-2 ring-[#A91079]/20 shadow-xs"
                    : "border-[#E5CCE3] bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Assign Myself</span>
                    </span>
                    {selectedStrategy === "SELF_ASSIGN" && (
                      <CheckCircle2 className="w-4 h-4 text-[#A91079]" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Department Head steps in directly to assume teaching loads for absent faculty.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded-md inline-block w-fit">
                  Direct Head Coverage
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Interactive Editable Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#A91079]" />
                <span>Step 2: Review & Manually Customize Assignments per Class</span>
              </label>
              <button
                type="button"
                onClick={() => applyStrategy(selectedStrategy)}
                className="text-[11px] font-bold text-[#A91079] hover:text-[#703372] flex items-center gap-1 transition cursor-pointer"
              >
                <span>Reset to Policy Suggestions</span>
              </button>
            </div>

            {orphanedSlots.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-[#E5CCE3]">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-700">No Orphaned Slots</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  This teacher has no active teaching loads assigned in the current schedule.
                </p>
              </div>
            ) : (
              <div className="border border-[#E5CCE3] rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#E5CCE3] text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3.5">Section & Room</th>
                      <th className="py-2.5 px-3.5">Subject</th>
                      <th className="py-2.5 px-3.5">Period & Time</th>
                      <th className="py-2.5 px-3.5">Assigned Substitute (Editable)</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {orphanedSlots.map((slot) => {
                      const sec = sections.find((s) => s.id === slot.section_id);
                      const sub = subjects.find((s) => s.id === slot.subject_id);
                      const currentSubId = manualSlotMap[slot.id] || absentTeacher.id;
                      const evalStatus = evaluateAssignment(slot, currentSubId);

                      return (
                        <tr key={slot.id} className="hover:bg-slate-50/70 transition">
                          {/* Section & Room */}
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">
                            <div>{sec?.name || `Section ${slot.section_id}`}</div>
                            <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{sec?.room_number || "Room TBA"}</span>
                            </div>
                          </td>

                          {/* Subject */}
                          <td className="py-2.5 px-3.5 text-slate-700 font-semibold">
                            {sub?.name || `Subject ${slot.subject_id}`}
                          </td>

                          {/* Day & Period */}
                          <td className="py-2.5 px-3.5 text-slate-600">
                            <div className="font-bold text-slate-800">{DAYS[slot.day_of_week]}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Period {slot.period_index}</span>
                            </div>
                          </td>

                          {/* Editable Substitute Select */}
                          <td className="py-2.5 px-3.5">
                            <select
                              value={currentSubId}
                              onChange={(e) => handleSlotTeacherChange(slot.id, Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden transition"
                            >
                              {departmentFaculty.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.position}) • {t.current_load_hours}h/wk
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Feasibility Status */}
                          <td className="py-2.5 px-3.5 text-center">
                            {evalStatus.hasClash ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"
                                title="Teacher has another class at this exact period"
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Clash</span>
                              </span>
                            ) : evalStatus.exceedsDailyCap ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                                title="Exceeds daily cap (max 6h/day)"
                              >
                                <span>Cap Exceeded</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Clear</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {orphanedSlots.length} class {orphanedSlots.length === 1 ? "load" : "loads"} mapped • Workload compliant
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || orphanedSlots.length === 0}
              onClick={handleSubmit}
              className="px-5 py-2.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-[#A91079]/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? "Dispatching..." : `Commit & Dispatch (${orphanedSlots.length} Slots)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
