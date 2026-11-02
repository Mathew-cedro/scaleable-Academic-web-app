import React, { useState, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  Sparkles,
  Building,
  CheckCircle2,
  Layers,
  AlertCircle,
} from "lucide-react";
import { api } from "../api/client";
import { loadModularTracks } from "../utils/modularTracks";

interface Section {
  id: number;
  name: string;
  grade_level: number;
  program_type: string;
  room_number: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingSections: Section[];
  onBatchCreated: () => void;
}

// DepEd KS-3 standard naming presets
const DEPED_GRADE_NAMES: Record<number, string[]> = {
  7: ["Diamond", "Emerald", "Sapphire", "Ruby", "Topaz", "Pearl", "Amethyst", "Opal", "Garnet", "Jade"],
  8: ["Darwin", "Einstein", "Newton", "Dalton", "Galileo", "Faraday", "Curie", "Mendel", "Tesla", "Pasteur"],
  9: ["Rizal", "Bonifacio", "Mabini", "Del Pilar", "Jacinto", "Luna", "Silang", "Aguinaldo", "Aquino", "Tandang Sora"],
  10: ["Quezon", "Osmeña", "Roxas", "Quirino", "Magsaysay", "Garcia", "Macapagal", "Laurel", "Kalaw", "Recto"],
};

