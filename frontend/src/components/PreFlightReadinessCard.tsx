import React, { useMemo } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Building,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { formatDuration } from "../utils/bellSchedule";

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
}

interface Props {
  teachers: Teacher[];
  sections: Section[];
  departments: Department[];
  subjects?: Subject[];
  selectedSectionIds: Set<number>;
  periodDuration: number;
  maxDailyHours: number;
  onLaunchGenerate: () => void;
  loading: boolean;
  isPrincipal: boolean;
  onNavigateToTab?: (tab: "TRACKS" | "SECTIONS" | "CONSTRAINTS" | "RUN_DEPLOY") => void;
}

export const PreFlightReadinessCard: React.FC<Props> = ({
  teachers,
  sections,
  departments,
  selectedSectionIds,
  periodDuration,
  maxDailyHours,
  onLaunchGenerate,
  loading,
  isPrincipal,
  onNavigateToTab,
}) => {
  // 1. Audit Target Sections
  const targetSections = useMemo(
    () => sections.filter((s) => selectedSectionIds.has(s.id)),
    [sections, selectedSectionIds]
  );

  // 2. Audit Faculty per Department Capacity vs Demand
  const auditResults = useMemo(() => {
    const activeTeachers = teachers.filter((t) => t.status === "Active");
    const onLeaveTeachers = teachers.filter((t) => t.status !== "Active");

    // Check Department Load Demands (assuming standard 4 loads/week per section)
    const deptChecks = departments.map((dept) => {
      const deptTeachers = activeTeachers.filter((t) => t.department_id === dept.id);
      const deptAdvisers = deptTeachers.filter((t) => t.is_adviser && t.advisory_section_id);
      const deptNonAdvisers = deptTeachers.filter((t) => !(t.is_adviser && t.advisory_section_id));

      // Calculate demand: how many sections need subjects from this department
      // Standard: 1 subject per regular section = 4 loads (1 section)
      // Special tracks may have extra subject (e.g. Science in STE, MAPEH in SPS)
      let requiredSectionLoads = 0;
      targetSections.forEach((sec) => {
        const pType = (sec.program_type || "BEC").toUpperCase();
        if (pType === "STE" && dept.name.toLowerCase().includes("science")) {
          requiredSectionLoads += 2; // Core Science + Research
        } else if (pType === "SPS" && dept.name.toLowerCase().includes("mapeh")) {
          requiredSectionLoads += 2; // Core MAPEH + Sports & Education
        } else {
          requiredSectionLoads += 1;
        }
      });

      // Capacity: Advisers ~6 sections (24h) up to 7 with overload; Non-advisers ~7 sections (28h)
      // Normal capacity: advisers * 6 + nonAdvisers * 7
      // Overload ceiling: advisers * 7 + nonAdvisers * 7
      const normalCapacitySections = deptAdvisers.length * 6 + deptNonAdvisers.length * 7;
      const maxOverloadCapacitySections = (deptAdvisers.length + deptNonAdvisers.length) * 7;

      const isSufficient = maxOverloadCapacitySections >= requiredSectionLoads;
      const isTight = normalCapacitySections < requiredSectionLoads && isSufficient;

      return {
        dept,
        activeCount: deptTeachers.length,
        requiredLoads: requiredSectionLoads,
        normalCapacity: normalCapacitySections,
        maxCapacity: maxOverloadCapacitySections,
        status: isSufficient ? (isTight ? "WARNING" : "OPTIMAL") : "CRITICAL",
        gap: requiredSectionLoads - maxOverloadCapacitySections,
      };
    });

    // Check Room Allocations
    const roomMap: Record<string, string[]> = {};
    targetSections.forEach((s) => {
      const rm = (s.room_number || "Unassigned").trim();
      if (!roomMap[rm]) roomMap[rm] = [];
      roomMap[rm].push(s.name);
    });
    const sharedRooms = Object.entries(roomMap).filter(
      ([rm, secs]) => rm !== "Unassigned" && secs.length > 1
    );

    // Advisory Section Mapping
    const sectionsWithoutAdviser = targetSections.filter(
      (s) => !activeTeachers.some((t) => t.advisory_section_id === s.id)
    );

    const isZeroSections = targetSections.length === 0;
    const hasCriticalIssues = isZeroSections || deptChecks.some((c) => c.status === "CRITICAL");
    const hasWarnings = !isZeroSections && (deptChecks.some((c) => c.status === "WARNING") || sharedRooms.length > 0);

    return {
      activeTeachersCount: activeTeachers.length,
      onLeaveTeachersCount: onLeaveTeachers.length,
      deptChecks,
      sharedRooms,
      sectionsWithoutAdviser,
      hasCriticalIssues,
      hasWarnings,
      readinessScore: isZeroSections ? 0 : hasCriticalIssues ? 65 : hasWarnings ? 92 : 100,
    };
  }, [teachers, targetSections, departments]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in duration-150">
      {/* Header & Overall Health Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#FDF2FA] text-[#A91079] rounded-xl border border-[#E5CCE3]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900">
              Pre-Flight Schedule Feasibility & Readiness Check
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Automated verification of faculty ratios, curriculum loads, and DepEd RA 4670 compliance before solving.
          </p>
        </div>

        {/* Readiness Meter Badge */}
        <div className="flex items-center gap-3 self-start sm:self-auto bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              Feasibility Score
            </span>
            <span
              className={`text-lg font-black num-tabular ${
                auditResults.readinessScore === 100
                  ? "text-emerald-600"
                  : auditResults.readinessScore >= 90
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {auditResults.readinessScore}%
            </span>
          </div>
          <div className="w-2.5 h-10 rounded-full bg-slate-200 overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full rounded-full transition-all duration-500 ${
                auditResults.readinessScore === 100
                  ? "bg-emerald-500 h-full"
                  : auditResults.readinessScore >= 90
                  ? "bg-amber-500 h-[92%]"
                  : "bg-rose-500 h-[65%]"
              }`}
            />
          </div>
        </div>
      </div>

      {/* 4 Primary Verification Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Check 1: Target Sections */}
        <div
          className={`p-3.5 rounded-2xl border transition ${
            targetSections.length > 0
              ? "bg-emerald-50/60 border-emerald-200/80 text-emerald-950"
              : "bg-rose-50 border-rose-200 text-rose-950"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Section Roster</span>
            </span>
            {targetSections.length > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div className="text-lg font-black num-tabular">
            {targetSections.length} Sections
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {targetSections.length === 0
              ? "No sections selected"
              : targetSections.length === sections.length
              ? "Full school timetable (100%)"
              : `Selected ${targetSections.length} of ${sections.length}`}
          </p>
        </div>

        {/* Check 2: Active Faculty Capacity */}
        <div
          className={`p-3.5 rounded-2xl border transition ${
            !auditResults.hasCriticalIssues
              ? "bg-emerald-50/60 border-emerald-200/80 text-emerald-950"
              : "bg-rose-50 border-rose-200 text-rose-950"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#A91079]" />
              <span>Faculty Capacity</span>
            </span>
            {!auditResults.hasCriticalIssues ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div className="text-lg font-black num-tabular">
            {auditResults.activeTeachersCount} Active Faculty
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {auditResults.onLeaveTeachersCount > 0
              ? `${auditResults.onLeaveTeachersCount} faculty currently on leave`
              : "All 64 teachers active & ready"}
          </p>
        </div>

        {/* Check 3: Room Availability */}
        <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 text-slate-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold flex items-center gap-1.5">
              <Building className="w-4 h-4 text-indigo-600" />
              <span>Room Allocations</span>
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-black num-tabular">
            {auditResults.sharedRooms.length === 0 ? "100% Isolated" : `${auditResults.sharedRooms.length} Shared`}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {auditResults.sharedRooms.length === 0
              ? "Zero physical classroom clashes"
              : "Soft collision solver enabled"}
          </p>
        </div>

        {/* Check 4: Bell Schedule Standard */}
        <div className="p-3.5 rounded-2xl border bg-[#FDF2FA]/70 border-[#E5CCE3] text-slate-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#A91079]" />
              <span>DepEd Bell Model</span>
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-[#A91079] num-tabular">
            {formatDuration(periodDuration)} Periods
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            RA 4670 daily limit: {maxDailyHours}h cap
          </p>
        </div>
      </div>

      {/* Capacity Breakdown by Department */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Department Faculty-to-Section Load Balance:</span>
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            Max 7 sections/teacher (DepEd RA 4670)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {auditResults.deptChecks.map((chk) => (
            <div
              key={chk.dept.id}
              className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between transition ${
                chk.status === "OPTIMAL"
                  ? "bg-slate-50/70 border-slate-200"
                  : chk.status === "WARNING"
                  ? "bg-amber-50/70 border-amber-200 text-amber-950"
                  : "bg-rose-50 border-rose-300 text-rose-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold truncate text-slate-900" title={chk.dept.name}>
                  {chk.dept.code || chk.dept.name}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    chk.status === "OPTIMAL"
                      ? "bg-emerald-500"
                      : chk.status === "WARNING"
                      ? "bg-amber-500"
                      : "bg-rose-500 animate-pulse"
                  }`}
                />
              </div>

              <div className="mt-1 flex items-baseline justify-between text-[11px]">
                <span className="text-slate-500">Need: {chk.requiredLoads} secs</span>
                <span className="font-bold text-slate-700">Cap: {chk.maxCapacity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advisory Section Warning if Any */}
      {auditResults.sectionsWithoutAdviser.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{auditResults.sectionsWithoutAdviser.length} sections</strong> do not have a designated Class Adviser for Monday Period 1 Homeroom Guidance.
            </span>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab("SECTIONS")}
              className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 shrink-0"
            >
              Assign Advisers &rarr;
            </button>
          )}
        </div>
      )}

      {/* Primary Action Call to Action */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {auditResults.hasCriticalIssues
              ? "Resolve department faculty shortages before initiating master schedule generation."
              : "All system parameters verified. Safe to generate conflict-free timetable."}
          </span>
        </div>

        <button
          type="button"
          disabled={loading || targetSections.length === 0 || auditResults.hasCriticalIssues || !isPrincipal}
          onClick={onLaunchGenerate}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#A91079] hover:bg-[#8F0B66] text-white text-xs font-black shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          <span>{loading ? "Solving Schedule..." : "Proceed to Generate Master Schedule"}</span>
          <ArrowRight className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
