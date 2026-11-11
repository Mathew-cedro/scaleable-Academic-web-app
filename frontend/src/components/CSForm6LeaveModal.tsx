import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  apiClient,
  type CSForm6PreviewResponse,
  type LeaveApplicationCreate,
  type LeaveApplicationRecord,
} from "../api/client";

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  selectedTeacher?: Teacher | null;
  onLeaveFiled?: () => void;
}

const LEAVE_TYPES = [
  "Sick Leave (Sec. 43, Rule XVI)",
  "Vacation Leave (Sec. 51, Rule XVI)",
  "Mandatory / Forced Leave (Sec. 25, Rule XVI)",
  "Special Privilege Leave (DO 84, s. 2007)",
  "Faculty Wellness Leave (DO 002, s. 2026)",
  "Emergency / Calamity Leave (CSC MC No. 2, s. 2012)",
  "Maternity Leave (RA 11210)",
  "Paternity Leave (RA 8187)",
  "Solo Parent Leave (RA 8972 / RA 11861)",
];

export const CSForm6LeaveModal: React.FC<Props> = ({
  isOpen,
  onClose,
  teachers,
  selectedTeacher,
  onLeaveFiled,
}) => {
  const [activeTeacherId, setActiveTeacherId] = useState<number | "">(
    selectedTeacher ? selectedTeacher.id : teachers[0]?.id || ""
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [leaveType, setLeaveType] = useState<string>(LEAVE_TYPES[0]);
  const [reasonDetails, setReasonDetails] = useState<string>("");
  const [commutation, setCommutation] = useState<boolean>(false);
  const [autoDispatch, setAutoDispatch] = useState<boolean>(true);
  const [manualSubId, setManualSubId] = useState<number | "">("");

  // Preview data
  const [previewData, setPreviewData] = useState<CSForm6PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Completed record for printable view
  const [completedRecord, setCompletedRecord] = useState<LeaveApplicationRecord | null>(null);

  useEffect(() => {
    if (selectedTeacher) {
      setActiveTeacherId(selectedTeacher.id);
    } else if (teachers.length > 0 && !activeTeacherId) {
      setActiveTeacherId(teachers[0].id);
    }
  }, [selectedTeacher, teachers]);

  // Fetch timetable impact preview whenever teacher or dates change
  useEffect(() => {
    if (!isOpen || !activeTeacherId) return;
    let isCancelled = false;

    async function loadPreview() {
      setLoadingPreview(true);
      setErrorBanner(null);
      try {
        const data = await apiClient.getCSForm6Preview(
          Number(activeTeacherId),
          startDate,
          endDate
        );
        if (!isCancelled) {
          setPreviewData(data);
          if (data.recommended_substitutes.length > 0 && !manualSubId) {
            setManualSubId(data.recommended_substitutes[0].teacher_id);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorBanner(err.message || "Failed to load timetable impact preview");
        }
      } finally {
        if (!isCancelled) setLoadingPreview(false);
      }
    }

    loadPreview();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, activeTeacherId, startDate, endDate]);

  if (!isOpen) return null;

  const currentTeacherObj = teachers.find((t) => t.id === Number(activeTeacherId));

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeacherId) return;

    setSubmitting(true);
    setErrorBanner(null);

    try {
      const payload: LeaveApplicationCreate = {
        teacher_id: Number(activeTeacherId),
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        number_of_days: 1.0,
        reason_details: reasonDetails || undefined,
        commutation_requested: commutation,
        auto_dispatch_substitutes: autoDispatch,
        manual_substitute_id: !autoDispatch && manualSubId ? Number(manualSubId) : null,
      };

      const record = await apiClient.fileCSForm6Leave(payload);
      setCompletedRecord(record);
      if (onLeaveFiled) onLeaveFiled();
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to submit leave application");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-purple-200 overflow-hidden text-gray-800">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#2E0249] to-[#570A57] text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <FileText className="w-6 h-6 text-pink-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase tracking-wider font-semibold bg-pink-500/30 text-pink-200 px-2 py-0.5 rounded">
                  Civil Service Commission Form No. 6
                </span>
                <span className="text-xs bg-purple-700/60 text-purple-200 px-2 py-0.5 rounded">
                  DepEd Order No. 005, s. 2024
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight">
                {completedRecord ? "Official CS Form 6 Endorsement Slip" : "Application for Leave & Emergency Substitution"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center space-x-2 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Modal Body: Switch between Form and Official Endorsement View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!completedRecord ? (
            <form onSubmit={handleSubmitLeave} className="space-y-6">
              
              {/* Top Row: Teacher & Leave Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    1. Faculty Applicant (School Personnel)
                  </label>
                  <select
                    value={activeTeacherId}
                    onChange={(e) => setActiveTeacherId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#A91079] focus:border-transparent outline-none bg-gray-50/50"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.position}) - {t.current_load_hours}h/wk
                      </option>
                    ))}
                  </select>
                  {currentTeacherObj && (
                    <p className="mt-1 text-xs text-gray-500">
                      Current Weekly Instructional Load:{" "}
                      <span className="font-semibold text-purple-800">
                        {currentTeacherObj.current_load_hours} hours / week
                      </span>{" "}
                      {currentTeacherObj.is_adviser ? "• Class Adviser" : ""}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    2. Type of Leave (CSC Omnibus Rules, Rule XVI)
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#A91079] focus:border-transparent outline-none bg-gray-50/50"
                  >
                    {LEAVE_TYPES.map((lt) => (
                      <option key={lt} value={lt}>
                        {lt}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Mandatory official classification under Civil Service Commission regulations.
                  </p>
                </div>
              </div>

              {/* Middle Row: Dates & Commutation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span>Inclusive Date (Start)</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-[#A91079] bg-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span>Inclusive Date (End)</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-[#A91079] bg-white outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <label className="text-xs font-semibold text-purple-900 mb-2">Commutation Option</label>
                  <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commutation}
                      onChange={(e) => setCommutation(e.target.checked)}
                      className="rounded text-[#A91079] focus:ring-[#A91079] w-4 h-4"
                    />
                    <span>Request Commutation of Leave</span>
                  </label>
                </div>
              </div>

              {/* Reason / Medical Details */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  3. Details of Leave / Medical Diagnosis / Justification
                </label>
                <textarea
                  rows={2}
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder="Specify illness/hospitalization, personal family circumstance, or DO 002 wellness justification..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#A91079] focus:border-transparent outline-none"
                />
              </div>

              {/* Dynamic Timetable Impact Preview Section */}
              <div className="border border-purple-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gradient-to-r from-purple-100 to-pink-50 px-4 py-2.5 flex items-center justify-between border-b border-purple-200">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-purple-800" />
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                      Tier 2 Dynamic MPP Timetable Impact Analysis
                    </span>
                  </div>
                  {previewData && (
                    <span className="text-xs font-semibold bg-purple-200/80 text-purple-900 px-2.5 py-0.5 rounded-full">
                      {previewData.impacted_slots_count} Scheduled Classes Affected ({previewData.impacted_hours} Hours)
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {loadingPreview ? (
                    <div className="py-6 text-center text-sm text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-purple-700 border-t-transparent mr-2"></div>
                      Scanning master timetable for active classes...
                    </div>
                  ) : previewData && previewData.slots.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">
                        The following scheduled classes for <strong>{previewData.teacher_name}</strong> will be temporarily orphaned and require dynamic substitution:
                      </p>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg text-xs">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 text-gray-700 sticky top-0">
                            <tr>
                              <th className="px-3 py-1.5 text-left font-semibold">Day</th>
                              <th className="px-3 py-1.5 text-left font-semibold">Period / Time</th>
                              <th className="px-3 py-1.5 text-left font-semibold">Section</th>
                              <th className="px-3 py-1.5 text-left font-semibold">Subject</th>
                              <th className="px-3 py-1.5 text-left font-semibold">Room</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {previewData.slots.map((s) => (
                              <tr key={s.slot_id} className="hover:bg-purple-50/40">
                                <td className="px-3 py-1.5 font-medium text-gray-900">{s.day_name}</td>
                                <td className="px-3 py-1.5 text-gray-600">{s.time_window}</td>
                                <td className="px-3 py-1.5 font-semibold text-purple-900">{s.section_name}</td>
                                <td className="px-3 py-1.5 text-gray-800">{s.subject_name}</td>
                                <td className="px-3 py-1.5 text-gray-500">{s.room_number}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 py-2 italic text-center">
                      No active classes found for this faculty member on selected dates.
                    </div>
                  )}

                  {/* DepEd DO 005 Underload Prioritization Strategy */}
                  <div className="bg-pink-50/50 p-3.5 rounded-xl border border-pink-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#A91079] uppercase tracking-wider flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>DepEd Order No. 005, s. 2024 Substitution Policy</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-start space-x-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="subPolicy"
                          checked={autoDispatch}
                          onChange={() => setAutoDispatch(true)}
                          className="mt-0.5 text-[#A91079] focus:ring-[#A91079]"
                        />
                        <div>
                          <p className="text-xs font-bold text-gray-800">
                            Automatic Tier 2 MPP Underload Prioritization (Recommended)
                          </p>
                          <p className="text-xs text-gray-500">
                            Dynamically allocates orphaned classes to colleagues with lowest teaching loads (&lt; 30h) within the {currentTeacherObj?.department_id ? "Science" : "Department"} department.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start space-x-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="subPolicy"
                          checked={!autoDispatch}
                          onChange={() => setAutoDispatch(false)}
                          className="mt-0.5 text-[#A91079] focus:ring-[#A91079]"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-800">
                            Manual Designated Substitute
                          </p>
                          {!autoDispatch && previewData && (
                            <select
                              value={manualSubId}
                              onChange={(e) => setManualSubId(Number(e.target.value))}
                              className="mt-1.5 w-full px-3 py-1.5 text-xs border border-pink-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#A91079]"
                            >
                              {previewData.recommended_substitutes.map((cand) => (
                                <option key={cand.teacher_id} value={cand.teacher_id}>
                                  {cand.teacher_name} ({cand.position}) - {cand.current_load_hours}h/wk {cand.reason}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !activeTeacherId}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#2E0249] to-[#A91079] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Filing & Dispatching Substitutes...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application & Dispatch Tier 2 MPP</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* OFFICIAL PRINTABLE CS FORM 6 & ENDORSEMENT VIEW */
            <div className="space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3 text-green-800 text-xs">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-bold">
                    Civil Service Form No. 6 Successfully Filed! Control Number: {completedRecord.control_number}
                  </p>
                  <p className="text-green-700">
                    Faculty marked &quot;On Leave&quot;. {completedRecord.substitute_summary || "Tier 2 MPP substitutes assigned."}
                  </p>
                </div>
              </div>

              {/* Printable Civil Service Form 6 Layout */}
              <div className="p-6 border-2 border-gray-800 rounded-lg bg-white font-serif text-xs text-gray-900 space-y-4 print:m-0 print:border-none print:p-0">
                
                {/* Official CSC Header */}
                <div className="text-center border-b-2 border-gray-800 pb-3 space-y-0.5">
                  <p className="text-[10px] tracking-widest font-sans font-semibold">Civil Service Form No. 6 • Revised 2020</p>
                  <p className="font-sans text-[11px] font-bold">REPUBLIC OF THE PHILIPPINES</p>
                  <p className="font-sans text-[12px] font-extrabold text-[#2E0249]">DEPARTMENT OF EDUCATION • REGION V (BICOL)</p>
                  <p className="font-sans text-[11px] font-bold">POLANGUI GENERAL COMPREHENSIVE HIGH SCHOOL</p>
                  <p className="text-[10px] italic">Polangui, Albay • School ID: 301986</p>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider pt-1 font-sans">
                    APPLICATION FOR LEAVE & TEACHER SUBSTITUTION ENDORSEMENT
                  </h3>
                  <p className="font-mono text-xs font-bold text-purple-900">
                    TRACKING NO: {completedRecord.control_number}
                  </p>
                </div>

                {/* Personnel Details Grid */}
                <div className="grid grid-cols-2 gap-4 border-b border-gray-300 pb-3 font-sans">
                  <div>
                    <span className="font-bold">1. OFFICE / DEPARTMENT:</span>
                    <p className="pl-3 font-semibold text-gray-800">
                      DepEd PGCHS • {previewData?.department_name || "Academic"} Department
                    </p>
                  </div>
                  <div>
                    <span className="font-bold">2. NAME (LAST, FIRST, MIDDLE):</span>
                    <p className="pl-3 font-semibold text-gray-800">{completedRecord.teacher_name}</p>
                  </div>
                  <div>
                    <span className="font-bold">3. DATE OF FILING:</span>
                    <p className="pl-3 font-semibold text-gray-800">
                      {new Date(completedRecord.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold">4. POSITION / PLANTILLA TITLE:</span>
                    <p className="pl-3 font-semibold text-gray-800">{previewData?.position || "Teacher I"}</p>
                  </div>
                </div>

                {/* Details of Leave Application */}
                <div className="space-y-2 border-b border-gray-300 pb-3 font-sans">
                  <p className="font-bold text-xs">5. DETAILS OF APPLICATION:</p>
                  <div className="grid grid-cols-2 gap-4 pl-3">
                    <div>
                      <span className="font-semibold text-gray-700">Type of Leave:</span>
                      <p className="font-bold text-purple-900">{completedRecord.leave_type}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Inclusive Dates:</span>
                      <p className="font-bold text-gray-900">
                        {completedRecord.start_date} to {completedRecord.end_date} ({completedRecord.number_of_days} Day/s)
                      </p>
                    </div>
                  </div>
                  {completedRecord.reason_details && (
                    <div className="pl-3">
                      <span className="font-semibold text-gray-700">Cause / Medical Details:</span>
                      <p className="italic text-gray-800">{completedRecord.reason_details}</p>
                    </div>
                  )}
                  <div className="pl-3 text-[11px] text-gray-600">
                    Commutation: {completedRecord.commutation_requested ? "Requested" : "Not Requested"}
                  </div>
                </div>

                {/* Substitution Dispatch Summary */}
                <div className="space-y-1.5 border-b border-gray-300 pb-3 font-sans bg-gray-50/70 p-2.5 rounded">
                  <p className="font-bold text-xs text-purple-950 flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#A91079]" />
                    <span>DEPED ORDER NO. 005, S. 2024 NOTICE OF SUBSTITUTION:</span>
                  </p>
                  <p className="text-[11px] text-gray-800 pl-2">
                    {completedRecord.substitute_summary || "Classes reallocated under Tier 2 MPP underload policy."}
                  </p>
                  <p className="text-[10px] text-gray-500 pl-2 italic">
                    All substituted instructional loads comply strictly with Republic Act No. 4670 (max 360 daily instructional minutes).
                  </p>
                </div>

                {/* Signature Blocks */}
                <div className="grid grid-cols-3 gap-6 pt-6 font-sans text-center">
                  <div>
                    <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-900">
                      {completedRecord.teacher_name}
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Applicant Teacher</p>
                  </div>
                  <div>
                    <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-900">
                      HEAD TEACHER / DEPT. CHAIR
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Department Endorsement</p>
                  </div>
                  <div>
                    <div className="border-b border-gray-400 pb-1 mb-1 font-bold text-gray-900">
                      DR. MARY ANNE M. SAHAGUN
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Secondary School Principal IV</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setCompletedRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded-xl transition-colors"
                >
                  ← File Another Leave
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-colors flex items-center space-x-2"
                  >
                    <Printer className="w-4 h-4 text-gray-600" />
                    <span>Print Endorsement Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 bg-[#2E0249] hover:bg-[#570A57] text-white text-xs font-bold rounded-xl shadow-md transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
