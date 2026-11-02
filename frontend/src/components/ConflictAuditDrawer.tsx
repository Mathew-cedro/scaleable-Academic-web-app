import React, { useState } from 'react';
import type {
  ConflictAlert,
  Teacher,
  PeriodSlot,
  ScheduleAssignment
} from '../types/schedule';
import { calculateTeacherWorkload } from '../utils/conflictDetector';
import { TeacherWorkloadBadge } from './TeacherWorkloadBadge';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  X,
  Filter,
  User,
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ConflictAlert[];
  teachers: Teacher[];
  assignments: ScheduleAssignment[];
  periods: PeriodSlot[];
  onSelectTeacher: (teacherId: string) => void;
  onOpenSlotAdjuster?: (assignmentId: string) => void;
}

/**
 * ============================================================================
 * CONFLICT & WORKLOAD AUDIT DRAWER
 * ============================================================================
 * How it works:
 * 1. Summary Cards at the top:
 *    - Overloaded teachers count (>= 8 classes) -> Red
 *    - Underloaded teachers count (< 6 classes) -> Amber
 *    - Balanced teachers count (6 to 7 classes) -> Emerald
 *    - Double-booking / room clashes count -> Slate/Red
 * 2. Filter Navigation:
 *    - All Alerts: Lists all detected issues across the entire high school
 *    - Workload Rules: Filters only to underloaded and overloaded faculty
 *    - Double-Bookings: Filters only to physical room or teacher double-bookings
 * 3. Quick Resolution:
 *    - Click any teacher to jump into their personal timetable
 *    - Click "Quick Adjust Slot" to open the Adjuster modal directly on the conflicting class
 * ============================================================================
 */
export const ConflictAuditDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  conflicts,
  teachers,
  assignments,
  periods,
  onSelectTeacher,
  onOpenSlotAdjuster,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'workload' | 'collisions'>('all');

  if (!isOpen) return null;

  // Calculate workload summaries across all faculty members
  const workloadSummaries = teachers.map(t => ({
    teacher: t,
    stats: calculateTeacherWorkload(t, assignments, periods),
  }));

  const underloadedCount = workloadSummaries.filter(w => w.stats.status === 'underloaded').length;
  const overloadedCount = workloadSummaries.filter(w => w.stats.status === 'overloaded').length;
  const optimalCount = workloadSummaries.filter(w => w.stats.status === 'optimal').length;
  const collisionCount = conflicts.filter(c => c.type.includes('double_booked')).length;

  // Filter conflicts based on the selected audit tab
  const filteredConflicts = conflicts.filter(c => {
    if (filterType === 'workload') {
      return c.type === 'teacher_overloaded' || c.type === 'teacher_underloaded';
    }
    if (filterType === 'collisions') {
      return c.type.includes('double_booked');
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-fadeIn">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E5CCE3]">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#F3E5F2] text-[#A91079] rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Workload & Conflict Audit
              </h2>
              <p className="text-xs text-slate-500">
                Live compliance monitor for teacher loads and schedule clashes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Metrics */}
        <div className="p-4 bg-slate-50/50 border-b border-[#E5CCE3] grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-red-50 border border-red-200">
            <span className="block text-lg font-bold text-red-700">{overloadedCount}</span>
            <span className="text-[10px] uppercase font-bold text-red-600">Overloaded (≥8)</span>
          </div>

          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
            <span className="block text-lg font-bold text-amber-700">{underloadedCount}</span>
            <span className="text-[10px] uppercase font-bold text-amber-600">Underloaded (&lt;6)</span>
          </div>

          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="block text-lg font-bold text-emerald-700">{optimalCount}</span>
            <span className="text-[10px] uppercase font-bold text-emerald-600">Balanced (6-7)</span>
          </div>

          <div className="p-2 rounded-lg bg-slate-100 border border-slate-300">
            <span className="block text-lg font-bold text-slate-700">{collisionCount}</span>
            <span className="text-[10px] uppercase font-bold text-slate-600">Clashes</span>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E5CCE3] bg-white">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Filter:</span>

          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Alerts ({conflicts.length})
          </button>

          <button
            onClick={() => setFilterType('workload')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              filterType === 'workload'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Workload Rules ({underloadedCount + overloadedCount})
          </button>

          <button
            onClick={() => setFilterType('collisions')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              filterType === 'collisions'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            Double-Bookings ({collisionCount})
          </button>
        </div>

        {/* Audit Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Faculty Workload Breakdown Section */}
          {filterType !== 'collisions' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Teacher Workload Roster (Target: 6–7 Classes)
              </h3>

              <div className="grid grid-cols-1 gap-2">
                {workloadSummaries.map(({ teacher, stats }) => (
                  <div
                    key={teacher.id}
                    onClick={() => {
                      onSelectTeacher(teacher.id);
                      onClose();
                    }}
                    className="p-3 rounded-lg border border-[#E5CCE3] hover:border-[#A91079] bg-white hover:bg-[#FDF2FA]/20 cursor-pointer transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: teacher.color }}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800">{teacher.name}</p>
                        <p className="text-[11px] text-slate-500">{teacher.department}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TeacherWorkloadBadge
                        totalLoads={stats.totalLoads}
                        minLoad={teacher.minLoad}
                        overloadLimit={teacher.overloadLimit}
                        compact
                      />
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Conflict Notices */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Detected Schedule Issues ({filteredConflicts.length})
            </h3>

            {filteredConflicts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-[#E5CCE3]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No issues found in this category!</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  All assignments and workloads meet criteria.
                </p>
              </div>
            ) : (
              filteredConflicts.map(alert => {
                const isOverload = alert.type === 'teacher_overloaded';
                const isUnderload = alert.type === 'teacher_underloaded';
                const isDouble = alert.type.includes('double_booked');

                return (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition ${
                      isOverload || isDouble
                        ? 'bg-red-50/70 border-red-200 text-red-950'
                        : isUnderload
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-[#FDF2FA] border-[#E5CCE3] text-[#2E0249]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        {isOverload && <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />}
                        {isUnderload && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                        {isDouble && <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />}
                        {!isOverload && !isUnderload && !isDouble && <Info className="w-4 h-4 text-[#A91079] shrink-0" />}
                        <span>{alert.title}</span>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        alert.severity === 'error'
                          ? 'bg-red-200 text-red-800'
                          : alert.severity === 'warning'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-[#F3E5F2] text-[#A91079] border border-[#E5CCE3]'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed">{alert.message}</p>

                    <div className="pt-1 flex items-center justify-end gap-2">
                      {alert.teacherId && (
                        <button
                          onClick={() => {
                            onSelectTeacher(alert.teacherId!);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-2xs transition"
                        >
                          View Teacher Timetable
                        </button>
                      )}

                      {alert.relatedAssignmentIds[0] && onOpenSlotAdjuster && (
                        <button
                          onClick={() => {
                            onOpenSlotAdjuster(alert.relatedAssignmentIds[0]);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-[#A91079] hover:bg-[#8F0B66] text-white text-[11px] font-semibold shadow-2xs transition"
                        >
                          Quick Adjust Slot
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[#E5CCE3] bg-slate-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
          >
            Close Audit Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
