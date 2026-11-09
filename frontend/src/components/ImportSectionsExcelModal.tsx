import React, { useState, useRef } from "react";
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Sparkles,
  Info,
  Check,
} from "lucide-react";
import { api } from "../api/client";

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
}

interface ParsedSectionRow {
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
  onImportComplete: () => void;
  teachers: Teacher[];
}

export const ImportSectionsExcelModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportComplete,
  teachers,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<ParsedSectionRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<Record<string, string | null>>({});
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setError(null);
      await api.downloadSectionsTemplateExcel();
    } catch (err: any) {
      setError(err?.message || "Failed to download template spreadsheet.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const processFile = async (selectedFile: File) => {
    const validExts = [".xlsx", ".xls", ".csv"];
    const hasValidExt = validExts.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setError("Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      setFile(selectedFile);

      const res = await api.previewSectionsExcel(selectedFile);
      if (res.success) {
        setPreviewRows(res.rows as ParsedSectionRow[]);
        setDetectedColumns(res.detected_columns);
      } else {
        setError("Could not parse file. Please verify structure.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to parse section spreadsheet.");
      setFile(null);
      setPreviewRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveRow = (idxToRemove: number) => {
    setPreviewRows((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleUpdateField = (idx: number, field: keyof ParsedSectionRow, value: any) => {
    setPreviewRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, [field]: value };
        if (field === "adviser_id") {
          const t = teachers.find((tc) => tc.id === Number(value));
          updated.adviser_id = t ? t.id : null;
          updated.adviser_name = t ? t.name : null;
          updated.adviser_matched = Boolean(t);
        }
        return updated;
      })
    );
  };

  const handleCommitImport = async () => {
    if (previewRows.length === 0) {
      setError("No section records to import.");
      return;
    }

    try {
      setImporting(true);
      setError(null);

      const payload = previewRows.map((r) => ({
        name: r.name.trim(),
        grade_level: Number(r.grade_level),
        program_type: r.program_type.trim(),
        room_number: r.room_number.trim(),
        adviser_id: r.adviser_id || null,
      }));

      const res = await api.importSectionsExcel(payload, updateExisting);
      if (res.success) {
        setSuccessMessage(
          `Successfully processed ${res.total_processed} section(s): ${res.created_count} created, ${res.updated_count} updated.`
        );
        setTimeout(() => {
          onImportComplete();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to commit section import.");
    } finally {
      setImporting(false);
    }
  };

  const validRowCount = previewRows.filter((r) => r.status !== "DUPLICATE_IN_FILE").length;
  const newRowCount = previewRows.filter((r) => r.status === "NEW").length;
  const updateRowCount = previewRows.filter((r) => r.status === "UPDATING").length;
  const matchedAdviserCount = previewRows.filter((r) => r.adviser_matched).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-linear-to-r from-[#2E0249] to-[#570A57] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">Import Sections via Excel / CSV</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  DepEd Key Stage 3
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Bulk create or update student sections, program tracks, classrooms, and assigned Class Advisers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-white/20 shadow-xs"
              title="Download official sample DepEd section template (.xlsx)"
            >
              {downloadingTemplate ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span>Download Template</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{successMessage}</div>
            </div>
          )}

          {/* Upload Drop Zone */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-[#A91079] bg-[#FAF5FA]"
                  : "border-slate-200 hover:border-[#A91079]/60 hover:bg-[#FAF5FA]/60 bg-slate-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-[#E5CCE3] flex items-center justify-center text-[#A91079]">
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {loading ? "Analyzing Spreadsheet..." : "Click to select or drag and drop your spreadsheet"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports Microsoft Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) and Comma-Separated Values (<strong>.csv</strong>)
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Check className="w-3 h-3 text-emerald-600" /> Auto-extracts Grade Level & Tracks
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  <Check className="w-3 h-3 text-emerald-600" /> Fuzzy Adviser Matching
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info & Options Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF5FA] p-3.5 rounded-2xl border border-[#E5CCE3]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white border border-[#E5CCE3] text-emerald-600">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{file.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • {previewRows.length} rows loaded
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-[#A91079] transition">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={(e) => setUpdateExisting(e.target.checked)}
                      className="rounded-sm text-[#A91079] focus:ring-[#A91079]"
                    />
                    <span>Update existing sections</span>
                  </label>

                  <button
                    onClick={() => {
                      setFile(null);
                      setPreviewRows([]);
                      setError(null);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Choose a different spreadsheet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Statistics Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-slate-500 font-semibold text-[11px]">Total Sections</div>
                  <div className="text-lg font-bold text-slate-900 num-tabular">{previewRows.length}</div>
                </div>
                <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200 text-[#2E0249]">
                  <div className="text-purple-700 font-semibold text-[11px]">New to Create</div>
                  <div className="text-lg font-bold text-[#A91079] num-tabular">{newRowCount}</div>
                </div>
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-amber-900">
                  <div className="text-amber-700 font-semibold text-[11px]">Existing to Update</div>
                  <div className="text-lg font-bold text-amber-800 num-tabular">{updateRowCount}</div>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-emerald-900">
                  <div className="text-emerald-700 font-semibold text-[11px]">Advisers Matched</div>
                  <div className="text-lg font-bold text-emerald-800 num-tabular">
                    {matchedAdviserCount} <span className="text-xs font-normal text-slate-500">/ {previewRows.length}</span>
                  </div>
                </div>
              </div>

              {/* Detected Column Mapping Pill */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 overflow-x-auto">
                <span className="font-bold text-slate-700 shrink-0">Auto-Detected Columns:</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Name: <strong className="text-slate-800">{detectedColumns.name || "Col 1"}</strong></span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Grade: <strong className="text-slate-800">{detectedColumns.grade_level || "Auto"}</strong></span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Track: <strong className="text-slate-800">{detectedColumns.program_type || "Auto"}</strong></span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Room: <strong className="text-slate-800">{detectedColumns.room_number || "Auto"}</strong></span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">Adviser: <strong className="text-slate-800">{detectedColumns.adviser || "None"}</strong></span>
              </div>

              {/* Interactive Validation Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#FAF5FA] border-b border-[#E5CCE3] sticky top-0 z-10 text-[11px] font-bold text-[#2E0249]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Section Name</th>
                        <th className="py-2.5 px-3 w-28">Grade</th>
                        <th className="py-2.5 px-3 w-28">Track</th>
                        <th className="py-2.5 px-3 w-28">Room</th>
                        <th className="py-2.5 px-3">Assigned Class Adviser</th>
                        <th className="py-2.5 px-3 w-24 text-center">Status</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Name Input */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleUpdateField(idx, "name", e.target.value)}
                              className="w-full font-bold text-slate-900 bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-[#A91079] rounded px-1.5 py-0.5 outline-hidden"
                            />
                          </td>

                          {/* Grade Level Dropdown */}
                          <td className="py-2 px-3">
                            <select
                              value={row.grade_level}
                              onChange={(e) => handleUpdateField(idx, "grade_level", Number(e.target.value))}
                              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                            >
                              <option value={7}>Grade 7</option>
                              <option value={8}>Grade 8</option>
                              <option value={9}>Grade 9</option>
                              <option value={10}>Grade 10</option>
                            </select>
                          </td>

                          {/* Track Input/Select */}
                          <td className="py-2 px-3">
                            <select
                              value={row.program_type}
                              onChange={(e) => handleUpdateField(idx, "program_type", e.target.value)}
                              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-hidden focus:border-[#A91079]"
                            >
                              <option value="BEC">BEC (Regular)</option>
                              <option value="STE">STE (Science)</option>
                              <option value="SPS">SPS (Sports)</option>
                              <option value="SPA">SPA (Arts)</option>
                              <option value="SPJ">SPJ (Journalism)</option>
                            </select>
                          </td>

                          {/* Room Number */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.room_number}
                              onChange={(e) => handleUpdateField(idx, "room_number", e.target.value)}
                              className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-hidden focus:border-[#A91079]"
                            />
                          </td>

                          {/* Class Adviser Selection */}
                          <td className="py-2 px-3">
                            <select
                              value={row.adviser_id || ""}
                              onChange={(e) => handleUpdateField(idx, "adviser_id", e.target.value ? Number(e.target.value) : null)}
                              className={`w-full text-xs font-semibold rounded-lg px-2 py-1 border transition focus:outline-hidden ${
                                row.adviser_matched
                                  ? "bg-emerald-50/60 border-emerald-300 text-emerald-900"
                                  : "bg-slate-50 border-slate-200 text-slate-500"
                              }`}
                            >
                              <option value="">(No Adviser Assigned)</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.position})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Status Badge */}
                          <td className="py-2 px-3 text-center">
                            {row.status === "NEW" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                New
                              </span>
                            )}
                            {row.status === "UPDATING" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Update
                              </span>
                            )}
                            {row.status === "DUPLICATE_IN_FILE" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Duplicate
                              </span>
                            )}
                          </td>

                          {/* Remove Row Button */}
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Exclude row from import"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>Assigned advisers will automatically have Monday Period 1 Homeroom Guidance locked.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>

            {file && previewRows.length > 0 && (
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={importing || validRowCount === 0}
                className="px-5 py-2 rounded-xl bg-[#A91079] hover:bg-[#8F0B66] text-white text-xs font-bold shadow-md shadow-[#A91079]/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing Sections...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Commit Import ({validRowCount} Sections)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
