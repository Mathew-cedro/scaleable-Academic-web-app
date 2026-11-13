import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Clock,
  Lock,
  Layers,
  ChevronDown,
} from "lucide-react";
import { api } from "../api/client";

interface SectionOption {
  id: number;
  name: string;
  grade_level?: number;
  gradeLevel?: number;
  program_type?: string;
}

interface ParsedSlotItem {
  day_of_week: number;
  day_name: string;
  period_index: number;
  time_str: string;
  raw_subject: string;
  subject_id: number | null;
  subject_name: string;
  raw_teacher?: string | null;
  teacher_id: number | null;
  teacher_name: string;
  is_locked: boolean;
  status: "VALID" | "CONFLICT" | "WARNING" | "UNMATCHED_SUBJECT" | "UNMATCHED_TEACHER";
  message: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  sections: SectionOption[];
  initialSectionId?: number;
  teachers?: any[];
}

export const ImportSectionScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportComplete,
  sections,
  initialSectionId,
}) => {
  const [selectedSectionId, setSelectedSectionId] = useState<number>(() => {
    if (initialSectionId) return initialSectionId;
    return sections.length > 0 ? sections[0].id : 1;
  });

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewSlots, setPreviewSlots] = useState<ParsedSlotItem[]>([]);
  const [layoutDetected, setLayoutDetected] = useState<string>("");
  const [stats, setStats] = useState<{
    total_slots: number;
    valid_count: number;
    conflict_count: number;
    warning_count: number;
  }>({ total_slots: 0, valid_count: 0, conflict_count: 0, warning_count: 0 });

  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFLICT" | "WARNING" | "VALID">("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initialSectionId when modal opens
  useEffect(() => {
    if (initialSectionId) {
      setSelectedSectionId(initialSectionId);
    } else if (sections.length > 0) {
      setSelectedSectionId(sections[0].id);
    }
  }, [initialSectionId, isOpen, sections]);

  const currentSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || sections[0];
  }, [sections, selectedSectionId]);

  const handleDownloadTemplate = async () => {
    if (!currentSection) return;
    try {
      setDownloadingTemplate(true);
      setError(null);
      await api.downloadSectionScheduleTemplateExcel(currentSection.id, currentSection.name);
    } catch (err: any) {
      setError(err?.message || "Failed to download schedule template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = async (selectedFile: File) => {
    const fn = selectedFile.name.toLowerCase();
    if (!fn.endsWith(".xlsx") && !fn.endsWith(".xls") && !fn.endsWith(".csv")) {
      setError("Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const data = await api.previewSectionScheduleExcel(selectedSectionId, selectedFile);
      setPreviewSlots(data.slots || []);
      setLayoutDetected(data.layout_detected || "GRID_MATRIX");
      setStats(data.stats || { total_slots: 0, valid_count: 0, conflict_count: 0, warning_count: 0 });
    } catch (err: any) {
      setError(err?.message || "Failed to parse section schedule spreadsheet.");
      setPreviewSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleConfirmImport = async () => {
    if (!previewSlots || previewSlots.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      // Filter slots that have valid subject and teacher
      const validSlots = previewSlots
        .filter((s) => s.subject_id !== null && s.teacher_id !== null)
        .map((s) => ({
          day_of_week: s.day_of_week,
          period_index: s.period_index,
          subject_id: s.subject_id!,
          teacher_id: s.teacher_id!,
          is_locked: s.is_locked,
        }));

      if (validSlots.length === 0) {
        throw new Error("No valid instructional periods found to import.");
      }

      const res = await api.importSectionScheduleExcel(selectedSectionId, validSlots);
      setSuccessMessage(res.message || `Successfully imported ${res.slots_imported} periods.`);

      setTimeout(() => {
        if (onImportComplete) onImportComplete();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to commit section schedule.");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewSlots([]);
    setError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filteredSlots = useMemo(() => {
    if (statusFilter === "CONFLICT") return previewSlots.filter((s) => s.status === "CONFLICT" || s.status.startsWith("UNMATCHED"));
    if (statusFilter === "WARNING") return previewSlots.filter((s) => s.status === "WARNING");
    if (statusFilter === "VALID") return previewSlots.filter((s) => s.status === "VALID");
    return previewSlots;
  }, [previewSlots, statusFilter]);

  // Group slots by period (1 to 9) and day (0 to 4) for Grid View
  const gridMatrix = useMemo(() => {
    const matrix: Record<number, Record<number, ParsedSlotItem | undefined>> = {};
    for (let p = 1; p <= 9; p++) {
      matrix[p] = {};
    }
    previewSlots.forEach((slot) => {
      if (matrix[slot.period_index]) {
        matrix[slot.period_index][slot.day_of_week] = slot;
      }
    });
    return matrix;
  }, [previewSlots]);

  const maxPeriodInPreview = useMemo(() => {
    if (previewSlots.length === 0) return 7;
    return Math.max(7, ...previewSlots.map((s) => s.period_index));
  }, [previewSlots]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-[#2E0249] to-[#4A0E4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Import Section Weekly Timetable</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Excel / CSV
                </span>
              </h2>
              <p className="text-xs text-purple-200 mt-0.5">
                Upload and validate a weekly schedule matrix for a specific section (DepEd Key Stage 3 compliant).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section Selection & Template Download Banner */}
          <div className="bg-[#FAF5FA] border border-[#E5CCE3] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Target Section for Schedule Import
              </label>
              <div className="relative inline-block w-full max-w-md">
                <select
                  value={selectedSectionId}
                  onChange={(e) => {
                    setSelectedSectionId(Number(e.target.value));
                    handleReset();
                  }}
                  disabled={loading || importing}
                  className="w-full bg-white border border-[#D9B8D7] text-slate-900 text-sm font-semibold rounded-lg px-3 py-2 pr-8 shadow-2xs focus:ring-2 focus:ring-[#A91079] focus:outline-hidden appearance-none cursor-pointer"
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name} ({sec.program_type || "BEC"} Grade {sec.grade_level || sec.gradeLevel || 7})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate || loading}
              className="px-4 py-2 bg-white hover:bg-purple-50 text-[#A91079] border border-[#E5CCE3] rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-2 transition cursor-pointer self-start md:self-auto"
            >
              {downloadingTemplate ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#A91079]" />
              ) : (
                <Download className="w-4 h-4 text-[#A91079]" />
              )}
              <span>Download Pre-filled Template (.xlsx)</span>
            </button>
          </div>

          {/* Error / Success Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Upload Dropzone (When no preview is active) */}
          {previewSlots.length === 0 && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-[#A91079] bg-purple-50/70"
                  : "border-slate-300 hover:border-[#A91079] bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="p-3.5 bg-purple-100 text-[#A91079] rounded-2xl shadow-xs">
                {loading ? (
                  <RefreshCw className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {loading ? "Analyzing Schedule Spreadsheet..." : "Click to select or drag and drop your schedule file"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv). Grid Matrix and Tabular layouts supported.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Preview View */}
          {previewSlots.length > 0 && (
            <div className="space-y-4">
              {/* Top Stats Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Layout Detected:</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold uppercase tracking-wider text-[10px]">
                    {layoutDetected === "GRID_MATRIX" ? "Timetable Grid Matrix" : "Tabular Slot List"}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600 font-medium">{file?.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      statusFilter === "ALL" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({stats.total_slots})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("VALID")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === "VALID" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid ({stats.valid_count})</span>
                  </button>
                  {stats.warning_count > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("WARNING")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === "WARNING" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Warnings ({stats.warning_count})</span>
                    </button>
                  )}
                  {stats.conflict_count > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter("CONFLICT")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === "CONFLICT" ? "bg-red-700 text-white" : "bg-red-50 text-red-800 hover:bg-red-100"
                      }`}
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <span>Clashes ({stats.conflict_count})</span>
                    </button>
                  )}

                  <div className="h-4 w-px bg-slate-300 mx-1" />

                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === "GRID" ? "LIST" : "GRID")}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold transition cursor-pointer flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{viewMode === "GRID" ? "List View" : "Grid Matrix View"}</span>
                  </button>
                </div>
              </div>

              {/* Grid Matrix View */}
              {viewMode === "GRID" && (
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[#2E0249] text-white">
                        <th className="p-2.5 border-r border-[#4A0E4E] font-bold text-center w-28">Period</th>
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => (
                          <th key={d} className="p-2.5 border-r border-[#4A0E4E] font-bold text-center">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.from({ length: maxPeriodInPreview }, (_, i) => i + 1).map((periodNum) => {
                        return (
                          <React.Fragment key={periodNum}>
                            {/* Insert Recess between Period 2 and 3 */}
                            {periodNum === 3 && (
                              <tr className="bg-slate-100 text-slate-600 font-semibold text-center italic text-[11px]">
                                <td colSpan={6} className="py-1 px-4">
                                  9:00 AM – 9:20 AM • RECESS / HEALTH BREAK (Statutory Block)
                                </td>
                              </tr>
                            )}
                            {/* Insert Lunch between Period 4 and 5 */}
                            {periodNum === 5 && (
                              <tr className="bg-slate-100 text-slate-600 font-semibold text-center italic text-[11px]">
                                <td colSpan={6} className="py-1 px-4">
                                  11:20 AM – 12:00 PM • NOON BREAK / LUNCH RECESS
                                </td>
                              </tr>
                            )}
                            <tr className="hover:bg-slate-50/50 transition">
                              <td className="p-2 border-r border-slate-200 text-center font-bold bg-slate-50 text-slate-700">
                                <div className="text-xs">Period {periodNum}</div>
                                <div className="text-[10px] text-slate-500 font-normal flex items-center justify-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>
                                    {gridMatrix[periodNum]?.[0]?.time_str || `P${periodNum}`}
                                  </span>
                                </div>
                              </td>

                              {[0, 1, 2, 3, 4].map((dayIdx) => {
                                const slot = gridMatrix[periodNum]?.[dayIdx];
                                if (!slot) {
                                  return (
                                    <td key={dayIdx} className="p-2 border-r border-slate-200 text-center text-slate-300 italic">
                                      Vacant
                                    </td>
                                  );
                                }

                                const isConflict = slot.status === "CONFLICT" || slot.status.startsWith("UNMATCHED");
                                const isWarning = slot.status === "WARNING";

                                return (
                                  <td
                                    key={dayIdx}
                                    className={`p-2 border-r border-slate-200 align-top transition ${
                                      isConflict
                                        ? "bg-red-50/80 border-red-200"
                                        : isWarning
                                        ? "bg-amber-50/80 border-amber-200"
                                        : "bg-white"
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-slate-900 truncate">
                                          {slot.subject_name}
                                        </span>
                                        {slot.is_locked && (
                                          <span title="Locked Slot">
                                            <Lock className="w-3 h-3 text-[#A91079]" />
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-600 truncate">
                                        {slot.teacher_name}
                                      </div>
                                      {slot.message && (
                                        <div
                                          className={`text-[10px] font-medium leading-tight ${
                                            isConflict
                                              ? "text-red-700"
                                              : isWarning
                                              ? "text-amber-800"
                                              : "text-emerald-700"
                                          }`}
                                        >
                                          {slot.message}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* List View */}
              {viewMode === "LIST" && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 font-bold">Day & Period</th>
                        <th className="p-2.5 font-bold">Subject</th>
                        <th className="p-2.5 font-bold">Teacher</th>
                        <th className="p-2.5 font-bold">Audit Status</th>
                        <th className="p-2.5 font-bold">Diagnostic Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSlots.map((slot, idx) => {
                        const isConflict = slot.status === "CONFLICT" || slot.status.startsWith("UNMATCHED");
                        const isWarning = slot.status === "WARNING";
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-medium text-slate-800 whitespace-nowrap">
                              {slot.day_name} • Period {slot.period_index}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">{slot.subject_name}</td>
                            <td className="p-2.5 text-slate-700">{slot.teacher_name}</td>
                            <td className="p-2.5 whitespace-nowrap">
                              {isConflict ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                  <AlertOctagon className="w-3 h-3" /> Clashing
                                </span>
                              ) : isWarning ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3" /> Warning
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600 text-[11px]">{slot.message || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {previewSlots.length > 0 ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={importing}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Choose Different File
            </button>
          ) : (
            <div className="text-xs text-slate-500 italic">
              Make sure your class advisers and subjects are properly configured before import.
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            {previewSlots.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || previewSlots.length === 0}
                className="px-5 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white text-xs font-bold rounded-xl shadow-md shadow-[#A91079]/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {importing
                    ? "Importing Schedule..."
                    : `Confirm & Import Schedule (${previewSlots.length} Slots)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Backward-compatible alias for existing imports
export const ImportSectionsExcelModal = ImportSectionScheduleModal;
