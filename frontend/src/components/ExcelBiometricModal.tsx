import { useState } from "react";
import {
  FileSpreadsheet,
  Fingerprint,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  ShieldAlert,
  RefreshCw
} from "lucide-react";
import { api } from "../api/client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ExcelBiometricModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const [activeTab, setActiveTab] = useState<"SCHEDULE" | "BIOMETRIC">("SCHEDULE");
  
  // Schedule Import State
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [commitLoading, setCommitLoading] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Biometric Ingestion State
  const [biometricFile, setBiometricFile] = useState<File | null>(null);
  const [cutoffTime, setCutoffTime] = useState<string>("07:45");
  const [biometricResult, setBiometricResult] = useState<any>(null);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  if (!isOpen) return null;

  // --- Schedule Import Handlers ---
  const handleDownloadScheduleTemplate = async () => {
    try {
      const blob = await api.downloadScheduleTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "DepEd_Master_Schedule_Template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to download template: " + err.message);
    }
  };

  const handleScheduleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScheduleFile(file);
    setScheduleError(null);
    setSchedulePreview(null);
    setPreviewLoading(true);

    try {
      const res = await api.previewScheduleExcel(file);
      setSchedulePreview(res);
    } catch (err: any) {
      setScheduleError(err.message || "Failed to preview file");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommitSchedule = async () => {
    if (!scheduleFile) return;
    setCommitLoading(true);
    setScheduleError(null);

    try {
      const res = await api.commitScheduleExcel(scheduleFile);
      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      setScheduleError(err.message || "Failed to commit schedule");
    } finally {
      setCommitLoading(false);
    }
  };

  // --- Biometric Handlers ---
  const handleDownloadDtrTemplate = async () => {
    try {
      const blob = await api.downloadDtrTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Biometric_DTR_Attendance_Sample.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to download DTR template: " + err.message);
    }
  };

  const handleBiometricFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBiometricFile(file);
    setBiometricError(null);
    setBiometricResult(null);
    setBiometricLoading(true);

    try {
      const res = await api.processBiometrics(file, cutoffTime);
      setBiometricResult(res);
    } catch (err: any) {
      setBiometricError(err.message || "Failed to process biometric log");
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleApplySubstitutions = async () => {
    if (!biometricResult || !biometricResult.recommendations?.length) return;
    setApplyLoading(true);
    setBiometricError(null);

    try {
      const res = await api.applyBiometricSubstitutions({
        date: biometricResult.date,
        recommendations: biometricResult.recommendations,
      });
      onSuccess(res.message);
      onClose();
    } catch (err: any) {
      setBiometricError(err.message || "Failed to apply substitutions");
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#220137] border border-[#570A57] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#570A57] flex items-center justify-between bg-[#2E0249]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#570A57] border border-[#F806CC]/30 flex items-center justify-center text-[#F806CC] shrink-0">
              {activeTab === "SCHEDULE" ? <FileSpreadsheet className="w-5 h-5" /> : <Fingerprint className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {activeTab === "SCHEDULE" ? "Excel Master Schedule Ingestion" : "Biometric Scan Attendance & Dynamic Substitution"}
              </h2>
              <p className="text-xs text-[#D5B4DE]">
                Automating school load sheets & morning attendance fault-tolerance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#3D055E] hover:bg-[#570A57] text-[#D5B4DE] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#570A57] bg-[#2E0249]/60 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab("SCHEDULE")}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-xs border-b-2 transition cursor-pointer ${
              activeTab === "SCHEDULE"
                ? "border-[#F806CC] text-white"
                : "border-transparent text-[#D5B4DE] hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#F806CC]" />
            <span>Master Schedule (.xlsx / .csv)</span>
          </button>

          <button
            onClick={() => setActiveTab("BIOMETRIC")}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-xs border-b-2 transition cursor-pointer ${
              activeTab === "BIOMETRIC"
                ? "border-[#F806CC] text-white"
                : "border-transparent text-[#D5B4DE] hover:text-white"
            }`}
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span>Biometric DTR Sync (Daily Substitution)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
          {activeTab === "SCHEDULE" ? (
            /* TAB 1: SCHEDULE EXCEL IMPORT */
            <div className="space-y-5">
              <div className="bg-[#2E0249] border border-[#570A57] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Download DepEd Schedule Spreadsheet Template</h4>
                  <p className="text-xs text-[#D5B4DE]">
                    Pre-formatted Excel sheet with column definitions (Teacher, Section, Grade, Room, Subject, Day, Period).
                  </p>
                </div>
                <button
                  onClick={handleDownloadScheduleTemplate}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#570A57] hover:bg-[#A91079] text-xs font-bold text-white transition cursor-pointer border border-[#A91079] shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .xlsx Template</span>
                </button>
              </div>

              {/* Upload Box */}
              <div className="border-2 border-dashed border-[#570A57] hover:border-[#F806CC] rounded-2xl p-6 text-center bg-[#2E0249]/40 transition group">
                <input
                  type="file"
                  id="schedule-file-input"
                  accept=".xlsx,.csv"
                  onChange={handleScheduleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="schedule-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#570A57] text-[#F806CC] flex items-center justify-center group-hover:scale-105 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {scheduleFile ? scheduleFile.name : "Click to upload Excel or CSV master schedule"}
                    </span>
                    <span className="text-xs text-[#D5B4DE] block mt-0.5">
                      Supports Microsoft Excel (.xlsx) and standard CSV files
                    </span>
                  </div>
                </label>
              </div>

              {previewLoading && (
                <div className="py-8 flex items-center justify-center gap-3 text-sm text-[#D5B4DE]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#F806CC]" />
                  <span>Analyzing spreadsheet & verifying RA 4670 limits...</span>
                </div>
              )}

              {scheduleError && (
                <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Validation Failed</div>
                    <div>{scheduleError}</div>
                  </div>
                </div>
              )}

              {/* Preview Results */}
              {schedulePreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#2E0249] border border-[#570A57] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-[#D5B4DE] uppercase font-bold">Total Rows</div>
                      <div className="text-lg font-black text-white mt-0.5">{schedulePreview.total_rows}</div>
                    </div>
                    <div className="bg-[#2E0249] border border-emerald-600/40 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-emerald-300 uppercase font-bold">Valid Slots</div>
                      <div className="text-lg font-black text-emerald-400 mt-0.5">{schedulePreview.valid_rows_count}</div>
                    </div>
                    <div className="bg-[#2E0249] border border-[#570A57] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-[#D5B4DE] uppercase font-bold">Faculty Count</div>
                      <div className="text-lg font-black text-white mt-0.5">{schedulePreview.unique_teachers_count}</div>
                    </div>
                    <div className="bg-[#2E0249] border border-[#570A57] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-[#D5B4DE] uppercase font-bold">Sections</div>
                      <div className="text-lg font-black text-white mt-0.5">{schedulePreview.unique_sections_count}</div>
                    </div>
                  </div>

                  {schedulePreview.error_rows_count > 0 ? (
                    <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>{schedulePreview.error_rows_count} collision / validation error(s) must be resolved:</span>
                      </div>
                      <ul className="text-[11px] text-rose-200/90 list-disc list-inside space-y-1 max-h-36 overflow-y-auto">
                        {schedulePreview.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-xs text-emerald-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Ready to commit. No collisions detected; satisfies RA 4670 daily limits.</span>
                      </div>
                      <button
                        onClick={handleCommitSchedule}
                        disabled={commitLoading}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {commitLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Ingesting...
                          </>
                        ) : (
                          <>Commit to Master Schedule</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: BIOMETRIC DTR SYNC */
            <div className="space-y-5">
              <div className="bg-[#2E0249] border border-[#570A57] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Daily Biometric Attendance Scan Sync</h4>
                  <p className="text-xs text-[#D5B4DE]">
                    Upload morning punch logs from biometric fingerprint/facial scan terminals (ZKTeco/Granding/DTR).
                  </p>
                </div>
                <button
                  onClick={handleDownloadDtrTemplate}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#570A57] hover:bg-[#A91079] text-xs font-bold text-white transition cursor-pointer border border-[#A91079] shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Sample DTR</span>
                </button>
              </div>

              {/* Cutoff Setting & Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#2E0249] border border-[#570A57] rounded-xl p-3 flex flex-col justify-center">
                  <label className="text-[10px] text-[#D5B4DE] uppercase font-bold block mb-1">
                    Morning Cutoff Time:
                  </label>
                  <input
                    type="time"
                    value={cutoffTime}
                    onChange={(e) => setCutoffTime(e.target.value)}
                    className="bg-[#3D055E] border border-[#A91079] rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-[#D5B4DE] mt-1">Unscanned faculty marked absent</span>
                </div>

                <div className="sm:col-span-2 border-2 border-dashed border-[#570A57] hover:border-emerald-400 rounded-xl p-4 text-center bg-[#2E0249]/40 transition group">
                  <input
                    type="file"
                    id="biometric-file-input"
                    accept=".xlsx,.csv"
                    onChange={handleBiometricFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="biometric-file-input"
                    className="cursor-pointer flex items-center justify-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0">
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold text-white block">
                        {biometricFile ? biometricFile.name : "Select Biometric Punch Log (.xlsx / .csv)"}
                      </span>
                      <span className="text-[10px] text-[#D5B4DE] block">
                        Automates absent detection & underloaded substitute dispatch
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {biometricLoading && (
                <div className="py-8 flex items-center justify-center gap-3 text-sm text-[#D5B4DE]">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Processing biometric scans & formulating DO 005 underloaded substitutes...</span>
                </div>
              )}

              {biometricError && (
                <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Biometric Processing Error</div>
                    <div>{biometricError}</div>
                  </div>
                </div>
              )}

              {/* Biometric Results */}
              {biometricResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-[#2E0249] border border-[#570A57] rounded-xl p-2.5 text-center">
                      <div className="text-[10px] text-[#D5B4DE] uppercase font-bold">Total Scanned</div>
                      <div className="text-base font-black text-white">{biometricResult.total_scanned}</div>
                    </div>
                    <div className="bg-[#2E0249] border border-emerald-600/40 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] text-emerald-300 uppercase font-bold">Present</div>
                      <div className="text-base font-black text-emerald-400">{biometricResult.present_count}</div>
                    </div>
                    <div className="bg-[#2E0249] border border-amber-600/40 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] text-amber-300 uppercase font-bold">Late</div>
                      <div className="text-base font-black text-amber-400">{biometricResult.late_count}</div>
                    </div>
                    <div className="bg-[#2E0249] border border-rose-600/40 rounded-xl p-2.5 text-center">
                      <div className="text-[10px] text-rose-300 uppercase font-bold">Absent / Leave</div>
                      <div className="text-base font-black text-rose-400">{biometricResult.absent_count}</div>
                    </div>
                  </div>

                  {/* Absent Teachers & Automated Substitution Plan */}
                  {biometricResult.recommendations?.length > 0 ? (
                    <div className="bg-[#2E0249] border border-amber-500/40 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <h4 className="text-xs font-bold text-amber-200">
                            Automated Substitution Plan ({biometricResult.recommendations.length} classes uncovered)
                          </h4>
                        </div>
                        <span className="text-[10px] bg-[#570A57] text-[#FAF5FA] px-2 py-0.5 rounded font-medium">
                          DO 005, s. 2024 Underloaded Match
                        </span>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                        {biometricResult.recommendations.map((rec: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-[#3D055E]/80 border border-[#570A57] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span className="text-[#F806CC]">Period {rec.period_index}</span>
                                <span>•</span>
                                <span>{rec.subject_name}</span>
                                <span className="text-[#D5B4DE]">({rec.section_name} • {rec.room_number})</span>
                              </div>
                              <div className="text-[11px] text-[#D5B4DE] mt-0.5">
                                Absent: <span className="text-rose-300 line-through">{rec.original_teacher_name}</span>
                                <span className="mx-1.5">➔</span>
                                Reassigned to: <strong className="text-emerald-300">{rec.suggested_substitute_name}</strong>
                                <span className="text-[10px] text-emerald-400/80 ml-1">({rec.reason})</span>
                              </div>
                            </div>

                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/40 shrink-0 self-start sm:self-center">
                              ≤ 6 hrs/day OK
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleApplySubstitutions}
                          disabled={applyLoading}
                          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {applyLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching...
                            </>
                          ) : (
                            <>Apply Automated Substitutions</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>All faculty present or no teaching slots affected by recorded absences.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
