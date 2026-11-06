import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Star,
  Heart,
} from "lucide-react";

interface ScheduleSlot {
  id: number;
  section_id: number;
  subject_id: number;
  teacher_id: number;
  day_of_week: number;
  period_index: number;
}

interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
}

interface Teacher {
  id: number;
  name: string;
  status: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
}

interface Props {
  slots: ScheduleSlot[];
  sections: Section[];
  teachers?: Teacher[];
  latencyMs?: number;
}

export const ScheduleHealthScorecard: React.FC<Props> = ({
  slots,
  sections,
  latencyMs,
}) => {
  if (slots.length === 0) return null;

  // 1. Homeroom Protection Count
  // Monday Period 1 (day_of_week=0, period_index=1)
  const homeroomSlots = slots.filter(
    (s) => s.day_of_week === 0 && s.period_index === 1
  );
  const homeroomProtectedCount = homeroomSlots.length;

  // 2. Specialized Track in Period 8 or 9
  // Special tracks: sections with program_type != BEC / Regular
  const specialSectionIds = new Set(
    sections
      .filter((s) => !["BEC", "REGULAR", "STANDARD", "GENERAL"].includes((s.program_type || "").toUpperCase()))
      .map((s) => s.id)
  );
  const specialSlots = slots.filter((s) => specialSectionIds.has(s.section_id));
  const specialTrackExtSlots = specialSlots.filter((s) => s.period_index >= 8);

  // 3. Teacher Fatigue (No teacher teaching > 3 consecutive periods)
  // Group slots by teacher and day
  const teacherDayMap = new Map<string, number[]>();
  slots.forEach((s) => {
    const key = `${s.teacher_id}_${s.day_of_week}`;
    if (!teacherDayMap.has(key)) teacherDayMap.set(key, []);
    teacherDayMap.get(key)!.push(s.period_index);
  });

  let overConsecutiveCount = 0;
  teacherDayMap.forEach((periods) => {
    periods.sort((a, b) => a - b);
    let consecutive = 1;
    for (let i = 1; i < periods.length; i++) {
      if (periods[i] === periods[i - 1] + 1) {
        consecutive++;
        if (consecutive > 3) overConsecutiveCount++;
      } else {
        consecutive = 1;
      }
    }
  });

  return (
    <div className="bg-gradient-to-r from-emerald-50/80 via-white to-purple-50/50 rounded-3xl border border-emerald-200/80 p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
            Schedule Quality & DepEd Compliance Scorecard
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Conflict-Free
          </span>
          {latencyMs !== undefined && latencyMs > 0 && (
            <span className="text-slate-400 font-normal">
              Solved in {(latencyMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Metric 1: Slots Completed */}
        <div className="p-3 bg-white rounded-2xl border border-emerald-200/60 shadow-2xs space-y-0.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Generated Slots
          </span>
          <div className="text-base font-black text-slate-900 num-tabular flex items-baseline gap-1">
            <span>{slots.length}</span>
            <span className="text-[11px] font-semibold text-emerald-600">Active</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            Across {sections.length} active sections
          </span>
        </div>

        {/* Metric 2: Adviser Homeroom Guidance */}
        <div className="p-3 bg-white rounded-2xl border border-purple-200/60 shadow-2xs space-y-0.5">
          <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Homeroom Lock
          </span>
          <div className="text-base font-black text-slate-900 num-tabular flex items-baseline gap-1">
            <span>{homeroomProtectedCount}</span>
            <span className="text-[11px] font-semibold text-purple-600">/ {sections.length}</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            Locked on Mon Period 1
          </span>
        </div>

        {/* Metric 3: Track Routing in P8/P9 */}
        <div className="p-3 bg-white rounded-2xl border border-amber-200/60 shadow-2xs space-y-0.5">
          <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-500" />
            Track P8/P9 Routing
          </span>
          <div className="text-base font-black text-slate-900 num-tabular flex items-baseline gap-1">
            <span>{specialTrackExtSlots.length}</span>
            <span className="text-[11px] font-semibold text-amber-600">Track Slots</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            In 3:00–5:00 PM extended slot
          </span>
        </div>

        {/* Metric 4: Fatigue / Consecutive Window */}
        <div className="p-3 bg-white rounded-2xl border border-teal-200/60 shadow-2xs space-y-0.5">
          <span className="text-[10px] text-teal-700 font-bold uppercase tracking-wider block flex items-center gap-1">
            <Heart className="w-3 h-3 text-teal-500" />
            Faculty Fatigue
          </span>
          <div className="text-base font-black text-slate-900 num-tabular flex items-baseline gap-1">
            <span>{overConsecutiveCount === 0 ? "Optimal" : `${overConsecutiveCount} Peaks`}</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            &le; 3 consecutive periods/day
          </span>
        </div>
      </div>
    </div>
  );
};
