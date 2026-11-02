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
  Trash2
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
  teachers: Teacher[];
  departments: Department[];
  sections: Section[];
  onTeacherStatusToggle: (teacherId: number, newStatus: string) => void;
  onAddTeacher?: () => void;
  onEditTeacher?: (teacher: Teacher) => void;
  onDeleteTeacher?: (teacher: Teacher) => void;
}

export const TeacherLoadSidebar = ({
  teachers,
  departments,
  sections,
  onTeacherStatusToggle,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
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

  return (
    <aside className="w-80 bg-white border-r border-[#E5CCE3] flex flex-col h-full shrink-0 shadow-xs">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-[#E5CCE3] bg-slate-50/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#A91079]" />
            <h2 className="text-sm font-bold text-slate-900">Faculty Workload</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3E5F2] text-[#A91079]">
              ≤ 6h/day
            </span>
            {onAddTeacher && (
              <button
                onClick={() => onAddTeacher()}
                className="p-1 rounded-lg bg-[#A91079] hover:bg-[#8F0B66] text-white shadow-2xs transition cursor-pointer flex items-center gap-1 text-[10px] font-bold px-2 py-0.5"
                title="Add New Faculty Member"
              >
                <UserPlus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Max 6 hrs/day classroom teaching. Underloaded faculty prioritized for substitutions.
        </p>

        {/* Summary Counter Pills */}
        <div className="grid grid-cols-3 gap-1.5 mt-3 text-center text-xs">
          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200" title="20-25 hrs/week">
            <span className="block font-bold text-emerald-700">{optimalCount}</span>
            <span className="text-[10px] text-emerald-600 uppercase font-semibold">Optimal</span>
          </div>
          <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200" title="< 20 hrs/week">
            <span className="block font-bold text-amber-700">{underloadedCount}</span>
            <span className="text-[10px] text-amber-600 uppercase font-semibold">Underload</span>
          </div>
          <div className="p-1.5 rounded-lg bg-red-50 border border-red-200" title="On Leave / Wellness">
            <span className="block font-bold text-red-700">{onLeaveCount}</span>
            <span className="text-[10px] text-red-600 uppercase font-semibold">On Leave</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="p-3 border-b border-[#E5CCE3] space-y-2 bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search faculty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-[#E5CCE3] rounded-lg focus:outline-hidden focus:border-[#A91079] text-slate-800"
          />
        </div>

        <select
          value={filterDept}
          onChange={(e) =>
            setFilterDept(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
          }
          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-[#E5CCE3] rounded-lg text-slate-700 focus:outline-hidden cursor-pointer"
        >
          <option value="ALL">All 8 Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
      </div>

      {/* Faculty List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
        {filteredTeachers.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No faculty members found.
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

            // Percentage of standard 30 hrs/wk load
            const loadPercent = Math.min(
              100,
              Math.round((teacher.current_load_hours / teacher.max_weekly_hours) * 100)
            );

            return (
              <div
                key={teacher.id}
                className={`p-3 rounded-xl border transition shadow-2xs group relative ${
                  isAbsent
                    ? "bg-slate-100/80 border-slate-300 opacity-75"
                    : isUnder
                    ? "bg-amber-50/50 border-amber-200 hover:border-amber-400"
                    : "bg-white border-[#E5CCE3] hover:border-[#A91079]"
                }`}
              >
                {/* Top row: Name & Actions */}
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">
                      {teacher.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {teacher.position} • {deptName}
                    </p>
                  </div>

                  {/* Actions: Edit, Delete, Status Toggle */}
                  <div className="flex items-center gap-1">
                    {onEditTeacher && (
                      <button
                        onClick={() => onEditTeacher(teacher)}
                        className="p-1 rounded text-slate-400 hover:text-[#A91079] hover:bg-slate-100 transition cursor-pointer opacity-70 group-hover:opacity-100"
                        title="Edit faculty member"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    {onDeleteTeacher && (
                      <button
                        onClick={() => onDeleteTeacher(teacher)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer opacity-70 group-hover:opacity-100"
                        title="Remove faculty member"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        onTeacherStatusToggle(
                          teacher.id,
                          teacher.status === "Active" ? "On Leave" : "Active"
                        )
                      }
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold transition cursor-pointer ${
                        teacher.status === "Active"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-800"
                          : "bg-red-100 text-red-800 hover:bg-emerald-100 hover:text-emerald-800"
                      }`}
                      title="Click to toggle teacher leave status and trigger dynamic repair"
                    >
                      {teacher.status}
                    </button>
                  </div>
                </div>

                {/* Class Advisory Tag */}
                {teacher.is_adviser && teacher.advisory_section_id && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#A91079] bg-[#FDF2FA] px-2 py-0.5 rounded-md">
                    <UserCheck className="w-3 h-3 text-[#A91079]" />
                    <span>Adviser: {secMap.get(teacher.advisory_section_id) || "Assigned Section"}</span>
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
                          : `${teacher.current_load_hours} hrs/week`}
                      </span>
                    </span>
                    <span className="text-slate-400 font-mono">
                      max {teacher.max_daily_hours}h/day
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
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
