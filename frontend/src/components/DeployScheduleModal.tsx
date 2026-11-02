import React, { useState, useMemo } from "react";
import {
  Send,
  X,
  CheckCircle2,
  Building2,
  Users,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  ShieldCheck,
  Bell,
  Check,
} from "lucide-react";
import {
  api,
  type ScheduleDeployRequest,
  type ScheduleDeployResponse,
  type UserProfile,
} from "../api/client";

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
  status: string;
}

interface Subject {
  id: number;
  name: string;
  department_id: number;
  duration_minutes?: number;
}

interface ScheduleSlot {
  id: number;
  section_id: number;
  subject_id: number;
  teacher_id: number;
  day_of_week: number;
  period_index: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  teachers: Teacher[];
  slots: ScheduleSlot[];
  subjects: Subject[];
  currentUser?: UserProfile;
  onDeploySuccess: (response: ScheduleDeployResponse) => void;
}

export const DeployScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  departments,
  teachers,
  slots,
  subjects,
  currentUser,
  onDeploySuccess,
}) => {
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<number>>(
    () => new Set(departments.map((d) => d.id))
  );
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [semester, setSemester] = useState("1st Semester");
  const [deployedBy, setDeployedBy] = useState(() =>
    currentUser?.name
      ? `${currentUser.name} (${currentUser.position || "School Principal IV"})`
      : "Office of the Principal / Dr. Aris Thorne"
  );
  const [memo, setMemo] = useState(
    "Pursuant to DepEd Order No. 009, s. 2026 and Republic Act No. 4670, the Master Timetable for S.Y. 2026-2027 is hereby officially approved and deployed to all Academic Departments. Department Heads are instructed to verify faculty teaching loads, disseminate individual schedules, and ensure immediate operational execution."
  );
  const [notifyFaculty, setNotifyFaculty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<ScheduleDeployResponse | null>(null);

  // Subject duration lookup
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  // Department statistics mapping
  const deptStats = useMemo(() => {
    const stats = new Map<
      number,
      {
        facultyCount: number;
        slotsCount: number;
        weeklyHours: number;
      }
    >();

    departments.forEach((dept) => {
      const deptTeachers = teachers.filter((t) => t.department_id === dept.id);
      const teacherIds = new Set(deptTeachers.map((t) => t.id));
      const deptSlots = slots.filter((sl) => teacherIds.has(sl.teacher_id));

      let hours = 0;
      deptSlots.forEach((sl) => {
        const sub = subjectMap.get(sl.subject_id);
        const duration = sub?.duration_minutes ?? 60;
        hours += duration / 60;
      });

      stats.set(dept.id, {
        facultyCount: deptTeachers.length,
        slotsCount: deptSlots.length,
        weeklyHours: Math.round(hours * 10) / 10,
      });
    });

    return stats;
  }, [departments, teachers, slots, subjectMap]);

  if (!isOpen) return null;

  const toggleDept = (deptId: number) => {
    setSelectedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedDeptIds(new Set(departments.map((d) => d.id)));
  };

  const clearAll = () => {
    setSelectedDeptIds(new Set());
  };

  const selectedDeptsList = departments.filter((d) => selectedDeptIds.has(d.id));
  const totalSelectedSlots = selectedDeptsList.reduce(
    (sum, d) => sum + (deptStats.get(d.id)?.slotsCount ?? 0),
    0
  );
  const totalSelectedFaculty = selectedDeptsList.reduce(
    (sum, d) => sum + (deptStats.get(d.id)?.facultyCount ?? 0),
    0
  );
  const totalSelectedHours = selectedDeptsList.reduce(
    (sum, d) => sum + (deptStats.get(d.id)?.weeklyHours ?? 0),
    0
  );

  const handleDeploy = async () => {
    if (selectedDeptIds.size === 0) {
      setError("Please select at least one academic department to deploy the schedule to.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: ScheduleDeployRequest = {
        department_ids: Array.from(selectedDeptIds),
        academic_year: academicYear,
        semester: semester,
        deployed_by: deployedBy,
        memo: memo,
        notify_faculty: notifyFaculty,
      };

      const result = await api.deploySchedule(payload);
      setSuccessResult(result);
      onDeploySuccess(result);

      // Auto close after brief display
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err?.message || "Failed to deploy schedule to departments.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#2E0249] via-[#570A57] to-[#2E0249] text-white flex items-center justify-between shrink-0 border-b border-[#570A57]/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 text-[#F806CC] shadow-inner">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Deploy Master Schedule to Academic Departments
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Official Release
                </span>
              </div>
              <p className="text-xs text-pink-200/80 mt-0.5">
                DepEd DO 009, s. 2026 Workload Compliance • Multi-Department Distribution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-pink-200 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Success Banner if deployed */}
          {successResult && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-4 animate-in fade-in zoom-in-95">
              <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-950">
                  Master Schedule Successfully Deployed!
                </h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Released to {successResult.department_summaries.length} Academic Departments ({successResult.deployment.slots_count} instructional slots). Broadcast notification transmitted.
                </p>
              </div>
            </div>
          )}

          {/* Top Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-[#E5CCE3]">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Selected Depts</span>
                <Building2 className="w-3.5 h-3.5 text-[#A91079]" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {selectedDeptIds.size} <span className="text-xs font-semibold text-slate-400">/ {departments.length}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {selectedDeptIds.size === departments.length ? "All Learning Areas" : "Selective Release"}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FDF2FA]/70 border border-[#E5CCE3]">
              <div className="flex items-center justify-between text-[#703372] text-[11px] font-bold">
                <span>Slots Covered</span>
                <Clock className="w-3.5 h-3.5 text-[#A91079]" />
              </div>
              <div className="text-xl font-black text-[#2E0249] mt-1">
                {totalSelectedSlots} <span className="text-xs font-semibold text-[#A91079]">slots</span>
              </div>
              <div className="text-[10px] text-[#A91079] mt-0.5">
                Weekly Class Assignments
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-[#E5CCE3]">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>Faculty Impacted</span>
                <Users className="w-3.5 h-3.5 text-[#A91079]" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {totalSelectedFaculty} <span className="text-xs font-semibold text-slate-400">teachers</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Registered Teaching Staff
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold">
                <span>Teaching Volume</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-950 mt-1">
                {totalSelectedHours} <span className="text-xs font-semibold text-emerald-700">hrs/wk</span>
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                Workload Compliant
              </div>
            </div>
          </div>

          {/* Department Selection Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#A91079]" />
                  <span>Target Academic Departments</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select which departments will receive and enforce this master timetable deployment.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 text-[11px] font-bold text-[#A91079] bg-[#FDF2FA] hover:bg-[#F3E5F2] rounded-lg border border-[#E5CCE3] transition cursor-pointer"
                >
                  Select All ({departments.length})
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border border-[#E5CCE3] transition cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Department Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {departments.map((dept) => {
                const isSelected = selectedDeptIds.has(dept.id);
                const stats = deptStats.get(dept.id);

                return (
                  <div
                    key={dept.id}
                    onClick={() => toggleDept(dept.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? "bg-[#FDF2FA]/50 border-[#A91079] shadow-xs ring-1 ring-[#F806CC]/40"
                        : "bg-white border-[#E5CCE3] hover:border-slate-300 text-slate-400"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            isSelected
                              ? "bg-[#A91079] text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {dept.code}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center transition ${
                            isSelected
                              ? "bg-[#A91079] text-white"
                              : "border border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      <h4
                        className={`text-xs font-bold leading-tight line-clamp-1 ${
                          isSelected ? "text-slate-900" : "text-slate-600"
                        }`}
                      >
                        {dept.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#E5CCE3]/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-medium">
                        {stats?.facultyCount ?? 0} Faculty
                      </span>
                      <span
                        className={`font-black ${
                          isSelected ? "text-[#A91079]" : "text-slate-400"
                        }`}
                      >
                        {stats?.slotsCount ?? 0} slots ({stats?.weeklyHours ?? 0}h)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deployment Directive & Metadata Form */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-[#E5CCE3] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E5CCE3]">
              <ShieldCheck className="w-4 h-4 text-[#A91079]" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Official Administrative Directive & Metadata
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Academic School Year
                </label>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-[#E5CCE3] text-xs text-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full bg-transparent outline-none font-semibold"
                    placeholder="e.g. 2026-2027"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Semester / Grading Term
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-[#E5CCE3] text-xs font-semibold text-slate-800 outline-none"
                >
                  <option value="1st Semester">1st Semester (Q1 & Q2)</option>
                  <option value="2nd Semester">2nd Semester (Q3 & Q4)</option>
                  <option value="Full Academic Year">Full Academic Year</option>
                  <option value="Summer / Remediation Term">Summer / ARAL Remediation</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Issuing Authority / Deployed By
                </label>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-[#E5CCE3] text-xs text-slate-800">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={deployedBy}
                    onChange={(e) => setDeployedBy(e.target.value)}
                    className="w-full bg-transparent outline-none font-semibold truncate"
                    placeholder="e.g. Office of the Principal"
                  />
                </div>
              </div>
            </div>

            {/* Official Memorandum Textarea */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Official Memorandum Directive / Department Instructions
              </label>
              <textarea
                rows={3}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full p-3 bg-white rounded-xl border border-[#E5CCE3] text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#A91079]/30 leading-relaxed font-sans"
                placeholder="Enter deployment notes or special instructions for Department Heads..."
              />
              <p className="text-[10px] text-slate-500 mt-1">
                This memorandum will appear on all Department Head dashboards upon release.
              </p>
            </div>

            {/* Real-time notification toggle */}
            <div className="pt-2 flex items-center justify-between border-t border-[#E5CCE3]/70">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#A91079]" />
                <span className="text-xs font-bold text-slate-800">
                  Live Multi-Client Synchronization
                </span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyFaculty}
                  onChange={(e) => setNotifyFaculty(e.target.checked)}
                  className="rounded text-[#A91079] focus:ring-[#A91079] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700">
                  Broadcast WebSocket Alert to all Department Dashboards
                </span>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-[#E5CCE3] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Ready to publish official timetable</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDeploy}
              disabled={loading || selectedDeptIds.size === 0}
              className="px-5 py-2.5 bg-[#A91079] hover:bg-[#8F0B66] disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-[#A91079]/25 flex items-center gap-2 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {loading
                  ? "Deploying Schedule..."
                  : `Deploy to ${selectedDeptIds.size} Department${selectedDeptIds.size === 1 ? "" : "s"}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
