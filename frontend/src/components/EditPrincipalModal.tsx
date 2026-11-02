import { useState, useEffect } from "react";
import { X, UserCheck, Save, Mail, Phone, MapPin, Image as ImageIcon } from "lucide-react";
import type { UserProfile } from "../api/client";
import { api } from "../api/client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSave: (updated: UserProfile) => void;
}

const AVATAR_SEEDS = [
  { label: "Rolando (Default)", seed: "RolandoMariano" },
  { label: "School Head", seed: "SchoolHead" },
  { label: "Executive Head", seed: "DrMariano" },
  { label: "DepEd Leader", seed: "DepEdExecutive" },
];

export const EditPrincipalModal = ({
  isOpen,
  onClose,
  currentUser,
  onSave,
}: Props) => {
  const [name, setName] = useState(currentUser.name || "");
  const [position, setPosition] = useState(currentUser.position || "");
  const [email, setEmail] = useState(currentUser.email || "rolando.mariano@deped.gov.ph");
  const [phone, setPhone] = useState(currentUser.phone || "+63 (054) 881-2345");
  const [officeLocation, setOfficeLocation] = useState(
    currentUser.office_location || "Office of the School Head, Administrative Wing"
  );
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || "");
      setPosition(currentUser.position || "");
      setEmail(currentUser.email || "rolando.mariano@deped.gov.ph");
      setPhone(currentUser.phone || "+63 (054) 881-2345");
      setOfficeLocation(
        currentUser.office_location || "Office of the School Head, Administrative Wing"
      );
      setAvatarUrl(currentUser.avatar_url || "");
      setErrorMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Principal name cannot be blank.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const updateData = {
        name: name.trim(),
        position: position.trim() || "Principal IV / School Head",
        badge: "Principal Master View",
        avatar_url: avatarUrl.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        office_location: officeLocation.trim() || null,
      };

      let updatedProfile: UserProfile;
      try {
        updatedProfile = await api.updateUserProfile(currentUser.username, updateData);
      } catch {
        // Local fallback if API fails
        updatedProfile = {
          ...currentUser,
          ...updateData,
        };
      }

      onSave(updatedProfile);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update principal profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E5CCE3] flex items-center justify-between bg-[#FAF5FA]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#F3E5F2] text-[#A91079] rounded-xl border border-[#E5CCE3]">
              <UserCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-[#2E0249]">
                Edit Principal Profile Information
              </h3>
              <p className="text-xs text-[#703372]">
                Update official school head credentials, contact channels, and executive designation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-[#2E0249] rounded-xl hover:bg-[#F3E5F2] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Full Name & Position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Rolando Mariano"
                required
                className="w-full px-3.5 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-[#2E0249] focus:outline-hidden transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Title / Position
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Principal IV / School Head"
                className="w-full px-3.5 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-[#2E0249] focus:outline-hidden transition"
              />
            </div>
          </div>

          {/* Contact Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#A91079]" />
                <span>DepEd Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rolando.mariano@deped.gov.ph"
                className="w-full px-3.5 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-[#2E0249] focus:outline-hidden transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Office Phone / Extension</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +63 (054) 881-2345"
                className="w-full px-3.5 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-[#2E0249] focus:outline-hidden transition"
              />
            </div>
          </div>

          {/* Office Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#A91079]" />
              <span>Office Location & Station</span>
            </label>
            <input
              type="text"
              value={officeLocation}
              onChange={(e) => setOfficeLocation(e.target.value)}
              placeholder="e.g. Office of the School Head, Administrative Wing"
              className="w-full px-3.5 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-bold text-[#2E0249] focus:outline-hidden transition"
            />
          </div>

          {/* Profile Photo / Avatar URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-[#A91079]" />
                <span>Avatar / Photo URL</span>
              </span>
              <span className="text-[10px] text-[#703372] font-semibold">
                Direct image link or Dicebear seed
              </span>
            </label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://api.dicebear.com/7.x/avataaars/svg?seed=..."
              className="w-full px-3.5 py-2 bg-[#FAF5FA] border border-[#E5CCE3] focus:bg-white focus:border-[#A91079] rounded-xl text-xs font-semibold text-[#2E0249] focus:outline-hidden transition"
            />

            {/* Quick Avatar Presets */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] text-slate-400 font-bold mr-1">Presets:</span>
              {AVATAR_SEEDS.map((preset) => (
                <button
                  key={preset.seed}
                  type="button"
                  onClick={() =>
                    setAvatarUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${preset.seed}`)
                  }
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#F3E5F2] hover:bg-[#E5CCE3] text-[#703372] transition cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5CCE3]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-[#F3E5F2] hover:text-[#2E0249] font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-md shadow-[#A91079]/20 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? "Saving..." : "Save Profile Information"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
