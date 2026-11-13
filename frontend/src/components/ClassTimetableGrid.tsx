import { useState, useMemo, useRef, useEffect } from "react";
import { getPeriodRows, loadCustomBreakTimings, type CustomBreakTimings } from "../utils/bellSchedule";
import {
  GraduationCap,
  Printer,
  ChevronDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  Sparkles,
  MapPin,
  SlidersHorizontal,
  Plus,
  UserPlus,
  AlertTriangle,
  ShieldCheck,
  Building,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "../api/client";
import { ExportDocxModal } from "./ExportDocxModal";
import { ImportSectionScheduleModal } from "./ImportSectionScheduleModal";
import {
  evaluateSlotConflict,
  getSectionConflictStats
} from "../utils/scheduleConflictChecker";
import { useLanguage } from "../context/LanguageContext";

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

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
  status?: string;
}

interface Props {
  sections: Section[];
  selectedSectionId: number;
  onSelectSection: (sectionId: number) => void;
  slots: ScheduleSlot[];
  teachers: Teacher[];
  durationMinutes?: number;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onSlotContextMenu?: (slot: ScheduleSlot, e: React.MouseEvent) => void;
  onEmptySlotClick?: (sectionId: number, day: number, period: number) => void;
  onAddTeacher?: () => void;
  onChangeAdviser?: (sectionId: number, teacherId: number) => Promise<void>;
  onRefreshData?: () => void;
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

export const ClassTimetableGrid = ({
  sections,
  selectedSectionId,
  onSelectSection,
  slots,
  teachers,
  durationMinutes = 60,
  onSlotClick,
  onSlotContextMenu,
  onEmptySlotClick,
  onAddTeacher,
  onChangeAdviser,
  onRefreshData,
}: Props) => {
  const { t, isTagalog } = useLanguage();
  // Search and filter states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [inTableSearch, setInTableSearch] = useState("");

  const [isAdviserDropdownOpen, setIsAdviserDropdownOpen] = useState(false);
  const [adviserSearch, setAdviserSearch] = useState("");
  const [isUpdatingAdviser, setIsUpdatingAdviser] = useState(false);

  // Export Docx & SF-7 Modal State
  const [isExportDocxModalOpen, setIsExportDocxModalOpen] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingSF7, setIsExportingSF7] = useState(false);
  const [isImportScheduleExcelOpen, setIsImportScheduleExcelOpen] = useState(false);

  const handleExportSF7 = async () => {
    setIsExportingSF7(true);
    try {
      const blob = await api.exportSF7Excel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SF7_PGCHS_School_Personnel_Assignment_2026-2027.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Failed to export DepEd SF-7: " + (err.message || "Unknown error"));
    } finally {
      setIsExportingSF7(false);
    }
  };
  const [customBreaks, setCustomBreaks] = useState<CustomBreakTimings>(loadCustomBreakTimings());

