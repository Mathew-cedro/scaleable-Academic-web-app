import type {
  Teacher,
  PeriodSlot,
  ScheduleAssignment,
  ConflictAlert,
  TeacherWorkloadStats,
  Subject,
  Room,
  ClassSection,
  DayOfWeek
} from '../types/schedule';
import { DAYS_OF_WEEK } from '../types/schedule';

/**
 * ============================================================================
 * TEACHER WORKLOAD CALCULATOR
 * ============================================================================
 * How it works:
 * 1. Counts total academic class assignments allocated to a teacher.
 * 2. Compares against the workload thresholds:
 *    - totalLoads < 6: Returns 'underloaded' (contract minimum deficit).
 *    - totalLoads >= 8: Returns 'overloaded' (maximum load exceeded; risk of burnout).
 *    - 6 to 7 loads: Returns 'optimal' (compliant, balanced high school load).
 * 3. Analyzes daily load distribution (Monday to Friday).
 * 4. Calculates max consecutive classes without an intervening break/prep period
 *    to prevent fatigue.
 * ============================================================================
 */
export function calculateTeacherWorkload(
  teacher: Teacher,
  assignments: ScheduleAssignment[],
  periods: PeriodSlot[]
): TeacherWorkloadStats {
  // Filter all assignments assigned to this teacher
  // Exclude non-teaching duties from pure academic load count if flagged
  const teacherAssignments = assignments.filter(
    a => a.teacherId === teacher.id && !a.isDuty
  );
  const totalLoads = teacherAssignments.length;

  const min = teacher.minLoad ?? 6;
  const overloadLimit = teacher.overloadLimit ?? 8;

  // Determine workload compliance status
  let status: TeacherWorkloadStats['status'] = 'optimal';
  if (totalLoads < min) {
    status = 'underloaded';
  } else if (totalLoads >= overloadLimit) {
    status = 'overloaded';
  } else {
    status = 'optimal';
  }

  // Calculate daily distribution across Monday to Friday
  const dailyLoads: Record<DayOfWeek, number> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
  };

  teacherAssignments.forEach(a => {
    if (dailyLoads[a.day] !== undefined) {
      dailyLoads[a.day]++;
    }
  });

  // Calculate maximum consecutive teaching blocks without a break/free period
  let maxConsecutive = 0;
  const teachingPeriods = periods.filter(p => !p.isBreak);

  DAYS_OF_WEEK.forEach(day => {
    let currentConsecutive = 0;
    teachingPeriods.forEach(p => {
      const isTeaching = teacherAssignments.some(
        a => a.day === day && a.periodId === p.id
      );
      if (isTeaching) {
        currentConsecutive++;
        if (currentConsecutive > maxConsecutive) {
          maxConsecutive = currentConsecutive;
        }
      } else {
        // Reset count whenever teacher has a free/prep period or break
        currentConsecutive = 0;
      }
    });
  });

  return {
    teacherId: teacher.id,
    totalLoads,
    status,
    dailyLoads,
    maxConsecutive,
  };
}

/**
 * ============================================================================
 * COMPREHENSIVE CONFLICT DETECTION ENGINE
 * ============================================================================
 * How it works:
 * 1. Slot Collision Detection:
 *    Maps every assignment by a combined key: `${day}_${periodId}`.
 *    - If multiple assignments share the same teacher -> Teacher Double-Booking!
 *    - If multiple assignments share the same room -> Room Double-Booking!
 *    - If multiple assignments share the same student section -> Section Overlap!
 *
 * 2. Faculty Workload Rules:
 *    - Evaluates every teacher against the 6-to-8 load limits.
 *    - Teachers with >= 8 loads generate a Red ERROR conflict.
 *    - Teachers with < 6 loads generate an Amber WARNING notice.
 *    - Teachers with > 4 consecutive teaching periods generate a Fatigue WARNING.
 *
 * 3. Physical Facility Validation:
 *    - Checks if subjects needing specialized facilities (e.g. Science Lab)
 *      are placed into normal classrooms.
 * ============================================================================
 */
