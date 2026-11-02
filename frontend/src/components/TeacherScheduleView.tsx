import React from 'react';
import type {
  Teacher,
  ScheduleAssignment,
  Subject,
  Room,
  ClassSection,
  PeriodSlot,
  DayOfWeek,
  ConflictAlert
} from '../types/schedule';
import { DAYS_OF_WEEK } from '../types/schedule';
import { calculateTeacherWorkload } from '../utils/conflictDetector';
import { TeacherWorkloadBadge } from './TeacherWorkloadBadge';
import {
  Mail,
  BookOpen,
  Printer,
  Calendar,
  Building,
  Coffee,
  AlertOctagon
} from 'lucide-react';

interface Props {
  teachers: Teacher[];
  assignments: ScheduleAssignment[];
  subjects: Subject[];
  rooms: Room[];
  sections: ClassSection[];
  periods: PeriodSlot[];
  conflicts: ConflictAlert[];
  selectedTeacherId: string;
  onSelectTeacher: (id: string) => void;
  onSlotClick: (slot: {
    day: DayOfWeek;
    periodId: string;
    teacherId: string;
    assignment?: ScheduleAssignment;
  }) => void;
}

/**
 * ============================================================================
 * TEACHER PERSONAL TIMETABLE VIEW
 * ============================================================================
 * How it works:
 * 1. Dedicated view designed for faculty members to inspect their weekly schedule.
 * 2. Teacher Profile Card:
 *    - Displays teacher details (department, email, assigned rooms).
 *    - Live Teaching Load Gauge:
 *      * Shows total weekly classes vs the 6-to-8 load limits.
 *      * Alerts if Underloaded (<6) or Overloaded (>=8).
 *      * Counts prep periods guaranteed during the week.
 * 3. 5-Day Grid:
 *    - Monday to Friday periods.
 *    - Free periods are clearly labeled as "☕ Prep Period" with a quick-assign option.
 * 4. Print Ready:
 *    - Clicking "Print Timetable" triggers a clean printable version optimized for paper.
 * ============================================================================
 */
