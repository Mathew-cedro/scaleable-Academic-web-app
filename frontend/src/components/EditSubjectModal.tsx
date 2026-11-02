import { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Clock,
  Layers,
  Save,
  Building2,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Sun,
  Sunset,
  Lock,
  Shuffle,
} from "lucide-react";
import { api } from "../api/client";

interface Department {
  id: number;
  name: string;
  code: string;
}

export interface Subject {
  id: number;
  name: string;
  department_id: number;
  grade_level: number;
  required_weekly_loads: number;
  duration_minutes?: number;
  preferred_placement?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null;
  departments: Department[];
  currentAllotment?: {
    duration_minutes: number;
    required_weekly_loads: number;
    is_adviser_locked?: boolean;
    preferred_placement?: string;
  };
  onSubjectUpdated: (
    updatedSubject: Subject,
    newDuration: number,
    newLoads: number,
    isAdviserLocked: boolean,
    newPlacement?: string
  ) => Promise<void> | void;
}

const DURATION_PRESETS = [40, 45, 50, 60, 90, 120];

export const PLACEMENT_OPTIONS = [
  {
    id: "MORNING",
    title: "Morning Academic",
    timeWindow: "7:00 AM – 11:15 AM (Periods 1–4)",
    desc: "Preferred for core academic subjects with high cognitive demand (Science, Math, English, etc.)",
    icon: Sun,
  },
  {
    id: "AFTERNOON",
    title: "Afternoon Applied",
    timeWindow: "12:00 PM – 3:00 PM (Periods 5–7)",
    desc: "Preferred for hands-on workshops, laboratories, and physical activities (TLE, MAPEH, Arts)",
    icon: Sunset,
  },
  {
    id: "MON_P1_LOCK",
    title: "Monday Period 1 Lock",
    timeWindow: "Monday 7:00 AM – 8:00 AM",
    desc: "DepEd-mandated fixed slot exclusively for Homeroom Guidance Program (HRGP)",
    icon: Lock,
  },
  {
    id: "FLEXIBLE",
    title: "Flexible Placement",
    timeWindow: "Unrestricted (Periods 1–7)",
    desc: "Freely scheduled by the solver to balance teacher daily workload and room distribution",
    icon: Shuffle,
  },
];

const getDefaultPlacement = (subName: string): string => {
  const lower = subName.toLowerCase();
  if (lower.includes("homeroom") || lower.includes("guidance")) return "MON_P1_LOCK";
  if (
    lower.includes("tle") ||
    lower.includes("mapeh") ||
    lower.includes("pe") ||
    lower.includes("music") ||
    lower.includes("arts") ||
    lower.includes("health") ||
    lower.includes("technology") ||
    lower.includes("livelihood")
  ) {
    return "AFTERNOON";
  }
  if (
    lower.includes("math") ||
    lower.includes("science") ||
    lower.includes("english") ||
    lower.includes("filipino") ||
    lower.includes("araling") ||
    lower.includes("ap")
  ) {
    return "MORNING";
  }
  return "FLEXIBLE";
};

