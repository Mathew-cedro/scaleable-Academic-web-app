import { useState } from "react";
import {
  UserPlus,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  ShieldAlert,
  RefreshCw,
  Clock,
  Sparkles
} from "lucide-react";
import { api } from "../api/client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  departments: any[];
  sections: any[];
  subjects: any[];
  onSuccess: (message: string) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const NewHireModal = ({
  isOpen,
  onClose,
  departments,
  sections,
  subjects,
  onSuccess,
}: Props) => {
  const [name, setName] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<number>(departments[0]?.id || 1);
  const [position, setPosition] = useState<string>("Teacher I");
  const [maxDailyHours, setMaxDailyHours] = useState<number>(6);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState<number>(30);

  // Proposed Slots list
  const [proposedSlots, setProposedSlots] = useState<Array<{
    section_id: number;
    subject_id: number;
    day_of_week: number;
    period_index: number;
  }>>([]);

  const [auditResult, setAuditResult] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddProposedSlot = () => {
    setProposedSlots((prev) => [
      ...prev,
      {
        section_id: sections[0]?.id || 1,
        subject_id: subjects[0]?.id || 1,
        day_of_week: 0,
        period_index: 2,
      },
    ]);
    setAuditResult(null);
  };

  const handleRemoveProposedSlot = (idx: number) => {
    setProposedSlots((prev) => prev.filter((_, i) => i !== idx));
    setAuditResult(null);
  };

  const handleRunAudit = async () => {
    if (!name.trim()) {
      setError("Please provide the teacher's name.");
      return;
    }
    setError(null);
    setLoadingAudit(true);

    try {
      const res = await api.auditNewHire({
        name: name.trim(),
        department_id: departmentId,
        position,
        max_daily_hours: maxDailyHours,
        max_weekly_hours: maxWeeklyHours,
        proposed_slots: proposedSlots,
      });
      setAuditResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to audit proposed schedule.");
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleCommitNewHire = async () => {
    if (!name.trim()) return;
    setCommitting(true);
    setError(null);

    try {
      // 1. Create Teacher profile
      const newTeacher = await api.createTeacher({
        name: name.trim(),
        department_id: departmentId,
        position,
        max_daily_hours: maxDailyHours,
        max_weekly_hours: maxWeeklyHours,
        status: "Active",
      });

      // 2. Assign proposed slots if any
      for (const slot of proposedSlots) {
        await api.assignOrUpdateSlot({
          section_id: slot.section_id,
          subject_id: slot.subject_id,
          teacher_id: newTeacher.id,
          day_of_week: slot.day_of_week,
          period_index: slot.period_index,
          allow_room_override: true,
        });
      }

      onSuccess(`Successfully onboarded ${name} (${position}) with ${proposedSlots.length} teaching assignments!`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to onboard new hire");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#220137] border border-[#570A57] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#570A57] flex items-center justify-between bg-[#2E0249]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#570A57] border border-[#F806CC]/30 flex items-center justify-center text-[#F806CC] shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                New Hire Onboarding & Conflict Checker
              </h2>
              <p className="text-xs text-[#D5B4DE]">
                Account for new faculty, verify timetable collisions, and balance workloads
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#3D055E] hover:bg-[#570A57] text-[#D5B4DE] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Teacher Profile Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#D5B4DE] uppercase tracking-wider block mb-1.5">
                Faculty Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Mrs. Maria Santos"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setAuditResult(null);
                }}
                className="w-full bg-[#2E0249] border border-[#570A57] rounded-xl px-3.5 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-[#F806CC]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#D5B4DE] uppercase tracking-wider block mb-1.5">
                Department *
              </label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(Number(e.target.value));
                  setAuditResult(null);
                }}
                className="w-full bg-[#2E0249] border border-[#570A57] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F806CC] cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#2E0249]">
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#D5B4DE] uppercase tracking-wider block mb-1.5">
                Designation / Position
              </label>
              <select
                value={position}
                onChange={(e) => {
                  setPosition(e.target.value);
                  setAuditResult(null);
                }}
                className="w-full bg-[#2E0249] border border-[#570A57] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F806CC] cursor-pointer"
              >
                <option value="Teacher I">Teacher I</option>
                <option value="Teacher II">Teacher II</option>
                <option value="Teacher III">Teacher III</option>
                <option value="Master Teacher I">Master Teacher I</option>
                <option value="Master Teacher II">Master Teacher II</option>
                <option value="Special Science Teacher">Special Science Teacher</option>
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-[#D5B4DE] uppercase tracking-wider block mb-1.5">
                  Daily Cap (RA 4670)
                </label>
                <input
                  type="number"
                  max={6}
                  min={1}
                  value={maxDailyHours}
                  onChange={(e) => setMaxDailyHours(Number(e.target.value))}
                  className="w-full bg-[#2E0249] border border-[#570A57] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F806CC]"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-[#D5B4DE] uppercase tracking-wider block mb-1.5">
                  Weekly Cap
                </label>
                <input
                  type="number"
                  max={30}
                  min={1}
                  value={maxWeeklyHours}
                  onChange={(e) => setMaxWeeklyHours(Number(e.target.value))}
                  className="w-full bg-[#2E0249] border border-[#570A57] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F806CC]"
                />
              </div>
            </div>
          </div>

          {/* Proposed Schedule Slots */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Proposed Class Schedule (Optional)
                </h4>
                <p className="text-[11px] text-[#D5B4DE]">
                  Assign teaching periods to check for time collisions or room clashes.
                </p>
              </div>
              <button
                onClick={handleAddProposedSlot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#570A57] hover:bg-[#A91079] text-xs font-bold text-white transition cursor-pointer border border-[#A91079]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Period</span>
              </button>
            </div>

            {proposedSlots.length > 0 && (
              <div className="space-y-2">
                {proposedSlots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="bg-[#2E0249] border border-[#570A57] rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs"
                  >
                    <select
                      value={slot.section_id}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setProposedSlots((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, section_id: val } : s))
                        );
                        setAuditResult(null);
                      }}
                      className="bg-[#3D055E] border border-[#A91079]/50 rounded-lg px-2 py-1 text-white"
                    >
                      {sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name} ({sec.room_number})
                        </option>
                      ))}
                    </select>

                    <select
                      value={slot.subject_id}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setProposedSlots((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, subject_id: val } : s))
                        );
                        setAuditResult(null);
                      }}
                      className="bg-[#3D055E] border border-[#A91079]/50 rounded-lg px-2 py-1 text-white"
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} (G{sub.grade_level})
                        </option>
                      ))}
                    </select>

                    <select
                      value={slot.day_of_week}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setProposedSlots((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, day_of_week: val } : s))
                        );
                        setAuditResult(null);
                      }}
                      className="bg-[#3D055E] border border-[#A91079]/50 rounded-lg px-2 py-1 text-white"
                    >
                      {DAYS.map((d, dIdx) => (
                        <option key={dIdx} value={dIdx}>
                          {d}
                        </option>
                      ))}
                    </select>

                    <select
                      value={slot.period_index}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setProposedSlots((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, period_index: val } : s))
                        );
                        setAuditResult(null);
                      }}
                      className="bg-[#3D055E] border border-[#A91079]/50 rounded-lg px-2 py-1 text-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                        <option key={p} value={p}>
                          Period {p}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleRemoveProposedSlot(idx)}
                      className="w-7 h-7 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 flex items-center justify-center ml-auto cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Action Button */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={handleRunAudit}
              disabled={loadingAudit}
              className="px-4 py-2 rounded-xl bg-[#570A57] hover:bg-[#A91079] text-xs font-bold text-white transition cursor-pointer border border-[#A91079] flex items-center gap-1.5"
            >
              {loadingAudit ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#F806CC]" /> Run Conflict & Compliance Audit
                </>
              )}
            </button>
          </div>

          {/* Audit Results View */}
          {auditResult && (
            <div className="space-y-4 pt-2">
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  auditResult.feasibility === "FEASIBLE"
                    ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                    : auditResult.feasibility === "WARNING"
                    ? "bg-amber-950/40 border-amber-500/60 text-amber-200"
                    : "bg-rose-950/40 border-rose-500/60 text-rose-200"
                }`}
              >
                {auditResult.feasibility === "FEASIBLE" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    Audit Status: {auditResult.feasibility}
                  </div>
                  <div className="text-xs mt-0.5">{auditResult.summary}</div>
                </div>
              </div>

              {/* Clash details if any */}
              {auditResult.clashes?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-rose-300">Detected Clashes:</span>
                  <div className="space-y-1.5">
                    {auditResult.clashes.map((c: any, i: number) => (
                      <div
                        key={i}
                        className="bg-rose-950/50 border border-rose-500/40 rounded-xl p-2.5 text-xs text-rose-200 flex items-start gap-2"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{c.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workload Relief Opportunities */}
              {auditResult.relief_opportunities?.length > 0 && (
                <div className="bg-[#2E0249] border border-purple-500/40 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#F806CC]" />
                    <h5 className="text-xs font-bold text-white">
                      Workload Relief Opportunities in Department
                    </h5>
                  </div>
                  <p className="text-[11px] text-[#D5B4DE]">
                    Existing colleagues currently carry heavy loads. You can offload these classes to the new hire:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {auditResult.relief_opportunities.slice(0, 3).map((opp: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-[#3D055E] border border-[#570A57] rounded-xl p-2.5 text-xs flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-white">{opp.subject_name}</strong> • {opp.section_name} ({opp.room_number})
                          <div className="text-[10px] text-[#D5B4DE] mt-0.5">{opp.reason}</div>
                        </div>
                        <span className="text-[10px] bg-[#570A57] text-white px-2 py-0.5 rounded font-semibold">
                          Period {opp.period_index}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#570A57] bg-[#2E0249] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#D5B4DE] hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleCommitNewHire}
            disabled={committing || (auditResult && !auditResult.can_commit)}
            className="px-5 py-2 rounded-xl bg-[#A91079] hover:bg-[#F806CC] text-white font-bold text-xs transition cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {committing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Onboarding...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Onboard Teacher
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
