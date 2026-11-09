import React, { useState } from "react";
import {
  FileText,
  X,
  Download,
  Clock,
  Users,
  RotateCcw,
} from "lucide-react";
import {
  loadCustomBreakTimings,
  saveCustomBreakTimings,
} from "../utils/bellSchedule";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sectionName: string;
  gradeLevel: number;
  programType: string;
  adviserName?: string;
  onConfirmExport: (params: {
    school_year: string;
    flag_ceremony_time: string;
    morning_break_time: string;
    lunch_break_time: string;
    adviser_name: string;
    grade_chairman: string;
    consultant_1: string;
    consultant_2: string;
    principal_name: string;
  }) => Promise<void>;
  loading?: boolean;
}

export const ExportDocxModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sectionName,
  gradeLevel,
  programType,
  adviserName,
  onConfirmExport,
  loading = false,
}) => {
  const initialBreaks = loadCustomBreakTimings();

  // Form State
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [flagTime, setFlagTime] = useState(initialBreaks.flagCeremonyTime || "6:45-7:00");
  const [breakTime, setBreakTime] = useState(initialBreaks.morningBreakTime || "9:00-9:15");
  const [lunchTime, setLunchTime] = useState(initialBreaks.lunchBreakTime || "11:15-12:00");

  const [advName, setAdvName] = useState(adviserName || "Unassigned Faculty");
  const [gradeChairman, setGradeChairman] = useState("Mrs. Sarah Jenkins");
  const [consultant1, setConsultant1] = useState("Mr. David Chen");
  const [consultant2, setConsultant2] = useState("Mrs. Theresa Navarro");
  const [principalName, setPrincipalName] = useState("Dr. Eleanor Vance");

  const [saveBreaksAsDefault, setSaveBreaksAsDefault] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveBreaksAsDefault) {
      saveCustomBreakTimings({
        flagCeremonyTime: flagTime.trim(),
        morningBreakTime: breakTime.trim(),
        lunchBreakTime: lunchTime.trim(),
      });
    }

    await onConfirmExport({
      school_year: schoolYear.trim(),
      flag_ceremony_time: flagTime.trim(),
      morning_break_time: breakTime.trim(),
      lunch_break_time: lunchTime.trim(),
      adviser_name: advName.trim(),
      grade_chairman: gradeChairman.trim(),
      consultant_1: consultant1.trim(),
      consultant_2: consultant2.trim(),
      principal_name: principalName.trim(),
    });
    onClose();
  };

  const handleResetBreaks = () => {
    setFlagTime("6:45-7:00");
    setBreakTime("9:00-9:15");
    setLunchTime("11:15-12:00");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#FDF2FA] to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-[#570A57] to-[#A91079] text-white rounded-2xl shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Export DepEd Class Program (.docx)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Grade {gradeLevel} {programType} • {sectionName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Section 1: Bell Schedule Break Timings */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#A91079]" />
                <span>Ceremony & Break Windows</span>
              </span>
              <button
                type="button"
                onClick={handleResetBreaks}
                className="text-[10px] font-bold text-slate-500 hover:text-[#A91079] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Standard (6:45, 9:00, 11:15)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Customize daily non-instructional intervals. These will appear in the schedule table rows.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Flag Ceremony
                </label>
                <input
                  type="text"
                  value={flagTime}
                  onChange={(e) => setFlagTime(e.target.value)}
                  placeholder="6:45-7:00"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Morning Break / Recess
                </label>
                <input
                  type="text"
                  value={breakTime}
                  onChange={(e) => setBreakTime(e.target.value)}
                  placeholder="9:00-9:15"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Lunch Break
                </label>
                <input
                  type="text"
                  value={lunchTime}
                  onChange={(e) => setLunchTime(e.target.value)}
                  placeholder="11:15-12:00"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={saveBreaksAsDefault}
                onChange={(e) => setSaveBreaksAsDefault(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 accent-[#A91079]"
              />
              <span>Save these break timings as my system-wide default view</span>
            </label>
          </div>

          {/* Section 2: School Year & Section Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Academic School Year
              </label>
              <input
                type="text"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                placeholder="2026-2027"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Class Adviser
              </label>
              <input
                type="text"
                value={advName}
                onChange={(e) => setAdvName(e.target.value)}
                placeholder="Name of Class Adviser"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                required
              />
            </div>
          </div>

          {/* Section 3: Official DepEd Signatories */}
          <div className="space-y-3 p-4 rounded-2xl bg-[#FDF2FA]/60 border border-[#E5CCE3]">
            <span className="font-extrabold text-[#2E0249] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#A91079]" />
              <span>DepEd Form Signatories & Approvers</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Grade Level Chairman
                </label>
                <input
                  type="text"
                  value={gradeChairman}
                  onChange={(e) => setGradeChairman(e.target.value)}
                  placeholder="Mrs. Sarah Jenkins"
                  className="w-full px-3 py-1.5 bg-white border border-[#E5CCE3] rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Principal IV (Final Approval)
                </label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="Dr. Eleanor Vance"
                  className="w-full px-3 py-1.5 bg-white border border-[#E5CCE3] rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Consultant (Teacher III)
                </label>
                <input
                  type="text"
                  value={consultant1}
                  onChange={(e) => setConsultant1(e.target.value)}
                  placeholder="Mr. David Chen"
                  className="w-full px-3 py-1.5 bg-white border border-[#E5CCE3] rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Consultant (Head Teacher-III)
                </label>
                <input
                  type="text"
                  value={consultant2}
                  onChange={(e) => setConsultant2(e.target.value)}
                  placeholder="Mrs. Theresa Navarro"
                  className="w-full px-3 py-1.5 bg-white border border-[#E5CCE3] rounded-xl font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                />
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-medium">
              Produces official editable Word (.docx) document.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#A91079] hover:bg-[#8F0B66] text-white font-extrabold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{loading ? "Generating .docx..." : "Download Word Document"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
