import {
  Calendar,
  Users,
  Building2,
  LogOut,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Cpu,
  UserCheck
} from "lucide-react";
import type { UserProfile } from "../api/client";

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Props {
  currentUser: UserProfile;
  activeView: string; // "CLASS_GRID" | "TEACHER_GRID" | "MASTER_GRID" | "FACULTY_LOAD" | "DEPT_DASHBOARD" | "DEPT_GRID" | "PROFILE" | "GENERATE_MASTER"
  onSelectView: (view: string) => void;
  departments?: Department[];
  selectedDeptId?: number | "ALL";
  onSelectDepartment?: (deptId: number | "ALL") => void;
  onLogout: () => void;
  onGenerateMaster?: () => void;
  onDynamicRepair?: () => void;
  onViewReport?: () => void;
  actionLoading?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar = ({
  currentUser,
  activeView,
  onSelectView,
  onSelectDepartment,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}: Props) => {
  const isPrincipal = currentUser.role === "PRINCIPAL";

  const initials =
    currentUser.name
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
      .slice(0, 2) || "SC";

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-72"
      } bg-[#2E0249] text-[#F3E5F2] border-r border-[#570A57] flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-40 shadow-xl no-print select-none`}
    >
      {/* Brand Header */}
      <div
        className={`border-b border-[#570A57] transition-all duration-200 ${
          collapsed
            ? "p-3 flex flex-col items-center gap-2.5"
            : "p-4 flex items-center justify-between"
        }`}
      >
        <div
          className={`flex items-center gap-3 overflow-hidden cursor-pointer ${
            collapsed ? "justify-center" : ""
          }`}
          onClick={() => onSelectView(isPrincipal ? "MASTER_GRID" : "DEPT_DASHBOARD")}
          title="DepEd SchedMaster (Key Stage 3)"
        >
          <div className="w-10 h-10 rounded-xl bg-[#570A57] border border-[#F806CC]/30 flex items-center justify-center text-[#F806CC] shrink-0 shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-tight truncate">
                  DepEd SchedMaster
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#570A57] text-[#FAF5FA] border border-[#A91079]/40">
                  {isPrincipal ? "Admin" : currentUser.department_code}
                </span>
              </div>
              <p className="text-[11px] text-[#D5B4DE] truncate">
                Junior High School • Grades 7–10
              </p>
            </div>
          )}
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`rounded-xl text-[#D5B4DE] hover:text-white hover:bg-[#570A57] transition cursor-pointer flex items-center justify-center ${
              collapsed
                ? "w-9 h-7 border border-[#570A57] hover:border-[#A91079] bg-[#220137]"
                : "p-1.5"
            }`}
            title={collapsed ? "Expand sidebar (full menu)" : "Collapse sidebar (icons only)"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-[#F806CC]" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Current Logged-in User Card */}
      <div className={`transition-all duration-200 ${collapsed ? "py-2 px-2 flex justify-center" : "p-3 mx-3 my-2.5 rounded-2xl bg-[#3D055E]/80 border border-[#570A57]"}`}>
        {collapsed ? (
          <button
            onClick={() => onSelectView("PROFILE")}
            className="w-10 h-10 rounded-xl bg-[#570A57] text-[#F806CC] flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer border border-[#A91079] overflow-hidden hover:ring-2 hover:ring-[#F806CC] transition"
            title={`${currentUser.name} (${currentUser.badge}) • View Profile`}
          >
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </button>
        ) : (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[#570A57] text-[#F806CC] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs overflow-hidden border border-[#A91079]">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-white truncate" title={currentUser.name}>
                  {currentUser.name}
                </span>
              </div>
              <div className="text-[11px] text-[#D5B4DE] font-medium truncate flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{currentUser.badge}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 space-y-3 scrollbar-thin">
        {/* Category 1: Timetables & Matrices */}
        <div>
          {!collapsed ? (
            <div className="text-xs font-semibold text-[#D5B4DE] px-3 mb-1.5">
              Timetables & Matrices
            </div>
          ) : (
            <div className="border-t border-[#570A57] my-1.5 mx-2" />
          )}

          <nav className="space-y-1">
            {/* If Dept Head, show Dept Dashboard */}
            {!isPrincipal && (
              <button
                onClick={() => onSelectView("DEPT_DASHBOARD")}
                className={`w-full flex items-center ${
                  collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2"
                } rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeView === "DEPT_DASHBOARD"
                    ? "bg-[#A91079] text-white shadow-md border-l-4 border-[#F806CC]"
                    : "text-[#E2C7E5] hover:text-white hover:bg-[#570A57]/60"
                }`}
                title="Department Dashboard Overview"
              >
                <Building2 className="w-4 h-4 shrink-0 text-[#F806CC]" />
                {!collapsed && <span className="truncate">Dept Dashboard</span>}
              </button>
            )}

            {/* Timetable Schedules Unified Tab (School Master, Class & Teacher) */}
            <button
              onClick={() => {
                if (isPrincipal && onSelectDepartment) {
                  onSelectDepartment("ALL");
                }
                if (
                  activeView !== "CLASS_GRID" &&
                  activeView !== "TEACHER_GRID" &&
                  activeView !== "MASTER_GRID" &&
                  activeView !== "DEPT_GRID"
                ) {
                  onSelectView("MASTER_GRID");
                }
              }}
              className={`w-full flex items-center ${
                collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2"
              } rounded-xl text-xs font-medium transition cursor-pointer ${
                activeView === "CLASS_GRID" ||
                activeView === "TEACHER_GRID" ||
                activeView === "MASTER_GRID" ||
                activeView === "DEPT_GRID"
                  ? "bg-[#A91079] text-white shadow-md border-l-4 border-[#F806CC]"
                  : "text-[#E2C7E5] hover:text-white hover:bg-[#570A57]/60"
              }`}
              title="Timetable Schedules (Class, Teacher & School Master)"
            >
              <Calendar className="w-4 h-4 shrink-0 text-[#F806CC]" />
              {!collapsed && <span className="truncate">Timetable Schedules</span>}
            </button>
          </nav>
        </div>

        {/* Category: Academic Structure */}
        <div>
          {!collapsed ? (
            <div className="text-xs font-semibold text-[#D5B4DE] px-3 mb-1.5">
              Academic Structure
            </div>
          ) : (
            <div className="border-t border-[#570A57] my-1.5 mx-2" />
          )}

          <nav className="space-y-1">
            <button
              onClick={() => onSelectView("SECTIONS")}
              className={`w-full flex items-center ${
                collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2"
              } rounded-xl text-xs font-medium transition cursor-pointer ${
                activeView === "SECTIONS"
                  ? "bg-[#A91079] text-white shadow-md border-l-4 border-[#F806CC]"
                  : "text-[#E2C7E5] hover:text-white hover:bg-[#570A57]/60"
              }`}
              title="Section Management"
            >
              <GraduationCap className="w-4 h-4 shrink-0 text-[#F806CC]" />
              {!collapsed && (
                <span className="truncate">Section Management</span>
              )}
            </button>
          </nav>
        </div>

        {/* Category 2: Faculty & Magna Carta */}
        <div>
          {!collapsed ? (
            <div className="text-xs font-semibold text-[#D5B4DE] px-3 mb-1.5">
              Faculty & Magna Carta
            </div>
          ) : (
            <div className="border-t border-[#570A57] my-1.5 mx-2" />
          )}

          <nav className="space-y-1">
            {/* Faculty Workload Hub */}
            <button
              onClick={() => onSelectView("FACULTY_LOAD")}
              className={`w-full flex items-center ${
                collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2"
              } rounded-xl text-xs font-medium transition cursor-pointer ${
                activeView === "FACULTY_LOAD"
                  ? "bg-[#A91079] text-white shadow-md border-l-4 border-[#F806CC]"
                  : "text-[#E2C7E5] hover:text-white hover:bg-[#570A57]/60"
              }`}
              title="Faculty Workload & Directory Hub"
            >
              <Users className="w-4 h-4 shrink-0 text-[#F806CC]" />
              {!collapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">Faculty Workload</span>
                  {!isPrincipal && (
                    <span className="text-[10px] bg-[#570A57] text-emerald-300 px-1.5 py-0.5 rounded font-medium border border-[#A91079]/40">
                      Dept
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Profile Tab */}
            <button
              onClick={() => onSelectView("PROFILE")}
              className={`w-full flex items-center ${
                collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2"
              } rounded-xl text-xs font-medium transition cursor-pointer ${
                activeView === "PROFILE"
                  ? "bg-[#A91079] text-white shadow-md border-l-4 border-[#F806CC]"
                  : "text-[#E2C7E5] hover:text-white hover:bg-[#570A57]/60"
              }`}
              title={isPrincipal ? "School Head Profile & Summary" : "Department Head Profile & Schedule"}
            >
              <UserCheck className="w-4 h-4 shrink-0 text-[#F806CC]" />
              {!collapsed && (
                <span className="truncate">
                  {isPrincipal ? "Principal Profile" : "My Profile & Classes"}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Category 3: Optimization & Tools */}
        <div>
          {!collapsed ? (
            <div className="text-xs font-semibold text-[#D5B4DE] px-3 mb-1.5">
              Optimization & Tools
            </div>
          ) : (
            <div className="border-t border-[#570A57] my-1.5 mx-2" />
          )}

          <div className="space-y-1">
            {/* Schedule Generator Tab */}
            <button
              onClick={() => onSelectView("GENERATE_MASTER")}
              className={`w-full flex items-center ${
                collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2"
              } rounded-xl text-xs font-medium transition cursor-pointer ${
                activeView === "GENERATE_MASTER"
                  ? "bg-[#A91079] text-white shadow-md border-l-4 border-[#F806CC]"
                  : "text-[#E2C7E5] hover:text-white hover:bg-[#570A57]/60"
              }`}
              title="Schedule Generator"
            >
              <Cpu className="w-4 h-4 shrink-0 text-[#F806CC]" />
              {!collapsed && (
                <span className="truncate">Schedule Generator</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Sign Out */}
      <div className="p-3 border-t border-[#570A57] bg-[#220137]">
        <button
          onClick={onLogout}
          className={`w-full flex items-center ${
            collapsed ? "justify-center py-2.5 px-0" : "justify-center gap-2 px-3 py-2"
          } text-rose-300 hover:text-white hover:bg-rose-950/40 rounded-xl text-xs font-bold transition cursor-pointer border border-rose-900/30`}
          title="Sign Out / Switch Dept"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out / Switch Dept</span>}
        </button>
      </div>
    </aside>
  );
};
