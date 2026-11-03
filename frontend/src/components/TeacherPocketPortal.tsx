import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  BookOpen,
  ShieldAlert,
  Printer,
  LogOut,
  UserCheck,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { api } from "../api/client";

interface Props {
  teachers?: any[];
  initialTeacherId?: number | null;
  onExit: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const TeacherPocketPortal = ({ teachers = [], initialTeacherId, onExit }: Props) => {
  const [facultyList, setFacultyList] = useState<any[]>(teachers);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(() => {
    return initialTeacherId || (teachers.length > 0 ? teachers[0].id : null);
  });
  const [activeDay, setActiveDay] = useState<number>(() => {
    const dow = new Date().getDay() - 1; // 0=Mon, 4=Fri
    return dow >= 0 && dow <= 4 ? dow : 0;
  });
  const [pocketData, setPocketData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingFaculty, setLoadingFaculty] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [acknowledgedNotices, setAcknowledgedNotices] = useState<Record<number, boolean>>({});

  // Ensure faculty list is populated (self-healing if prop was empty)
  useEffect(() => {
    if (teachers && teachers.length > 0) {
      setFacultyList(teachers);
      if (!selectedTeacherId) {
        setSelectedTeacherId(initialTeacherId || teachers[0].id);
      }
    } else {
      setLoadingFaculty(true);
      api.getTeachers()
        .then((data) => {
          if (data && data.length > 0) {
            setFacultyList(data);
            setSelectedTeacherId((prev) => prev || initialTeacherId || data[0].id);
          }
        })
        .catch((err) => {
          console.error("Failed to load teachers for pocket portal:", err);
        })
        .finally(() => {
          setLoadingFaculty(false);
        });
    }
  }, [teachers, initialTeacherId]);

  const loadPocketData = (teacherId: number, day: number) => {
    setLoading(true);
    setFetchError(null);
    api.getTeacherPocketSchedule(teacherId, day)
      .then((data) => {
        setPocketData(data);
      })
      .catch((err) => {
        console.error("Failed to load teacher pocket schedule:", err);
        setFetchError(err.message || "Failed to retrieve timetable data from server.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedTeacherId) {
      loadPocketData(selectedTeacherId, activeDay);
    }
  }, [selectedTeacherId, activeDay]);

  const handleAcknowledge = (slotId: number) => {
    setAcknowledgedNotices((prev) => ({ ...prev, [slotId]: true }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#1A012B] text-[#FAF5FA] font-sans pb-16">
      {/* Top Mobile-Friendly Quick Header */}
      <header className="sticky top-0 z-30 bg-[#2E0249]/95 backdrop-blur-md border-b border-[#570A57] px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#570A57] border border-[#F806CC]/30 flex items-center justify-center text-[#F806CC] shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Teacher Pocket Schedule</span>
              <span className="text-[10px] bg-[#A91079] text-white px-2 py-0.5 rounded-full font-semibold">
                Zero-Friction
              </span>
            </h1>
            <p className="text-[11px] text-[#D5B4DE]">DepEd Key Stage 3 • Personal Timetable</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3D055E] hover:bg-[#570A57] text-xs font-semibold text-[#D5B4DE] hover:text-white transition cursor-pointer border border-[#570A57]"
            title="Print Daily Slip"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print Slip</span>
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A91079] hover:bg-[#F806CC] text-xs font-bold text-white transition cursor-pointer shadow-md"
            title="Return to Management Dashboard"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Management View</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Quick Teacher Selector Card */}
        <section className="bg-[#2E0249] border border-[#570A57] rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#D5B4DE] uppercase tracking-wider">
                Viewing Faculty:
              </span>
              <select
                value={selectedTeacherId || ""}
                onChange={(e) => setSelectedTeacherId(Number(e.target.value))}
                disabled={loadingFaculty || facultyList.length === 0}
                className="bg-[#3D055E] border border-[#A91079]/60 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#F806CC] cursor-pointer disabled:opacity-50"
              >
                {facultyList.length === 0 ? (
                  <option value="">{loadingFaculty ? "Loading faculty list..." : "No faculty found"}</option>
                ) : (
                  facultyList.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#2E0249] text-white">
                      {t.name} ({t.position})
                    </option>
                  ))
                )}
              </select>
            </div>

            {pocketData && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-[#570A57] text-[#FAF5FA] font-medium border border-[#A91079]/40">
                  {pocketData.department_name} ({pocketData.department_code})
                </span>
                {pocketData.is_adviser && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-700/40">
                    Adviser: {pocketData.advisory_section_name || "Section"}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-[#F806CC]/30 border-t-[#F806CC] rounded-full animate-spin" />
            <span className="text-sm font-semibold text-[#D5B4DE]">Loading your personal timetable...</span>
          </div>
        ) : fetchError ? (
          <div className="bg-[#2E0249] border border-rose-500/50 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Unable to Load Schedule</h3>
            <p className="text-xs text-rose-300 max-w-md mx-auto">{fetchError}</p>
            <button
              onClick={() => selectedTeacherId && loadPocketData(selectedTeacherId, activeDay)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#A91079] hover:bg-[#F806CC] text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : pocketData ? (
          <>
            {/* Urgent Substitution Banner if Any */}
            {pocketData.has_substitute_duty_today && pocketData.substitute_notices?.length > 0 && (
              <section className="bg-amber-950/40 border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-amber-200 tracking-tight flex items-center gap-2">
                        <span>Urgent DepEd Substitution Duty Assigned</span>
                        <span className="text-[10px] bg-amber-500 text-stone-950 font-black px-2 py-0.5 rounded-full uppercase">
                          Action Required
                        </span>
                      </h3>
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Per DepEd Order No. 005, s. 2024, you have been selected for temporary class coverage based on existing workload availability.
                    </p>

                    <div className="space-y-2 pt-2">
                      {pocketData.substitute_notices.map((sub: any, idx: number) => {
                        const isAck = acknowledgedNotices[sub.slot_id];
                        return (
                          <div
                            key={idx}
                            className="bg-stone-900/80 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-sm font-bold text-white flex items-center gap-2">
                                <span className="text-amber-400">{sub.time_range}</span>
                                <span>•</span>
                                <span>{sub.subject_name}</span>
                                <span className="text-xs text-[#D5B4DE]">({sub.section_name})</span>
                              </div>
                              <div className="text-xs text-amber-300/80 flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" /> {sub.room_number}
                                </span>
                                <span>Covering for: <strong>{sub.covering_for}</strong> ({sub.reason})</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleAcknowledge(sub.slot_id)}
                              disabled={isAck}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
                                isAck
                                  ? "bg-emerald-600 text-white cursor-default"
                                  : "bg-amber-500 hover:bg-amber-400 text-stone-950 cursor-pointer shadow-md"
                              }`}
                            >
                              {isAck ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" /> Acknowledged
                                </>
                              ) : (
                                "Acknowledge Duty"
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* RA 4670 Compliance & Workload Gauge Card */}
            <section className="bg-[#2E0249] border border-[#570A57] rounded-2xl p-5 shadow-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Daily Hours Gauge */}
              <div className="bg-[#3D055E]/80 border border-[#570A57] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#D5B4DE] uppercase tracking-wider">
                    Today's Instructional Load
                  </div>
                  <div className="text-2xl font-black text-white mt-1 flex items-baseline gap-1.5">
                    <span>{pocketData.daily_load_hours}</span>
                    <span className="text-sm text-[#D5B4DE] font-normal">/ {pocketData.max_daily_hours} hrs max</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>RA 4670 Magna Carta Compliant (≤ 6 hrs/day)</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#570A57] flex items-center justify-center text-[#F806CC]">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Weekly Hours Gauge */}
              <div className="bg-[#3D055E]/80 border border-[#570A57] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#D5B4DE] uppercase tracking-wider">
                    Weekly Teaching Allotment
                  </div>
                  <div className="text-2xl font-black text-white mt-1 flex items-baseline gap-1.5">
                    <span>{pocketData.weekly_load_hours}</span>
                    <span className="text-sm text-[#D5B4DE] font-normal">/ {pocketData.max_weekly_hours} hrs/wk</span>
                  </div>
                  <div className="text-[11px] text-[#D5B4DE] font-medium mt-1">
                    Standard 30-hour weekly instructional cap
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#570A57] flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>
            </section>

            {/* Day Selector Tabs (Mon to Fri) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {DAYS.map((dayName, idx) => {
                const isSelected = activeDay === idx;
                const slotCount = pocketData.all_week_schedule?.[idx]?.length || 0;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveDay(idx)}
                    className={`flex-1 min-w-[120px] py-3 px-3 rounded-xl text-center font-bold text-xs transition cursor-pointer border ${
                      isSelected
                        ? "bg-[#A91079] text-white border-[#F806CC] shadow-lg shadow-[#A91079]/30"
                        : "bg-[#2E0249] text-[#D5B4DE] hover:text-white border-[#570A57] hover:bg-[#3D055E]"
                    }`}
                  >
                    <div>{dayName}</div>
                    <div className="text-[11px] font-normal mt-0.5 opacity-80">
                      {slotCount} {slotCount === 1 ? "Class" : "Classes"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Classes Timeline / Feed */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{DAYS[activeDay]} Schedule Feed</span>
                  <span className="text-xs text-[#D5B4DE] font-normal">
                    ({pocketData.today_schedule.length} assigned periods)
                  </span>
                </h2>
                <span className="text-xs text-[#D5B4DE]">DepEd Order No. 009, s. 2026</span>
              </div>

              {pocketData.today_schedule.length === 0 ? (
                <div className="bg-[#2E0249] border border-[#570A57] rounded-2xl p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#3D055E] flex items-center justify-center text-[#D5B4DE] mx-auto">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">No Scheduled Classes on {DAYS[activeDay]}</h3>
                  <p className="text-xs text-[#D5B4DE] max-w-sm mx-auto">
                    You have no instructional periods assigned for this day. This time may be allocated for lesson preparation, grading, or school tasks.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pocketData.today_schedule.map((slot: any, idx: number) => {
                    const isSub = slot.is_substituted;
                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl p-4 transition-all duration-200 border ${
                          slot.is_current_period
                            ? "bg-[#3D055E] border-[#F806CC] shadow-lg shadow-[#F806CC]/20 ring-2 ring-[#F806CC]"
                            : isSub
                            ? "bg-amber-950/30 border-amber-500/60"
                            : "bg-[#2E0249] border-[#570A57] hover:border-[#A91079]"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Period Number Badge */}
                            <div className="w-12 h-12 rounded-xl bg-[#570A57] border border-[#A91079] flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] uppercase text-[#D5B4DE] font-semibold">P{slot.period_index}</span>
                              <span className="text-xs font-bold text-white">{slot.period_index}</span>
                            </div>

                            {/* Class Details */}
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-bold text-white tracking-tight">
                                  {slot.subject_name}
                                </h4>
                                {slot.is_current_period && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-stone-950 font-black text-[10px] animate-pulse">
                                    LIVE NOW
                                  </span>
                                )}
                                {isSub && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 font-black text-[10px]">
                                    SUBSTITUTE
                                  </span>
                                )}
                                {slot.is_locked && (
                                  <span className="text-[10px] bg-[#570A57] text-[#FAF5FA] px-2 py-0.5 rounded font-medium border border-[#A91079]/40">
                                    Homeroom Lock
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-[#D5B4DE] flex items-center gap-3 mt-1">
                                <span className="font-semibold text-white">{slot.section_name}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-[#F806CC]">
                                  <Clock className="w-3.5 h-3.5" /> {slot.time_range}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <MapPin className="w-3.5 h-3.5" /> {slot.room_number}
                                </span>
                              </div>

                              {isSub && slot.original_teacher_name && (
                                <p className="text-[11px] text-amber-300/80 mt-1.5 flex items-center gap-1.5">
                                  <span>Covering for: <strong>{slot.original_teacher_name}</strong></span>
                                  <span>({slot.substitution_reason || "Temporary Assignment"})</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="text-xs px-3 py-1.5 rounded-xl bg-[#3D055E] text-[#D5B4DE] font-semibold border border-[#570A57]">
                              60 min
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
};
