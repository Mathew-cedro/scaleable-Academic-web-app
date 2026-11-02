import { UserX, AlertTriangle, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  teacherName?: string;
  subjectName?: string;
  sectionName?: string;
  dayName?: string;
  periodName?: string;
  roomNumber?: string;
  loading?: boolean;
}

export const UnassignConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  teacherName,
  subjectName,
  sectionName,
  dayName,
  periodName,
  roomNumber,
  loading = false,
}: Props) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6">
          {/* Header Icon & Close */}
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 text-red-700 rounded-2xl">
              <UserX className="w-6 h-6" />
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title & Description */}
          <h3 className="text-base font-black text-slate-900 tracking-tight mb-2">
            Unassign Faculty Member?
          </h3>

          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Are you sure you want to unassign{" "}
            <strong className="text-slate-900 font-bold">
              "{teacherName || "Assigned Teacher"}"
            </strong>{" "}
            from this instructional class period?
          </p>

          {/* Slot Context Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Subject</span>
              <span className="font-extrabold text-slate-900">{subjectName || "Subject"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Class Section</span>
              <span className="font-bold text-slate-800">{sectionName || "Section"}</span>
            </div>
            {(dayName || periodName) && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Schedule</span>
                <span className="font-semibold text-slate-700">
                  {dayName} • {periodName}
                </span>
              </div>
            )}
            {roomNumber && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Room</span>
                <span className="font-semibold text-slate-700">{roomNumber}</span>
              </div>
            )}
          </div>

          {/* Impact Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-semibold mb-5 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              This period will become <strong>Vacant</strong> in the timetable, and the teacher's weekly workload will decrease by 1 hour.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              Keep Assigned
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-red-500/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserX className="w-4 h-4" />
              <span>{loading ? "Unassigning..." : "Confirm Unassignment"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
