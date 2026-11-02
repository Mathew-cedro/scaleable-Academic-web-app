/**
 * Schedule Conflict & RA 4670 Workload Detector
 * 
 * Provides real-time in-grid validation for:
 * 1. Teacher Double-Booking (Collision): Same teacher assigned to multiple sections at the same day & period.
 * 2. RA 4670 Daily Overload: Teacher has > 6 actual classroom teaching hours on a single day.
 * 3. Room Collision: Two different sections sharing the same room at the same time.
 * 4. DepEd Table 5 HRGP Adviser Alignment: Monday Period 1 HRGP conducted by someone other than the class adviser.
 */

export interface ScheduleSlot {
  id: number;
  section_id: number;
  subject_id: number;
  teacher_id: number;
  day_of_week: number;
  period_index: number;
  is_locked: boolean;
  section_name?: string;
  subject_name?: string;
  teacher_name?: string;
  department_name?: string;
  room_number?: string;
}

export interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
}

export interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  current_load_hours?: number;
  max_daily_hours?: number;
  is_adviser: boolean;
  advisory_section_id?: number | null;
  status?: string;
}

export interface SlotConflictInfo {
  hasConflict: boolean;
  hasDoubleBooking: boolean;
  hasDailyOverload: boolean;
  hasRoomConflict: boolean;
  hasAdviserMismatch: boolean;
  hasTeacherOnLeave?: boolean;
  severity: "error" | "warning" | "info" | "none";
  badgeLabel: string;
  badgeTooltip: string;
  dailyHours: number;
  conflictingSections: string[];
  roomName?: string;
  conflictingRoomSections?: string[];
}

export interface RoomCollisionIncident {
  roomNumber: string;
  dayOfWeek: number;
  periodIndex: number;
  dayName: string;
  slots: Array<{
    slotId: number;
    sectionId: number;
    sectionName: string;
    subjectName: string;
    teacherName: string;
  }>;
}

const DAYS_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/**
 * Evaluates an individual slot for collisions, overloads, and compliance issues.
 */
export function evaluateSlotConflict(
  slot: ScheduleSlot | null | undefined,
  allSlots: ScheduleSlot[],
  allTeachers: Teacher[],
  allSections: Section[],
  isMondayHRGP: boolean = false
): SlotConflictInfo {
  const result: SlotConflictInfo = {
    hasConflict: false,
    hasDoubleBooking: false,
    hasDailyOverload: false,
    hasRoomConflict: false,
    hasAdviserMismatch: false,
    severity: "none",
    badgeLabel: "",
    badgeTooltip: "",
    dailyHours: 0,
    conflictingSections: [],
  };

  if (!slot) {
    return result;
  }

  const teacher = allTeachers.find((t) => t.id === slot.teacher_id);
  const teacherName = slot.teacher_name || teacher?.name || "Assigned Teacher";
  const dayName = DAYS_NAMES[slot.day_of_week] || `Day ${slot.day_of_week}`;

  // 1. Check for Teacher Double-Booking (CRITICAL ERROR)
  // Look for any other slot at the same day & period index with the same teacher_id but a different section
  const doubleBookedSlots = allSlots.filter(
    (s) =>
      s.id !== slot.id &&
      s.teacher_id === slot.teacher_id &&
      s.day_of_week === slot.day_of_week &&
      s.period_index === slot.period_index &&
      s.section_id !== slot.section_id
  );

  if (doubleBookedSlots.length > 0) {
    result.hasConflict = true;
    result.hasDoubleBooking = true;
    result.severity = "error";
    result.conflictingSections = doubleBookedSlots.map(
      (s) =>
        s.section_name ||
        allSections.find((sec) => sec.id === s.section_id)?.name ||
        `Section #${s.section_id}`
    );
    result.badgeLabel = "Collision";
    result.badgeTooltip = `Double-Booked: ${teacherName} is simultaneously scheduled in ${result.conflictingSections.join(
      ", "
    )} on ${dayName} Period ${slot.period_index}.`;
  }

  // 2. Check for RA 4670 Daily Overload (WARNING)
  // Calculate total teaching hours for this teacher on this day across all sections
  const dailySlots = allSlots.filter(
    (s) => s.teacher_id === slot.teacher_id && s.day_of_week === slot.day_of_week
  );
  result.dailyHours = dailySlots.length;
  const maxAllowed = teacher?.max_daily_hours || 6;

  if (result.dailyHours > maxAllowed) {
    result.hasConflict = true;
    result.hasDailyOverload = true;
    if (result.severity !== "error") {
      result.severity = "warning";
      result.badgeLabel = `>6h Cap (${result.dailyHours}h)`;
      result.badgeTooltip = `Workload Overload: ${teacherName} is scheduled for ${result.dailyHours} teaching hours on ${dayName} (Magna Carta cap is 6 hours/day).`;
    }
  }

  // 3. Check for Room Collision (ERROR)
  const effectiveRoom = (
    slot.room_number ||
    allSections.find((sec) => sec.id === slot.section_id)?.room_number ||
    ""
  ).trim();

  if (effectiveRoom.length > 0) {
    const roomCollisionSlots = allSlots.filter((s) => {
      if (s.id === slot.id || s.section_id === slot.section_id) return false;
      if (s.day_of_week !== slot.day_of_week || s.period_index !== slot.period_index) return false;
      const otherEffectiveRoom = (
        s.room_number ||
        allSections.find((sec) => sec.id === s.section_id)?.room_number ||
        ""
      ).trim();
      return otherEffectiveRoom.toLowerCase() === effectiveRoom.toLowerCase();
    });

    if (roomCollisionSlots.length > 0) {
      result.hasConflict = true;
      result.hasRoomConflict = true;
      result.roomName = effectiveRoom;
      const otherSecs = roomCollisionSlots.map((s) => {
        const sec = allSections.find((sec) => sec.id === s.section_id);
        const sub = s.subject_name || "Class";
        const tch =
          s.teacher_name ||
          allTeachers.find((t) => t.id === s.teacher_id)?.name ||
          "Teacher";
        return `${sec ? sec.name : `Section #${s.section_id}`} (${sub} - ${tch})`;
      });
      result.conflictingRoomSections = otherSecs;

      if (result.hasDoubleBooking) {
        result.badgeLabel = "Teacher & Room Clash";
        result.badgeTooltip += ` Also Room Collision in ${effectiveRoom} occupied by ${otherSecs.join(", ")}.`;
      } else {
        result.severity = "error";
        result.badgeLabel = `Room Clash: ${effectiveRoom}`;
        result.badgeTooltip = `Room Double-Booked: ${effectiveRoom} is simultaneously occupied by ${otherSecs.join(", ")} on ${dayName} Period ${slot.period_index}.`;
      }
    }
  }

  // 4. Check for DepEd Table 5 Monday HRGP Class Adviser Alignment (INFO)
  if (isMondayHRGP || (slot.day_of_week === 0 && slot.period_index === 1)) {
    const sectionAdviser = allTeachers.find(
      (t) => t.is_adviser && t.advisory_section_id === slot.section_id
    );
    if (sectionAdviser && teacher && teacher.id !== sectionAdviser.id) {
      result.hasAdviserMismatch = true;
      if (result.severity === "none") {
        result.hasConflict = true;
        result.severity = "info";
        result.badgeLabel = "Non-Adviser";
        result.badgeTooltip = `DepEd DO 009 Notice: Monday HRGP is officially assigned to Class Adviser (${sectionAdviser.name}).`;
      }
    }
  }

  // 5. Check if Assigned Teacher is On Leave / Unavailable (WARNING)
  if (teacher && teacher.status && teacher.status !== "Active") {
    result.hasTeacherOnLeave = true;
    if (result.severity === "none" || result.severity === "info") {
      result.hasConflict = true;
      result.severity = "warning";
      result.badgeLabel = teacher.status === "Wellness Leave" ? "Wellness Leave" : "On Leave";
      result.badgeTooltip = `Faculty Unavailable: ${teacherName} is currently ${teacher.status}. Substitute assignment or dynamic repair required.`;
    } else {
      result.badgeTooltip += ` (Note: ${teacherName} is currently ${teacher.status})`;
    }
  }

  return result;
}

