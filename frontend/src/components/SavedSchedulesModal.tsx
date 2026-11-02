import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  History,
  Save,
  Download,
  Upload,
  Trash2,
  Edit3,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Search,
  Check,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { api, type SavedScheduleItem } from "../api/client";
import { formatDuration } from "../utils/bellSchedule";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSaveCurrent: () => void;
  onRestoreSchedule: (id: number) => Promise<void>;
  currentDurationMinutes: number;
  currentSlotsCount: number;
}

export const SavedSchedulesModal = ({
  isOpen,
  onClose,
  onOpenSaveCurrent,
  onRestoreSchedule,
  currentDurationMinutes,
  currentSlotsCount,
}: Props) => {
  if (!isOpen) return null;

  const [savedSchedules, setSavedSchedules] = useState<SavedScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedScheduleItem | null>(null);
  const [editingTarget, setEditingTarget] = useState<SavedScheduleItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSaved = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const list = await api.listSavedSchedules();
      setSavedSchedules(list);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load saved schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return savedSchedules;
    const q = searchQuery.toLowerCase().trim();
    return savedSchedules.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q))
    );
  }, [savedSchedules, searchQuery]);

  const handleRestore = async (item: SavedScheduleItem) => {
    if (
      !window.confirm(
        `Are you sure you want to load "${item.name}" as the active schedule?\n\nCurrent live timetable slots will be replaced with this version.`
      )
    ) {
      return;
    }

    try {
      setRestoringId(item.id);
      setErrorMsg(null);
      await onRestoreSchedule(item.id);
      setSuccessMsg(`Successfully restored "${item.name}" as the active timetable!`);
      await fetchSaved();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore schedule.");
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteSavedSchedule(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessMsg(`Schedule "${deleteTarget.name}" deleted.`);
      await fetchSaved();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete schedule.");
    }
  };

  const handleOpenEdit = (item: SavedScheduleItem) => {
    setEditingTarget(item);
    setEditName(item.name);
    setEditDesc(item.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingTarget || !editName.trim()) return;
    try {
      await api.updateSavedSchedule(editingTarget.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setEditingTarget(null);
      setSuccessMsg("Schedule details updated.");
      await fetchSaved();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update schedule.");
    }
  };

  const handleExportJson = async (item: SavedScheduleItem) => {
    try {
      const detail = await api.getSavedSchedule(item.id);
      const dataStr =
        "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(detail, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `${item.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.schedmaster.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setSuccessMsg(`Exported "${item.name}" to JSON.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to export schedule.");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.slots_json && !Array.isArray(parsed.slots)) {
          throw new Error("Invalid file format. Must be an exported SchedMaster JSON file.");
        }

        const slotsJsonStr = parsed.slots_json || JSON.stringify(parsed.slots);
        const slotsCount = Array.isArray(parsed.slots) ? parsed.slots.length : JSON.parse(slotsJsonStr).length;

        await api.createSavedSchedule({
          name: parsed.name ? `${parsed.name} (Imported)` : `Imported Schedule (${slotsCount} slots)`,
          description: parsed.description ? `Imported file: ${parsed.description}` : "Imported from external file",
          period_duration_minutes: parsed.period_duration_minutes || 60,
          config_json: parsed.config_json,
        });

        setSuccessMsg("File imported successfully as a new schedule snapshot!");
        await fetchSaved();
      } catch (err: any) {
        setErrorMsg("Failed to import file: " + (err.message || "Corrupt JSON format"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-[#F3E5F2] text-[#A91079]">
              <History className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Saved Schedules & Version History
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E5F2] text-[#703372]">
                  {savedSchedules.length} Version{savedSchedules.length === 1 ? "" : "s"}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Live: {currentSlotsCount} slots • {currentDurationMinutes}m
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Switch back and forth between different schedules, create snapshots, or restore previous versions.
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

        {/* Toolbar Bar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved schedule name or description..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 focus:bg-white border border-[#E5CCE3] focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden transition"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {/* Hidden File Input for JSON Import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#E5CCE3] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Import an exported schedule file"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Import JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSaveCurrent();
              }}
              className="px-3.5 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>+ Save Current Schedule</span>
            </button>
          </div>
        </div>

        {/* Alert Messages */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Schedule List Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#A91079] mb-2" />
              <p className="text-xs font-bold">Loading schedule archives...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-[#E5CCE3]">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">No saved schedules found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Click "+ Save Current Schedule" above to archive your current timetable version.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  item.is_active
                    ? "bg-[#FDF2FA]/50 border-[#E5CCE3] ring-2 ring-[#A91079]/10 shadow-2xs"
                    : "bg-white border-[#E5CCE3] hover:border-slate-300 hover:shadow-2xs"
                }`}
              >
                {/* Left Metadata */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-slate-900 tracking-tight truncate">
                      {item.name}
                    </h4>
                    {item.is_active && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Active Timetable</span>
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                      {item.slots_count} Slots
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F3E5F2]/70 text-[#703372]">
                      {formatDuration(item.period_duration_minutes)} Periods
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                  )}

                  <div className="text-[10px] text-slate-400 flex items-center gap-3 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Saved: {new Date(item.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </span>
                    {item.updated_at !== item.created_at && (
                      <span>Updated: {new Date(item.updated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                    )}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  {/* Restore / Load Button */}
                  <button
                    type="button"
                    disabled={restoringId === item.id || item.is_active}
                    onClick={() => handleRestore(item)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      item.is_active
                        ? "bg-slate-100 text-slate-400 cursor-default"
                        : "bg-[#A91079] hover:bg-[#8F0B66] text-white shadow-xs"
                    }`}
                    title={item.is_active ? "This schedule is currently active" : "Load this schedule into the live timetable"}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{restoringId === item.id ? "Loading..." : item.is_active ? "Loaded" : "Load Schedule"}</span>
                  </button>

                  {/* Edit Metadata Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="Rename or edit notes"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Export JSON Button */}
                  <button
                    type="button"
                    onClick={() => handleExportJson(item)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="Export JSON backup file"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Delete snapshot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>Active schedule is always stored in live database. Snapshots allow instant rollback anytime.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Inline Edit Modal */}
      {editingTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-xl border border-[#E5CCE3] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900">Edit Schedule Snapshot</h4>
              <button
                onClick={() => setEditingTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Schedule Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-hidden resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-xl border border-[#E5CCE3] max-w-sm w-full p-6 space-y-4">
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 w-fit">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Delete Schedule Snapshot?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong className="text-slate-800">"{deleteTarget.name}"</strong>? This will permanently remove this save file from history.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