export const BatchSectionSetupModal: React.FC<Props> = ({
  isOpen,
  onClose,
  existingSections,
  onBatchCreated,
}) => {
  // Number of sections to ADD for each grade
  const [countsToAdd, setCountsToAdd] = useState<Record<number, number>>({
    7: 0,
    8: 0,
    9: 0,
    10: 0,
  });

  // Track selection per grade for added sections
  const [gradeTracks, setGradeTracks] = useState<Record<number, string>>({
    7: "BEC",
    8: "STE",
    9: "BEC",
    10: "BEC",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Current counts in DB
  const currentGradeCounts = useMemo(() => {
    const counts: Record<number, number> = { 7: 0, 8: 0, 9: 0, 10: 0 };
    existingSections.forEach((s) => {
      if (counts[s.grade_level] !== undefined) {
        counts[s.grade_level]++;
      }
    });
    return counts;
  }, [existingSections]);

  // Generate preview of sections that will be created
  const previewSections = useMemo(() => {
    const list: Array<{
      name: string;
      grade_level: number;
      program_type: string;
      room_number: string;
    }> = [];

    const existingNames = new Set(existingSections.map((s) => s.name.trim().toLowerCase()));

    [7, 8, 9, 10].forEach((grade) => {
      const count = countsToAdd[grade] || 0;
      if (count <= 0) return;

      const presets = DEPED_GRADE_NAMES[grade] || [];
      const track = gradeTracks[grade] || "BEC";
      let presetIdx = 0;

      for (let i = 0; i < count; i++) {
        // Find next unused preset name
        let chosenName = "";
        while (presetIdx < presets.length) {
          const candidate = `Grade ${grade} - ${presets[presetIdx]}`;
          if (!existingNames.has(candidate.toLowerCase())) {
            chosenName = candidate;
            existingNames.add(candidate.toLowerCase());
            presetIdx++;
            break;
          }
          presetIdx++;
        }

        // Fallback if presets exhausted
        if (!chosenName) {
          let num = currentGradeCounts[grade] + i + 1;
          chosenName = `Grade ${grade} - Section ${num}`;
          while (existingNames.has(chosenName.toLowerCase())) {
            num++;
            chosenName = `Grade ${grade} - Section ${num}`;
          }
          existingNames.add(chosenName.toLowerCase());
        }

        // Room number suggestion
        const roomNumber = `Room ${grade}0${currentGradeCounts[grade] + i + 1}`;

        list.push({
          name: chosenName,
          grade_level: grade,
          program_type: track,
          room_number: roomNumber,
        });
      }
    });

    return list;
  }, [countsToAdd, gradeTracks, existingSections, currentGradeCounts]);

  const totalToAdd = previewSections.length;

  const handleIncrement = (grade: number) => {
    setCountsToAdd((prev) => ({
      ...prev,
      [grade]: Math.min((prev[grade] || 0) + 1, 10),
    }));
  };

  const handleDecrement = (grade: number) => {
    setCountsToAdd((prev) => ({
      ...prev,
      [grade]: Math.max((prev[grade] || 0) - 1, 0),
    }));
  };

  const handleQuickPreset = (pattern: "EVEN_2" | "EVEN_3" | "RESET") => {
    if (pattern === "RESET") {
      setCountsToAdd({ 7: 0, 8: 0, 9: 0, 10: 0 });
    } else if (pattern === "EVEN_2") {
      // Ensure each grade has at least 2 sections
      setCountsToAdd({
        7: Math.max(0, 2 - currentGradeCounts[7]),
        8: Math.max(0, 2 - currentGradeCounts[8]),
        9: Math.max(0, 2 - currentGradeCounts[9]),
        10: Math.max(0, 2 - currentGradeCounts[10]),
      });
    } else if (pattern === "EVEN_3") {
      // Ensure each grade has at least 3 sections
      setCountsToAdd({
        7: Math.max(0, 3 - currentGradeCounts[7]),
        8: Math.max(0, 3 - currentGradeCounts[8]),
        9: Math.max(0, 3 - currentGradeCounts[9]),
        10: Math.max(0, 3 - currentGradeCounts[10]),
      });
    }
  };

  const handleExecuteBatchCreate = async () => {
    if (previewSections.length === 0) return;
    try {
      setLoading(true);
      setError(null);
      await api.createSectionsBatch(previewSections);
      setSuccessCount(previewSections.length);
      setTimeout(() => {
        onBatchCreated();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to create batch sections");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-800">
        {/* Header */}
        <div className="px-6 py-5 bg-[#2E0249] text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 text-amber-300 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Batch Section Setup
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/20">
                  Grades 7 to 10
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Quickly scale or balance student sections across Key Stage 3 for schedule generation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Successfully created {successCount} sections! Refreshing timetable matrix...</span>
            </div>
          )}

          {/* Quick Presets Bar */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl flex-wrap">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#A91079]" />
              <span>Quick Scaling Templates:</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickPreset("EVEN_2")}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                Ensure ≥ 2 Sections / Grade
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("EVEN_3")}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                Ensure ≥ 3 Sections / Grade
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("RESET")}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Grade Level Stepper Rows (Grades 7, 8, 9, 10) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[7, 8, 9, 10].map((grade) => {
              const current = currentGradeCounts[grade] || 0;
              const toAdd = countsToAdd[grade] || 0;
              const totalAfter = current + toAdd;

              return (
                <div
                  key={grade}
                  className={`p-4 rounded-xl border transition ${
                    toAdd > 0
                      ? "bg-[#FDF2FA] border-[#E5CCE3] shadow-2xs"
                      : "bg-white border-slate-200/90"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-[#2E0249] text-white font-bold text-xs flex items-center justify-center">
                        G{grade}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Grade {grade} Sections</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {current} active section{current !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900 num-tabular">
                        {totalAfter} <span className="text-[11px] font-normal text-slate-400">total</span>
                      </div>
                      {toAdd > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          +{toAdd} new
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDecrement(grade)}
                        disabled={toAdd <= 0}
                        className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition disabled:opacity-30 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-black text-slate-800">
                        +{toAdd}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleIncrement(grade)}
                        className="w-8 h-8 rounded-xl border border-[#E5CCE3] bg-[#FDF2FA] hover:bg-[#F3E5F2] text-[#A91079] flex items-center justify-center font-bold text-sm transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Track Template for this grade */}
                    <select
                      value={gradeTracks[grade]}
                      onChange={(e) =>
                        setGradeTracks((prev) => ({ ...prev, [grade]: e.target.value }))
                      }
                      className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-[#A91079]"
                    >
                      {loadModularTracks().map((trk) => (
                        <option key={trk.code} value={trk.code}>
                          {trk.code} ({trk.name.split(" ")[0]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generated Sections Preview List */}
          {previewSections.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Preview: {previewSections.length} New Sections to be Created</span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Automatic DepEd Naming & Room Assignment
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {previewSections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs font-semibold shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#F3E5F2] text-[#A91079] text-[10px] font-black">
                        G{sec.grade_level}
                      </span>
                      <span className="font-bold text-slate-900">{sec.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200">
                        {sec.program_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <Building className="w-3 h-3 text-slate-400" />
                        {sec.room_number}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600 font-semibold">
            {totalToAdd > 0 ? (
              <span>
                Ready to create <strong className="text-[#A91079] font-black">{totalToAdd}</strong> new section{totalToAdd > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-slate-400">Use the + steppers to add sections for Grade 7 to 10</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteBatchCreate}
              disabled={totalToAdd === 0 || loading}
              className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-lg text-xs font-semibold transition flex items-center gap-2 shadow-xs disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Creating Sections..." : `Create ${totalToAdd} Sections`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