export function detectAllConflicts(
  assignments: ScheduleAssignment[],
  teachers: Teacher[],
  periods: PeriodSlot[],
  subjects: Subject[],
  rooms: Room[],
  sections: ClassSection[]
): ConflictAlert[] {
  const conflicts: ConflictAlert[] = [];

  // 1. Group assignments into slot buckets (Day + Period)
  const slotMap = new Map<string, ScheduleAssignment[]>();
  assignments.forEach(a => {
    const key = `${a.day}_${a.periodId}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, []);
    }
    slotMap.get(key)!.push(a);
  });

  // 2. Iterate each time slot to identify collisions
  slotMap.forEach((slotAssignments, slotKey) => {
    const [day, periodId] = slotKey.split('_');
    const periodName = periods.find(p => p.id === periodId)?.name || periodId;

    // Check A: Teacher Double-Booking (Same teacher in two places at once)
    const teacherMap = new Map<string, ScheduleAssignment[]>();
    slotAssignments.forEach(a => {
      if (!teacherMap.has(a.teacherId)) teacherMap.set(a.teacherId, []);
      teacherMap.get(a.teacherId)!.push(a);
    });

    teacherMap.forEach((dupes, tId) => {
      if (dupes.length > 1) {
        const teacher = teachers.find(t => t.id === tId);
        const teacherName = teacher ? teacher.name : 'Teacher';
        const sectionNames = dupes
          .map(d => sections.find(s => s.id === d.sectionId)?.name || d.sectionId)
          .join(' and ');

        conflicts.push({
          id: `conflict_teacher_double_${tId}_${slotKey}`,
          type: 'teacher_double_booked',
          severity: 'error',
          title: `Teacher Double-Booked: ${teacherName}`,
          message: `${teacherName} is scheduled for multiple classes (${sectionNames}) on ${day} during ${periodName}.`,
          relatedAssignmentIds: dupes.map(d => d.id),
          teacherId: tId,
        });
      }
    });

    // Check B: Room Double-Booking (Two classes occupying the same physical room)
    const roomMap = new Map<string, ScheduleAssignment[]>();
    slotAssignments.forEach(a => {
      if (!roomMap.has(a.roomId)) roomMap.set(a.roomId, []);
      roomMap.get(a.roomId)!.push(a);
    });

    roomMap.forEach((dupes, rId) => {
      if (dupes.length > 1) {
        const room = rooms.find(r => r.id === rId);
        const roomName = room ? room.name : 'Classroom';
        const teacherNames = dupes
          .map(d => teachers.find(t => t.id === d.teacherId)?.name || 'Teacher')
          .join(' & ');

        conflicts.push({
          id: `conflict_room_double_${rId}_${slotKey}`,
          type: 'room_double_booked',
          severity: 'error',
          title: `Room Double-Booked: ${roomName}`,
          message: `${roomName} is double-booked by ${teacherNames} on ${day} during ${periodName}.`,
          relatedAssignmentIds: dupes.map(d => d.id),
          roomId: rId,
        });
      }
    });

    // Check C: Student Section Overlap (Student cohort scheduled for 2 classes at once)
    const sectionMap = new Map<string, ScheduleAssignment[]>();
    slotAssignments.forEach(a => {
      if (!sectionMap.has(a.sectionId)) sectionMap.set(a.sectionId, []);
      sectionMap.get(a.sectionId)!.push(a);
    });

    sectionMap.forEach((dupes, sId) => {
      if (dupes.length > 1) {
        const sec = sections.find(s => s.id === sId);
        const sectionName = sec ? sec.name : 'Section';
        const subjectNames = dupes
          .map(d => subjects.find(sub => sub.id === d.subjectId)?.name || 'Subject')
          .join(' and ');

        conflicts.push({
          id: `conflict_section_double_${sId}_${slotKey}`,
          type: 'section_double_booked',
          severity: 'error',
          title: `Student Section Overlap: ${sectionName}`,
          message: `${sectionName} has overlapping classes scheduled (${subjectNames}) on ${day} during ${periodName}.`,
          relatedAssignmentIds: dupes.map(d => d.id),
          sectionId: sId,
        });
      }
    });
  });

  // 3. Faculty Workload Rules & Fatigue Checks
  teachers.forEach(teacher => {
    const stats = calculateTeacherWorkload(teacher, assignments, periods);

    // Rule: Overloaded (8+ loads)
    if (stats.status === 'overloaded') {
      conflicts.push({
        id: `conflict_overload_${teacher.id}`,
        type: 'teacher_overloaded',
        severity: 'error',
        title: `Overloaded Teacher: ${teacher.name} (${stats.totalLoads} loads)`,
        message: `${teacher.name} has ${stats.totalLoads} teaching loads assigned (maximum limit is ${teacher.overloadLimit ?? 8}). Please adjust to prevent burnout and ensure prep time.`,
        relatedAssignmentIds: assignments.filter(a => a.teacherId === teacher.id).map(a => a.id),
        teacherId: teacher.id,
      });
    }
    // Rule: Underloaded (< 6 loads)
    else if (stats.status === 'underloaded') {
      const deficit = (teacher.minLoad ?? 6) - stats.totalLoads;
      conflicts.push({
        id: `conflict_underload_${teacher.id}`,
        type: 'teacher_underloaded',
        severity: 'warning',
        title: `Underloaded Teacher: ${teacher.name} (${stats.totalLoads} loads)`,
        message: `${teacher.name} has only ${stats.totalLoads} loads (minimum requirement is ${teacher.minLoad ?? 6} classes). Needs ${deficit} more class assignment(s) to meet contract quota.`,
        relatedAssignmentIds: assignments.filter(a => a.teacherId === teacher.id).map(a => a.id),
        teacherId: teacher.id,
      });
    }

    // Fatigue warning: More than 4 continuous teaching periods without a break
    if (stats.maxConsecutive > 4) {
      conflicts.push({
        id: `conflict_consecutive_${teacher.id}`,
        type: 'consecutive_excess',
        severity: 'warning',
        title: `Consecutive Teaching Fatigue: ${teacher.name}`,
        message: `${teacher.name} is scheduled for ${stats.maxConsecutive} consecutive periods without a break or prep period.`,
        relatedAssignmentIds: assignments.filter(a => a.teacherId === teacher.id).map(a => a.id),
        teacherId: teacher.id,
      });
    }
  });

  // 4. Facility Room Type Compatibility
  assignments.forEach(a => {
    const subject = subjects.find(s => s.id === a.subjectId);
    const room = rooms.find(r => r.id === a.roomId);

    if (subject?.roomTypeNeeded && room && room.type !== subject.roomTypeNeeded) {
      conflicts.push({
        id: `conflict_room_type_${a.id}`,
        type: 'room_mismatch',
        severity: 'info',
        title: `Facility Recommendation: ${subject.name}`,
        message: `${subject.name} recommends a ${subject.roomTypeNeeded.replace('-', ' ')}, but is assigned to ${room.name} (${room.type.replace('-', ' ')}).`,
        relatedAssignmentIds: [a.id],
        roomId: room.id,
      });
    }
  });

  return conflicts;
}
