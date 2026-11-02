import { AlertTriangle, Trash2, X } from "lucide-react";

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  current_load_hours: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  departmentName?: string;
  onConfirmDelete: (teacherId: number) => Promise<void>;
  loading: boolean;
}

export const DeleteTeacherModal = ({
  isOpen,
  onClose,
  teacher,
  departmentName,
  onConfirmDelete,
  loading,
}: Props) => {
  if (!isOpen || !teacher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5CCE3] w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-700 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Remove Faculty Member</h3>
              <p className="text-[11px] text-slate-500">Confirm teacher deletion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to remove{" "}
            <strong className="text-slate-900 font-bold">{teacher.name}</strong> (
            {teacher.position}) from the{" "}
            <span className="font-semibold text-[#A91079]">{departmentName || "Department"}</span>{" "}
            roster?
          </p>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Timetable Impact Notice</span>
            </div>
            <p>
              Removing this teacher will unassign their active timetable slots ({teacher.current_load_hours} hrs/week).
              After deletion, please execute <strong>Dynamic Schedule Repair</strong> or <strong>Generate Master</strong> to reassign their loads to qualified faculty.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirmDelete(teacher.id)}
              disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{loading ? "Removing..." : "Confirm Removal"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
