import { useState } from "react";
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Search,
  HeartHandshake,
  UserCheck,
  UserPlus,
  Edit3,
  Trash2,
  X,
  ExternalLink,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  max_daily_hours: number;
  max_weekly_hours: number;
  current_load_hours: number;
  is_adviser: boolean;
  advisory_section_id?: number | null;
  status: string;
  avatar_url?: string | null;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Section {
  id: number;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  departments: Department[];
  sections: Section[];
  onTeacherStatusToggle: (teacherId: number, newStatus: string) => void;
  onAddTeacher?: (deptId?: number) => void;
  onEditTeacher?: (teacher: Teacher) => void;
  onDeleteTeacher?: (teacher: Teacher) => void;
  onViewTeacherProfile?: (teacher: Teacher) => void;
}

export const TeacherSidebar = ({
  isOpen,
  onClose,
  teachers,
  departments,
  sections,
  onTeacherStatusToggle,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  onViewTeacherProfile,
}: Props) => {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<number | "ALL">("ALL");

  const deptMap = new Map<number, string>(departments.map((d) => [d.id, d.name]));
  const secMap = new Map<number, string>(sections.map((s) => [s.id, s.name]));

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.position.toLowerCase().includes(search.toLowerCase());
    const matchesDept = filterDept === "ALL" || t.department_id === filterDept;
    return matchesSearch && matchesDept;
  });

  // Calculate workload stats
  const activeTeachers = teachers.filter((t) => t.status === "Active");
  const underloadedCount = activeTeachers.filter((t) => t.current_load_hours < 20).length;
  const optimalCount = activeTeachers.filter((t) => t.current_load_hours >= 20 && t.current_load_hours <= 25).length;
  const onLeaveCount = teachers.filter((t) => t.status !== "Active").length;

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
      />

      {/* Slide-over Right Sidebar Panel */}
      <aside className="fixed top-0 right-0 h-full w-88 max-w-[90vw] bg-white border-l border-[#E5CCE3] shadow-2xl flex flex-col z-50 animate-fadeIn no-print">
        {/* Header */}
        <div className="p-4 border-b border-[#E5CCE3] bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#FDF2FA] text-[#A91079] rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Faculty Directory</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#F3E5F2] text-[#A91079]">
                  {teachers.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Workload & Compliance Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onAddTeacher && (
              <button
                onClick={() => onAddTeacher()}
                className="p-1.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition cursor-pointer"
                title="Add New Faculty Member"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="text-[11px]">Add</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Counter Summary Pills */}
        <div className="p-3 bg-slate-100/60 border-b border-[#E5CCE3] grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="block font-bold text-emerald-700">{optimalCount}</span>
            <span className="text-[9px] text-emerald-600 uppercase font-semibold">Optimal</span>
          </div>
          <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200">
            <span className="block font-bold text-amber-700">{underloadedCount}</span>
            <span className="text-[9px] text-amber-600 uppercase font-semibold">Underload</span>
          </div>
          <div className="p-1.5 rounded-lg bg-red-50 border border-red-200">
            <span className="block font-bold text-red-700">{onLeaveCount}</span>
            <span className="text-[9px] text-red-600 uppercase font-semibold">On Leave</span>
          </div>
        </div>

        {/* Search & Department Filter */}
        <div className="p-3 border-b border-[#E5CCE3] space-y-2 bg-white">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-[#E5CCE3] rounded-lg focus:outline-hidden focus:border-[#A91079] text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterDept}
              onChange={(e) =>
                setFilterDept(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
              }
              className="w-full px-2 py-1 text-xs bg-slate-50 border border-[#E5CCE3] rounded-lg text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All 8 Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Teacher Cards Roster */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
          {filteredTeachers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No faculty members match your search criteria.
            </div>
          ) : (
            filteredTeachers.map((teacher) => {
              const isAbsent = teacher.status !== "Active";
              const isUnder = !isAbsent && teacher.current_load_hours < 20;
              const isOptimal =
                !isAbsent &&
                teacher.current_load_hours >= 20 &&
                teacher.current_load_hours <= 25;
              const isCapped = !isAbsent && teacher.current_load_hours > 25;

              const deptName = deptMap.get(teacher.department_id) || "Department";
              const loadPercent = Math.min(
                100,
                Math.round((teacher.current_load_hours / teacher.max_weekly_hours) * 100)
              );

              return (
                <div
                  key={teacher.id}
                  className={`p-3 rounded-xl border transition shadow-2xs group relative ${
                    isAbsent
                      ? "bg-slate-50 border-slate-300 opacity-80"
                      : isUnder
                      ? "bg-amber-50/40 border-amber-200 hover:border-amber-400"
                      : "bg-white border-[#E5CCE3] hover:border-[#A91079]"
                  }`}
                >
                  {/* Top Row: Name, Dept, Status */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {teacher.avatar_url ? (
                        <img
                          src={teacher.avatar_url}
                          alt={teacher.name}
                          className="w-8 h-8 rounded-xl object-cover shrink-0 border border-[#E5CCE3] bg-white"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <span
                        className={`w-8 h-8 rounded-xl bg-[#FDF2FA] text-[#A91079] flex items-center justify-center font-bold text-xs shrink-0 border border-[#E5CCE3] ${
                          teacher.avatar_url ? "hidden" : ""
                        }`}
                      >
                        {teacher.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-slate-900 truncate">
                            {teacher.name}
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          {teacher.position} • {deptName}
                        </p>
                      </div>
                    </div>

                    {/* Status Toggle Badge */}
                    <button
                      onClick={() =>
                        onTeacherStatusToggle(
                          teacher.id,
                          teacher.status === "Active" ? "On Leave" : "Active"
                        )
                      }
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold transition shrink-0 cursor-pointer ${
                        teacher.status === "Active"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-800"
                          : "bg-red-100 text-red-800 hover:bg-emerald-100 hover:text-emerald-800"
                      }`}
                      title="Click to toggle leave status"
                    >
                      {teacher.status}
                    </button>
                  </div>

                  {/* Class Advisory Tag */}
                  {teacher.is_adviser && teacher.advisory_section_id && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#A91079] bg-[#FDF2FA] px-2 py-0.5 rounded-md">
                      <UserCheck className="w-3 h-3 text-[#A91079] shrink-0" />
                      <span className="truncate">
                        Adviser: {secMap.get(teacher.advisory_section_id) || "Section"}
                      </span>
                    </div>
                  )}

                  {/* Workload Progress Bar */}
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-semibold text-slate-600 flex items-center gap-1">
                        {isUnder && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                        {isOptimal && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {isCapped && <AlertOctagon className="w-3 h-3 text-red-600" />}
                        {isAbsent && <HeartHandshake className="w-3 h-3 text-slate-500" />}
                        <span>
                          {isAbsent
                            ? "On Leave (0 hrs)"
                            : `~${(teacher.current_load_hours / 5).toFixed(1)}h/day avg`}
                        </span>
                      </span>
                      <span className="text-slate-400 font-mono text-[9px]">
                        Cap: ≤{teacher.max_daily_hours || 6}h/day
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isAbsent
                            ? "bg-slate-300"
                            : isUnder
                            ? "bg-amber-500"
                            : isOptimal
                            ? "bg-emerald-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${isAbsent ? 0 : loadPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    {onViewTeacherProfile && (
                      <button
                        onClick={() => onViewTeacherProfile(teacher)}
                        className="text-[#A91079] hover:text-[#703372] font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="View Full Profile and Schedule Matrix"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Profile & Schedule</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1">
                      {onEditTeacher && (
                        <button
                          onClick={() => onEditTeacher(teacher)}
                          className="p-1 rounded text-slate-400 hover:text-[#A91079] hover:bg-slate-100 transition cursor-pointer"
                          title="Edit Teacher"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                      {onDeleteTeacher && (
                        <button
                          onClick={() => onDeleteTeacher(teacher)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Remove Teacher"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#E5CCE3] bg-slate-50 text-[10px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#A91079]" />
            <span>Magna Carta Cap: ≤ 6h/day</span>
          </div>
        </div>
      </aside>
    </>
  );
};
