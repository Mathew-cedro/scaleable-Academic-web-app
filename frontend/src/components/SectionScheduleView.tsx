import React from 'react';
import type {
  ClassSection,
  ScheduleAssignment,
  Subject,
  Teacher,
  Room,
  PeriodSlot,
  DayOfWeek,
  ConflictAlert
} from '../types/schedule';
import { DAYS_OF_WEEK } from '../types/schedule';
import {
  Users,
  Printer,
  Calendar,
  Building,
  AlertOctagon
} from 'lucide-react';

interface Props {
  sections: ClassSection[];
  assignments: ScheduleAssignment[];
  subjects: Subject[];
  teachers: Teacher[];
  rooms: Room[];
  periods: PeriodSlot[];
  conflicts: ConflictAlert[];
  selectedSectionId: string;
  onSelectSection: (id: string) => void;
  onSlotClick: (slot: {
    day: DayOfWeek;
    periodId: string;
    sectionId: string;
    assignment?: ScheduleAssignment;
  }) => void;
}

/**
 * ============================================================================
 * CLASS SECTION (STUDENT COHORT) TIMETABLE VIEW
 * ============================================================================
 * How it works:
 * 1. Focuses on the student perspective (Grade 9 through Grade 12 cohorts).
 * 2. Displays:
 *    - Section name and grade level
 *    - Faculty Adviser / Homeroom teacher
 *    - Total scheduled academic subjects for the week
 *    - Clean weekly timetable grid (Monday to Friday)
 * 3. Print Ready:
 *    - "Print Section Schedule" outputs a crisp weekly calendar suitable for
 *      posting on classroom doors and bulletin boards.
 * ============================================================================
 */
export const SectionScheduleView: React.FC<Props> = ({
  sections,
  assignments,
  subjects,
  teachers,
  rooms,
  periods,
  conflicts,
  selectedSectionId,
  onSelectSection,
  onSlotClick,
}) => {
  const currentSection = sections.find(s => s.id === selectedSectionId) || sections[0];

  if (!currentSection) {
    return <div className="p-8 text-center text-slate-500">No student sections found.</div>;
  }

  const adviser = teachers.find(t => t.id === currentSection.adviserTeacherId);
  const sectionAssignments = assignments.filter(a => a.sectionId === currentSection.id);
  const sectionConflicts = conflicts.filter(c => c.sectionId === currentSection.id);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Section Header Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#E5CCE3] p-6 print-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#F3E5F2] text-[#A91079] rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <select
                  value={currentSection.id}
                  onChange={(e) => onSelectSection(e.target.value)}
                  className="text-xl font-bold text-slate-900 border-none bg-transparent hover:bg-slate-100 rounded-lg py-0.5 px-1 -ml-1 cursor-pointer focus:ring-2 focus:ring-[#A91079]"
                >
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Grade {s.gradeLevel})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Adviser: <strong className="text-slate-700">{adviser?.name || 'Unassigned'}</strong> •{' '}
                  {sectionAssignments.length} total scheduled weekly subjects
                </p>
              </div>
            </div>
          </div>

          <div className="no-print">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              Print Section Schedule
            </button>
          </div>
        </div>

        {/* Section Clashes Notice */}
        {sectionConflicts.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              Section Clashes Detected ({sectionConflicts.length})
            </div>
            {sectionConflicts.map(c => (
              <p key={c.id} className="text-red-700 pl-5">
                • {c.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Grid */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#E5CCE3] overflow-hidden print-card">
        <div className="p-4 border-b border-[#E5CCE3] bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#A91079]" />
            <h3 className="text-sm font-bold text-slate-800">
              Timetable: {currentSection.name}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Monday to Friday</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-[#E5CCE3] text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3 w-36 border-r border-[#E5CCE3]">Period</th>
                {DAYS_OF_WEEK.map(day => (
                  <th key={day} className="p-3 text-center border-r border-[#E5CCE3] last:border-r-0">
                    <span className="text-slate-800 font-bold">{day}</span>
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
                        🍽️ Lunch Break
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={period.id} className="hover:bg-slate-50/40 transition">
                    <td className="p-3 font-semibold text-slate-800 bg-slate-50/50 border-r border-[#E5CCE3]">
                      <div className="font-bold">{period.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {period.startTime} - {period.endTime}
                      </div>
                    </td>

                    {DAYS_OF_WEEK.map(day => {
                      const assignment = assignments.find(
                        a => a.day === day && a.periodId === period.id && a.sectionId === currentSection.id
                      );

                      const subject = assignment ? subjects.find(s => s.id === assignment.subjectId) : null;
                      const teacher = assignment ? teachers.find(t => t.id === assignment.teacherId) : null;
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
                                  sectionId: currentSection.id,
                                  assignment,
                                })
                              }
                              className="group p-2.5 rounded-xl border border-[#E5CCE3] bg-white hover:border-[#A91079] cursor-pointer transition shadow-2xs hover:shadow-xs"
                            >
                              <div className="font-bold text-slate-900 truncate" title={subject?.name}>
                                {subject?.name}
                              </div>

                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: teacher?.color || '#94a3b8' }}
                                />
                                <span className="truncate">{teacher?.name}</span>
                              </div>

                              <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                                <Building className="w-2.5 h-2.5" />
                                <span>{room?.name}</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                onSlotClick({
                                  day,
                                  periodId: period.id,
                                  sectionId: currentSection.id,
                                })
                              }
                              className="w-full h-full min-h-[58px] p-2 rounded-xl border border-dashed border-[#E5CCE3] hover:border-[#A91079] hover:bg-slate-50 flex items-center justify-center text-slate-300 hover:text-[#A91079] transition"
                              title="Click to schedule class"
                            >
                              <span className="text-[10px] font-medium">+ Add Class</span>
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
