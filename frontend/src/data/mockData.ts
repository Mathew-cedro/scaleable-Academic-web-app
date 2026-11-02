import type {
  Teacher,
  Room,
  ClassSection,
  Subject,
  PeriodSlot,
  ScheduleAssignment
} from '../types/schedule';

/**
 * ============================================================================
 * BELL SCHEDULE CONFIGURATION (Periods 1 to 8 + Common Lunch)
 * ============================================================================
 * Standard high school daily schedule:
 * - 8 academic teaching periods (45 mins each)
 * - 1 common midday lunch break (11:15 - 12:00) marked as `isBreak: true`
 *   to ensure no academic classes can be scheduled during lunch.
 * ============================================================================
 */
export const INITIAL_PERIODS: PeriodSlot[] = [
  { id: 'p-1', name: 'Period 1', startTime: '08:00', endTime: '08:45' },
  { id: 'p-2', name: 'Period 2', startTime: '08:50', endTime: '09:35' },
  { id: 'p-3', name: 'Period 3', startTime: '09:40', endTime: '10:25' },
  { id: 'p-4', name: 'Period 4', startTime: '10:30', endTime: '11:15' },
  { id: 'p-lunch', name: 'Lunch Break', startTime: '11:15', endTime: '12:00', isBreak: true },
  { id: 'p-5', name: 'Period 5', startTime: '12:00', endTime: '12:45' },
  { id: 'p-6', name: 'Period 6', startTime: '12:50', endTime: '13:35' },
  { id: 'p-7', name: 'Period 7', startTime: '13:40', endTime: '14:25' },
  { id: 'p-8', name: 'Period 8', startTime: '14:30', endTime: '15:15' },
];

/**
 * ============================================================================
 * FACULTY ROSTER & WORKLOAD QUOTAS
 * ============================================================================
 * Each teacher has:
 * - `minLoad`: 6 (teaching loads below 6 trigger an "Underloaded" warning)
 * - `maxLoad`: 7 (teaching loads between 6 and 7 represent "Balanced / Optimal")
 * - `overloadLimit`: 8 (teaching loads of 8 or more trigger an "Overloaded" conflict)
 * - `color`: A unique hex color badge used to visually distinguish classes on schedules
 * ============================================================================
 */
