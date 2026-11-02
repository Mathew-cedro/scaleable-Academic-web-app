/**
 * High School Schedule Creator & Adjuster - Type Definitions
 *
 * This module defines the complete data contract for the scheduling engine:
 * 1. Time slots & Bell Schedule (Periods, Breaks, Lunch)
 * 2. Faculty & Workload Rules (< 6 underloaded, 6-7 balanced, >= 8 overloaded)
 * 3. Class Cohorts / Student Sections
 * 4. Rooms and Subject Classifications
 * 5. Schedule Assignments & Real-Time Conflict Alerts
 */

/**
 * Standard 5-day academic school week in high schools.
 */
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * PeriodSlot represents a period in the high school bell schedule.
 * Example: Period 1 (08:00 - 08:45), Lunch (11:15 - 12:00)
 */
export interface PeriodSlot {
  id: string;             // Unique identifier, e.g. "p-1", "p-lunch", "p-8"
  name: string;           // Display title, e.g. "Period 1", "Advisory", "Lunch Break"
  startTime: string;      // Start time in 24-hr format (e.g. "08:00")
  endTime: string;        // End time in 24-hr format (e.g. "08:45")
  isBreak?: boolean;      // When true, classes cannot be scheduled (e.g. lunch or recess)
}

/**
 * Teacher Load Status Classification:
 * - 'underloaded': Teacher has < 6 loads (below minimum required contract teaching volume)
 * - 'optimal': Teacher has 6 to 7 loads (the balanced, compliant target range)
 * - 'overloaded': Teacher has >= 8 loads (exceeds safe limit; triggers overload conflict)
 */
export type TeacherLoadStatus = 'underloaded' | 'optimal' | 'overloaded';

/**
 * Teacher profile and workload quota settings.
 */
export interface Teacher {
  id: string;             // e.g. "t-1"
  name: string;           // Teacher's full name, e.g. "Dr. Aris Thorne"
  email: string;          // School contact email
  department: string;     // Faculty department, e.g. "Mathematics", "Science"
  color: string;          // Hex color used to tag this teacher's classes on schedules
  minLoad: number;        // Default: 6 (Threshold below which teacher is Underloaded)
  maxLoad: number;        // Default: 7 (Upper bound of balanced load)
  overloadLimit: number;  // Default: 8 (Threshold at or above which teacher is Overloaded)
}

/**
 * Physical room or laboratory facility in the school.
 */
export interface Room {
  id: string;             // e.g. "r-101", "r-scia"
  name: string;           // "Room 101", "Science Lab A", "Main Gymnasium"
  type: 'classroom' | 'science-lab' | 'computer-lab' | 'gym' | 'library';
  capacity: number;       // Maximum student seating capacity
}

/**
 * Student Class Section / Cohort.
 * High school students stay together in sections (e.g. Grade 9 - Emerald).
 */
export interface ClassSection {
  id: string;             // e.g. "sec-9a"
  name: string;           // e.g. "Grade 9 - Emerald", "Grade 11 - STEM"
  gradeLevel: 9 | 10 | 11 | 12;
  adviserTeacherId?: string; // Homeroom / advisory teacher
}

/**
 * Academic Subject Curriculum.
 */
export interface Subject {
  id: string;             // e.g. "sub-math1"
  name: string;           // e.g. "Algebra I", "General Chemistry"
  code: string;           // Curriculum code, e.g. "MATH-101"
  department: string;     // Matches teacher department
  color: string;          // Subject visual accent
  roomTypeNeeded?: Room['type']; // Optional facility requirement (e.g. Science Lab)
}

/**
 * ScheduleAssignment connects:
 * (Day + Period) ➔ (Section + Subject + Teacher + Room)
 */
export interface ScheduleAssignment {
  id: string;             // Unique assignment ID, e.g. "as-1"
  day: DayOfWeek;         // Monday .. Friday
  periodId: string;       // References PeriodSlot.id
  teacherId: string;      // References Teacher.id
  subjectId: string;      // References Subject.id
  sectionId: string;      // References ClassSection.id
  roomId: string;         // References Room.id
  isDuty?: boolean;       // Optional non-teaching duty (cafeteria, hall monitor)
  notes?: string;         // Optional administrator notes (e.g. "Lab experiment")
  isLocked?: boolean;     // Pinned slot to protect from automatic swaps
}

/**
 * Severity ranking for timetable conflicts.
 */
export type ConflictSeverity = 'error' | 'warning' | 'info';

/**
 * Conflict classification types:
 * - 'teacher_double_booked': Same teacher booked in multiple classes at the same time
 * - 'room_double_booked': Two classes assigned to the same room at the same time
 * - 'section_double_booked': Student section assigned two classes at the same time
 * - 'teacher_overloaded': Teacher has 8 or more classes (overload conflict)
 * - 'teacher_underloaded': Teacher has fewer than 6 classes (contract deficit warning)
 * - 'consecutive_excess': Teacher has > 4 consecutive teaching periods without break
 * - 'room_mismatch': Class requires special facility (e.g. Lab) but placed in normal room
 */
export type ConflictType = 
  | 'teacher_double_booked'
  | 'room_double_booked'
  | 'section_double_booked'
  | 'teacher_overloaded'
  | 'teacher_underloaded'
  | 'consecutive_excess'
  | 'room_mismatch';

/**
 * ConflictAlert represents an identified scheduling issue.
 */
export interface ConflictAlert {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  message: string;
  relatedAssignmentIds: string[];
  teacherId?: string;
  roomId?: string;
  sectionId?: string;
}

/**
 * Computed statistics and workload metrics for an individual teacher.
 */
export interface TeacherWorkloadStats {
  teacherId: string;
  totalLoads: number;
  status: TeacherLoadStatus;
  dailyLoads: Record<DayOfWeek, number>;
  maxConsecutive: number;
}
