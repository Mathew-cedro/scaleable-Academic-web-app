import React, { useState } from "react";
import { X, Layers, PlusCircle } from "lucide-react";
import { type ModularTrack, normalizeModularTrack } from "../utils/modularTracks";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTrackCreated: (newTrack: ModularTrack) => void;
  existingTracks: ModularTrack[];
}

export const AddSpecialTrackModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onTrackCreated,
  existingTracks,
}) => {
  const [trackCode, setTrackCode] = useState("");
  const [trackName, setTrackName] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  const [trackColor, setTrackColor] = useState<ModularTrack["badgeColor"]>("fuchsia");
  const [includeCoreSubjects, setIncludeCoreSubjects] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = trackCode.trim().toUpperCase();
    const cleanName = trackName.trim();

    if (!cleanCode) {
      setError("Please enter a valid track code (e.g., SPFL, TVL, ALIVE).");
      return;
    }

    if (!cleanName) {
      setError("Please enter the track full name.");
      return;
    }

    if (existingTracks.some((t) => t.code.toUpperCase() === cleanCode)) {
      setError(`A program track with code '${cleanCode}' already exists.`);
      return;
    }

    const defaultSubs = includeCoreSubjects ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [];
    const newTrack: ModularTrack = normalizeModularTrack({
      id: cleanCode,
      code: cleanCode,
      name: cleanName,
      description:
        trackDesc.trim() || `Specialized DepEd program track (${cleanCode}) for student class sections.`,
      badgeColor: trackColor,
      isDefault: false,
      isGradeSpecific: true,
      subjectIds: defaultSubs,
      gradeSubjects: {
        7: [...defaultSubs],
        8: [...defaultSubs],
        9: [...defaultSubs],
        10: [...defaultSubs],
      },
    });

    onTrackCreated(newTrack);
    // Reset form
    setTrackCode("");
    setTrackName("");
    setTrackDesc("");
    setTrackColor("fuchsia");
    setIncludeCoreSubjects(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#F3E5F2] text-[#A91079] rounded-xl">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Add Special Program Track</h3>
              <p className="text-[11px] text-slate-500">
                Define a specialized DepEd track for student class sections.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Track Code (e.g. SPFL, TVL, ALIVE, SPA, SPS) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={trackCode}
              onChange={(e) => setTrackCode(e.target.value.toUpperCase())}
              placeholder="e.g. SPFL"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase focus:outline-hidden focus:border-[#A91079] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Track Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              placeholder="e.g. Special Program in Foreign Language"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-hidden focus:border-[#A91079] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Curriculum Description</label>
            <textarea
              rows={2}
              value={trackDesc}
              onChange={(e) => setTrackDesc(e.target.value)}
              placeholder="Specialized language and cultural immersion curriculum..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-[#A91079] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Badge Color Theme</label>
            <div className="flex items-center gap-2">
              {(["indigo", "emerald", "amber", "fuchsia", "sky", "rose", "teal"] as const).map((clr) => (
                <button
                  key={clr}
                  type="button"
                  onClick={() => setTrackColor(clr)}
                  className={`w-7 h-7 rounded-xl border-2 transition cursor-pointer ${
                    trackColor === clr ? "border-slate-900 scale-110 shadow-xs" : "border-transparent"
                  } ${
                    clr === "indigo"
                      ? "bg-indigo-500"
                      : clr === "emerald"
                      ? "bg-emerald-500"
                      : clr === "amber"
                      ? "bg-amber-500"
                      : clr === "fuchsia"
                      ? "bg-fuchsia-500"
                      : clr === "sky"
                      ? "bg-sky-500"
                      : clr === "rose"
                      ? "bg-rose-500"
                      : "bg-teal-500"
                  }`}
                  title={clr}
                />
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
            <input
              type="checkbox"
              id="includeCoreSection"
              checked={includeCoreSubjects}
              onChange={(e) => setIncludeCoreSubjects(e.target.checked)}
              className="w-4 h-4 rounded text-[#A91079] cursor-pointer"
            />
            <label htmlFor="includeCoreSection" className="font-bold text-slate-700 cursor-pointer text-xs">
              Pre-populate with standard DepEd Core Subjects (Grades 7–10)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#A91079] hover:bg-[#8F0B66] text-white font-bold shadow-2xs cursor-pointer transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Track</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
