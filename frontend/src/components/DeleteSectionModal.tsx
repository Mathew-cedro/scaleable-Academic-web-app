import { AlertTriangle, Trash2, X } from "lucide-react";

interface Section {
  id: number;
  name: string;
  grade_level: number;
  room_number: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  section: Section | null;
  slotsCount: number;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export const DeleteSectionModal = ({
  isOpen,
  onClose,
  section,
  slotsCount,
  onConfirm,
  loading = false,
}: Props) => {
  if (!isOpen || !section) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 text-red-700 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base font-black text-slate-900 tracking-tight mb-2">
            Delete Section?
          </h3>

          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Are you sure you want to permanently delete section{" "}
            <strong className="text-slate-900 font-bold">"{section.name}"</strong> (Grade {section.grade_level}, {section.room_number})?
          </p>

          {slotsCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-semibold mb-4 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <span>⚠️ Associated Schedule Slots Warning:</span>
              </div>
              <p className="text-[11px] text-amber-800">
                This section currently has <strong>{slotsCount} scheduled periods</strong> in the timetable. Deleting this section will automatically remove all its associated timetable slots.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-red-500/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? "Deleting..." : "Delete Section"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
