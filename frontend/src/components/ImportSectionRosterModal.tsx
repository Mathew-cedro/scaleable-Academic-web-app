import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  GraduationCap,
  Check,
} from "lucide-react";
import { api } from "../api/client";

interface SectionPreviewRow {
  row_index: number;
  section_id?: number | null;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
  raw_adviser?: string | null;
  adviser_id?: number | null;
  adviser_name?: string | null;
  adviser_matched: boolean;
  status: "NEW" | "UPDATING" | "DUPLICATE_IN_FILE";
  status_message: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const ImportSectionRosterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<SectionPreviewRow[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    valid: number;
    new: number;
    updating: number;
    advisers_matched: number;
  }>({ total: 0, valid: 0, new: 0, updating: 0, advisers_matched: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setError(null);
      await api.downloadSectionsTemplateExcel();
    } catch (err: any) {
      setError(err?.message || "Failed to download section template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = async (selectedFile: File) => {
    const fn = selectedFile.name.toLowerCase();
    if (!fn.endsWith(".xlsx") && !fn.endsWith(".xls") && !fn.endsWith(".csv")) {
      setError("Unsupported format. Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const data = await api.previewSectionsExcel(selectedFile);
      setPreviewRows(data.rows || []);
      setStats(
        data.stats || {
          total: 0,
          valid: 0,
          new: 0,
          updating: 0,
          advisers_matched: 0,
        }
      );
    } catch (err: any) {
      setError(err?.message || "Failed to parse section roster spreadsheet.");
      setPreviewRows([]);
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

  const handleReset = () => {
    setFile(null);
    setPreviewRows([]);
    setError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!previewRows || previewRows.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const payload = previewRows
        .filter((r) => r.status !== "DUPLICATE_IN_FILE")
        .map((r) => ({
          name: r.name,
          grade_level: r.grade_level,
          program_type: r.program_type,
          room_number: r.room_number,
          adviser_id: r.adviser_id,
        }));

      const res = await api.importSectionsExcel(payload, updateExisting);
      setSuccessMessage(
        `Successfully processed ${res.total_processed} sections: ${res.created_count} created, ${res.updated_count} updated, ${res.skipped_count} skipped.`
      );

      setTimeout(() => {
        if (onImportComplete) onImportComplete();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to commit sections.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-[#2E0249] to-[#4A0E4E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/20">
              <GraduationCap className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Batch Import Section Roster</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Excel / CSV
                </span>
              </h2>
              <p className="text-xs text-purple-200 mt-0.5">
                Bulk create or update sections, assign classrooms, and link Class Advisers.
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Download Template Banner */}
          <div className="bg-[#FAF5FA] border border-[#E5CCE3] p-4 rounded-xl flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Need the official Section Roster template?
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Download a pre-formatted Excel template with columns: Section Name, Grade Level, Program Track, Room, and Class Adviser.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="px-3.5 py-2 bg-white hover:bg-purple-50 text-[#A91079] border border-[#E5CCE3] rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-2 transition cursor-pointer shrink-0"
            >
              {downloadingTemplate ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#A91079]" />
              ) : (
                <Download className="w-4 h-4 text-[#A91079]" />
              )}
              <span>Download Template (.xlsx)</span>
            </button>
          </div>

          {/* Notifications */}
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

          {/* Upload Dropzone */}
          {previewRows.length === 0 && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-[#A91079] bg-purple-50/50 scale-[0.99]"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50/60"
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
              <div className="p-3.5 bg-white rounded-2xl shadow-xs border border-slate-200 text-[#A91079]">
                {loading ? (
                  <RefreshCw className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {loading
                    ? "Analyzing section spreadsheet..."
                    : "Drag and drop your section roster file here"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV files
                </p>
              </div>
            </div>
          )}

          {/* Preview Table & Options */}
          {previewRows.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <span className="font-semibold text-slate-700">
                  Roster File: <span className="text-[#A91079] font-bold">{file?.name}</span>
                </span>
                <span>{previewRows.length} rows loaded</span>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Total Sections
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {stats.total}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    New Sections
                  </div>
                  <div className="text-lg font-black text-emerald-800 mt-0.5">
                    {stats.new}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                    Updating Existing
                  </div>
                  <div className="text-lg font-black text-blue-800 mt-0.5">
                    {stats.updating}
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
                  <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                    Advisers Matched
                  </div>
                  <div className="text-lg font-black text-[#A91079] mt-0.5">
                    {stats.advisers_matched} / {stats.total}
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 text-[#A91079] rounded-sm border-slate-300 focus:ring-[#A91079]"
                  />
                  <span>Update existing sections if name matches</span>
                </label>
                <span className="text-slate-500 italic">
                  Monday Period 1 Homeroom Guidance will be automatically locked to matched advisers.
                </span>
              </div>

              {/* Rows Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 font-bold">Section Name</th>
                      <th className="p-2.5 font-bold text-center">Grade</th>
                      <th className="p-2.5 font-bold text-center">Track</th>
                      <th className="p-2.5 font-bold">Classroom</th>
                      <th className="p-2.5 font-bold">Class Adviser</th>
                      <th className="p-2.5 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 font-bold text-slate-900">
                          {row.name}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                            Gr. {row.grade_level}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              row.program_type === "STE"
                                ? "bg-blue-100 text-blue-800"
                                : row.program_type === "SPA"
                                ? "bg-amber-100 text-amber-800"
                                : row.program_type === "SPJ"
                                ? "bg-purple-100 text-purple-800"
                                : row.program_type === "SPS"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.program_type}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 font-medium">
                          {row.room_number || "—"}
                        </td>
                        <td className="p-2.5">
                          {row.adviser_matched ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{row.adviser_name}</span>
                            </span>
                          ) : row.raw_adviser ? (
                            <span className="inline-flex items-center gap-1 text-amber-800">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>{row.raw_adviser} (Unmatched)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No Adviser Assigned</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {row.status === "NEW" ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                              New Section
                            </span>
                          ) : row.status === "UPDATING" ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                              Updating Sec #{row.section_id}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                              Duplicate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {previewRows.length > 0 ? (
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
              Make sure faculty advisers are registered in the Faculty tab for automatic Homeroom Guidance binding.
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

            {previewRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || previewRows.length === 0}
                className="px-5 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white text-xs font-bold rounded-xl shadow-md shadow-[#A91079]/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>
                  {importing
                    ? "Importing Sections..."
                    : `Confirm & Import (${previewRows.length} Sections)`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