/**
 * Calculates total schedule health metrics for a given section.
 */
export function getSectionConflictStats(
  sectionId: number,
  allSlots: ScheduleSlot[],
  allTeachers: Teacher[],
  allSections: Section[]
): {
  collisionCount: number;
  overloadCount: number;
  roomCollisionCount: number;
  adviserMismatchCount: number;
  totalIssues: number;
} {
  const sectionSlots = allSlots.filter((s) => s.section_id === sectionId);
  let collisionCount = 0;
  let overloadCount = 0;
  let roomCollisionCount = 0;
  let adviserMismatchCount = 0;

  sectionSlots.forEach((slot) => {
    const info = evaluateSlotConflict(slot, allSlots, allTeachers, allSections);
    if (info.hasDoubleBooking) collisionCount++;
    if (info.hasDailyOverload) overloadCount++;
    if (info.hasRoomConflict) roomCollisionCount++;
    if (info.hasAdviserMismatch) adviserMismatchCount++;
  });

  return {
    collisionCount,
    overloadCount,
    roomCollisionCount,
    adviserMismatchCount,
    totalIssues: collisionCount + overloadCount + roomCollisionCount,
  };
}

/**
 * Returns all room collision incidents across the entire school schedule.
 */
export function getAllRoomConflicts(
  allSlots: ScheduleSlot[],
  allSections: Section[],
  allTeachers: Teacher[]
): RoomCollisionIncident[] {
  const incidentsMap = new Map<string, RoomCollisionIncident>();
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  allSlots.forEach((slot) => {
    const info = evaluateSlotConflict(slot, allSlots, allTeachers, allSections);
    if (info.hasRoomConflict && info.roomName) {
      const incidentKey = `${info.roomName.toLowerCase()}_${slot.day_of_week}_${slot.period_index}`;
      const sec = allSections.find((s) => s.id === slot.section_id);
      const tch = allTeachers.find((t) => t.id === slot.teacher_id);

      if (!incidentsMap.has(incidentKey)) {
        incidentsMap.set(incidentKey, {
          roomNumber: info.roomName,
          dayOfWeek: slot.day_of_week,
          periodIndex: slot.period_index,
          dayName: DAYS[slot.day_of_week] || `Day ${slot.day_of_week}`,
          slots: [],
        });
      }

      const incident = incidentsMap.get(incidentKey)!;
      if (!incident.slots.some((s) => s.slotId === slot.id)) {
        incident.slots.push({
          slotId: slot.id,
          sectionId: slot.section_id,
          sectionName: slot.section_name || sec?.name || `Section #${slot.section_id}`,
          subjectName: slot.subject_name || "Class",
          teacherName: slot.teacher_name || tch?.name || "Teacher",
        });
      }
    }
  });

  return Array.from(incidentsMap.values());
}
