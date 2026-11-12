import { useState } from "react";
import {
  Calendar,
  Lock,
  Building,
  UserCheck,
  Edit3,
  Printer,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import type { UserProfile } from "../api/client";
import { EditPrincipalModal } from "./EditPrincipalModal";

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

interface Props {
  teacher: Teacher | null;
  currentUser: UserProfile;
  departments: Department[];
  sections: Section[];
  slots: ScheduleSlot[];
  teachers?: Teacher[];
  onEditTeacher?: (teacher: Teacher) => void;
  onToggleStatus?: (teacherId: number, status: string) => void;
  onUpdateCurrentUser?: (updated: UserProfile) => void;
  onBack?: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIOD_HEADERS = [
  { index: 1, name: "Period 1", time: "7:00 – 8:00 AM" },
  { index: 2, name: "Period 2", time: "8:00 – 9:00 AM" },
  { index: 3, name: "Period 3", time: "9:20 – 10:20 AM" },
  { index: 4, name: "Period 4", time: "10:20 – 11:20 AM" },
  { index: 5, name: "Period 5", time: "12:00 – 1:00 PM" },
  { index: 6, name: "Period 6", time: "1:00 – 2:00 PM" },
  { index: 7, name: "Period 7", time: "2:00 – 3:00 PM (ARAL/Elective)" },
];

export const ProfileView = ({
  teacher,
  currentUser,
  departments,
  sections,
  slots,
  onEditTeacher,
  onToggleStatus,
  onUpdateCurrentUser,
  onBack,
}: Props) => {
  const [isEditPrincipalOpen, setIsEditPrincipalOpen] = useState(false);
  const deptMap = new Map<number, Department>(departments.map((d) => [d.id, d]));
  const secMap = new Map<number, Section>(sections.map((s) => [s.id, s]));

  // If teacher is null, create a display profile from currentUser
  const displayTeacher: Teacher = teacher || {
    id: 0,
    name: currentUser.name,
    department_id: currentUser.department_id || 1,
    position: currentUser.position,
    max_daily_hours: 6,
    max_weekly_hours: 30,
    current_load_hours: 0,
    is_adviser: false,
    advisory_section_id: null,
    status: "Active",
  };

  const currentDept = deptMap.get(displayTeacher.department_id);
  const advisorySection = displayTeacher.advisory_section_id
    ? secMap.get(displayTeacher.advisory_section_id)
    : null;

  // Filter slots for this teacher
  const teacherSlots = slots.filter((s) => s.teacher_id === displayTeacher.id);

  // Slot lookup map: "day_period" -> ScheduleSlot
  const slotMap = new Map<string, ScheduleSlot>();
  teacherSlots.forEach((s) => {
    slotMap.set(`${s.day_of_week}_${s.period_index}`, s);
  });

  // Calculate daily workload hours
  const dailyHours = [0, 0, 0, 0, 0];
  teacherSlots.forEach((s) => {
    if (s.day_of_week >= 0 && s.day_of_week <= 4) {
      dailyHours[s.day_of_week] += 1;
    }
  });

  const isAbsent = displayTeacher.status !== "Active";
  const isPrincipal =
    (!teacher && currentUser.role === "PRINCIPAL") ||
    displayTeacher.position?.toLowerCase().includes("principal") ||
    (currentUser.role === "PRINCIPAL" && (displayTeacher.name === currentUser.name || displayTeacher.id === 0));

  const isUnder = !isAbsent && !isPrincipal && displayTeacher.current_load_hours < 20;
  const isOptimal =
    !isAbsent &&
    !isPrincipal &&
    displayTeacher.current_load_hours >= 20 &&
    displayTeacher.current_load_hours <= 25;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between no-print">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-[#E5CCE3] hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Return to Timetable Matrix</span>
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {isPrincipal ? (
            <button
              onClick={() => setIsEditPrincipalOpen(true)}
              className="px-3.5 py-2 bg-white border border-[#E5CCE3] hover:bg-[#FAF5FA] text-[#2E0249] rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#A91079]" />
              <span>Edit Principal Profile</span>
            </button>
          ) : (
            teacher && onEditTeacher && (
              <button
                onClick={() => onEditTeacher(teacher)}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Edit Profile</span>
              </button>
            )
          )}

          {!isPrincipal && (
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Faculty Schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Header Hero Card */}
      <div className="bg-white rounded-3xl border border-[#E5CCE3] p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FDF2FA]/80 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-5 z-10">
          {displayTeacher.avatar_url ? (
            <img
              src={displayTeacher.avatar_url}
              alt={displayTeacher.name}
              className="w-20 h-20 rounded-2xl object-cover shadow-md shrink-0 border-2 border-[#E5CCE3] bg-white"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#570A57] via-[#A91079] to-[#F806CC] text-white flex items-center justify-center font-extrabold text-2xl shadow-md shrink-0 ${
              displayTeacher.avatar_url ? "hidden" : ""
            }`}
          >
            {displayTeacher.name
              .split(" ")
              .filter(
                (n) =>
                  !n.startsWith("Dr.") &&
                  !n.startsWith("Mrs.") &&
                  !n.startsWith("Mr.") &&
                  !n.startsWith("G.") &&
                  !n.startsWith("Bb.") &&
                  !n.startsWith("Mme.")
              )
              .map((n) => n[0])
              .join("")
              .slice(0, 2) || "FT"}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {displayTeacher.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F3E5F2] text-[#A91079]">
                {currentDept?.code || "FACULTY"}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  displayTeacher.status === "Active"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {displayTeacher.status}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span className="font-bold text-slate-700">{displayTeacher.position}</span>
              <span>•</span>
              <span>{currentDept?.name || "Academic Department"}</span>
            </p>

            {isPrincipal && (currentUser.email || currentUser.phone || currentUser.office_location) && (
              <div className="flex items-center gap-3 flex-wrap text-xs font-semibold text-[#703372] pt-1">
                {currentUser.email && (
                  <span className="flex items-center gap-1 bg-[#FAF5FA] border border-[#E5CCE3] px-2.5 py-1 rounded-lg">
                    <Mail className="w-3.5 h-3.5 text-[#A91079]" />
                    <span>{currentUser.email}</span>
                  </span>
                )}
                {currentUser.phone && (
                  <span className="flex items-center gap-1 bg-[#FAF5FA] border border-[#E5CCE3] px-2.5 py-1 rounded-lg">
                    <Phone className="w-3.5 h-3.5 text-[#A91079]" />
                    <span>{currentUser.phone}</span>
                  </span>
                )}
                {currentUser.office_location && (
                  <span className="flex items-center gap-1 bg-[#FAF5FA] border border-[#E5CCE3] px-2.5 py-1 rounded-lg">
                    <MapPin className="w-3.5 h-3.5 text-[#A91079]" />
                    <span>{currentUser.office_location}</span>
                  </span>
                )}
              </div>
            )}

            {advisorySection && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#703372] bg-[#FDF2FA] border border-[#E5CCE3] px-3 py-1 rounded-xl mt-1">
                <UserCheck className="w-4 h-4 text-[#A91079]" />
                <span>
                  Designated Class Adviser: {advisorySection.name} (Grade {advisorySection.grade_level})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Status Toggle Actions */}
        {teacher && onToggleStatus && (
          <div className="flex flex-wrap items-center gap-2 z-10 no-print">
            {displayTeacher.status === "Active" ? (
              <>
                <button
                  onClick={() => onToggleStatus(displayTeacher.id, "On Leave")}
                  className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Mark On Leave
                </button>
                <button
                  onClick={() => onToggleStatus(displayTeacher.id, "Wellness Leave")}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="DO 002, s. 2026 Mental Health / Wellness Leave"
                >
                  Wellness Leave
                </button>
              </>
            ) : (
              <button
                onClick={() => onToggleStatus(displayTeacher.id, "Active")}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Mark Active
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI & Institutional Profile Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weekly Load Card */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5CCE3] shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isPrincipal ? "Instructional Role" : "Weekly Instructional Load"}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {isPrincipal ? "School Head" : displayTeacher.current_load_hours}
            </span>
            {!isPrincipal && (
              <span className="text-xs text-slate-500">
                / {displayTeacher.max_weekly_hours} hrs max
              </span>
            )}
          </div>
          <div className="pt-1">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isPrincipal
                  ? "bg-[#F3E5F2] text-[#A91079]"
                  : isAbsent
                  ? "bg-slate-100 text-slate-500"
                  : isUnder
                  ? "bg-amber-100 text-amber-800"
                  : isOptimal
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {isPrincipal
                ? "Executive Administration"
                : isAbsent
                ? "On Leave (0 hrs)"
                : isUnder
                ? "Underloaded"
                : isOptimal
                ? "Optimal Teaching Load"
                : "Workload Capped"}
            </span>
          </div>
        </div>

        {/* Daily Cap / Scope Card */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5CCE3] shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isPrincipal ? "Administrative Scope" : "Daily Teaching Cap"}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#A91079]">
              {isPrincipal
                ? `${departments.length} Departments`
                : `≤ ${displayTeacher.max_daily_hours} hrs`}
            </span>
            {!isPrincipal && <span className="text-xs text-slate-500">per day</span>}
          </div>
          <p className="text-[10px] text-slate-400 pt-1">
            {isPrincipal
              ? "Institutional School Oversight"
              : "Daily 6-Hour Teaching Ceiling"}
          </p>
        </div>

        {/* Advisory / Sections Card */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5CCE3] shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isPrincipal ? "Supervised Sections" : "Class Advisory Role"}
          </div>
          <div className="text-sm font-extrabold text-slate-900 truncate">
            {isPrincipal
              ? `${sections.length} Student Sections`
              : advisorySection
              ? advisorySection.name
              : "Subject Specialist"}
          </div>
          <p className="text-[10px] text-slate-400 pt-1">
            {isPrincipal
              ? "Junior High School (Grades 7–10)"
              : advisorySection
              ? "Mon 7:00–8:00 AM Homeroom Lock"
              : "No Section Advisory Duties"}
          </p>
        </div>

        {/* Daily Hours Balance / Governance Card */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5CCE3] shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isPrincipal ? "Master Timetable Authority" : "Daily Hours Distribution"}
          </div>
          {isPrincipal ? (
            <div className="pt-1">
              <span className="text-sm font-extrabold text-emerald-700 block">
                Final Deployment Authority
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                Sole signatory for official school schedule deployment
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pt-1 text-xs font-bold text-slate-700">
              {DAYS.map((day, idx) => (
                <div
                  key={day}
                  className="flex-1 p-1 bg-slate-50 border border-[#E5CCE3] rounded-lg text-center"
                  title={`${day}: ${dailyHours[idx]} hours`}
                >
                  <div className="text-[9px] text-slate-400 font-semibold">{day.slice(0, 1)}</div>
                  <div className={dailyHours[idx] > 6 ? "text-red-600" : "text-slate-800"}>
                    {dailyHours[idx]}h
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Individual Teacher Timetable Grid (Hidden for Principal Profile) */}
      {!isPrincipal ? (
        <div className="bg-white rounded-3xl border border-[#E5CCE3] shadow-xs overflow-hidden">
          <div className="p-5 border-b border-[#E5CCE3] bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#A91079]" />
                <span>{displayTeacher.name}'s Weekly Teaching Schedule</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Weekly instructional assignment and room schedule
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-[#F3E5F2] text-[#A91079] border border-[#E5CCE3]">
              {teacherSlots.length} Total Instructional Hours
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[950px] text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-[#E5CCE3]">
                  <th className="p-3 w-28 text-left border-r border-[#E5CCE3]">Day</th>
                  {PERIOD_HEADERS.slice(0, 2).map((p) => (
                    <th key={p.index} className="p-2.5 text-center border-r border-[#E5CCE3] min-w-[120px]">
                      <div>{p.name}</div>
                      <div className="text-[9px] text-slate-400 font-normal">{p.time}</div>
                    </th>
                  ))}
                  {/* Health Break */}
                  <th className="p-2 text-center bg-emerald-50/80 border-r border-[#E5CCE3] w-24 text-[10px] text-emerald-800 font-bold">
                    Health Break
                    <div className="text-[9px] text-emerald-600 font-normal">9:00 – 9:20</div>
                  </th>
                  {PERIOD_HEADERS.slice(2, 4).map((p) => (
                    <th key={p.index} className="p-2.5 text-center border-r border-[#E5CCE3] min-w-[120px]">
                      <div>{p.name}</div>
                      <div className="text-[9px] text-slate-400 font-normal">{p.time}</div>
                    </th>
                  ))}
                  {/* Lunch Break */}
                  <th className="p-2 text-center bg-amber-50/80 border-r border-[#E5CCE3] w-24 text-[10px] text-amber-800 font-bold">
                    Lunch Break
                    <div className="text-[9px] text-amber-600 font-normal">11:20 – 12:00</div>
                  </th>
                  {PERIOD_HEADERS.slice(4).map((p) => (
                    <th key={p.index} className="p-2.5 text-center border-r border-[#E5CCE3] min-w-[120px] last:border-r-0">
                      <div>{p.name}</div>
                      <div className="text-[9px] text-slate-400 font-normal">{p.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DAYS.map((dayName, dayIdx) => (
                  <tr key={dayName} className="hover:bg-slate-50/40 transition">
                    {/* Day Label */}
                    <td className="p-3 font-bold text-slate-900 border-r border-[#E5CCE3] bg-slate-50/50">
                      {dayName}
                    </td>

                    {/* Period 1 */}
                    {renderTeacherSlotCell(dayIdx, 1, slotMap, displayTeacher)}

                    {/* Period 2 */}
                    {renderTeacherSlotCell(dayIdx, 2, slotMap, displayTeacher)}

                    {/* Health Break */}
                    <td className="p-2 text-center bg-emerald-50/40 border-r border-[#E5CCE3] text-emerald-800 text-[10px] font-semibold">
                      Break
                    </td>

                    {/* Period 3 */}
                    {renderTeacherSlotCell(dayIdx, 3, slotMap, displayTeacher)}

                    {/* Period 4 */}
                    {renderTeacherSlotCell(dayIdx, 4, slotMap, displayTeacher)}

                    {/* Lunch Break */}
                    <td className="p-2 text-center bg-amber-50/40 border-r border-[#E5CCE3] text-amber-800 text-[10px] font-semibold">
                      Lunch
                    </td>

                    {/* Period 5 */}
                    {renderTeacherSlotCell(dayIdx, 5, slotMap, displayTeacher)}

                    {/* Period 6 */}
                    {renderTeacherSlotCell(dayIdx, 6, slotMap, displayTeacher)}

                    {/* Period 7 (ARAL / Elective) */}
                    {renderTeacherSlotCell(dayIdx, 7, slotMap, displayTeacher)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Executive School Governance & Department Portfolio Card for Principal */
        <div className="bg-white rounded-3xl border border-[#E5CCE3] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5CCE3] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#F3E5F2] text-[#A91079] rounded-2xl">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#2E0249]">
                  Institutional Academic Portfolio & Department Overview
                </h3>
                <p className="text-xs text-[#703372]">
                  Consolidated management of academic departments, faculty distribution, and class sections
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold">
              School Head Governance Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="p-3.5 bg-[#FAF5FA] border border-[#E5CCE3] rounded-2xl flex items-center justify-between hover:border-[#A91079]/40 transition"
              >
                <div>
                  <span className="font-extrabold text-xs text-[#2E0249] block">
                    {dept.name}
                  </span>
                  <span className="text-[11px] text-[#703372] block">
                    Department Code: {dept.code}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-white border border-[#E5CCE3] rounded-lg text-[10px] font-bold text-[#A91079]">
                  {dept.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Principal Profile Modal */}
      <EditPrincipalModal
        isOpen={isEditPrincipalOpen}
        onClose={() => setIsEditPrincipalOpen(false)}
        currentUser={currentUser}
        onSave={(updated) => {
          onUpdateCurrentUser?.(updated);
        }}
      />
    </div>
  );
};

function renderTeacherSlotCell(
  day: number,
  period: number,
  slotMap: Map<string, ScheduleSlot>,
  teacher: Teacher
) {
  const slot = slotMap.get(`${day}_${period}`);
  const isHomeroomLock = day === 0 && period === 1 && teacher.is_adviser;

  if (!slot) {
    return (
      <td
        key={`${day}_${period}`}
        className="p-1.5 border-r border-[#E5CCE3] last:border-r-0 align-top"
      >
        <div className="h-16 rounded-xl border border-dashed border-[#E5CCE3] flex flex-col items-center justify-center text-[10px] text-slate-400 font-medium bg-slate-50/20">
          <span>Non-Teaching</span>
          <span className="text-[9px] text-slate-300">Prep / Consultation</span>
        </div>
      </td>
    );
  }

  return (
    <td
      key={`${day}_${period}`}
      className="p-1.5 border-r border-[#E5CCE3] last:border-r-0 align-top"
    >
      <div
        className={`p-2.5 rounded-xl border transition shadow-2xs ${
          isHomeroomLock
            ? "bg-[#FDF2FA] border-[#A91079]"
            : "bg-white border-[#E5CCE3] hover:border-[#A91079]"
        }`}
      >
        {isHomeroomLock && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-[#A91079] bg-[#F3E5F2] px-1.5 py-0.2 rounded w-fit mb-1">
            <Lock className="w-2.5 h-2.5" />
            <span>ADVISER HOMEROOM</span>
          </div>
        )}

        <div className="font-bold text-xs text-slate-900 truncate">
          {slot.subject_name}
        </div>

        <div className="text-[11px] font-semibold text-[#A91079] truncate mt-0.5">
          {slot.section_name}
        </div>

        <div className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
          <Building className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{slot.room_number || "Classroom"}</span>
        </div>
      </div>
    </td>
  );
}
