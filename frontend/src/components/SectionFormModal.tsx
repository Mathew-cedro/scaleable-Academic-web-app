import { useState, useEffect, useMemo } from "react";
import { X, GraduationCap, Building, User, Sparkles, AlertTriangle } from "lucide-react";
import { loadModularTracks } from "../utils/modularTracks";

interface Teacher {
  id: number;
  name: string;
  department_id: number;
  position: string;
  is_adviser: boolean;
  advisory_section_id?: number | null;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

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
  sectionToEdit?: Section | null;
  defaultGradeLevel?: number;
  sections?: Section[];
  teachers: Teacher[];
  departments: Department[];
  onSubmit: (data: {
    name: string;
    grade_level: number;
    program_type: string;
    room_number: string;
    adviser_id?: number | null;
  }) => Promise<void>;
  loading?: boolean;
}

export const SectionFormModal = ({
  isOpen,
  onClose,
  sectionToEdit,
  defaultGradeLevel = 7,
  sections = [],
  teachers,
  departments,
  onSubmit,
  loading = false,
}: Props) => {
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState<number>(defaultGradeLevel);
  const [programType, setProgramType] = useState<string>("BEC");
  const [roomNumber, setRoomNumber] = useState("");
  const [adviserId, setAdviserId] = useState<number | 0>(0);
  const [error, setError] = useState<string | null>(null);

  const deptMap = new Map<number, Department>(departments.map((d) => [d.id, d]));

  // Check if room is already taken by another active section
  const clashingSections = useMemo(() => {
    if (!roomNumber.trim() || !sections || sections.length === 0) return [];
    return sections.filter(
      (s) =>
        s.room_number?.trim().toLowerCase() === roomNumber.trim().toLowerCase() &&
        (sectionToEdit ? s.id !== sectionToEdit.id : true)
    );
  }, [roomNumber, sections, sectionToEdit]);

  // Pre-fill fields if editing
  useEffect(() => {
    if (sectionToEdit) {
      setName(sectionToEdit.name);
      setGradeLevel(sectionToEdit.grade_level);
      setProgramType(
        sectionToEdit.program_type === "Regular" ? "BEC" : (sectionToEdit.program_type || "BEC")
      );
      setRoomNumber(sectionToEdit.room_number || "");

      // Find current adviser for this section
      const currentAdviser = teachers.find(
        (t) => t.is_adviser && t.advisory_section_id === sectionToEdit.id
      );
      setAdviserId(currentAdviser ? currentAdviser.id : 0);
    } else {
      setName("");
      setGradeLevel(defaultGradeLevel);
      setProgramType("BEC");
      setRoomNumber(`Room ${defaultGradeLevel}01`);
      setAdviserId(0);
    }
    setError(null);
  }, [sectionToEdit, isOpen, teachers, defaultGradeLevel]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a section name (e.g. Grade 7 - Rizal).");
      return;
    }
    if (!roomNumber.trim()) {
      setError("Please specify a classroom or room number.");
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        grade_level: gradeLevel,
        program_type: programType,
        room_number: roomNumber.trim(),
        adviser_id: adviserId > 0 ? adviserId : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save section.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-[#E5CCE3] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#F3E5F2] text-[#A91079] shadow-2xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                {sectionToEdit ? "Edit Class Section" : "Create New Section"}
              </h3>
              <p className="text-xs text-slate-500">
                Configure class section details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* Section Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Section Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grade 7 - Diamond, Grade 8 - STE Darwin"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition"
            />
          </div>

          {/* Grade Level & Track Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Grade Level <span className="text-red-500">*</span>
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden transition cursor-pointer"
              >
                <option value={7}>Grade 7</option>
                <option value={8}>Grade 8</option>
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Program Track <span className="text-red-500">*</span>
              </label>
              <select
                value={programType}
                onChange={(e) => setProgramType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden transition cursor-pointer"
              >
                {loadModularTracks().map((trk) => (
                  <option key={trk.code} value={trk.code}>
                    {trk.code} ({trk.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Room Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Designated Room / Classroom <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Room 101, Bldg A - Lab 2"
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden transition"
              />
            </div>
            {clashingSections.length > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="font-bold">Shared Room Notice:</strong> Classroom{" "}
                  <span className="font-mono font-bold">{roomNumber.trim()}</span> is already assigned to{" "}
                  <strong>{clashingSections.map((s) => s.name).join(", ")}</strong>. Ensure sections run on separate shifts or staggered hours to prevent room collisions.
                </div>
              </div>
            )}
          </div>

          {/* Designated Class Adviser */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Designated Class Adviser (Homeroom Lock)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <select
                value={adviserId}
                onChange={(e) => setAdviserId(Number(e.target.value))}
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden transition cursor-pointer"
              >
                <option value={0}>-- Unassigned (No Adviser Selected) --</option>
                {teachers.map((t) => {
                  const tDept = deptMap.get(t.department_id);
                  const isAlreadyAdviserOther =
                    t.is_adviser &&
                    t.advisory_section_id &&
                    t.advisory_section_id !== sectionToEdit?.id;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.position} • {tDept?.code || "Dept"})
                      {isAlreadyAdviserOther ? " [Currently Advises Another Section]" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-[#A91079] hover:bg-[#8F0B66] text-white shadow-md hover:shadow-[#A91079]/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Saving..." : sectionToEdit ? "Update Section" : "Create Section"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
