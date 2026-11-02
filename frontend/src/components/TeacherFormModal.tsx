import { useState, useEffect, useRef } from "react";
import { X, UserPlus, Edit3, AlertCircle, Sparkles, Image as ImageIcon, Upload, RefreshCw, Trash2 } from "lucide-react";

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
}

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
  avatar_url?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null; // null for Create, object for Edit
  departments: Department[];
  sections: Section[];
  teachers?: Teacher[];
  defaultDeptId?: number | null;
  isDeptHead?: boolean;
  onSave: (data: any, isEdit: boolean, teacherId?: number) => Promise<void>;
  loading: boolean;
}

const POSITIONS = [
  "Teacher I",
  "Teacher II",
  "Teacher III",
  "Master Teacher I",
  "Master Teacher II",
  "Head Teacher I",
  "Head Teacher II",
  "Head Teacher III",
];

const PRESET_AVATARS = [
  { name: "Male 1", seed: "Felix", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" },
  { name: "Female 1", seed: "Aneka", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" },
  { name: "Male 2", seed: "Brian", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Brian" },
  { name: "Female 2", seed: "Maria", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria" },
  { name: "Male 3", seed: "Oliver", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver" },
  { name: "Female 3", seed: "Zoe", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe" },
];

export const TeacherFormModal = ({
  isOpen,
  onClose,
  teacher,
  departments,
  sections,
  teachers = [],
  defaultDeptId,
  isDeptHead = false,
  onSave,
  loading,
}: Props) => {
  const isEdit = Boolean(teacher);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<number>(1);
  const [position, setPosition] = useState<string>("Teacher I");
  const [advisorySectionId, setAdvisorySectionId] = useState<number | "NONE">("NONE");
  const [maxDailyHours, setMaxDailyHours] = useState<number>(6);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState<number>(30);
  const [status, setStatus] = useState<string>("Active");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [imgError, setImgError] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (teacher) {
      setName(teacher.name);
      setDepartmentId(teacher.department_id);
      setPosition(teacher.position);
      setAdvisorySectionId(teacher.advisory_section_id || "NONE");
      setMaxDailyHours(teacher.max_daily_hours);
      setMaxWeeklyHours(teacher.max_weekly_hours);
      setStatus(teacher.status);
      setAvatarUrl(teacher.avatar_url || "");
    } else {
      setName("");
      const resolvedDept =
        typeof defaultDeptId === "number" ? defaultDeptId : (departments[0]?.id ?? 1);
      setDepartmentId(resolvedDept);
      setPosition("Teacher I");
      setAdvisorySectionId("NONE");
      setMaxDailyHours(6);
      setMaxWeeklyHours(30);
      setStatus("Active");
      setAvatarUrl("");
    }
    setImgError(false);
    setErrorMsg(null);
  }, [teacher, isOpen, defaultDeptId, departments]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (PNG, JPG, SVG, WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Avatar file size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        setImgError(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    setAvatarUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`);
    setImgError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Teacher full name is required.");
      return;
    }

    if (maxDailyHours > 6) {
      setErrorMsg("Actual classroom teaching cannot exceed 6 hours per day.");
      return;
    }

    const payload = {
      name: name.trim(),
      department_id: Number(departmentId) || (departments[0]?.id ?? 1),
      position: String(position || "Teacher I"),
      max_daily_hours: Number(maxDailyHours) || 6,
      max_weekly_hours: Number(maxWeeklyHours) || 30,
      is_adviser: advisorySectionId !== "NONE",
      advisory_section_id: advisorySectionId === "NONE" ? null : Number(advisorySectionId),
      status: String(status || "Active"),
      avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
    };

    try {
      await onSave(payload, isEdit, teacher?.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save faculty record.");
    }
  };

  const initials =
    name
      .split(" ")
      .filter((n) => !n.startsWith("Dr.") && !n.startsWith("Mrs.") && !n.startsWith("Mr.") && !n.startsWith("G.") && !n.startsWith("Bb."))
      .map((n) => n[0])
      .join("")
      .slice(0, 2) || "TC";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5CCE3] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FDF2FA] text-[#A91079] rounded-xl">
              {isEdit ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEdit ? "Edit Faculty Profile" : "Add New Faculty Member"}
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure faculty profile and teaching workload limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Profile Picture (PFP) Selector */}
          <div className="p-3.5 bg-slate-50 border border-[#E5CCE3] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Faculty Profile Picture (PFP)</span>
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl("");
                    setImgError(false);
                  }}
                  className="text-[10px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Circular Avatar Preview */}
              <div className="relative shrink-0">
                {avatarUrl && !imgError ? (
                  <img
                    src={avatarUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#E5CCE3] shadow-sm bg-white"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#A91079] text-white font-extrabold text-lg flex items-center justify-center shadow-sm">
                    {initials}
                  </div>
                )}
              </div>

              {/* Upload & Generator Controls */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateRandomAvatar}
                    className="px-3 py-1.5 bg-[#FDF2FA] border border-[#E5CCE3] hover:bg-[#F3E5F2] text-[#A91079] rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                    title="Generate random styled avatar"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#A91079]" />
                    <span>Randomize</span>
                  </button>
                </div>

                {/* Direct Image URL input */}
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setImgError(false);
                  }}
                  placeholder="Or paste external image URL (e.g. Unsplash, CDN)"
                  className="w-full px-2.5 py-1.5 bg-white border border-[#E5CCE3] rounded-lg text-[11px] text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-[#A91079]"
                />
              </div>
            </div>

            {/* Quick Presets Picker */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Quick Avatar Presets
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.seed}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(preset.url);
                      setImgError(false);
                    }}
                    className={`w-9 h-9 rounded-xl border p-0.5 transition cursor-pointer shrink-0 ${
                      avatarUrl === preset.url
                        ? "border-[#A91079] ring-2 ring-[#F806CC] bg-[#FDF2FA]"
                        : "border-[#E5CCE3] hover:border-slate-300 bg-white"
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full rounded-lg object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Teacher Full Name & Salutation
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Maria Santos or Mr. David Chen"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
            />
          </div>

          {/* Department & Position */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Academic Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                disabled={isDeptHead}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079] disabled:bg-slate-100 disabled:text-slate-500"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                DepEd Position / Rank
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Advisory Section Assignment */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Class Advisory Role (Homeroom & Guidance Program)
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">DepEd DO 009 Locked Mon P1</span>
            </div>
            <select
              value={advisorySectionId}
              onChange={(e) =>
                setAdvisorySectionId(e.target.value === "NONE" ? "NONE" : Number(e.target.value))
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
            >
              <option value="NONE">No Class Advisory (Subject Teacher only)</option>
              {sections.map((sec) => {
                const currentSecAdv = teachers.find(
                  (t) => t.is_adviser && t.advisory_section_id === sec.id && t.id !== teacher?.id
                );
                return (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} ({sec.program_type} • Grade {sec.grade_level})
                    {currentSecAdv ? ` [Current Adviser: ${currentSecAdv.name}]` : ""}
                  </option>
                );
              })}
            </select>
            {advisorySectionId !== "NONE" && (
              (() => {
                const currentSecAdv = teachers.find(
                  (t) => t.is_adviser && t.advisory_section_id === Number(advisorySectionId) && t.id !== teacher?.id
                );
                return currentSecAdv ? (
                  <p className="mt-1 text-[11px] text-amber-700 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Notice: Saving will transfer advisory from <strong>{currentSecAdv.name}</strong> and update the section's Monday Period 1 Homeroom slot.
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Assigns faculty as official class adviser for Monday Period 1 Homeroom Guidance Program.
                  </p>
                );
              })()
            )}
          </div>

          {/* Daily Cap & Weekly Load Limit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Max Daily Hours
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={maxDailyHours}
                onChange={(e) => setMaxDailyHours(Math.min(6, Math.max(1, Number(e.target.value))))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Max Weekly Hours
              </label>
              <input
                type="number"
                min="1"
                max="40"
                value={maxWeeklyHours}
                onChange={(e) => setMaxWeeklyHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Faculty Availability Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#A91079]"
            >
              <option value="Active">Active (Available for teaching & substitution)</option>
              <option value="On Leave">On Leave (Excluded from schedule solving)</option>
              <option value="Wellness Leave">Wellness Leave (DO 002, s. 2026 Mental Health)</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? "Saving..." : isEdit ? "Update Faculty" : "Add Faculty"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
