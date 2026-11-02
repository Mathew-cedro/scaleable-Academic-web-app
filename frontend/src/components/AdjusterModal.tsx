import React, { useState } from 'react';
import type {
  ScheduleAssignment,
  Teacher,
  Subject,
  Room,
  ClassSection,
  PeriodSlot,
  DayOfWeek
} from '../types/schedule';
import { DAYS_OF_WEEK } from '../types/schedule';
import { calculateTeacherWorkload } from '../utils/conflictDetector';
import {
  X,
  ArrowLeftRight,
  UserCheck,
  Save,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  Clock,
  Sparkles,
  UserX
} from 'lucide-react';
import { UnassignConfirmModal } from './UnassignConfirmModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetSlot: {
    day: DayOfWeek;
    periodId: string;
    sectionId?: string;
    teacherId?: string;
  } | null;
  currentAssignment?: ScheduleAssignment;
  assignments: ScheduleAssignment[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  sections: ClassSection[];
  periods: PeriodSlot[];
  onSaveAssignment: (assignment: ScheduleAssignment) => void;
  onDeleteAssignment: (id: string) => void;
  onSwapAssignments: (
    slotA: { day: DayOfWeek; periodId: string; sectionId: string },
    slotB: { day: DayOfWeek; periodId: string; sectionId: string }
  ) => void;
}

/**
 * ============================================================================
 * ADJUSTER MODAL COMPONENT
 * ============================================================================
 * How it works:
 * This is the central schedule adjustment dialog supporting three distinct modes:
 *
 * 1. EDIT / ASSIGN MODE:
 *    - Select subject, teacher, section, room, and notes.
 *    - Real-Time Workload Feedback: As the user selects different teachers,
 *      it previews their current loads -> projected loads and alerts if assigning
 *      them this class will trigger an Underload or Overload!
 *
 * 2. QUICK PERIOD SWAP MODE:
 *    - Interchanges the current class with another time slot in the student
 *      section's weekly timetable.
 *
 * 3. SMART SUBSTITUTE / WORKLOAD BALANCER:
 *    - Filters teachers who are FREE during this specific period.
 *    - Prioritizes UNDERLOADED teachers (< 6 loads) at the top so administrators
 *      can easily allocate classes to teachers needing more volume to meet quota.
 * ============================================================================
 */
