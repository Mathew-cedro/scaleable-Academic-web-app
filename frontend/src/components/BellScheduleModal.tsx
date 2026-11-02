import React, { useState } from 'react';
import type { PeriodSlot } from '../types/schedule';
import { X, Clock, Plus, Trash2, Check, RotateCcw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  periods: PeriodSlot[];
  onSavePeriods: (periods: PeriodSlot[]) => void;
  onResetPeriods: () => void;
}

/**
 * ============================================================================
 * BELL SCHEDULE CONFIGURATION MODAL
 * ============================================================================
 * How it works:
 * 1. Allows administrators to customize high school bell timings.
 * 2. Features:
 *    - Rename periods (e.g. "Period 1", "Morning Homeroom", "Block A").
 *    - Adjust start time and end time for each period.
 *    - Flag periods as "Lunch / Break" so classes cannot be placed there.
 *    - Add new periods or delete periods (minimum 3 required).
 *    - Reset to standard high school 8-period defaults with 1 click.
 * ============================================================================
 */
export const BellScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  periods,
  onSavePeriods,
  onResetPeriods,
}) => {
  if (!isOpen) return null;

  // Local copy of periods for editing before saving
  const [localPeriods, setLocalPeriods] = useState<PeriodSlot[]>([...periods]);

  const handleUpdate = (index: number, field: keyof PeriodSlot, value: any) => {
    const updated = [...localPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setLocalPeriods(updated);
  };

  const handleAddPeriod = () => {
    const nextNum = localPeriods.filter(p => !p.isBreak).length + 1;
    const newPeriod: PeriodSlot = {
      id: `p-${Date.now()}`,
      name: `Period ${nextNum}`,
      startTime: '15:20',
      endTime: '16:05',
      isBreak: false,
    };
    setLocalPeriods([...localPeriods, newPeriod]);
  };

  const handleDeletePeriod = (index: number) => {
    if (localPeriods.length <= 3) {
      alert('A minimum of 3 periods is required.');
      return;
    }
    const updated = localPeriods.filter((_, i) => i !== index);
    setLocalPeriods(updated);
  };

  const handleSave = () => {
    onSavePeriods(localPeriods);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5CCE3] w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#A91079]" />
            <h2 className="text-base font-bold text-slate-900">Configure Bell Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-3">
          <p className="text-xs text-slate-500">
            Define daily periods, timings, and lunch break intervals. Classes will align with these time slots.
          </p>

          <div className="space-y-2">
            {localPeriods.map((period, idx) => (
              <div
                key={period.id}
                className={`p-3 rounded-xl border flex items-center gap-3 text-xs ${
                  period.isBreak
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-white border-[#E5CCE3] shadow-2xs'
                }`}
              >
                <div className="w-28">
                  <input
                    type="text"
                    value={period.name}
                    onChange={(e) => handleUpdate(idx, 'name', e.target.value)}
                    className="w-full px-2 py-1 font-bold border border-slate-300 rounded focus:ring-1 focus:ring-[#A91079] bg-white"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-slate-500">
                  <input
                    type="time"
                    value={period.startTime}
                    onChange={(e) => handleUpdate(idx, 'startTime', e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-[#A91079] bg-white"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={period.endTime}
                    onChange={(e) => handleUpdate(idx, 'endTime', e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-[#A91079] bg-white"
                  />
                </div>

                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 ml-auto cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!period.isBreak}
                    onChange={(e) => handleUpdate(idx, 'isBreak', e.target.checked)}
                    className="rounded text-[#A91079]"
                  />
                  <span>Lunch/Break</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDeletePeriod(idx)}
                  className="p-1 text-slate-400 hover:text-red-600 transition"
                  title="Delete period"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddPeriod}
            className="w-full py-2 border border-dashed border-slate-300 hover:border-[#A91079] hover:bg-[#FDF2FA]/30 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#A91079] flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Add Another Period
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm('Reset bell schedule to standard default high school 8-period times?')) {
                onResetPeriods();
                onClose();
              }
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save Bell Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
