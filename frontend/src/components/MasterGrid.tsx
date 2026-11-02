import React, { useState } from 'react';
import type {
  ScheduleAssignment,
  Teacher,
  Subject,
  Room,
  ClassSection,
  PeriodSlot,
  DayOfWeek,
  ConflictAlert
} from '../types/schedule';
import { DAYS_OF_WEEK } from '../types/schedule';
import {
  Plus,
  AlertOctagon,
  Clock,
  Layers,
  Users,
  Building
} from 'lucide-react';

interface Props {
  assignments: ScheduleAssignment[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  sections: ClassSection[];
  periods: PeriodSlot[];
  conflicts: ConflictAlert[];
  onSlotClick: (slot: {
    day: DayOfWeek;
    periodId: string;
    sectionId?: string;
    teacherId?: string;
    assignment?: ScheduleAssignment;
  }) => void;
}

/**
 * ============================================================================
 * MASTER GRID TIMETABLE COMPONENT
 * ============================================================================
 * How it works:
 * 1. Filter bar at the top:
 *    - Day selector: View all 5 days or focus on an individual weekday.
 *    - Grouping toggle:
 *      * "By Section": Rows represent student cohorts (Grade 9-A, Grade 10-A, etc.)
 *      * "By Teacher": Rows represent faculty members (Dr. Thorne, Mrs. Rostova, etc.)
 *    - Department filter: Narrow down teachers by academic department.
 *
 * 2. Visual Collision Badges:
 *    - If an assignment has a conflict (double-booking or teacher overload),
 *      the card is outlined in red with a warning icon and tooltip explanation.
 *
 * 3. Interactive Slot Adjuster:
 *    - Clicking any occupied class card opens the Adjuster Modal to edit or swap.
 *    - Clicking an empty slot opens the Adjuster Modal to quickly create a new class.
 * ============================================================================
 */
export const MasterGrid: React.FC<Props> = ({
  assignments,
  teachers,
  subjects,
  rooms,
  sections,
  periods,
  conflicts,
  onSlotClick,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('Monday');
  const [viewGrouping, setViewGrouping] = useState<'section' | 'teacher'>('section');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const departments = Array.from(new Set(teachers.map(t => t.department)));

  // Filter teachers if department filter is active
  const filteredTeachers = teachers.filter(t => 
    departmentFilter === 'all' || t.department === departmentFilter
  );

  // Helper function to find conflicts affecting a specific assignment
  const getAssignmentConflict = (assignmentId: string) => {
    return conflicts.find(c => c.relatedAssignmentIds.includes(assignmentId));
  };

  const activeDays: DayOfWeek[] = selectedDay === 'all' ? DAYS_OF_WEEK : [selectedDay];

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-[#E5CCE3] overflow-hidden flex flex-col">
      {/* Top Filter Bar */}
      <div className="p-4 border-b border-[#E5CCE3] bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
        {/* Weekday Selector */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
          <button
            onClick={() => setSelectedDay('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedDay === 'all'
                ? 'bg-white text-slate-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Week
          </button>
          {DAYS_OF_WEEK.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedDay === day
                  ? 'bg-[#A91079] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* View Mode & Department Filter */}
        <div className="flex items-center gap-2">
          {/* Grouping switch */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setViewGrouping('section')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewGrouping === 'section'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              By Section
            </button>
            <button
              onClick={() => setViewGrouping('teacher')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewGrouping === 'teacher'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              By Teacher
            </button>
          </div>

          {/* Department Filter (Active in Teacher View) */}
          {viewGrouping === 'teacher' && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Grid Content */}
      <div className="overflow-x-auto">
        {activeDays.map(day => (
          <div key={day} className="border-b last:border-b-0 border-[#E5CCE3]">
            {selectedDay === 'all' && (
              <div className="bg-slate-100/80 px-4 py-2 border-y border-[#E5CCE3] text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#A91079]" />
                {day} Schedule Matrix
              </div>
            )}

            <table className="w-full border-collapse min-w-[980px]">
              {/* Header Row: Periods */}
              <thead>
                <tr className="bg-slate-50 border-b border-[#E5CCE3] text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-3 w-44 sticky left-0 bg-slate-50 z-10 border-r border-[#E5CCE3]">
                    {viewGrouping === 'section' ? 'Class Section' : 'Teacher'}
                  </th>
                  {periods.map(period => (
                    <th
                      key={period.id}
                      className={`p-3 text-center border-r border-[#E5CCE3] last:border-r-0 ${
                        period.isBreak ? 'bg-amber-50/50 w-24' : 'min-w-[130px]'
                      }`}
                    >
                      <div className="font-bold text-slate-800">{period.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {period.startTime} - {period.endTime}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Rows */}
              <tbody className="divide-y divide-slate-100 text-xs">
                {viewGrouping === 'section' ? (
                  // Rows grouped by Student Class Section
                  sections.map(section => (
                    <tr key={section.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-semibold text-slate-900 sticky left-0 bg-white z-10 border-r border-[#E5CCE3] shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#FDF2FA]0 shrink-0" />
                          <div>
                            <p className="font-bold">{section.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">Grade {section.gradeLevel}</p>
                          </div>
                        </div>
                      </td>

                      {periods.map(period => {
                        // Render lunch/break separator
                        if (period.isBreak) {
                          return (
                            <td
                              key={period.id}
                              className="p-2 text-center bg-amber-50/30 border-r border-[#E5CCE3] text-amber-700 text-[11px] font-medium"
                            >
                              Lunch
                            </td>
                          );
                        }

                        // Find matching assignment
                        const assignment = assignments.find(
                          a => a.day === day && a.periodId === period.id && a.sectionId === section.id
                        );

                        const subject = assignment ? subjects.find(s => s.id === assignment.subjectId) : null;
                        const teacher = assignment ? teachers.find(t => t.id === assignment.teacherId) : null;
                        const room = assignment ? rooms.find(r => r.id === assignment.roomId) : null;
                        const conflict = assignment ? getAssignmentConflict(assignment.id) : null;

                        return (
                          <td
                            key={period.id}
                            className={`p-1.5 border-r border-[#E5CCE3] last:border-r-0 align-top transition ${
                              conflict ? 'bg-red-50/40' : ''
                            }`}
                          >
                            {assignment ? (
                              <div
                                onClick={() =>
                                  onSlotClick({
                                    day,
                                    periodId: period.id,
                                    sectionId: section.id,
                                    teacherId: assignment.teacherId,
                                    assignment,
                                  })
                                }
                                className={`group relative p-2.5 rounded-xl border cursor-pointer transition shadow-2xs hover:shadow-md ${
                                  conflict
                                    ? 'bg-red-50 border-red-300 hover:border-red-500'
                                    : 'bg-white border-[#E5CCE3] hover:border-[#A91079]'
                                }`}
                              >
                                {conflict && (
                                  <div className="absolute top-1.5 right-1.5 text-red-600" title={conflict.message}>
                                    <AlertOctagon className="w-3.5 h-3.5" />
                                  </div>
                                )}

                                <div className="font-bold text-slate-900 truncate pr-3" title={subject?.name}>
                                  {subject?.name || 'Class'}
                                </div>

                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: teacher?.color || '#94a3b8' }}
                                  />
                                  <span className="truncate">{teacher?.name || 'Teacher'}</span>
                                </div>

                                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Building className="w-2.5 h-2.5" />
                                    {room?.name}
                                  </span>
                                  <span className="opacity-0 group-hover:opacity-100 text-[#A91079] font-semibold transition">
                                    Adjust
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  onSlotClick({
                                    day,
                                    periodId: period.id,
                                    sectionId: section.id,
                                  })
                                }
                                className="w-full h-full min-h-[64px] border border-dashed border-[#E5CCE3] hover:border-[#A91079] hover:bg-[#FDF2FA]/30 rounded-xl flex items-center justify-center text-slate-300 hover:text-[#A91079] transition group"
                                title="Click to assign class"
                              >
                                <Plus className="w-4 h-4 opacity-50 group-hover:opacity-100 transition" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  // Rows grouped by Teacher
                  filteredTeachers.map(teacher => (
                    <tr key={teacher.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-semibold text-slate-900 sticky left-0 bg-white z-10 border-r border-[#E5CCE3] shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: teacher.color }}
                          />
                          <div>
                            <p className="font-bold">{teacher.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">{teacher.department}</p>
                          </div>
                        </div>
                      </td>

                      {periods.map(period => {
                        if (period.isBreak) {
                          return (
                            <td
                              key={period.id}
                              className="p-2 text-center bg-amber-50/30 border-r border-[#E5CCE3] text-amber-700 text-[11px] font-medium"
                            >
                              Lunch
                            </td>
                          );
                        }

                        const assignment = assignments.find(
                          a => a.day === day && a.periodId === period.id && a.teacherId === teacher.id
                        );

                        const subject = assignment ? subjects.find(s => s.id === assignment.subjectId) : null;
                        const section = assignment ? sections.find(s => s.id === assignment.sectionId) : null;
                        const room = assignment ? rooms.find(r => r.id === assignment.roomId) : null;
                        const conflict = assignment ? getAssignmentConflict(assignment.id) : null;

                        return (
                          <td
                            key={period.id}
                            className={`p-1.5 border-r border-[#E5CCE3] last:border-r-0 align-top transition ${
                              conflict ? 'bg-red-50/40' : ''
                            }`}
                          >
                            {assignment ? (
                              <div
                                onClick={() =>
                                  onSlotClick({
                                    day,
                                    periodId: period.id,
                                    teacherId: teacher.id,
                                    sectionId: assignment.sectionId,
                                    assignment,
                                  })
                                }
                                className={`group relative p-2.5 rounded-xl border cursor-pointer transition shadow-2xs hover:shadow-md ${
                                  conflict
                                    ? 'bg-red-50 border-red-300 hover:border-red-500'
                                    : 'bg-white border-[#E5CCE3] hover:border-[#A91079]'
                                }`}
                              >
                                {conflict && (
                                  <div className="absolute top-1.5 right-1.5 text-red-600" title={conflict.message}>
                                    <AlertOctagon className="w-3.5 h-3.5" />
                                  </div>
                                )}

                                <div className="font-bold text-slate-900 truncate pr-3" title={subject?.name}>
                                  {subject?.name}
                                </div>

                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#A91079] font-medium">
                                  <span className="truncate">{section?.name}</span>
                                </div>

                                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                  <span>{room?.name}</span>
                                  <span className="opacity-0 group-hover:opacity-100 text-[#A91079] font-semibold transition">
                                    Adjust
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  onSlotClick({
                                    day,
                                    periodId: period.id,
                                    teacherId: teacher.id,
                                  })
                                }
                                className="w-full h-full min-h-[64px] border border-dashed border-[#E5CCE3] hover:border-[#A91079] hover:bg-[#FDF2FA]/30 rounded-xl flex items-center justify-center text-slate-300 hover:text-[#A91079] transition group"
                                title="Free / Prep Period - Click to assign"
                              >
                                <span className="text-[10px] text-slate-300 group-hover:text-[#A91079] font-medium">
                                  Prep / Free
                                </span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};