export const AdjusterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetSlot,
  currentAssignment,
  assignments,
  teachers,
  subjects,
  rooms,
  sections,
  periods,
  onSaveAssignment,
  onDeleteAssignment,
  onSwapAssignments,
}) => {
  if (!isOpen || !targetSlot) return null;

  // Active tab mode inside the modal
  const [activeTab, setActiveTab] = useState<'edit' | 'swap' | 'substitute'>('edit');

  // Form states for Edit / Assign mode
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    currentAssignment?.teacherId || targetSlot.teacherId || teachers[0]?.id || ''
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    currentAssignment?.subjectId || subjects[0]?.id || ''
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    currentAssignment?.sectionId || targetSlot.sectionId || sections[0]?.id || ''
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    currentAssignment?.roomId || rooms[0]?.id || ''
  );
  const [notes, setNotes] = useState<string>(currentAssignment?.notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states for Swap mode
  const [swapDay, setSwapDay] = useState<DayOfWeek>(targetSlot.day);
  const [swapPeriodId, setSwapPeriodId] = useState<string>(
    periods.find(p => p.id !== targetSlot.periodId && !p.isBreak)?.id || periods[0]?.id || ''
  );

  const currentPeriod = periods.find(p => p.id === targetSlot.periodId);

  /**
   * Helper: Calculates how assigning this class will change the selected teacher's load
   */
  const getTeacherWorkloadPreview = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return null;

    const stats = calculateTeacherWorkload(teacher, assignments, periods);
    const isAlreadyAssignedHere = currentAssignment?.teacherId === teacherId;

    // Projected loads if this assignment is confirmed
    let projectedLoads = stats.totalLoads;
    if (!isAlreadyAssignedHere) {
      projectedLoads = stats.totalLoads + 1;
    }

    let projectedStatus: 'underloaded' | 'optimal' | 'overloaded' = 'optimal';
    if (projectedLoads < (teacher.minLoad ?? 6)) {
      projectedStatus = 'underloaded';
    } else if (projectedLoads >= (teacher.overloadLimit ?? 8)) {
      projectedStatus = 'overloaded';
    }

    return {
      currentLoads: stats.totalLoads,
      projectedLoads,
      currentStatus: stats.status,
      projectedStatus,
      teacher,
    };
  };

  const selectedTeacherPreview = getTeacherWorkloadPreview(selectedTeacherId);

  // Handle saving the assignment
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newAssignment: ScheduleAssignment = {
      id: currentAssignment?.id || `as-${Date.now()}`,
      day: targetSlot.day,
      periodId: targetSlot.periodId,
      teacherId: selectedTeacherId,
      subjectId: selectedSubjectId,
      sectionId: selectedSectionId,
      roomId: selectedRoomId,
      notes,
    };
    onSaveAssignment(newAssignment);
    onClose();
  };

  // Handle executing the slot swap
  const handleSwapExecute = () => {
    if (!selectedSectionId) return;
    onSwapAssignments(
      { day: targetSlot.day, periodId: targetSlot.periodId, sectionId: selectedSectionId },
      { day: swapDay, periodId: swapPeriodId, sectionId: selectedSectionId }
    );
    onClose();
  };

  // Handle quick teacher substitution transfer
  const handleQuickSubstitute = (newTeacherId: string) => {
    if (!currentAssignment) return;
    const updated: ScheduleAssignment = {
      ...currentAssignment,
      teacherId: newTeacherId,
    };
    onSaveAssignment(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5CCE3] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F3E5F2] text-[#A91079]">
                <Calendar className="w-3 h-3" />
                {targetSlot.day}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                <Clock className="w-3 h-3" />
                {currentPeriod?.name} ({currentPeriod?.startTime} - {currentPeriod?.endTime})
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              {currentAssignment ? 'Adjust Schedule Slot' : 'Create Class Assignment'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="flex border-b border-[#E5CCE3] bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'edit'
                ? 'border-[#A91079] text-[#A91079]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Save className="w-4 h-4" />
            {currentAssignment ? 'Edit Details' : 'New Class'}
          </button>

          {currentAssignment && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('swap')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
                  activeTab === 'swap'
                    ? 'border-[#A91079] text-[#A91079]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                Quick Period Swap
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('substitute')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
                  activeTab === 'substitute'
                    ? 'border-[#A91079] text-[#A91079]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Substitute / Transfer Teacher
              </button>
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 1: EDIT DETAILS */}
          {activeTab === 'edit' && (
            <form id="assignment-form" onSubmit={handleSave} className="space-y-4">
              {/* Teacher Selection with Workload Alert */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Assign Teacher & Check Workload Impact
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A91079] focus:outline-hidden text-sm bg-white"
                  required
                >
                  {teachers.map(t => {
                    const stats = calculateTeacherWorkload(t, assignments, periods);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.department}) — {stats.totalLoads} loads [
                        {stats.status === 'underloaded' ? '⚠️ Underloaded (<6)' : stats.status === 'overloaded' ? '🚨 Overloaded (8+)' : '🟢 Balanced (6-7)'}
                        ]
                      </option>
                    );
                  })}
                </select>

                {/* Real-time Workload Feedback Box */}
                {selectedTeacherPreview && (
                  <div className={`mt-2 p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    selectedTeacherPreview.projectedStatus === 'overloaded'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : selectedTeacherPreview.projectedStatus === 'underloaded'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    {selectedTeacherPreview.projectedStatus === 'overloaded' && (
                      <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    {selectedTeacherPreview.projectedStatus === 'underloaded' && (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    {selectedTeacherPreview.projectedStatus === 'optimal' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {selectedTeacherPreview.teacher.name}: Currently {selectedTeacherPreview.currentLoads} loads → Projected: {selectedTeacherPreview.projectedLoads} loads
                      </p>
                      <p className="mt-0.5">
                        {selectedTeacherPreview.projectedStatus === 'overloaded' && (
                          <span className="font-medium text-red-700">
                            Warning: This will overload the teacher (≥ 8 classes)! Consider transferring to an underloaded colleague instead.
                          </span>
                        )}
                        {selectedTeacherPreview.projectedStatus === 'underloaded' && (
                          <span>
                            Notice: Still underloaded ({selectedTeacherPreview.projectedLoads}/6 loads). Needs more classes to meet minimum contract quota.
                          </span>
                        )}
                        {selectedTeacherPreview.projectedStatus === 'optimal' && (
                          <span>
                            Optimal workload ({selectedTeacherPreview.projectedLoads} classes, within balanced 6–7 target).
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Subject Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Subject
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A91079] focus:outline-hidden text-sm bg-white"
                    required
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Student Section */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Class Section
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A91079] focus:outline-hidden text-sm bg-white"
                    required
                  >
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Room Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Classroom / Facility
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A91079] focus:outline-hidden text-sm bg-white"
                    required
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.type.replace('-', ' ')} • Cap: {r.capacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Optional Notes / Tag
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Lab experiment, Weekly quiz"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A91079] focus:outline-hidden text-sm"
                  />
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: QUICK SWAP MODE */}
          {activeTab === 'swap' && currentAssignment && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#FDF2FA] border border-[#E5CCE3] rounded-2xl text-xs text-[#2E0249] shadow-2xs">
                <span className="font-bold">Period Swap Assistant:</span> Swaps the current class for{' '}
                <strong>{sections.find(s => s.id === currentAssignment.sectionId)?.name}</strong> with another slot in their weekly schedule.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Swap to Day
                  </label>
                  <select
                    value={swapDay}
                    onChange={(e) => setSwapDay(e.target.value as DayOfWeek)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Swap to Period
                  </label>
                  <select
                    value={swapPeriodId}
                    onChange={(e) => setSwapPeriodId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {periods.filter(p => !p.isBreak).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.startTime} - {p.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Destination preview */}
              {(() => {
                const destAssignment = assignments.find(
                  a => a.day === swapDay && a.periodId === swapPeriodId && a.sectionId === currentAssignment.sectionId
                );
                return (
                  <div className="p-3 rounded-lg border border-[#E5CCE3] bg-slate-50 text-xs">
                    <p className="font-semibold text-slate-700">Destination Slot Status:</p>
                    {destAssignment ? (
                      <p className="mt-1 text-slate-600">
                        Currently occupied by{' '}
                        <strong>{subjects.find(s => s.id === destAssignment.subjectId)?.name}</strong> taught by{' '}
                        {teachers.find(t => t.id === destAssignment.teacherId)?.name}. Executing this swap will interchange both class periods!
                      </p>
                    ) : (
                      <p className="mt-1 text-emerald-700 font-medium">
                        ✓ Empty slot. The class will move to {swapDay} {periods.find(p => p.id === swapPeriodId)?.name}.
                      </p>
                    )}
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleSwapExecute}
                className="w-full py-2.5 px-4 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Execute Slot Swap
              </button>
            </div>
          )}

          {/* TAB 3: SMART SUBSTITUTE & WORKLOAD BALANCER */}
          {activeTab === 'substitute' && currentAssignment && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Smart Workload Balancer:</span>
                  <p className="mt-0.5">
                    Teachers listed below are sorted to prioritize <strong>Underloaded teachers (&lt; 6 loads)</strong> to help balance your faculty.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {teachers
                  .map(teacher => {
                    const stats = calculateTeacherWorkload(teacher, assignments, periods);
                    const isBusyThisPeriod = assignments.some(
                      a => a.teacherId === teacher.id && a.day === targetSlot.day && a.periodId === targetSlot.periodId && a.id !== currentAssignment.id
                    );
                    return { teacher, stats, isBusyThisPeriod };
                  })
                  .sort((a, b) => {
                    // Sort underloaded first, then by ascending load
                    if (a.stats.status === 'underloaded' && b.stats.status !== 'underloaded') return -1;
                    if (b.stats.status === 'underloaded' && a.stats.status !== 'underloaded') return 1;
                    return a.stats.totalLoads - b.stats.totalLoads;
                  })
                  .map(({ teacher, stats, isBusyThisPeriod }) => {
                    const isCurrent = teacher.id === currentAssignment.teacherId;

                    return (
                      <div
                        key={teacher.id}
                        className={`p-3 rounded-lg border flex items-center justify-between text-xs transition ${
                          isCurrent
                            ? 'bg-slate-100 border-slate-300 opacity-60'
                            : isBusyThisPeriod
                            ? 'bg-red-50/50 border-red-200 text-slate-500'
                            : 'bg-white hover:bg-slate-50 border-[#E5CCE3] shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: teacher.color }}
                          />
                          <div>
                            <p className="font-semibold text-slate-800">
                              {teacher.name} {isCurrent && '(Currently Assigned)'}
                            </p>
                            <p className="text-slate-500 text-[11px]">
                              {teacher.department} • {stats.totalLoads} loads
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isBusyThisPeriod && (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                              Busy this period
                            </span>
                          )}

                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            stats.status === 'underloaded'
                              ? 'bg-amber-100 text-amber-800'
                              : stats.status === 'overloaded'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {stats.status === 'underloaded' ? `Underloaded (${stats.totalLoads}/6)` : stats.status === 'overloaded' ? `Overloaded (${stats.totalLoads})` : `Balanced (${stats.totalLoads})`}
                          </span>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleQuickSubstitute(teacher.id)}
                              disabled={isBusyThisPeriod}
                              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                                isBusyThisPeriod
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-[#A91079] hover:bg-[#8F0B66] text-white shadow-2xs'
                              }`}
                            >
                              Transfer
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          {currentAssignment ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              Unassign Teacher
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
            {activeTab === 'edit' && (
              <button
                type="submit"
                form="assignment-form"
                className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {currentAssignment ? 'Save Changes' : 'Create Assignment'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <UnassignConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (currentAssignment) {
            onDeleteAssignment(currentAssignment.id);
            setShowDeleteConfirm(false);
            onClose();
          }
        }}
        teacherName={teachers.find((t) => t.id === currentAssignment?.teacherId)?.name}
        subjectName={subjects.find((s) => s.id === currentAssignment?.subjectId)?.name}
        sectionName={sections.find((s) => s.id === currentAssignment?.sectionId)?.name}
        dayName={targetSlot.day}
        periodName={targetSlot.periodId}
      />
    </div>
  );
};
