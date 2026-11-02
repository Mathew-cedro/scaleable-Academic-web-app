import { useState } from "react";
import { X, Save, CheckCircle2, AlertCircle } from "lucide-react";
import type { CreateSavedSchedulePayload } from "../api/client";
import { formatDuration } from "../utils/bellSchedule";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  slotsCount: number;
  periodDurationMinutes: number;
  configJson?: string;
  onSave: (payload: CreateSavedSchedulePayload) => Promise<void>;
}

export const SaveScheduleModal = ({
  isOpen,
  onClose,
  slotsCount,
  periodDurationMinutes,
  configJson,
  onSave,
}: Props) => {
  if (!isOpen) return null;

  const now = new Date();
  const defaultName = `Schedule Snapshot — ${now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please provide a name for this schedule version.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        period_duration_minutes: periodDurationMinutes,
        config_json: configJson,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save schedule snapshot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-[#F3E5F2] text-[#A91079]">
              <Save className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Save Schedule Snapshot
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Save current timetable state to version history for easy rollback anytime.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Schedule Summary Badge */}
          <div className="p-3.5 rounded-2xl bg-[#FDF2FA]/70 border border-[#E5CCE3] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#2E0249] font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#A91079]" />
              <span>Current Live Timetable</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="px-2 py-0.5 rounded-md bg-[#F3E5F2] text-[#703372]">
                {slotsCount} Slots
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#F3E5F2] text-[#703372]">
                {formatDuration(periodDurationMinutes)} Periods
              </span>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Schedule Version Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SY 2026-2027 Q1 Final (60m Single Shift)"
              className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden transition"
            />
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description / Audit Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Approved timetable version with science labs prioritized in morning periods and 40m catch-up modules."
              className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden transition resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-[#A91079]/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving Snapshot..." : "Save Schedule File"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
