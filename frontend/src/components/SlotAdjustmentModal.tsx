import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  AlertCircle,
  Sparkles,
  Calendar,
  UserPlus,
  CheckCircle2,
  Clock,
  BookOpen,
  GraduationCap,
  UserX,
  Building2,
  Zap,
  Award,
  Search,
  ChevronDown,
  Check,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { UnassignConfirmModal } from "./UnassignConfirmModal";

interface ScheduleSlot {
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

interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
}

interface Subject {
  id: number;
  name: string;
  department_id: number;
  grade_level: number;
  required_weekly_loads: number;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  current_load_hours: number;
  max_daily_hours: number;
  status: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  slot: ScheduleSlot | null;
  emptySlotInfo?: {
    section_id?: number;
    teacher_id?: number;
    day_of_week: number;
    period_index: number;
  } | null;
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  departments: Department[];
  slots: ScheduleSlot[];
  onSaveSlot: (slotData: {
    slot_id?: number;
    section_id: number;
    subject_id: number;
    teacher_id: number;
    day_of_week: number;
    period_index: number;
    allow_room_override?: boolean;
  }) => Promise<void>;
  onUnassignSlot?: (slotId: number) => Promise<void>;
  onQuickAddTeacher?: (teacherData: any) => Promise<Teacher>;
  loading: boolean;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [
  { index: 1, name: "Period 1 (7:00 AM – 8:00 AM)" },
  { index: 2, name: "Period 2 (8:00 AM – 9:00 AM)" },
  { index: 3, name: "Period 3 (9:20 AM – 10:20 AM)" },
  { index: 4, name: "Period 4 (10:20 AM – 11:20 AM)" },
  { index: 5, name: "Period 5 (12:00 PM – 1:00 PM)" },
  { index: 6, name: "Period 6 (1:00 PM – 2:00 PM)" },
  { index: 7, name: "Period 7 (2:00 PM – 3:00 PM)" },
  { index: 8, name: "Period 8 (3:00 PM – 4:00 PM) • Special Track" },
  { index: 9, name: "Period 9 (4:00 PM – 5:00 PM) • Special Track" },
];

export const SlotAdjustmentModal = ({
  isOpen,
  onClose,
  slot,
  emptySlotInfo,
  sections,
  subjects,
  teachers,
  departments,
  slots,
  onSaveSlot,
  onUnassignSlot,
  onQuickAddTeacher,
  loading,
}: Props) => {
  if (!isOpen || (!slot && !emptySlotInfo)) return null;

  // Active target section state
  const [selectedSectionId, setSelectedSectionId] = useState<number>(() => {
    return slot?.section_id ?? emptySlotInfo?.section_id ?? sections[0]?.id ?? 1;
  });

  const currentSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || sections[0];
  }, [sections, selectedSectionId]);

  const currentSectionAdviser = useMemo(() => {
    return teachers.find((t) => t.is_adviser && t.advisory_section_id === currentSection?.id);
  }, [teachers, currentSection]);

  // Section Combobox Dropdown State
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");
  const [sectionGradeFilter, setSectionGradeFilter] = useState<number | "ALL">("ALL");
  const sectionDropdownRef = useRef<HTMLDivElement>(null);
  const sectionSearchInputRef = useRef<HTMLInputElement>(null);

  // Teacher Combobox Dropdown State
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [teacherDeptFilter, setTeacherDeptFilter] = useState<number | "ALL">("ALL");
  const teacherDropdownRef = useRef<HTMLDivElement>(null);
  const teacherSearchInputRef = useRef<HTMLInputElement>(null);

  // Filter subjects for this section's grade level, while keeping all curriculum subjects accessible
  const availableSubjects = useMemo(() => {
    if (!currentSection) return { matching: subjects, others: [] };
    const matching = subjects.filter((sub) => !sub.grade_level || sub.grade_level === currentSection.grade_level || sub.id <= 9);
    const others = subjects.filter((sub) => sub.grade_level && sub.grade_level !== currentSection.grade_level && sub.id > 9);
    return { matching, others };
  }, [subjects, currentSection]);

  const gradeSubjects = useMemo(
    () => [...availableSubjects.matching, ...availableSubjects.others],
    [availableSubjects]
  );

  // Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(() => {
    if (slot) return slot.subject_id;
    return availableSubjects.matching[0]?.id ?? subjects[0]?.id ?? 1;
  });

  const [selectedTeacherId, setSelectedTeacherId] = useState<number>(() => {
    if (slot) return slot.teacher_id;
    if (emptySlotInfo?.teacher_id) return emptySlotInfo.teacher_id;
    // Default to first active teacher or adviser
    const active = teachers.filter((t) => t.status === "Active");
    return active[0]?.id ?? teachers[0]?.id ?? 1;
  });

  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return slot?.day_of_week ?? emptySlotInfo?.day_of_week ?? 0;
  });

  const [selectedPeriod, setSelectedPeriod] = useState<number>(() => {
    return slot?.period_index ?? emptySlotInfo?.period_index ?? 1;
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline "Add Teacher" State
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherDeptId, setNewTeacherDeptId] = useState<number>(departments[0]?.id ?? 1);
  const [newTeacherPosition, setNewTeacherPosition] = useState("Teacher I");
  const [newTeacherMaxDaily, setNewTeacherMaxDaily] = useState(6);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineSuccessNotice, setInlineSuccessNotice] = useState<string | null>(null);

  // Unassign Confirmation Popup State
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  // Room Collision Override State
  const [allowRoomOverride, setAllowRoomOverride] = useState(false);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sectionDropdownRef.current &&
        !sectionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSectionDropdownOpen(false);
      }
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTeacherDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search inputs on open
  useEffect(() => {
    if (isSectionDropdownOpen) {
      setTimeout(() => sectionSearchInputRef.current?.focus(), 50);
    }
  }, [isSectionDropdownOpen]);

  useEffect(() => {
    if (isTeacherDropdownOpen) {
      setTimeout(() => teacherSearchInputRef.current?.focus(), 50);
    }
  }, [isTeacherDropdownOpen]);

  // Sync state when slot or emptySlotInfo changes
  useEffect(() => {
    if (slot) {
      setSelectedSectionId(slot.section_id);
      setSelectedSubjectId(slot.subject_id);
      setSelectedTeacherId(slot.teacher_id);
      setSelectedDay(slot.day_of_week);
      setSelectedPeriod(slot.period_index);
    } else if (emptySlotInfo) {
      if (emptySlotInfo.section_id) {
        setSelectedSectionId(emptySlotInfo.section_id);
      }
      if (emptySlotInfo.teacher_id) {
        setSelectedTeacherId(emptySlotInfo.teacher_id);
      }
      setSelectedDay(emptySlotInfo.day_of_week);
      setSelectedPeriod(emptySlotInfo.period_index);
      if (emptySlotInfo.day_of_week === 0 && emptySlotInfo.period_index === 1) {
        const hrSub = subjects.find((s) => s.name.toLowerCase().includes("homeroom"));
        if (hrSub) {
          setSelectedSubjectId(hrSub.id);
        } else if (gradeSubjects.length > 0) {
          setSelectedSubjectId(gradeSubjects[0].id);
        }
      } else if (emptySlotInfo.teacher_id) {
        const tObj = teachers.find((t) => t.id === emptySlotInfo.teacher_id);
        const deptSub = tObj ? gradeSubjects.find((s) => s.department_id === tObj.department_id) : null;
        if (deptSub) {
          setSelectedSubjectId(deptSub.id);
        } else if (gradeSubjects.length > 0) {
          setSelectedSubjectId(gradeSubjects[0].id);
        }
      } else if (gradeSubjects.length > 0) {
        setSelectedSubjectId(gradeSubjects[0].id);
      }
    }
    setErrorMsg(null);
    setIsAddingTeacher(false);
    setInlineSuccessNotice(null);
    setShowUnassignConfirm(false);
    setUnassigning(false);
    setAllowRoomOverride(false);
    setIsSectionDropdownOpen(false);
    setIsTeacherDropdownOpen(false);
  }, [slot, emptySlotInfo]);

  // Update default inline dept when subject changes
  useEffect(() => {
    const selectedSub = subjects.find((s) => s.id === selectedSubjectId);
    if (selectedSub) {
      setNewTeacherDeptId(selectedSub.department_id);
    }
  }, [selectedSubjectId, subjects]);

  // Active Teachers list
  const activeTeachers = useMemo(() => {
    return teachers.filter((t) => t.status === "Active");
  }, [teachers]);

  // Filtered Sections for Customized Section Combobox
  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      if (sectionGradeFilter !== "ALL" && sec.grade_level !== sectionGradeFilter) {
        return false;
      }
      if (!sectionSearchQuery.trim()) return true;
      const q = sectionSearchQuery.toLowerCase().trim();
      const secAdv = teachers.find(
        (t) => t.is_adviser && t.advisory_section_id === sec.id
      );
      return (
        sec.name.toLowerCase().includes(q) ||
        `grade ${sec.grade_level}`.includes(q) ||
        `g${sec.grade_level}`.includes(q) ||
        sec.program_type.toLowerCase().includes(q) ||
        (sec.room_number && sec.room_number.toLowerCase().includes(q)) ||
        (secAdv && secAdv.name.toLowerCase().includes(q))
      );
    });
  }, [sections, sectionGradeFilter, sectionSearchQuery, teachers]);

  // Filtered Teachers for Customized Faculty Combobox
  const filteredTeachers = useMemo(() => {
    return activeTeachers.filter((t) => {
      if (teacherDeptFilter !== "ALL" && t.department_id !== teacherDeptFilter) {
        return false;
      }
      if (!teacherSearchQuery.trim()) return true;
      const q = teacherSearchQuery.toLowerCase().trim();
      const dept = departments.find((d) => d.id === t.department_id);
      return (
        t.name.toLowerCase().includes(q) ||
        (t.position && t.position.toLowerCase().includes(q)) ||
        (dept && (dept.name.toLowerCase().includes(q) || dept.code.toLowerCase().includes(q)))
      );
    });
  }, [activeTeachers, teacherDeptFilter, teacherSearchQuery, departments]);

  // Section & Teacher select handlers
  const handleSelectSection = (secId: number) => {
    setSelectedSectionId(secId);
    setIsSectionDropdownOpen(false);
    const newSec = sections.find((s) => s.id === secId);
    if (newSec) {
      const newGradeSubjects = subjects.filter((sub) => sub.grade_level === newSec.grade_level || sub.id <= 9);
      if (newGradeSubjects.length > 0 && !newGradeSubjects.some((sub) => sub.id === selectedSubjectId)) {
        setSelectedSubjectId(newGradeSubjects[0].id);
      }
    }
  };

  const handleSelectTeacher = (teachId: number) => {
    setSelectedTeacherId(teachId);
    setIsTeacherDropdownOpen(false);
  };

  // Priority Candidates in selected subject department
  const selectedSubObj = subjects.find((s) => s.id === selectedSubjectId);
  const eligibleDeptTeachers = useMemo(() => {
    if (!selectedSubObj) return activeTeachers;
    return activeTeachers.filter((t) => t.department_id === selectedSubObj.department_id);
  }, [selectedSubObj, activeTeachers]);

  const getRankScore = (position: string): number => {
    const p = (position || "").toLowerCase();
    if (p.includes("master teacher ii") || p.includes("mt-ii")) return 5;
    if (p.includes("master teacher i") || p.includes("mt-i")) return 4;
    if (p.includes("special science") || p.includes("sst") || p.includes("head teacher")) return 3;
    if (p.includes("teacher iii") || p.includes("t-iii")) return 2;
    if (p.includes("teacher ii") || p.includes("t-ii")) return 1;
    return 0;
  };

  const leastLoadedCandidate = useMemo(() => {
    if (eligibleDeptTeachers.length === 0) return null;
    return [...eligibleDeptTeachers].sort((a, b) => a.current_load_hours - b.current_load_hours)[0];
  }, [eligibleDeptTeachers]);

  const highestRankCandidate = useMemo(() => {
    if (eligibleDeptTeachers.length === 0) return null;
    return [...eligibleDeptTeachers].sort((a, b) => getRankScore(b.position) - getRankScore(a.position))[0];
  }, [eligibleDeptTeachers]);

  // Real-time Teacher Conflict Check (is teacher already teaching at this day/period?)
  const teacherConflict = useMemo(() => {
    if (!selectedTeacherId) return null;
    return slots.find(
      (s) =>
        s.teacher_id === selectedTeacherId &&
        s.day_of_week === selectedDay &&
        s.period_index === selectedPeriod &&
        (slot ? s.id !== slot.id : true)
    );
  }, [selectedTeacherId, selectedDay, selectedPeriod, slots, slot]);

  // Real-time Daily Load Check
  const teacherDailyHours = useMemo(() => {
    if (!selectedTeacherId) return 0;
    return slots.filter(
      (s) =>
        s.teacher_id === selectedTeacherId &&
        s.day_of_week === selectedDay &&
        (slot ? s.id !== slot.id : true)
    ).length;
  }, [selectedTeacherId, selectedDay, slots, slot]);

  const selectedTeacherObj = teachers.find((t) => t.id === selectedTeacherId);
  const selectedTeacherDept = selectedTeacherObj
    ? departments.find((d) => d.id === selectedTeacherObj.department_id)
    : null;

  const exceedsDailyCap =
    selectedTeacherObj &&
    teacherDailyHours + 1 > Math.min(selectedTeacherObj.max_daily_hours || 6, 6);

  // Real-time Room Collision Check
  const effectiveTargetRoom = (
    currentSection?.room_number ||
    slot?.room_number ||
    ""
  ).trim();

  const roomCollision = useMemo(() => {
    if (!effectiveTargetRoom) return null;
    return slots.find((s) => {
      if (slot && s.id === slot.id) return false;
      if (s.section_id === selectedSectionId) return false;
      if (s.day_of_week !== selectedDay || s.period_index !== selectedPeriod) return false;
      const otherSecRoom = (
        s.room_number ||
        sections.find((sec) => sec.id === s.section_id)?.room_number ||
        ""
      ).trim();
      return otherSecRoom.toLowerCase() === effectiveTargetRoom.toLowerCase();
    });
  }, [effectiveTargetRoom, slots, slot, selectedSectionId, selectedDay, selectedPeriod, sections]);

  const conflictingSectionObj = useMemo(() => {
    return roomCollision ? sections.find((s) => s.id === roomCollision.section_id) : null;
  }, [roomCollision, sections]);

  const conflictingSubjectObj = useMemo(() => {
    return roomCollision ? subjects.find((s) => s.id === roomCollision.subject_id) : null;
  }, [roomCollision, subjects]);

  const conflictingTeacherObj = useMemo(() => {
    return roomCollision ? teachers.find((t) => t.id === roomCollision.teacher_id) : null;
  }, [roomCollision, teachers]);

  const isLocked = slot?.is_locked || (selectedDay === 0 && selectedPeriod === 1);
  const isMondayHRGP = selectedDay === 0 && selectedPeriod === 1;

  // Handle Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (exceedsDailyCap) {
      setErrorMsg(
        `Workload Cap Violation: ${selectedTeacherObj?.name} cannot exceed ${Math.min(
          selectedTeacherObj?.max_daily_hours || 6,
          6
        )} teaching hours/day. Currently assigned ${teacherDailyHours} hours.`
      );
      return;
    }

    if (roomCollision && !allowRoomOverride) {
      setErrorMsg(
        `Physical Room Collision: Classroom ${effectiveTargetRoom} is already occupied by ${
          conflictingSectionObj?.name || "another section"
        } (${conflictingSubjectObj?.name || "Class"} with ${
          conflictingTeacherObj?.name || "Teacher"
        }) on ${DAYS[selectedDay]} Period ${selectedPeriod}. Please acknowledge by checking the override box below.`
      );
      return;
    }

    try {
      await onSaveSlot({
        slot_id: slot?.id,
        section_id: selectedSectionId,
        subject_id: selectedSubjectId,
        teacher_id: selectedTeacherId,
        day_of_week: selectedDay,
        period_index: selectedPeriod,
        allow_room_override: allowRoomOverride,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to adjust schedule slot");
    }
  };

  // Handle Quick Add Faculty inline
  const handleQuickAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) {
      setErrorMsg("Please enter the teacher's full name.");
      return;
    }
    if (!onQuickAddTeacher) return;

    try {
      setInlineLoading(true);
      setErrorMsg(null);
      const createdTeacher = await onQuickAddTeacher({
        name: newTeacherName.trim(),
        department_id: newTeacherDeptId,
        position: newTeacherPosition,
        max_daily_hours: newTeacherMaxDaily,
        max_weekly_hours: 30,
        status: "Active",
      });

      // Automatically select the newly created teacher
      if (createdTeacher && createdTeacher.id) {
        setSelectedTeacherId(createdTeacher.id);
        setInlineSuccessNotice(`Faculty member ${createdTeacher.name} created and assigned!`);
        setIsAddingTeacher(false);
        setNewTeacherName("");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create teacher");
    } finally {
      setInlineLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#A91079] text-white rounded-2xl shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>{slot ? "Edit Timetable Period" : "Assign New Class Period"}</span>
                {slot?.is_locked && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                    Locked Period
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Real-time conflict validation & timetable compliance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Section Info Card with Customized Search Combobox */}
          <div className="relative" ref={sectionDropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Target Section</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Click to search & switch section</span>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setIsSectionDropdownOpen((prev) => !prev);
                setIsTeacherDropdownOpen(false);
              }}
              className="w-full p-3 rounded-2xl bg-[#FDF2FA]/60 hover:bg-[#FDF2FA] border border-[#E5CCE3] hover:border-[#A91079] flex items-center justify-between text-left transition shadow-2xs cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white border border-[#E5CCE3] text-[#A91079] flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                  G{currentSection?.grade_level || 7}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-900 truncate">
                      {currentSection?.name || "Select Section"}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#F3E5F2] text-[#A91079]">
                      Grade {currentSection?.grade_level}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700">
                      {currentSection?.program_type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{currentSection?.room_number || "Room TBA"}</span>
                    <span>•</span>
                    <span className="truncate">
                      Adviser: {currentSectionAdviser?.name || "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-[#A91079] bg-white px-2 py-0.5 rounded-lg border border-[#E5CCE3] group-hover:border-[#A91079] transition">
                  Change
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isSectionDropdownOpen ? "rotate-180 text-[#A91079]" : ""
                  }`}
                />
              </div>
            </button>

            {/* Floating Dynamic Section Search Dropdown Panel */}
            {isSectionDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-[#E5CCE3] shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search Input */}
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    ref={sectionSearchInputRef}
                    type="text"
                    value={sectionSearchQuery}
                    onChange={(e) => setSectionSearchQuery(e.target.value)}
                    placeholder="Search sections by name, grade, room, adviser..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-[#E5CCE3] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#A91079] focus:bg-white transition"
                  />
                  {sectionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSectionSearchQuery("")}
                      className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Grade Quick Filter Chips */}
                <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSectionGradeFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                      sectionGradeFilter === "ALL"
                        ? "bg-[#A91079] text-white shadow-2xs"
                        : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                    }`}
                  >
                    All ({sections.length})
                  </button>
                  {[7, 8, 9, 10].map((lvl) => {
                    const count = sections.filter((s) => s.grade_level === lvl).length;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSectionGradeFilter(lvl)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                          sectionGradeFilter === lvl
                            ? "bg-[#A91079] text-white shadow-2xs"
                            : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                        }`}
                      >
                        Grade {lvl} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Filtered Sections List */}
                <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pr-1">
                  {filteredSections.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      <SlidersHorizontal className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                      No sections found matching "{sectionSearchQuery}"
                    </div>
                  ) : (
                    filteredSections.map((sec) => {
                      const isSelected = sec.id === selectedSectionId;
                      const secAdviser = teachers.find(
                        (t) => t.is_adviser && t.advisory_section_id === sec.id
                      );

                      return (
                        <div
                          key={sec.id}
                          onClick={() => handleSelectSection(sec.id)}
                          className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-[#FDF2FA] border-[#A91079] text-[#2E0249] shadow-2xs"
                              : "border-transparent hover:bg-slate-50 hover:border-[#E5CCE3] text-slate-700"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs truncate">
                                {sec.name}
                              </span>
                              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 font-semibold text-[10px] rounded">
                                G{sec.grade_level}
                              </span>
                              <span className="px-1.5 py-0.2 bg-[#F3E5F2] text-[#A91079] font-bold text-[10px] rounded">
                                {sec.program_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              <span>{sec.room_number}</span>
                              <span>•</span>
                              <span className="truncate">
                                Adviser: {secAdviser?.name || "Unassigned"}
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#A91079] shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Success / Error Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {inlineSuccessNotice && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{inlineSuccessNotice}</span>
            </div>
          )}

          {/* Conflict Warnings */}
          {teacherConflict && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <strong>Double-Booking Warning:</strong> {selectedTeacherObj?.name} is already teaching{" "}
                <strong>{teacherConflict.section_name}</strong> at this exact time ({DAYS[selectedDay]}, Period {selectedPeriod}).
              </div>
            </div>
          )}

          {exceedsDailyCap && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-300 flex items-start gap-2.5 text-xs text-red-900">
              <Clock className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <strong>Workload Cap:</strong> This assignment would give {selectedTeacherObj?.name}{" "}
                {teacherDailyHours + 1} hours on {DAYS[selectedDay]}. Magna Carta Section 13 mandates a maximum of 6 hours/day.
              </div>
            </div>
          )}

          {/* Physical Room Collision Reminder */}
          {roomCollision && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-950 space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <Building2 className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-rose-900 flex items-center justify-between">
                    <span>Physical Room Clash Warning</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-950 font-mono">
                      {effectiveTargetRoom}
                    </span>
                  </div>
                  <div className="text-rose-900">
                    Room <strong>{effectiveTargetRoom}</strong> is currently scheduled for{" "}
                    <strong>{conflictingSectionObj?.name || "another section"}</strong> (
                    {conflictingSubjectObj?.name || "Class"} with {conflictingTeacherObj?.name || "Teacher"}) on{" "}
                    <strong>{DAYS[selectedDay]}, Period {selectedPeriod}</strong>.
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Scheduling both sections into this physical space at the same time creates a room conflict. If you are conducting joint homeroom, team teaching, or an auditorium assembly, you may authorize an override below.
                  </p>
                </div>
              </div>

              {/* Interactive Override Checkbox */}
              <label className="flex items-center gap-2 pt-2 border-t border-rose-200/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowRoomOverride}
                  onChange={(e) => setAllowRoomOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-rose-900">
                  Acknowledge & Allow Room Sharing / Override (Authorized Dual-Use)
                </span>
              </label>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* DepEd Class Adviser Designation Info Banner for Mon P1 */}
            {isMondayHRGP && (
              <div className="p-3.5 bg-[#FDF2FA] border border-[#E5CCE3] rounded-2xl flex items-start gap-3 shadow-2xs">
                <Award className="w-5 h-5 text-[#A91079] shrink-0 mt-0.5" />
                <div className="text-xs text-[#2E0249] leading-relaxed">
                  <div className="font-extrabold text-[#A91079] mb-0.5">
                    DepEd Official Class Adviser Designation
                  </div>
                  Monday Period 1 (7:00–8:00 AM) is strictly locked for <strong>Homeroom Guidance Program (HRGP)</strong>. Reassigning the faculty member below automatically designates them as the official <strong>Class Adviser</strong> for <strong>{currentSection?.name || "this section"}</strong> across all department timetables and DepEd reports.
                </div>
              </div>
            )}
            {/* Subject Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#A91079]" />
                  <span>Learning Area / Subject</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Weekly load quota
                </span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                disabled={isLocked}
                className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 transition"
              >
                {availableSubjects.matching.length > 0 && (
                  <optgroup label={`Grade ${currentSection?.grade_level || ""} Learning Areas`}>
                    {availableSubjects.matching.map((sub) => {
                      const dept = departments.find((d) => d.id === sub.department_id);
                      return (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} ({dept?.name || "Dept"}) • {sub.required_weekly_loads} hrs/week
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {availableSubjects.others.length > 0 && (
                  <optgroup label="Other Curriculum Subjects & Electives">
                    {availableSubjects.others.map((sub) => {
                      const dept = departments.find((d) => d.id === sub.department_id);
                      return (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} ({dept?.name || "Dept"}) • Grade {sub.grade_level} ({sub.required_weekly_loads} hrs/wk)
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Teacher Selector with Realtime Add Teacher Button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Assigned Faculty Member</span>
                </label>
                {onQuickAddTeacher && (
                  <button
                    type="button"
                    onClick={() => setIsAddingTeacher((prev) => !prev)}
                    className="text-[11px] font-bold text-[#A91079] hover:text-[#2E0249] flex items-center gap-1 transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isAddingTeacher ? "Cancel Add Faculty" : "+ Realtime Add Faculty"}</span>
                  </button>
                )}
              </div>

              {/* Inline Add Teacher Sub-Form */}
              {isAddingTeacher && (
                <div className="mb-3 p-4 rounded-2xl bg-[#FDF2FA]/70 border border-[#E5CCE3] space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-[#E5CCE3] pb-2">
                    <span className="text-xs font-black text-[#2E0249] flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-[#A91079]" />
                      <span>Quick-Register New Faculty Member</span>
                    </span>
                    <span className="text-[10px] text-[#A91079] font-bold uppercase tracking-wider">
                      Instant Sync
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Full Name & Title:
                      </label>
                      <input
                        type="text"
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        placeholder="e.g. Maria Santos, PhD"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Department:
                      </label>
                      <select
                        value={newTeacherDeptId}
                        onChange={(e) => setNewTeacherDeptId(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Position / Rank:
                      </label>
                      <select
                        value={newTeacherPosition}
                        onChange={(e) => setNewTeacherPosition(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                      >
                        <option value="Teacher I">Teacher I</option>
                        <option value="Teacher II">Teacher II</option>
                        <option value="Teacher III">Teacher III</option>
                        <option value="Master Teacher I">Master Teacher I</option>
                        <option value="Master Teacher II">Master Teacher II</option>
                        <option value="Special Science Teacher I">Special Science Teacher I</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Daily Cap (Max 6h/day):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={newTeacherMaxDaily}
                        onChange={(e) => setNewTeacherMaxDaily(Math.min(6, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={inlineLoading}
                      onClick={handleQuickAddTeacherSubmit}
                      className="px-3.5 py-1.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{inlineLoading ? "Registering..." : "Register & Auto-Assign"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Prioritize Actions */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Pick:</span>
                {leastLoadedCandidate && (
                  <button
                    type="button"
                    onClick={() => setSelectedTeacherId(leastLoadedCandidate.id)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                      selectedTeacherId === leastLoadedCandidate.id
                        ? "bg-[#A91079] text-white border-[#A91079] shadow-2xs"
                        : "bg-[#FDF2FA] hover:bg-[#F3E5F2] text-[#A91079] border-[#E5CCE3]"
                    }`}
                    title={`Underloaded teacher: ${leastLoadedCandidate.name} (${leastLoadedCandidate.current_load_hours}h/wk)`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>Least Loaded ({leastLoadedCandidate.current_load_hours}h)</span>
                  </button>
                )}
                {highestRankCandidate && (
                  <button
                    type="button"
                    onClick={() => setSelectedTeacherId(highestRankCandidate.id)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                      selectedTeacherId === highestRankCandidate.id
                        ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                        : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                    }`}
                    title={`Senior faculty: ${highestRankCandidate.name} (${highestRankCandidate.position})`}
                  >
                    <Award className="w-3 h-3" />
                    <span>Highest Rank ({highestRankCandidate.position})</span>
                  </button>
                )}
              </div>

              {/* Customized Faculty Combobox with Search & Department Filters */}
              <div className="relative" ref={teacherDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsTeacherDropdownOpen((prev) => !prev);
                    setIsSectionDropdownOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 hover:border-[#A91079] focus:border-[#A91079] rounded-xl text-left transition shadow-2xs cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#FDF2FA] border border-[#E5CCE3] text-[#A91079] flex items-center justify-center font-bold text-xs shrink-0">
                      {selectedTeacherObj ? selectedTeacherObj.name.charAt(0) : "T"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {selectedTeacherObj ? selectedTeacherObj.name : "Select Faculty Member"}
                        </span>
                        {selectedTeacherDept && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#F3E5F2] text-[#A91079] shrink-0">
                            {selectedTeacherDept.code}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-medium truncate">
                          {selectedTeacherObj?.position}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {selectedTeacherObj && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          selectedTeacherObj.current_load_hours >= 30
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : selectedTeacherObj.current_load_hours < 20
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {selectedTeacherObj.current_load_hours}h/wk
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isTeacherDropdownOpen ? "rotate-180 text-[#A91079]" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Floating Dynamic Teacher Search Dropdown Panel */}
                {isTeacherDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-[#E5CCE3] shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search Input */}
                    <div className="relative mb-2">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        ref={teacherSearchInputRef}
                        type="text"
                        value={teacherSearchQuery}
                        onChange={(e) => setTeacherSearchQuery(e.target.value)}
                        placeholder="Search faculty by name, department, or rank..."
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-[#E5CCE3] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#A91079] focus:bg-white transition"
                      />
                      {teacherSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setTeacherSearchQuery("")}
                          className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Department Quick Filter Chips */}
                    <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setTeacherDeptFilter("ALL")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                          teacherDeptFilter === "ALL"
                            ? "bg-[#A91079] text-white shadow-2xs"
                            : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                        }`}
                      >
                        All ({activeTeachers.length})
                      </button>
                      {departments.map((dept) => {
                        const count = activeTeachers.filter((t) => t.department_id === dept.id).length;
                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => setTeacherDeptFilter(dept.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                              teacherDeptFilter === dept.id
                                ? "bg-[#A91079] text-white shadow-2xs"
                                : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                            }`}
                          >
                            {dept.code} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Filtered Faculty List */}
                    <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pr-1">
                      {filteredTeachers.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          <SlidersHorizontal className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                          No faculty found matching "{teacherSearchQuery}"
                        </div>
                      ) : (
                        filteredTeachers.map((teach) => {
                          const isSelected = teach.id === selectedTeacherId;
                          const tDept = departments.find((d) => d.id === teach.department_id);
                          return (
                            <div
                              key={teach.id}
                              onClick={() => handleSelectTeacher(teach.id)}
                              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? "bg-[#FDF2FA] border-[#A91079] shadow-2xs"
                                  : "bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                    isSelected
                                      ? "bg-[#A91079] text-white"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {teach.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-bold text-xs truncate ${
                                        isSelected ? "text-[#2E0249]" : "text-slate-800"
                                      }`}
                                    >
                                      {teach.name}
                                    </span>
                                    {tDept && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#F3E5F2] text-[#A91079] shrink-0">
                                        {tDept.code}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                                    <span>{teach.position}</span>
                                    <span>•</span>
                                    <span
                                      className={`font-semibold ${
                                        teach.current_load_hours >= 30
                                          ? "text-rose-600"
                                          : teach.current_load_hours < 20
                                          ? "text-emerald-600"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      {teach.current_load_hours}h/wk
                                      {teach.current_load_hours < 20 ? " (Underloaded)" : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {isSelected ? (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#A91079] bg-white px-2 py-0.5 rounded-md border border-[#E5CCE3]">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Selected</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-600">
                                    Select
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Daily teaching load is capped at ≤ 6 hours/day.</span>
                <span className="font-bold text-[#A91079]">
                  Current day load: {teacherDailyHours} hrs
                </span>
              </div>
            </div>

            {/* Time & Day Settings */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Day of Week</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  disabled={isLocked}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 transition"
                >
                  {DAYS.map((day, idx) => (
                    <option key={day} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instructional Period</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                  disabled={isLocked}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 transition"
                >
                  {PERIODS.map((p) => (
                    <option key={p.index} value={p.index}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              {/* Unassign Teacher / Slot Button */}
              {slot && !slot.is_locked && onUnassignSlot ? (
                <button
                  type="button"
                  disabled={loading || unassigning}
                  onClick={() => setShowUnassignConfirm(true)}
                  className="px-3.5 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Unassign teacher from this instructional slot"
                >
                  <UserX className="w-3.5 h-3.5 text-red-600" />
                  <span>Unassign Teacher</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || Boolean(exceedsDailyCap)}
                  className="px-5 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{loading ? "Saving..." : "Save Schedule Slot"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Custom Confirmation Popup for Teacher Unassignment */}
      <UnassignConfirmModal
        isOpen={showUnassignConfirm}
        onClose={() => setShowUnassignConfirm(false)}
        onConfirm={async () => {
          if (!slot || !onUnassignSlot) return;
          try {
            setUnassigning(true);
            await onUnassignSlot(slot.id);
            setShowUnassignConfirm(false);
            onClose();
          } catch (err) {
            console.error("Failed to unassign slot", err);
          } finally {
            setUnassigning(false);
          }
        }}
        teacherName={slot?.teacher_name || selectedTeacherObj?.name}
        subjectName={slot?.subject_name || subjects.find((s) => s.id === selectedSubjectId)?.name}
        sectionName={currentSection?.name}
        dayName={DAYS[selectedDay]}
        periodName={PERIODS.find((p) => p.index === selectedPeriod)?.name}
        roomNumber={slot?.room_number || currentSection?.room_number}
        loading={unassigning}
      />
    </div>
  );
};
