import React, { useEffect, useRef } from "react";
import { UserX, SlidersHorizontal, Lock, Clock, GraduationCap } from "lucide-react";
import type { ScheduleSlot } from "../utils/scheduleConflictChecker";
import { getPeriodHeaders } from "../utils/bellSchedule";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface SlotContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  slot: ScheduleSlot | null;
  durationMinutes?: number;
  onClose: () => void;
  onUnassign: (slot: ScheduleSlot) => void;
  onEdit?: (slot: ScheduleSlot) => void;
}

export const SlotContextMenu: React.FC<SlotContextMenuProps> = ({
  isOpen,
  position,
  slot,
  durationMinutes = 60,
  onClose,
  onUnassign,
  onEdit,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click, escape key, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleScrollOrResize = () => {
      onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !slot) return null;

  // Period header / time
  const periodHeaders = getPeriodHeaders(durationMinutes);
  const periodInfo = periodHeaders.find((p) => p.index === slot.period_index);
  const periodTime = periodInfo?.time || `Period ${slot.period_index}`;
  const dayName = DAYS[slot.day_of_week] || `Day ${slot.day_of_week + 1}`;

  const isLocked = Boolean(slot.is_locked);

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
      className="fixed z-[100] w-72 bg-white rounded-2xl shadow-2xl border border-[#E5CCE3] p-1.5 animate-in fade-in zoom-in-95 duration-100 select-none text-slate-800"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header Info Banner */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-[#2E0249] to-[#570A57] text-white space-y-1 mb-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
            {slot.subject_name || "Instructional Period"}
          </span>
          {isLocked && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-200 bg-amber-500/30 px-1.5 py-0.5 rounded-md border border-amber-300/30">
              <Lock className="w-2.5 h-2.5" />
              <span>Locked</span>
            </span>
          )}
        </div>

        <div className="pt-0.5">
          <div className="text-xs font-black truncate">
            {slot.teacher_name || "Assigned Faculty"}
          </div>
          {slot.department_name && (
            <div className="text-[10px] text-pink-200/90 font-medium truncate">
              {slot.department_name}
            </div>
          )}
        </div>

        <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-pink-100 font-medium">
          <span className="flex items-center gap-1 truncate">
            <GraduationCap className="w-3 h-3 text-pink-300 shrink-0" />
            <span className="truncate">{slot.section_name || "Section"}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0 text-white font-bold" title={periodTime}>
            <Clock className="w-3 h-3 text-pink-300 shrink-0" />
            <span>{dayName} • {periodTime}</span>
          </span>
        </div>
      </div>

      {/* Menu Actions */}
      <div className="space-y-0.5">
        {/* Unassign Teacher Option */}
        <button
          type="button"
          disabled={isLocked}
          onClick={() => {
            if (isLocked) return;
            onUnassign(slot);
          }}
          className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-3 cursor-pointer group ${
            isLocked
              ? "opacity-50 cursor-not-allowed bg-slate-50"
              : "hover:bg-rose-50 hover:border-rose-200 border border-transparent"
          }`}
          title={
            isLocked
              ? "Homeroom Guidance Program is locked to the class adviser and cannot be unassigned."
              : "Unassign faculty member from this scheduled slot"
          }
        >
          <div
            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              isLocked
                ? "bg-slate-200 text-slate-500"
                : "bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition"
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div
              className={`text-xs font-bold leading-tight ${
                isLocked
                  ? "text-slate-500"
                  : "text-rose-700 group-hover:text-rose-900"
              }`}
            >
              Unassign Teacher
            </div>
            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
              {isLocked
                ? "Locked Period (HRGP) • Cannot unassign"
                : `Remove ${slot.teacher_name || "teacher"} from this period`}
            </div>
          </div>
        </button>

        {/* Edit Period Option */}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(slot)}
            className="w-full text-left p-2.5 rounded-xl hover:bg-[#FDF2FA] hover:border-[#E5CCE3] border border-transparent transition flex items-start gap-3 cursor-pointer group"
          >
            <div className="p-2 rounded-lg bg-[#F3E5F2] text-[#A91079] group-hover:bg-[#A91079] group-hover:text-white transition shrink-0 mt-0.5">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 group-hover:text-[#2E0249] leading-tight">
                Edit Slot Settings
              </div>
              <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                Switch section, teacher, subject, or time
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Footer hint */}
      <div className="mt-1 px-2.5 py-1 text-[9px] text-slate-400 font-medium flex items-center justify-between border-t border-slate-100">
        <span>Press ESC to dismiss</span>
        <span className="font-semibold text-[#A91079]">DepEd SchedMaster</span>
      </div>
    </div>
  );
};