export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 't-1',
    name: 'Dr. Aris Thorne',
    email: 'a.thorne@highschool.edu',
    department: 'Mathematics',
    color: '#3b82f6', // Blue
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
  {
    id: 't-2',
    name: 'Mrs. Elena Rostova',
    email: 'e.rostova@highschool.edu',
    department: 'English Literature',
    color: '#8b5cf6', // Purple
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
  {
    id: 't-3',
    name: 'Mr. David Chen',
    email: 'd.chen@highschool.edu',
    department: 'Science & Chemistry',
    color: '#10b981', // Emerald
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
  {
    id: 't-4',
    name: 'Ms. Sofia Alcantara',
    email: 's.alcantara@highschool.edu',
    department: 'Social Studies',
    color: '#f59e0b', // Amber
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
  {
    id: 't-5',
    name: 'Coach Marcus Vance',
    email: 'm.vance@highschool.edu',
    department: 'Physical Education',
    color: '#ef4444', // Red
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
  {
    id: 't-6',
    name: 'Mr. Lucas Rivera',
    email: 'l.rivera@highschool.edu',
    department: 'Computer Science',
    color: '#06b6d4', // Cyan
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
  {
    id: 't-7',
    name: 'Mme. Claire Delacroix',
    email: 'c.delacroix@highschool.edu',
    department: 'Foreign Languages',
    color: '#ec4899', // Pink
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
  {
    id: 't-8',
    name: 'Mr. Jonathan Hayes',
    email: 'j.hayes@highschool.edu',
    department: 'Arts & Music',
    color: '#84cc16', // Lime
    minLoad: 6,
    maxLoad: 7,
    overloadLimit: 8,
  },
];

/**
 * ============================================================================
 * SCHOOL ROOMS & SPECIALIZED LAB FACILITIES
 * ============================================================================
 * Classrooms have types (classroom, science-lab, computer-lab, gym).
 * The system validates whether a subject requiring a lab is placed in the right facility.
 * ============================================================================
 */
export const INITIAL_ROOMS: Room[] = [
  { id: 'r-101', name: 'Room 101', type: 'classroom', capacity: 35 },
  { id: 'r-102', name: 'Room 102', type: 'classroom', capacity: 35 },
  { id: 'r-103', name: 'Room 103', type: 'classroom', capacity: 35 },
  { id: 'r-scia', name: 'Science Lab A', type: 'science-lab', capacity: 30 },
  { id: 'r-com1', name: 'Computer Lab 1', type: 'computer-lab', capacity: 32 },
  { id: 'r-gym', name: 'Main Gymnasium', type: 'gym', capacity: 100 },
  { id: 'r-art', name: 'Art Studio', type: 'classroom', capacity: 28 },
];

/**
 * ============================================================================
 * STUDENT CLASS SECTIONS (Grades 9 to 12)
 * ============================================================================
 * Each section represents a cohort of students who attend classes together.
 * Each section also has a designated faculty adviser / homeroom teacher.
 * ============================================================================
 */
export const INITIAL_SECTIONS: ClassSection[] = [
  { id: 'sec-9a', name: 'Grade 9 - Emerald', gradeLevel: 9, adviserTeacherId: 't-1' },
  { id: 'sec-9b', name: 'Grade 9 - Ruby', gradeLevel: 9, adviserTeacherId: 't-2' },
  { id: 'sec-10a', name: 'Grade 10 - Titanium', gradeLevel: 10, adviserTeacherId: 't-3' },
  { id: 'sec-10b', name: 'Grade 10 - Platinum', gradeLevel: 10, adviserTeacherId: 't-4' },
  { id: 'sec-11s', name: 'Grade 11 - STEM', gradeLevel: 11, adviserTeacherId: 't-6' },
  { id: 'sec-12h', name: 'Grade 12 - Humanities', gradeLevel: 12, adviserTeacherId: 't-7' },
];

/**
 * ============================================================================
 * ACADEMIC SUBJECTS
 * ============================================================================
 * Curricula definitions with department tags and required room facilities.
 * ============================================================================
 */
export const INITIAL_SUBJECTS: Subject[] = [
  { id: 'sub-math1', name: 'Algebra I', code: 'MATH-101', department: 'Mathematics', color: '#3b82f6' },
  { id: 'sub-geom', name: 'Geometry & Trig', code: 'MATH-201', department: 'Mathematics', color: '#2563eb' },
  { id: 'sub-eng1', name: 'English Literature 9', code: 'ENG-101', department: 'English Literature', color: '#8b5cf6' },
  { id: 'sub-eng2', name: 'World Literature 10', code: 'ENG-201', department: 'English Literature', color: '#7c3aed' },
  { id: 'sub-chem', name: 'General Chemistry', code: 'SCI-201', department: 'Science & Chemistry', color: '#10b981', roomTypeNeeded: 'science-lab' },
  { id: 'sub-bio', name: 'Biology & Ecology', code: 'SCI-101', department: 'Science & Chemistry', color: '#059669', roomTypeNeeded: 'science-lab' },
  { id: 'sub-hist', name: 'World History', code: 'HIST-101', department: 'Social Studies', color: '#f59e0b' },
  { id: 'sub-pe', name: 'Physical Education & Health', code: 'PE-101', department: 'Physical Education', color: '#ef4444', roomTypeNeeded: 'gym' },
  { id: 'sub-cs', name: 'Computer Programming', code: 'CS-101', department: 'Computer Science', color: '#06b6d4', roomTypeNeeded: 'computer-lab' },
  { id: 'sub-fr', name: 'French Language', code: 'LANG-101', department: 'Foreign Languages', color: '#ec4899' },
  { id: 'sub-art', name: 'Visual Arts', code: 'ART-101', department: 'Arts & Music', color: '#84cc16' },
];

/**
 * ============================================================================
 * SAMPLE SCHEDULE ASSIGNMENTS
 * ============================================================================
 * This dataset seeds the application to illustrate how the workload rules behave:
 *
 * 1. BALANCED TEACHERS (6 to 7 loads):
 *    - Dr. Thorne (t-1): 7 loads  -> 🟢 Balanced
 *    - Mrs. Rostova (t-2): 6 loads -> 🟢 Balanced
 *    - Coach Vance (t-5): 6 loads  -> 🟢 Balanced
 *    - Mr. Rivera (t-6): 6 loads   -> 🟢 Balanced
 *    - Mr. Hayes (t-8): 6 loads    -> 🟢 Balanced
 *
 * 2. OVERLOADED TEACHER (8 loads >= 8 limit):
 *    - Mr. Chen (t-3): 8 loads     -> 🚨 OVERLOADED!
 *      Allows user to test the Adjuster (e.g. transfer or swap a class to another teacher).
 *
 * 3. UNDERLOADED TEACHERS (< 6 loads):
 *    - Ms. Alcantara (t-4): 5 loads -> ⚠️ UNDERLOADED! (Needs 1 more class)
 *    - Mme. Delacroix (t-7): 4 loads -> ⚠️ UNDERLOADED! (Needs 2 more classes)
 * ============================================================================
 */
export const INITIAL_ASSIGNMENTS: ScheduleAssignment[] = [
  // Dr. Aris Thorne (t-1) - 7 loads (Balanced)
  { id: 'as-1', day: 'Monday', periodId: 'p-1', teacherId: 't-1', subjectId: 'sub-math1', sectionId: 'sec-9a', roomId: 'r-101' },
  { id: 'as-2', day: 'Monday', periodId: 'p-2', teacherId: 't-1', subjectId: 'sub-math1', sectionId: 'sec-9b', roomId: 'r-102' },
  { id: 'as-3', day: 'Tuesday', periodId: 'p-1', teacherId: 't-1', subjectId: 'sub-geom', sectionId: 'sec-10a', roomId: 'r-101' },
  { id: 'as-4', day: 'Tuesday', periodId: 'p-3', teacherId: 't-1', subjectId: 'sub-geom', sectionId: 'sec-10b', roomId: 'r-102' },
  { id: 'as-5', day: 'Wednesday', periodId: 'p-2', teacherId: 't-1', subjectId: 'sub-math1', sectionId: 'sec-9a', roomId: 'r-101' },
  { id: 'as-6', day: 'Thursday', periodId: 'p-1', teacherId: 't-1', subjectId: 'sub-geom', sectionId: 'sec-11s', roomId: 'r-101' },
  { id: 'as-7', day: 'Friday', periodId: 'p-2', teacherId: 't-1', subjectId: 'sub-math1', sectionId: 'sec-9b', roomId: 'r-102' },

  // Mrs. Elena Rostova (t-2) - 6 loads (Balanced)
  { id: 'as-8', day: 'Monday', periodId: 'p-3', teacherId: 't-2', subjectId: 'sub-eng1', sectionId: 'sec-9a', roomId: 'r-102' },
  { id: 'as-9', day: 'Tuesday', periodId: 'p-2', teacherId: 't-2', subjectId: 'sub-eng1', sectionId: 'sec-9b', roomId: 'r-103' },
  { id: 'as-10', day: 'Wednesday', periodId: 'p-1', teacherId: 't-2', subjectId: 'sub-eng2', sectionId: 'sec-10a', roomId: 'r-102' },
  { id: 'as-11', day: 'Wednesday', periodId: 'p-3', teacherId: 't-2', subjectId: 'sub-eng2', sectionId: 'sec-10b', roomId: 'r-103' },
  { id: 'as-12', day: 'Thursday', periodId: 'p-2', teacherId: 't-2', subjectId: 'sub-eng1', sectionId: 'sec-9a', roomId: 'r-102' },
  { id: 'as-13', day: 'Friday', periodId: 'p-1', teacherId: 't-2', subjectId: 'sub-eng2', sectionId: 'sec-12h', roomId: 'r-103' },

  // Mr. David Chen (t-3) - 8 loads (OVERLOADED: 8 loads >= 8)
  { id: 'as-14', day: 'Monday', periodId: 'p-4', teacherId: 't-3', subjectId: 'sub-bio', sectionId: 'sec-9a', roomId: 'r-scia' },
  { id: 'as-15', day: 'Monday', periodId: 'p-5', teacherId: 't-3', subjectId: 'sub-chem', sectionId: 'sec-10a', roomId: 'r-scia' },
  { id: 'as-16', day: 'Tuesday', periodId: 'p-4', teacherId: 't-3', subjectId: 'sub-chem', sectionId: 'sec-10b', roomId: 'r-scia' },
  { id: 'as-17', day: 'Tuesday', periodId: 'p-5', teacherId: 't-3', subjectId: 'sub-chem', sectionId: 'sec-11s', roomId: 'r-scia' },
  { id: 'as-18', day: 'Wednesday', periodId: 'p-5', teacherId: 't-3', subjectId: 'sub-bio', sectionId: 'sec-9b', roomId: 'r-scia' },
  { id: 'as-19', day: 'Thursday', periodId: 'p-4', teacherId: 't-3', subjectId: 'sub-chem', sectionId: 'sec-10a', roomId: 'r-scia' },
  { id: 'as-20', day: 'Thursday', periodId: 'p-5', teacherId: 't-3', subjectId: 'sub-chem', sectionId: 'sec-11s', roomId: 'r-scia' },
  { id: 'as-21', day: 'Friday', periodId: 'p-4', teacherId: 't-3', subjectId: 'sub-bio', sectionId: 'sec-9a', roomId: 'r-scia' },

  // Ms. Sofia Alcantara (t-4) - 5 loads (UNDERLOADED: 5 < 6 min)
  { id: 'as-22', day: 'Monday', periodId: 'p-6', teacherId: 't-4', subjectId: 'sub-hist', sectionId: 'sec-9a', roomId: 'r-103' },
  { id: 'as-23', day: 'Tuesday', periodId: 'p-6', teacherId: 't-4', subjectId: 'sub-hist', sectionId: 'sec-9b', roomId: 'r-102' },
  { id: 'as-24', day: 'Wednesday', periodId: 'p-6', teacherId: 't-4', subjectId: 'sub-hist', sectionId: 'sec-10a', roomId: 'r-101' },
  { id: 'as-25', day: 'Thursday', periodId: 'p-6', teacherId: 't-4', subjectId: 'sub-hist', sectionId: 'sec-10b', roomId: 'r-103' },
  { id: 'as-26', day: 'Friday', periodId: 'p-6', teacherId: 't-4', subjectId: 'sub-hist', sectionId: 'sec-12h', roomId: 'r-101' },

  // Coach Marcus Vance (t-5) - 6 loads (Balanced)
  { id: 'as-27', day: 'Monday', periodId: 'p-7', teacherId: 't-5', subjectId: 'sub-pe', sectionId: 'sec-9a', roomId: 'r-gym' },
  { id: 'as-28', day: 'Tuesday', periodId: 'p-7', teacherId: 't-5', subjectId: 'sub-pe', sectionId: 'sec-9b', roomId: 'r-gym' },
  { id: 'as-29', day: 'Wednesday', periodId: 'p-7', teacherId: 't-5', subjectId: 'sub-pe', sectionId: 'sec-10a', roomId: 'r-gym' },
  { id: 'as-30', day: 'Wednesday', periodId: 'p-8', teacherId: 't-5', subjectId: 'sub-pe', sectionId: 'sec-10b', roomId: 'r-gym' },
  { id: 'as-31', day: 'Thursday', periodId: 'p-7', teacherId: 't-5', subjectId: 'sub-pe', sectionId: 'sec-11s', roomId: 'r-gym' },
  { id: 'as-32', day: 'Friday', periodId: 'p-7', teacherId: 't-5', subjectId: 'sub-pe', sectionId: 'sec-12h', roomId: 'r-gym' },

  // Mr. Lucas Rivera (t-6) - 6 loads (Balanced)
  { id: 'as-33', day: 'Monday', periodId: 'p-8', teacherId: 't-6', subjectId: 'sub-cs', sectionId: 'sec-11s', roomId: 'r-com1' },
  { id: 'as-34', day: 'Tuesday', periodId: 'p-8', teacherId: 't-6', subjectId: 'sub-cs', sectionId: 'sec-10a', roomId: 'r-com1' },
  { id: 'as-35', day: 'Thursday', periodId: 'p-3', teacherId: 't-6', subjectId: 'sub-cs', sectionId: 'sec-10b', roomId: 'r-com1' },
  { id: 'as-36', day: 'Thursday', periodId: 'p-8', teacherId: 't-6', subjectId: 'sub-cs', sectionId: 'sec-9a', roomId: 'r-com1' },
  { id: 'as-37', day: 'Friday', periodId: 'p-3', teacherId: 't-6', subjectId: 'sub-cs', sectionId: 'sec-9b', roomId: 'r-com1' },
  { id: 'as-38', day: 'Friday', periodId: 'p-8', teacherId: 't-6', subjectId: 'sub-cs', sectionId: 'sec-12h', roomId: 'r-com1' },

  // Mme. Claire Delacroix (t-7) - 4 loads (UNDERLOADED: 4 < 6 min)
  { id: 'as-39', day: 'Monday', periodId: 'p-2', teacherId: 't-7', subjectId: 'sub-fr', sectionId: 'sec-12h', roomId: 'r-103' },
  { id: 'as-40', day: 'Tuesday', periodId: 'p-3', teacherId: 't-7', subjectId: 'sub-fr', sectionId: 'sec-11s', roomId: 'r-103' },
  { id: 'as-41', day: 'Wednesday', periodId: 'p-4', teacherId: 't-7', subjectId: 'sub-fr', sectionId: 'sec-10a', roomId: 'r-103' },
  { id: 'as-42', day: 'Friday', periodId: 'p-5', teacherId: 't-7', subjectId: 'sub-fr', sectionId: 'sec-10b', roomId: 'r-102' },

  // Mr. Jonathan Hayes (t-8) - 6 loads (Balanced)
  { id: 'as-43', day: 'Monday', periodId: 'p-5', teacherId: 't-8', subjectId: 'sub-art', sectionId: 'sec-9b', roomId: 'r-art' },
  { id: 'as-44', day: 'Tuesday', periodId: 'p-1', teacherId: 't-8', subjectId: 'sub-art', sectionId: 'sec-9a', roomId: 'r-art' },
  { id: 'as-45', day: 'Wednesday', periodId: 'p-1', teacherId: 't-8', subjectId: 'sub-art', sectionId: 'sec-12h', roomId: 'r-art' },
  { id: 'as-46', day: 'Thursday', periodId: 'p-4', teacherId: 't-8', subjectId: 'sub-art', sectionId: 'sec-9b', roomId: 'r-art' },
  { id: 'as-47', day: 'Friday', periodId: 'p-1', teacherId: 't-8', subjectId: 'sub-art', sectionId: 'sec-11s', roomId: 'r-art' },
  { id: 'as-48', day: 'Friday', periodId: 'p-5', teacherId: 't-8', subjectId: 'sub-art', sectionId: 'sec-9a', roomId: 'r-art' },
];