  useEffect(() => {
    const handleBreaksUpdated = (e: any) => {
      if (e.detail) setCustomBreaks(e.detail);
    };
    window.addEventListener("schedmaster_bell_breaks_updated", handleBreaksUpdated);
    return () => {
      window.removeEventListener("schedmaster_bell_breaks_updated", handleBreaksUpdated);
    };
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const adviserDropdownRef = useRef<HTMLDivElement>(null);

  // Close adviser dropdown on click outside
  useEffect(() => {
    const handleAdviserClickOutside = (event: MouseEvent) => {
      if (adviserDropdownRef.current && !adviserDropdownRef.current.contains(event.target as Node)) {
        setIsAdviserDropdownOpen(false);
      }
    };
    if (isAdviserDropdownOpen) {
      document.addEventListener("mousedown", handleAdviserClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleAdviserClickOutside);
    };
  }, [isAdviserDropdownOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDropdownOpen]);

  const currentSection =
    sections.find((s) => s.id === selectedSectionId) || sections[0];

  const isSpecialTrack = useMemo(() => {
    if (!currentSection?.program_type) return false;
    return !["BEC", "REGULAR", "STANDARD", "GENERAL"].includes(currentSection.program_type.trim().toUpperCase());
  }, [currentSection]);

  const hasExtendedSlots = useMemo(() => {
    return slots.some((s) => s.section_id === currentSection?.id && s.period_index >= 8);
  }, [slots, currentSection]);

  const maxPeriods = isSpecialTrack || hasExtendedSlots ? 9 : 7;
  const periodRows = useMemo(
    () => getPeriodRows(durationMinutes, maxPeriods, customBreaks),
    [durationMinutes, maxPeriods, customBreaks]
  );

  // Navigation handlers for Prev / Next section
  const currentIndex = sections.findIndex((s) => s.id === currentSection?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < sections.length - 1;

  const handlePrevSection = () => {
    if (hasPrev) onSelectSection(sections[currentIndex - 1].id);
  };

  const handleNextSection = () => {
    if (hasNext) onSelectSection(sections[currentIndex + 1].id);
  };

  // Filter slots for this section
  const sectionSlots = slots.filter((s) => s.section_id === currentSection?.id);

  // Map slots: "day_period" -> slot
  const slotMap = new Map<string, ScheduleSlot>();
  sectionSlots.forEach((s) => {
    slotMap.set(`${s.day_of_week}_${s.period_index}`, s);
  });

  // Find class adviser for this section:
  // 1. Primary: teacher assigned advisory_section_id
  // 2. Secondary: teacher assigned to Monday Period 1 (mandatory Homeroom Guidance Program)
  const monP1Slot = slotMap.get("0_1");
  const monP1Teacher = monP1Slot?.teacher_id
    ? teachers.find((t) => t.id === monP1Slot.teacher_id)
    : null;

  const adviser =
    teachers.find((t) => t.is_adviser && t.advisory_section_id === currentSection?.id) ||
    monP1Teacher ||
    (monP1Slot?.teacher_name ? ({ name: monP1Slot.teacher_name, id: monP1Slot.teacher_id } as Teacher) : null);

  // Dynamic filter for sections list
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      // Grade filter
      if (gradeFilter !== "ALL" && s.grade_level !== gradeFilter) {
        return false;
      }
      // Text search query
      if (!sectionSearchQuery.trim()) return true;
      const q = sectionSearchQuery.toLowerCase().trim();
      const secMonP1 = slots.find(
        (sl) => sl.section_id === s.id && sl.day_of_week === 0 && sl.period_index === 1
      );
      const secAdviser =
        teachers.find((t) => t.is_adviser && t.advisory_section_id === s.id) ||
        (secMonP1 ? teachers.find((t) => t.id === secMonP1.teacher_id) : null);
      return (
        (s.name || "").toLowerCase().includes(q) ||
        `grade ${s.grade_level}`.toLowerCase().includes(q) ||
        (s.program_type || "").toLowerCase().includes(q) ||
        (s.room_number || "").toLowerCase().includes(q) ||
        (secAdviser && (secAdviser.name || "").toLowerCase().includes(q))
      );
    });
  }, [sections, gradeFilter, sectionSearchQuery, teachers, slots]);

  // Candidates for Quick Adviser Picker
  const filteredAdviserCandidates = useMemo(() => {
    const q = adviserSearch.toLowerCase().trim();
    return teachers.filter((t) => {
      if (t.status && t.status !== "Active") return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.position.toLowerCase().includes(q)
      );
    });
  }, [teachers, adviserSearch]);

  // Count matches in current timetable for inTableSearch
  const inTableMatchCount = useMemo(() => {
    if (!inTableSearch.trim()) return 0;
    const q = inTableSearch.toLowerCase().trim();
    let count = 0;
    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      for (const row of periodRows) {
        if (row.type !== "PERIOD") continue;
        const periodNum = row.period!;
        const slot = slotMap.get(`${dayIdx}_${periodNum}`);
        const isMondayHRGP = dayIdx === 0 && periodNum === 1;

        const subjectTitle = isMondayHRGP
          ? "HRGP HOMEROOM GUIDANCE PROGRAM"
          : (slot?.subject_name || "");
        const teacherName = isMondayHRGP
          ? (adviser?.name || slot?.teacher_name || "")
          : (slot?.teacher_name || "");
        const deptName = slot?.department_name || "";

        if (
          subjectTitle.toLowerCase().includes(q) ||
          teacherName.toLowerCase().includes(q) ||
          deptName.toLowerCase().includes(q)
        ) {
          count++;
        }
      }
    }
    return count;
  }, [inTableSearch, slotMap, adviser]);

  // Unique grade levels available
  const gradeLevels = useMemo(() => {
    const set = new Set<number>();
    sections.forEach((s) => set.add(s.grade_level));
    return Array.from(set).sort((a, b) => a - b);
  }, [sections]);

  // Real-time conflict & RA 4670 workload stats for this section
  const conflictStats = useMemo(
    () => getSectionConflictStats(selectedSectionId, slots, teachers, sections),
    [selectedSectionId, slots, teachers, sections]
  );

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-[#E5CCE3] p-12 text-center shadow-xs space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#FDF2FA] border border-[#E5CCE3] flex items-center justify-center text-[#A91079] mx-auto shadow-2xs">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900">No Student Sections Found</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          No class sections exist in the school roster yet. Go to the Section Management tab or import sections from Excel to create your student cohorts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search & Section Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-[#E5CCE3] p-4 shadow-xs space-y-3 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Section Selector with Prev/Next Steppers & Combobox */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevSection}
              disabled={!hasPrev}
              title="Previous Section"
              className={`p-2 rounded-xl border border-[#E5CCE3] text-slate-600 transition shadow-2xs cursor-pointer ${
                hasPrev
                  ? "hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  : "opacity-40 cursor-not-allowed bg-slate-50"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Combobox Trigger Button */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-50 hover:bg-slate-100/90 border border-slate-300 hover:border-[#A91079] rounded-xl text-left transition shadow-2xs cursor-pointer min-w-[220px] sm:min-w-[280px]"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">
                      {currentSection?.name || "Select Section"}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#F3E5F2] text-[#A91079]">
                      G{currentSection?.grade_level}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700">
                      {currentSection?.program_type}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {currentSection?.room_number} • Adviser:{" "}
                    <span className="font-semibold text-slate-700">
                      {adviser ? adviser.name : "Unassigned"}
                    </span>
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180 text-[#A91079]" : ""
                  }`}
                />
              </button>

              {/* Floating Dynamic Section Search Dropdown Panel */}
              {isDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-[#E5CCE3] shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Search Input */}
                  <div className="relative mb-2.5">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={sectionSearchQuery}
                      onChange={(e) => setSectionSearchQuery(e.target.value)}
                      placeholder="Search by section, grade, room, adviser..."
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
                  <div className="flex items-center gap-1.5 pb-2.5 border-b border-slate-100 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setGradeFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                        gradeFilter === "ALL"
                          ? "bg-[#A91079] text-white shadow-2xs"
                          : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                      }`}
                    >
                      All ({sections.length})
                    </button>
                    {gradeLevels.map((lvl) => {
                      const count = sections.filter((s) => s.grade_level === lvl).length;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setGradeFilter(lvl)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                            gradeFilter === lvl
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
                  <div className="mt-2 max-h-64 overflow-y-auto space-y-1 pr-1">
                    {filteredSections.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        <SlidersHorizontal className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                        No sections found matching "{sectionSearchQuery}"
                      </div>
                    ) : (
                      filteredSections.map((sec) => {
                        const isSelected = sec.id === currentSection?.id;
                        const secMonP1 = slots.find(
                          (sl) => sl.section_id === sec.id && sl.day_of_week === 0 && sl.period_index === 1
                        );
                        const secAdviser =
                          teachers.find((t) => t.is_adviser && t.advisory_section_id === sec.id) ||
                          (secMonP1 ? teachers.find((t) => t.id === secMonP1.teacher_id) : null);
                        const secSlotsCount = slots.filter((s) => s.section_id === sec.id).length;

                        return (
                          <div
                            key={sec.id}
                            onClick={() => {
                              onSelectSection(sec.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected
                                ? "bg-[#FDF2FA] border-[#A91079] text-[#2E0249] shadow-2xs"
                                : "border-transparent hover:bg-slate-50 hover:border-[#E5CCE3] text-slate-700"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
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
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                                <span>{sec.room_number}</span>
                                <span>•</span>
                                <span className="truncate">
                                  Adviser:{" "}
                                  <strong className="text-slate-700">
                                    {secAdviser ? secAdviser.name : "None"}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>{secSlotsCount} periods</span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[#A91079] shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextSection}
              disabled={!hasNext}
              title="Next Section"
              className={`p-2 rounded-xl border border-[#E5CCE3] text-slate-600 transition shadow-2xs cursor-pointer ${
                hasNext
                  ? "hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  : "opacity-40 cursor-not-allowed bg-slate-50"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* In-Table Real-Time Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={inTableSearch}
                onChange={(e) => setInTableSearch(e.target.value)}
                placeholder="Find subject or teacher in grid..."
                className="pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-[#E5CCE3] focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition w-52 sm:w-64"
              />
              {inTableSearch && (
                <button
                  type="button"
                  onClick={() => setInTableSearch("")}
                  className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {inTableSearch && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{inTableMatchCount} {inTableMatchCount === 1 ? "match" : "matches"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timetable Schedule Grid Container */}
      <div className="bg-white rounded-2xl border border-[#E5CCE3] p-5 sm:p-6 shadow-xs text-slate-900 print:border-black print:p-0 print:shadow-none">
        {/* Clean Section Info Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5CCE3]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3E5F2] border border-[#E5CCE3] flex items-center justify-center text-[#A91079] font-black shrink-0">
              <GraduationCap className="w-5 h-5 text-[#A91079]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  {currentSection?.name || "Select Section"}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-[#E5CCE3]">
                  Grade {currentSection?.grade_level || 7} • {currentSection?.program_type || "General"} Track
                </span>
                {conflictStats.totalIssues === 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Conflict-Free
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    {conflictStats.totalIssues} Issue{conflictStats.totalIssues > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {currentSection?.room_number || "Room Unassigned"}
                </span>
                <span>•</span>
                <div className="relative inline-flex items-center gap-1.5" ref={adviserDropdownRef}>
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Adviser:</span>
                  <button
                    type="button"
                    onClick={() => setIsAdviserDropdownOpen((prev) => !prev)}
                    className="font-bold text-slate-800 hover:text-[#A91079] bg-slate-100/90 hover:bg-[#FDF2FA] px-2 py-0.5 rounded-lg border border-slate-200 hover:border-[#E5CCE3] transition flex items-center gap-1 cursor-pointer"
                    title="Click to change Class Adviser for this section"
                  >
                    <span>{adviser ? adviser.name : "Unassigned"}</span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </button>

                  {/* Interactive Adviser Selector Popover */}
                  {isAdviserDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-68 bg-white border border-[#E5CCE3] rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-black text-[#2E0249] uppercase tracking-wider">
                          Assign Class Adviser
                        </span>
                        <span className="text-[9px] text-[#A91079] font-bold">HRGP Mon P1</span>
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={adviserSearch}
                          onChange={(e) => setAdviserSearch(e.target.value)}
                          placeholder="Search faculty..."
                          className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-[#A91079]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredAdviserCandidates.map((t) => {
                          const isCurrent = adviser?.id === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              disabled={isUpdatingAdviser}
                              onClick={async () => {
                                if (onChangeAdviser && currentSection) {
                                  try {
                                    setIsUpdatingAdviser(true);
                                    await onChangeAdviser(currentSection.id, t.id);
                                  } finally {
                                    setIsUpdatingAdviser(false);
                                  }
                                }
                                setIsAdviserDropdownOpen(false);
                              }}
                              className={`w-full p-2 rounded-lg text-left text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                                isCurrent
                                  ? "bg-[#FDF2FA] text-[#A91079] font-bold border border-[#E5CCE3]"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="truncate pr-1">
                                <div className="truncate font-bold">{t.name}</div>
                                <div className="text-[10px] text-slate-400 font-normal truncate">{t.position}</div>
                              </div>
                              {isCurrent && <Check className="w-3.5 h-3.5 text-[#A91079] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <span>•</span>
                <span>{sectionSlots.length} Periods Scheduled</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 no-print">
            {onAddTeacher && (
              <button
                type="button"
                onClick={() => onAddTeacher()}
                className="px-3.5 py-2 bg-[#FDF2FA] hover:bg-[#F9E2F4] border border-[#E5CCE3] text-[#A91079] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#A91079]" />
                <span>+ Add Faculty</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExportDocxModalOpen(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-[#A91079] rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title={t.exportDocx.title}
            >
              <FileDown className="w-3.5 h-3.5 text-[#A91079]" />
              <span>{isExportingDocx ? t.common.exporting : t.common.exportWord}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportScheduleExcelOpen(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title={isTagalog ? "Mag-import ng Talaorasan ng Seksiyon gamit ang Excel/CSV" : "Import Section Timetable via Excel or CSV"}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isTagalog ? "Mag-import ng Talaorasan (Excel)" : "Import Schedule (Excel)"}</span>
            </button>
            <button
              type="button"
              onClick={handleExportSF7}
              disabled={isExportingSF7}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title={t.common.exportSF7}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isExportingSF7 ? (isTagalog ? "Ipinoproseso..." : "Exporting SF-7...") : t.common.exportSF7}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.common.printSchedule}</span>
            </button>
          </div>
        </div>

        {/* The Exact Photo Timetable Matrix */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-2 border-black border-collapse text-center text-xs">
            <thead>
              <tr className="bg-slate-100/90 text-black font-extrabold border-b-2 border-black text-xs sm:text-sm">
                <th className="p-2.5 sm:p-3 border-r-2 border-black w-28 uppercase tracking-wider text-center">
                  {t.grid.time}
                </th>
                {[t.days.monday, t.days.tuesday, t.days.wednesday, t.days.thursday, t.days.friday].map((dayName, idx) => (
                  <th
                    key={idx}
                    className="p-2.5 sm:p-3 border-r-2 border-black last:border-r-0 uppercase tracking-wider min-w-[150px] text-center"
                  >
                    {dayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodRows.map((row) => {
                // Fixed row spanning all days: Flag Ceremony, Break Time, Lunch Break
                if (row.type === "FIXED_ALL") {
                  const upperLabel = (row.label || "").toUpperCase();
                  const localizedLabel = !isTagalog
                    ? row.label
                    : upperLabel.includes("FLAG")
                    ? t.breaks.flagCeremony
                    : upperLabel.includes("RECESS") || upperLabel.includes("BREAK") || upperLabel.includes("MERYENDA")
                    ? t.breaks.morningBreak
                    : upperLabel.includes("LUNCH") || upperLabel.includes("TANGHALIAN")
                    ? t.breaks.lunchBreak
                    : row.label;

                  return (
                    <tr
                      key={row.time}
                      className="border-b-2 border-black bg-slate-50/80 font-bold"
                    >
                      <td className="p-2 border-r-2 border-black font-bold whitespace-nowrap text-slate-900 text-center text-[11px] sm:text-xs">
                        {row.time}
                      </td>
                      {/* Cell for each day or spanning */}
                      {DAYS.map((day) => (
                        <td
                          key={day}
                          className="p-2 border-r-2 border-black last:border-r-0 text-center font-extrabold uppercase text-[11px] sm:text-xs tracking-wide"
                        >
                          {localizedLabel}
                        </td>
                      ))}
                    </tr>
                  );
                }

                // Special Afternoon Program row (SPA / Remedial)
                if (row.type === "SPECIAL") {
                  return (
                    <tr key={row.time} className="border-b-2 border-black font-bold">
                      <td className="p-2 border-r-2 border-black font-bold whitespace-nowrap text-slate-900 text-center text-[11px] sm:text-xs">
                        {row.time}
                      </td>
                      {/* Mon to Thu: SPA, Fri: Blank or Consultation */}
                      {DAYS.map((day, dIdx) => (
                        <td
                          key={day}
                          className="p-2 border-r-2 border-black last:border-r-0 text-center font-bold uppercase text-[11px] sm:text-xs"
                        >
                          {dIdx < 4 ? "SPA / Remedial Program" : ""}
                        </td>
                      ))}
                    </tr>
                  );
                }

                // Regular Instructional Period row (Period 1 to 7)
                const periodNum = row.period!;
                return (
                  <tr
                    key={row.time}
                    className="border-b-2 border-black hover:bg-slate-50/50 transition"
                  >
                    {/* Time Column */}
                    <td className="p-2.5 border-r-2 border-black font-bold whitespace-nowrap text-slate-900 text-center text-[11px] sm:text-xs align-middle">
                      {row.time}
                    </td>

                    {/* Monday to Friday Cells */}
                    {DAYS.map((day, dayIdx) => {
                      const slot = slotMap.get(`${dayIdx}_${periodNum}`);
                      const isMondayHRGP = dayIdx === 0 && periodNum === 1;

                      if (!slot && !isMondayHRGP) {
                        return (
                          <td
                            key={day}
                            onClick={() =>
                              onEmptySlotClick &&
                              onEmptySlotClick(currentSection?.id || 1, dayIdx, periodNum)
                            }
                            className={`p-2 sm:p-2.5 border-r-2 border-black last:border-r-0 text-center align-middle transition cursor-pointer group hover:bg-[#FDF2FA] ${
                              inTableSearch ? "opacity-30" : ""
                            }`}
                            title="Click to assign class or teacher to this period in real-time"
                          >
                            <div className="flex flex-col items-center justify-center py-1">
                              <span className="text-slate-300 font-bold group-hover:hidden">—</span>
                              <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] font-extrabold text-[#A91079] bg-[#FDF2FA] border border-[#E5CCE3] px-2 py-0.5 rounded-md shadow-2xs">
                                <Plus className="w-3 h-3" />
                                Assign
                              </span>
                            </div>
                          </td>
                        );
                      }

                      // Subject title
                      const subjectTitle = slot?.subject_name
                        ? slot.subject_name.toUpperCase()
                        : isMondayHRGP
                        ? "HRGP"
                        : "SUBJECT";

                      // Teacher name
                      const teacherName = isMondayHRGP
                        ? slot?.teacher_name || adviser?.name || "Unassigned Faculty"
                        : slot?.teacher_name || "Assigned Teacher";

                      // In-table search match test
                      const q = inTableSearch.toLowerCase().trim();
                      const isMatch =
                        q.length > 0 &&
                        (subjectTitle.toLowerCase().includes(q) ||
                          (isMondayHRGP && "homeroom guidance program".includes(q)) ||
                          teacherName.toLowerCase().includes(q) ||
                          (slot?.department_name &&
                            slot.department_name.toLowerCase().includes(q)));

                      const isDimmed = inTableSearch.trim().length > 0 && !isMatch;

                      // Evaluate real-time slot conflict and RA 4670 workload limits
                      const conflict = evaluateSlotConflict(slot, slots, teachers, sections, isMondayHRGP);

                      const cellBgClass = isMatch
                        ? "bg-amber-100/90 ring-2 ring-amber-500 ring-inset shadow-md"
                        : isDimmed
                        ? "opacity-35 grayscale-30"
                        : conflict.hasRoomConflict
                        ? "bg-purple-50/80 ring-2 ring-purple-500 ring-inset"
                        : conflict.severity === "error"
                        ? "bg-red-50/70 ring-2 ring-red-500 ring-inset"
                        : conflict.severity === "warning"
                        ? "bg-amber-50/60 ring-2 ring-amber-400 ring-inset"
                        : conflict.severity === "info"
                        ? "bg-[#FDF2FA] ring-2 ring-[#A91079] ring-inset"
                        : isMondayHRGP
                        ? "bg-[#FDF2FA] hover:bg-[#F3E5F2]"
                        : "hover:bg-amber-50/40";

                      const cellTitle = conflict.hasConflict
                        ? `${conflict.badgeTooltip} (Click to edit or reassign)`
                        : slot
                        ? `${slot.subject_name} • ${slot.teacher_name} (Click to edit)`
                        : "";

                      return (
                        <td
                          key={day}
                          onClick={() => slot && onSlotClick && onSlotClick(slot)}
                          onContextMenu={(e) => {
                            if (slot && onSlotContextMenu) {
                              e.preventDefault();
                              e.stopPropagation();
                              onSlotContextMenu(slot, e);
                            }
                          }}
                          className={`p-2 sm:p-2.5 border-r-2 border-black last:border-r-0 text-center align-middle transition cursor-pointer group relative ${cellBgClass}`}
                          title={cellTitle}
                        >
                          {/* In-Grid Conflict & Overload Badge (Top Left, hidden on physical print) */}
                          {conflict.hasConflict && (
                            <span
                              className={`no-print absolute top-1 left-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider shadow-2xs flex items-center gap-0.5 z-10 transition ${
                                conflict.hasRoomConflict
                                  ? "bg-purple-600 text-white ring-1 ring-purple-400 animate-pulse"
                                  : conflict.severity === "error"
                                  ? "bg-red-600 text-white ring-1 ring-red-400 animate-pulse"
                                  : conflict.severity === "warning"
                                  ? "bg-amber-600 text-white ring-1 ring-amber-400"
                                  : "bg-[#A91079] text-white ring-1 ring-[#F806CC]"
                              }`}
                              title={conflict.badgeTooltip}
                            >
                              {conflict.hasRoomConflict ? (
                                <Building className="w-2.5 h-2.5 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              )}
                              <span>{conflict.badgeLabel}</span>
                            </span>
                          )}

                          {/* Live search match badge */}
                          {isMatch && (
                            <span className="absolute top-1 right-1 px-1 py-0.2 bg-amber-500 text-white rounded text-[8px] font-black uppercase tracking-wider shadow-2xs">
                              MATCH
                            </span>
                          )}

                          <div className="flex flex-col items-center justify-center space-y-0.5">
                            {/* Subject Name in Bold Uppercase */}
                            <span
                              className={`font-extrabold text-xs sm:text-sm tracking-tight transition ${
                                isMatch
                                  ? "text-amber-950 font-black"
                                  : "text-black group-hover:text-[#A91079]"
                              }`}
                            >
                              {subjectTitle === "HOMEROOM GUIDANCE PROGRAM" ? "HRGP" : subjectTitle}
                            </span>

                            {/* Teacher's Name directly underneath with authentic wavy underline */}
                            <span
                              className={`text-[11px] sm:text-xs font-semibold underline decoration-red-400/80 decoration-wavy decoration-1 underline-offset-2 transition ${
                                isMatch
                                  ? "text-amber-900 font-bold decoration-amber-600"
                                  : "text-slate-800 group-hover:decoration-[#A91079]"
                              }`}
                            >
                              {teacherName}
                            </span>

                            {/* Showcase conflicting class directly in the cell */}
                            {conflict.hasRoomConflict && conflict.conflictingRoomSections && conflict.conflictingRoomSections.length > 0 && (
                              <div className="no-print mt-1 px-1.5 py-0.5 rounded bg-purple-100 border border-purple-200 text-[9px] text-purple-950 font-semibold flex items-center justify-center gap-1 shadow-2xs max-w-full truncate">
                                <Building className="w-2.5 h-2.5 text-purple-700 shrink-0" />
                                <span className="truncate">Clash: {conflict.conflictingRoomSections[0]}</span>
                              </div>
                            )}

                            {conflict.hasDoubleBooking && conflict.conflictingSections && conflict.conflictingSections.length > 0 && (
                              <div className="no-print mt-1 px-1.5 py-0.5 rounded bg-red-100 border border-red-200 text-[9px] text-red-950 font-semibold flex items-center justify-center gap-1 shadow-2xs max-w-full truncate">
                                <AlertTriangle className="w-2.5 h-2.5 text-red-700 shrink-0" />
                                <span className="truncate">Also in: {conflict.conflictingSections.join(", ")}</span>
                              </div>
                            )}
                          </div>
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

      {/* Export Official DepEd Class Program Word Document Modal */}
      {currentSection && (
        <ExportDocxModal
          isOpen={isExportDocxModalOpen}
          onClose={() => setIsExportDocxModalOpen(false)}
          sectionName={currentSection.name}
          gradeLevel={currentSection.grade_level}
          programType={currentSection.program_type}
          adviserName={adviser?.name}
          loading={isExportingDocx}
          onConfirmExport={async (params) => {
            try {
              setIsExportingDocx(true);
              await api.downloadSectionDocx(currentSection.id, params);
            } catch (err: any) {
              console.error("Export failed:", err);
              throw err;
            } finally {
              setIsExportingDocx(false);
            }
          }}
        />
      )}

      {/* Import Section Weekly Schedule (Excel / CSV) Modal */}
      {isImportScheduleExcelOpen && (
        <ImportSectionScheduleModal
          isOpen={isImportScheduleExcelOpen}
          onClose={() => setIsImportScheduleExcelOpen(false)}
          sections={sections}
          initialSectionId={selectedSectionId}
          onImportComplete={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
};
