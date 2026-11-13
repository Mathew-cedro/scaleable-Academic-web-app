import { useState, useMemo, useEffect } from "react";
import {
  GraduationCap,
  Search,
  Plus,
  PlusCircle,
  Edit3,
  Trash2,
  Building,
  User,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { BatchSectionSetupModal } from "./BatchSectionSetupModal";
import { AddSpecialTrackModal } from "./AddSpecialTrackModal";
import { ImportSectionsExcelModal } from "./ImportSectionsExcelModal";
import {
  loadModularTracks,
  saveModularTracks,
  type ModularTrack,
} from "../utils/modularTracks";

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
}

interface ScheduleSlot {
  id: number;
  section_id: number;
  day_of_week: number;
  period_index: number;
}

interface Props {
  sections: Section[];
  teachers: Teacher[];
  departments: Department[];
  slots: ScheduleSlot[];
  onAddSection: (defaultGrade?: number) => void;
  onEditSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onViewClassTimetable: (sectionId: number) => void;
  onRefreshData?: () => void;
}

export const SectionManagerView = ({
  sections,
  teachers,
  departments,
  slots,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onViewClassTimetable,
  onRefreshData,
}: Props) => {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [trackFilter, setTrackFilter] = useState<string | "ALL">("ALL");
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [isImportExcelOpen, setIsImportExcelOpen] = useState(false);
  const [tracks, setTracks] = useState<ModularTrack[]>(loadModularTracks);

  useEffect(() => {
    const handleTracksUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<ModularTrack[]>;
      if (customEvent.detail) {
        setTracks(customEvent.detail);
      } else {
        setTracks(loadModularTracks());
      }
    };
    window.addEventListener("schedmaster_tracks_updated", handleTracksUpdated);
    return () => {
      window.removeEventListener("schedmaster_tracks_updated", handleTracksUpdated);
    };
  }, []);

  const handleTrackCreated = (newTrack: ModularTrack) => {
    const updated = [...tracks, newTrack];
    setTracks(updated);
    saveModularTracks(updated);
  };

  const deptMap = useMemo(() => new Map<number, Department>(departments.map((d) => [d.id, d])), [departments]);

  // Unique grade levels
  const gradeLevels = useMemo(() => {
    const set = new Set<number>();
    sections.forEach((s) => set.add(s.grade_level));
    return Array.from(set).sort((a, b) => a - b);
  }, [sections]);

  // Section with computed metadata
  const sectionStats = useMemo(() => {
    return sections.map((sec) => {
      const adviser = teachers.find(
        (t) => t.is_adviser && t.advisory_section_id === sec.id
      );
      const secSlots = slots.filter((s) => s.section_id === sec.id);
      const isComplete = secSlots.length >= 35;
      const percent = Math.min(Math.round((secSlots.length / 35) * 100), 100);

      return {
        ...sec,
        adviser,
        slotsCount: secSlots.length,
        isComplete,
        percent,
      };
    });
  }, [sections, teachers, slots]);

  // Overall KPIs
  const isRegular = (t: string) => t === "Regular" || t === "BEC";
  const regularCount = sections.filter((s) => isRegular(s.program_type)).length;
  const steCount = sections.filter((s) => !isRegular(s.program_type)).length;
  const assignedAdviserCount = sectionStats.filter((s) => s.adviser !== undefined).length;
  const unassignedAdviserCount = sections.length - assignedAdviserCount;

  // Filtered sections
  const filteredSections = useMemo(() => {
    return sectionStats.filter((sec) => {
      const q = search.toLowerCase().trim();
      const adviserName = sec.adviser?.name || "";

      const matchesSearch =
        q.length === 0 ||
        (sec.name || "").toLowerCase().includes(q) ||
        (sec.room_number || "").toLowerCase().includes(q) ||
        (sec.program_type || "").toLowerCase().includes(q) ||
        `grade ${sec.grade_level}`.toLowerCase().includes(q) ||
        adviserName.toLowerCase().includes(q);

      const matchesGrade = gradeFilter === "ALL" || sec.grade_level === gradeFilter;
      const matchesTrack =
        trackFilter === "ALL" ||
        sec.program_type === trackFilter ||
        ((trackFilter === "BEC" || trackFilter === "Regular") && isRegular(sec.program_type));

      return matchesSearch && matchesGrade && matchesTrack;
    });
  }, [sectionStats, search, gradeFilter, trackFilter]);

  return (
    <div className="space-y-6">
      {/* Top Hero & Action Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#F3E5F2] text-[#A91079]">
              <GraduationCap className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Section Management Hub
            </h2>

          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Configure student sections, curriculum tracks (Regular, STE, SPS), designated classrooms, and assigned Class Advisers across all academic departments.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsImportExcelOpen(true)}
            className="px-3.5 py-2 bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            title="Import section weekly timetable schedule via Excel (.xlsx, .xls) or CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import Schedule (Excel)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddTrackOpen(true)}
            className="px-3.5 py-2 bg-[#FDF2FA] hover:bg-[#F9E2F4] border border-[#E5CCE3] text-[#A91079] rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            title="Add a specialized program track (e.g. SPFL, TVL, ALIVE, SPA, SPS)"
          >
            <PlusCircle className="w-4 h-4 text-[#A91079]" />
            <span>Add Special Track</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBatchOpen(true)}
            className="px-3.5 py-2 bg-[#FDF2FA] hover:bg-[#F9E2F4] border border-[#E5CCE3] text-[#A91079] rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            title="Batch configure and generate sections across Grades 7 to 10"
          >
            <Layers className="w-4 h-4 text-[#A91079]" />
            <span>Batch Section Setup</span>
          </button>

          <button
            type="button"
            onClick={() => onAddSection(7)}
            className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg text-xs font-semibold shadow-md shadow-[#A91079]/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Section</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sections */}
        <div
          onClick={() => {
            setGradeFilter("ALL");
            setTrackFilter("ALL");
          }}
          className="p-4 rounded-xl border bg-[#2E0249] text-white border-[#570A57] shadow-2xs cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className="text-slate-200">Total Sections</span>
            <GraduationCap className="w-4 h-4 text-[#F806CC]" />
          </div>
          <div className="text-2xl font-bold num-tabular">{sections.length}</div>
          <div className="text-[11px] mt-1 text-slate-300">
            Active in School Timetable
          </div>
        </div>

        {/* Regular / BEC Track */}
        <div
          onClick={() => setTrackFilter(trackFilter === "BEC" || trackFilter === "Regular" ? "ALL" : "BEC")}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            trackFilter === "BEC" || trackFilter === "Regular"
              ? "bg-[#A91079] text-white border-[#A91079] shadow-xs"
              : "bg-white text-[#2E0249] border-[#E5CCE3] hover:border-[#A91079] shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className={trackFilter === "BEC" || trackFilter === "Regular" ? "text-[#F3E5F2]" : "text-slate-700"}>
              Regular (BEC) Curriculum
            </span>
            <BookOpen className={`w-4 h-4 ${trackFilter === "BEC" || trackFilter === "Regular" ? "text-white" : "text-[#A91079]"}`} />
          </div>
          <div className={`text-2xl font-bold num-tabular ${trackFilter === "BEC" || trackFilter === "Regular" ? "text-white" : "text-slate-900"}`}>
            {regularCount}
          </div>
          <div className={`text-[11px] mt-1 ${trackFilter === "BEC" || trackFilter === "Regular" ? "text-[#F3E5F2]" : "text-slate-500"}`}>
            Standard Curriculum Quotas
          </div>
        </div>

        {/* STE / Special Programs */}
        <div
          onClick={() => setTrackFilter(trackFilter === "STE" ? "ALL" : "STE")}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            trackFilter === "STE"
              ? "bg-[#A91079] text-white border-[#A91079] shadow-xs"
              : "bg-white text-[#2E0249] border-[#E5CCE3] hover:border-[#A91079] shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className={trackFilter === "STE" ? "text-[#F3E5F2]" : "text-slate-700"}>
              Special Programs (STE / SPS)
            </span>
            <Sparkles className={`w-4 h-4 ${trackFilter === "STE" ? "text-white" : "text-[#A91079]"}`} />
          </div>
          <div className={`text-2xl font-bold num-tabular ${trackFilter === "STE" ? "text-white" : "text-slate-900"}`}>
            {steCount}
          </div>
          <div className={`text-[11px] mt-1 ${trackFilter === "STE" ? "text-[#F3E5F2]" : "text-slate-500"}`}>
            Science & Sports Curricula
          </div>
        </div>

        {/* Assigned Advisers */}
        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            unassignedAdviserCount === 0
              ? "bg-emerald-50/60 text-slate-800 border-emerald-200"
              : "bg-amber-50/70 text-slate-800 border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className={unassignedAdviserCount === 0 ? "text-emerald-800" : "text-amber-900"}>
              Class Adviser Locks
            </span>
            {unassignedAdviserCount === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div className={`text-2xl font-bold num-tabular ${unassignedAdviserCount === 0 ? "text-emerald-950" : "text-amber-950"}`}>
            {assignedAdviserCount} <span className="text-sm font-semibold text-slate-500">/ {sections.length}</span>
          </div>
          <div className={`text-[11px] mt-1 ${unassignedAdviserCount === 0 ? "text-emerald-700" : "text-amber-800"}`}>
            {unassignedAdviserCount === 0 ? "All sections have designated advisers" : `${unassignedAdviserCount} section unassigned`}
          </div>
        </div>
      </div>

      {/* Search & Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search section name, room, grade, adviser..."
              className="w-full pl-9 pr-4 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition"
            />
          </div>

          <div className="text-xs font-bold text-slate-500">
            Showing <strong className="text-slate-900">{filteredSections.length}</strong> of {sections.length} sections
          </div>
        </div>

        {/* Filter Chips: Grade Levels & Tracks */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100 text-xs">
          {/* Grade Level Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">
              Grade:
            </span>
            <button
              onClick={() => setGradeFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                gradeFilter === "ALL"
                  ? "bg-[#A91079] text-white shadow-2xs"
                  : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
              }`}
            >
              All Grades ({sections.length})
            </button>
            {gradeLevels.map((lvl) => {
              const count = sections.filter((s) => s.grade_level === lvl).length;
              return (
                <button
                  key={lvl}
                  onClick={() => setGradeFilter(lvl)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                    gradeFilter === lvl
                      ? "bg-[#A91079] text-white font-semibold shadow-2xs"
                      : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                  }`}
                >
                  Grade {lvl} ({count})
                </button>
              );
            })}
          </div>

          {/* Program Track Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">
              Track:
            </span>
            <button
              onClick={() => setTrackFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                trackFilter === "ALL"
                  ? "bg-[#2E0249] text-white shadow-2xs"
                  : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
              }`}
            >
              All
            </button>
            {tracks.map((trk) => (
              <button
                key={trk.code}
                onClick={() => setTrackFilter(trk.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                  trackFilter === trk.code || (trk.code === "BEC" && trackFilter === "Regular")
                    ? "bg-[#2E0249] text-white shadow-2xs"
                    : "bg-[#F3E5F2] text-[#703372] hover:bg-[#E5CCE3]"
                }`}
              >
                {trk.code === "BEC" ? "BEC (Regular)" : trk.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section Cards Grid */}
      {filteredSections.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
          <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <h4 className="text-sm font-bold text-slate-700">No Student Sections Found</h4>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or grade level filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSections.map((sec) => {
            const adviser = sec.adviser;
            const adviserDept = adviser ? deptMap.get(adviser.department_id) : null;

            return (
              <div
                key={sec.id}
                className="bg-white rounded-2xl border border-[#E5CCE3] p-5 shadow-xs hover:border-[#A91079] hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                {/* Card Top: Name, Grade Badge, Track */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-[#F3E5F2] text-[#A91079] border border-[#E5CCE3] font-extrabold text-xs">
                          Grade {sec.grade_level}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-xs">
                          {sec.program_type}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base truncate">
                        {sec.name}
                      </h3>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 text-slate-400 shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Room & Class Adviser Info */}
                  <div className="mt-3 space-y-2 text-xs">
                    {/* Room */}
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800">{sec.room_number}</span>
                    </div>

                    {/* Class Adviser */}
                    <div
                      className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${
                        adviser
                          ? "bg-[#FDF2FA] border-[#E5CCE3] text-[#2E0249]"
                          : "bg-amber-50/70 border-amber-200 text-amber-900"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-[#A91079] shrink-0" />
                        <span className="truncate">
                          Adviser:{" "}
                          <strong className="font-bold">
                            {adviser ? adviser.name : "Unassigned"}
                          </strong>
                        </span>
                      </div>
                      {adviserDept && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white text-[#A91079] border border-[#E5CCE3] shrink-0 ml-1">
                          {adviserDept.code}
                        </span>
                      )}
                    </div>

                    {/* Scheduled Periods Fill Gauge */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Timetable Allocation:</span>
                        <span className="font-bold text-slate-800">
                          {sec.slotsCount} / 35 Periods ({sec.percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            sec.percent >= 100
                              ? "bg-emerald-500"
                              : sec.percent > 0
                              ? "bg-[#A91079]"
                              : "bg-slate-300"
                          }`}
                          style={{ width: `${sec.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onViewClassTimetable(sec.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#A91079] bg-[#FDF2FA] hover:bg-[#F3E5F2] border border-[#E5CCE3] transition flex items-center gap-1 cursor-pointer"
                    title="View Form SF-7 Timetable"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>SF-7 Timetable</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditSection(sec)}
                      className="p-1.5 text-slate-400 hover:text-[#A91079] hover:bg-[#FDF2FA] rounded-lg transition cursor-pointer"
                      title="Edit Section Details"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteSection(sec)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete Section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Section Setup Modal */}
      <BatchSectionSetupModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        existingSections={sections}
        onBatchCreated={() => {
          if (onRefreshData) onRefreshData();
          window.dispatchEvent(new CustomEvent("schedmaster_sections_refresh"));
        }}
      />

      {/* Add Special Track Modal */}
      <AddSpecialTrackModal
        isOpen={isAddTrackOpen}
        onClose={() => setIsAddTrackOpen(false)}
        onTrackCreated={handleTrackCreated}
        existingTracks={tracks}
      />

      {/* Import Section Schedule via Excel/CSV Modal */}
      {isImportExcelOpen && (
        <ImportSectionsExcelModal
          isOpen={isImportExcelOpen}
          onClose={() => setIsImportExcelOpen(false)}
          sections={sections}
          onImportComplete={() => {
            if (onRefreshData) onRefreshData();
            window.dispatchEvent(new CustomEvent("schedmaster_sections_refresh"));
          }}
          teachers={teachers}
        />
      )}
    </div>
  );
};