export const EditSubjectModal = ({
  isOpen,
  onClose,
  subject,
  departments,
  currentAllotment,
  onSubjectUpdated,
}: Props) => {
  const [name, setName] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<number>(1);
  const [gradeLevel, setGradeLevel] = useState<number>(7);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [requiredWeeklyLoads, setRequiredWeeklyLoads] = useState<number>(4);
  const [preferredPlacement, setPreferredPlacement] = useState<string>("FLEXIBLE");
  const [isAdviserLocked, setIsAdviserLocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (subject) {
      setName(subject.name || "");
      setDepartmentId(subject.department_id || (departments[0]?.id ?? 1));
      setGradeLevel(subject.grade_level || 7);
      setDurationMinutes(
        currentAllotment?.duration_minutes ?? subject.duration_minutes ?? 60
      );
      setRequiredWeeklyLoads(
        currentAllotment?.required_weekly_loads ??
          subject.required_weekly_loads ??
          4
      );
      const defaultLocked =
        currentAllotment?.is_adviser_locked !== undefined
          ? currentAllotment.is_adviser_locked
          : subject.name.toLowerCase().includes("homeroom") ||
            subject.name.toLowerCase().includes("guidance");
      setIsAdviserLocked(defaultLocked);

      const initialPlacement =
        currentAllotment?.preferred_placement ||
        subject.preferred_placement ||
        getDefaultPlacement(subject.name || "");
      setPreferredPlacement(initialPlacement);
      setErrorMsg(null);
    }
  }, [subject, currentAllotment, departments]);

  if (!isOpen || !subject) return null;

  const totalMinutes = durationMinutes * requiredWeeklyLoads;
  const totalHours = (totalMinutes / 60).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter a subject name.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const updated = await api.updateSubject(subject.id, {
        name: name.trim(),
        department_id: departmentId,
        grade_level: gradeLevel,
        duration_minutes: durationMinutes,
        required_weekly_loads: requiredWeeklyLoads,
        preferred_placement: preferredPlacement,
      });

      await onSubjectUpdated(
        updated,
        durationMinutes,
        requiredWeeklyLoads,
        isAdviserLocked,
        preferredPlacement
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update subject.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E5CCE3] flex items-center justify-between bg-[#FAF5FA]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#F3E5F2] text-[#A91079] rounded-xl border border-[#E5CCE3]">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-[#2E0249]">
                Edit Curriculum Subject
              </h3>
              <p className="text-xs text-[#703372]">
                Update subject name, department assignment, and weekly periods.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-[#2E0249] rounded-xl hover:bg-[#F3E5F2] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Subject Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Subject Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science 7, Advanced Robotics, English 9..."
              required
              className="w-full px-3.5 py-2.5 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-[#2E0249] placeholder-slate-400 focus:outline-hidden transition"
            />
          </div>

          {/* Department & Grade Level Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Department</span>
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-[#2E0249] focus:outline-hidden transition cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Grade Level */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Grade Level</span>
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-[#2E0249] focus:outline-hidden transition cursor-pointer"
              >
                <option value={7}>Grade 7</option>
                <option value={8}>Grade 8</option>
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10</option>
              </select>
            </div>
          </div>

          {/* Meeting Duration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Meeting Duration (Minutes per Class)</span>
              </label>
              <span className="text-xs font-extrabold text-[#A91079] tabular-nums">
                {durationMinutes} mins / class
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    durationMinutes === mins
                      ? "bg-[#A91079] text-white shadow-2xs"
                      : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>

            <input
              type="number"
              min={20}
              max={240}
              step={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(20, Math.min(240, Number(e.target.value) || 60)))}
              className="w-full px-3.5 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-[#2E0249] focus:outline-hidden transition"
            />
          </div>

          {/* Required Weekly Loads */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Required Weekly Loads (Periods per Week)</span>
              </label>
              <span className="text-xs font-extrabold text-[#A91079] tabular-nums">
                {requiredWeeklyLoads} loads / week
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((loads) => (
                <button
                  key={loads}
                  type="button"
                  onClick={() => setRequiredWeeklyLoads(loads)}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    requiredWeeklyLoads === loads
                      ? "bg-[#A91079] text-white shadow-xs"
                      : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                  }`}
                >
                  <span>{loads}x</span>
                  <span className="text-[9px] opacity-80">/wk</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Placement (Daily Schedule Time Window) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Preferred Placement (Daily Schedule Time Window)</span>
              </label>
              <span className="text-[11px] font-extrabold text-[#A91079]">
                {preferredPlacement === "MORNING" && "Periods 1–4 (Morning Academic)"}
                {preferredPlacement === "AFTERNOON" && "Periods 5–7 (Afternoon Applied)"}
                {preferredPlacement === "MON_P1_LOCK" && "Monday Period 1 Fixed Lock"}
                {preferredPlacement === "FLEXIBLE" && "Flexible (Periods 1–7)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLACEMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = preferredPlacement === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setPreferredPlacement(opt.id);
                      if (opt.id === "MON_P1_LOCK") {
                        setIsAdviserLocked(true);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-[#FDF2FA] border-[#A91079] ring-2 ring-[#A91079]/20 shadow-2xs"
                        : "bg-[#FAF5FA]/80 border-[#E5CCE3] hover:border-[#A91079]/40 hover:bg-[#FAF5FA]"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 border transition ${
                        isSelected
                          ? "bg-[#A91079] text-white border-[#A91079]"
                          : "bg-white text-slate-500 border-slate-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#2E0249] truncate block">
                          {opt.title}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#A91079] shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-[#A91079] block mt-0.5">
                        {opt.timeWindow}
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5 line-clamp-2">
                        {opt.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lock to Section Adviser Option */}
          <div
            onClick={() => setIsAdviserLocked(!isAdviserLocked)}
            className={`p-3.5 rounded-2xl border transition cursor-pointer select-none flex items-center justify-between ${
              isAdviserLocked
                ? "bg-[#FAF5FA] border-[#A91079]/50 ring-1 ring-[#A91079]/20"
                : "bg-[#FAF5FA]/60 border-[#E5CCE3]/80 hover:border-[#A91079]/40"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl border transition ${
                  isAdviserLocked
                    ? "bg-[#F3E5F2] border-[#E5CCE3] text-[#A91079]"
                    : "bg-white border-[#E5CCE3] text-slate-400"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#2E0249] block">
                  Lock to Section Adviser
                </span>
                <span className="text-[11px] text-[#703372] block">
                  Assign instructional periods for this subject exclusively to the Class Adviser.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isAdviserLocked}
              onChange={(e) => setIsAdviserLocked(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-4.5 h-4.5 rounded border-[#E5CCE3] text-[#A91079] focus:ring-[#F806CC] cursor-pointer accent-[#A91079]"
            />
          </div>

          {/* Live Weekly Allotment Calculation Banner */}
          <div className="p-3 bg-[#FDF2FA] rounded-2xl border border-[#E5CCE3] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A91079]" />
              <div>
                <span className="text-xs font-bold text-[#2E0249]">
                  Computed Weekly Allotment
                </span>
                <span className="text-[11px] text-[#703372] block">
                  {requiredWeeklyLoads} sessions × {durationMinutes} mins
                </span>
              </div>
            </div>
            <div className="text-right">
              <strong className="text-sm font-extrabold text-[#A91079] tabular-nums">
                {totalMinutes} mins/wk
              </strong>
              <span className="text-[10px] text-[#703372] block font-semibold">
                ({totalHours} hrs/week)
              </span>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5CCE3]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-[#F3E5F2] hover:text-[#2E0249] font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-md shadow-[#A91079]/20 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? "Saving..." : "Save Subject Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