export const TeacherScheduleView: React.FC<Props> = ({
  teachers,
  assignments,
  subjects,
  rooms,
  sections,
  periods,
  conflicts,
  selectedTeacherId,
  onSelectTeacher,
  onSlotClick,
}) => {
  const currentTeacher = teachers.find(t => t.id === selectedTeacherId) || teachers[0];

  if (!currentTeacher) {
    return <div className="p-8 text-center text-slate-500">No teachers found.</div>;
  }

  // Calculate teacher's workload statistics and any active conflict alerts
  const workload = calculateTeacherWorkload(currentTeacher, assignments, periods);
  const teacherConflicts = conflicts.filter(c => c.teacherId === currentTeacher.id);

  // Distinct rooms used by this teacher
  const teacherRooms = Array.from(
    new Set(
      assignments
        .filter(a => a.teacherId === currentTeacher.id)
        .map(a => rooms.find(r => r.id === a.roomId)?.name)
        .filter(Boolean)
    )
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Teacher Profile & Workload Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#E5CCE3] p-6 print-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Avatar, Name & Selector */}
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-xs shrink-0"
              style={{ backgroundColor: currentTeacher.color }}
            >
              {currentTeacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={currentTeacher.id}
                  onChange={(e) => onSelectTeacher(e.target.value)}
                  className="text-xl font-bold text-slate-900 border-none bg-transparent hover:bg-slate-100 rounded-lg py-0.5 px-1 -ml-1 cursor-pointer focus:ring-2 focus:ring-[#A91079]"
                >
                  {teachers.map(t => {
                    const st = calculateTeacherWorkload(t, assignments, periods);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({st.totalLoads} loads - {st.status})
                      </option>
                    );
                  })}
                </select>

                <TeacherWorkloadBadge
                  totalLoads={workload.totalLoads}
                  minLoad={currentTeacher.minLoad}
                  overloadLimit={currentTeacher.overloadLimit}
                  compact
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <BookOpen className="w-3.5 h-3.5 text-[#A91079]" />
                  {currentTeacher.department}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {currentTeacher.email}
                </span>
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Rooms: {teacherRooms.join(', ') || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Print Action */}
          <div className="flex items-center gap-2 no-print self-end lg:self-center">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              Print Timetable
            </button>
          </div>
        </div>

        {/* Detailed Workload Status Banner */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <TeacherWorkloadBadge
              totalLoads={workload.totalLoads}
              minLoad={currentTeacher.minLoad}
              overloadLimit={currentTeacher.overloadLimit}
              showBar
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-[#E5CCE3]">
              <span className="block text-base font-bold text-slate-800">
                {workload.totalLoads} / 5 days
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Classes</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-[#E5CCE3]">
              <span className="block text-base font-bold text-slate-800">
                {periods.filter(p => !p.isBreak).length * 5 - workload.totalLoads}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Prep / Free Periods</span>
            </div>
          </div>
        </div>

        {/* Active Conflict Warning Banner */}
        {teacherConflicts.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              Schedule Attention Required ({teacherConflicts.length})
            </div>
            {teacherConflicts.map(c => (
              <p key={c.id} className="text-red-700 pl-5">
                • {c.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* 5-Day Weekly Timetable Grid */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#E5CCE3] overflow-hidden print-card">
        <div className="p-4 border-b border-[#E5CCE3] bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#A91079]" />
            <h3 className="text-sm font-bold text-slate-800">
              Weekly Timetable: {currentTeacher.name}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Monday through Friday
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-[#E5CCE3] text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3 w-36 border-r border-[#E5CCE3]">Time / Period</th>
                {DAYS_OF_WEEK.map(day => (
                  <th key={day} className="p-3 text-center border-r border-[#E5CCE3] last:border-r-0">
                    <div className="text-slate-800 font-bold">{day}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {workload.dailyLoads[day]} {workload.dailyLoads[day] === 1 ? 'class' : 'classes'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {periods.map(period => {
                if (period.isBreak) {
                  return (
                    <tr key={period.id} className="bg-amber-50/40 text-center">
                      <td className="p-2.5 font-bold text-amber-800 border-r border-[#E5CCE3] text-xs">
                        {period.name}
                        <div className="text-[10px] text-amber-600 font-normal">
                          {period.startTime} - {period.endTime}
                        </div>
                      </td>
                      <td colSpan={5} className="p-2 text-xs font-semibold text-amber-700 tracking-wide">
                        🍽️ School-wide Lunch & Common Passing Time
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={period.id} className="hover:bg-slate-50/40 transition">
                    {/* Period header */}
                    <td className="p-3 font-semibold text-slate-800 bg-slate-50/50 border-r border-[#E5CCE3]">
                      <div className="font-bold">{period.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {period.startTime} - {period.endTime}
                      </div>
                    </td>

                    {/* Days columns */}
                    {DAYS_OF_WEEK.map(day => {
                      const assignment = assignments.find(
                        a => a.day === day && a.periodId === period.id && a.teacherId === currentTeacher.id
                      );

                      const subject = assignment ? subjects.find(s => s.id === assignment.subjectId) : null;
                      const section = assignment ? sections.find(s => s.id === assignment.sectionId) : null;
                      const room = assignment ? rooms.find(r => r.id === assignment.roomId) : null;

                      return (
                        <td
                          key={day}
                          className="p-1.5 border-r border-[#E5CCE3] last:border-r-0 align-top"
                        >
                          {assignment ? (
                            <div
                              onClick={() =>
                                onSlotClick({
                                  day,
                                  periodId: period.id,
                                  teacherId: currentTeacher.id,
                                  assignment,
                                })
                              }
                              className="group relative p-2.5 rounded-xl border border-[#E5CCE3] bg-[#FDF2FA]/40 hover:bg-[#F3E5F2]/60 cursor-pointer transition shadow-2xs hover:shadow-xs"
                            >
                              <div className="font-bold text-slate-900 truncate" title={subject?.name}>
                                {subject?.name}
                              </div>

                              <div className="mt-1 flex items-center justify-between text-[11px] text-[#A91079] font-semibold">
                                <span>{section?.name}</span>
                                <span className="text-[10px] text-slate-500 font-normal">{room?.name}</span>
                              </div>

                              <div className="mt-1 flex items-center justify-end text-[10px] text-[#A91079] font-bold opacity-0 group-hover:opacity-100 transition no-print">
                                Adjust Class
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                onSlotClick({
                                  day,
                                  periodId: period.id,
                                  teacherId: currentTeacher.id,
                                })
                              }
                              className="w-full h-full min-h-[58px] p-2 rounded-xl border border-dashed border-[#E5CCE3] hover:border-[#A91079] hover:bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:text-[#A91079] transition group"
                              title="Free / Prep Period - Click to schedule"
                            >
                              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-[#A91079]">
                                <Coffee className="w-3 h-3 text-slate-300 group-hover:text-[#A91079]" />
                                <span>Prep Period</span>
                              </div>
                              <span className="text-[9px] text-slate-300 group-hover:text-[#A91079] opacity-0 group-hover:opacity-100 transition no-print">
                                + Assign
                              </span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
