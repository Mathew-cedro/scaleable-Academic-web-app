import { useState, useEffect, useRef } from "react";
import {
  GraduationCap,
  Lock,
  User,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  BookOpen
} from "lucide-react";
import { api } from "../api/client";
import type { UserProfile } from "../api/client";

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
  onOpenTeacherPocket?: () => void;
}

export const LoginPage = ({ onLoginSuccess, onOpenTeacherPocket }: Props) => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [capsLockActive, setCapsLockActive] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monitor CapsLock state
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState("CapsLock")) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            setErrorMsg(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await api.login(username.trim(), password, rememberMe);

      if (res.token) {
        localStorage.setItem("schedmaster_token", res.token);
      }
      if (res.user) {
        localStorage.setItem("schedmaster_user", JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      const msg = err.message || "Authentication failed";
      setErrorMsg(msg);

      if (msg.toLowerCase().includes("lockout") || msg.toLowerCase().includes("too many failed")) {
        setLockoutSeconds(60);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A012B] text-[#FAF5FA] flex flex-col justify-center items-center p-4 selection:bg-[#F806CC] selection:text-white relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#570A57]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#A91079]/15 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#570A57] border border-[#F806CC]/30 flex items-center justify-center text-[#F806CC] shadow-xl mx-auto shadow-[#570A57]/40">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            DepEd SchedMaster
          </h1>
          <p className="text-xs text-[#D5B4DE] max-w-xs mx-auto">
            Junior High School Key Stage 3 Timetable Management • DepEd Order No. 009, s. 2026
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#2E0249] border border-[#570A57] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative">
          <div className="flex items-center justify-between border-b border-[#570A57] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Institutional Access
              </span>
            </div>
            <span className="text-[10px] font-semibold text-[#D5B4DE] bg-[#3D055E] px-2 py-0.5 rounded-full border border-[#570A57]">
              PBKDF2-HMAC-SHA256
            </span>
          </div>

          {errorMsg && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                lockoutSeconds > 0
                  ? "bg-rose-950/60 border-rose-500 text-rose-200"
                  : "bg-rose-950/40 border-rose-600/50 text-rose-200"
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Authentication Refused</div>
                <div className="text-[11px] mt-0.5">{errorMsg}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-xs font-bold text-[#D5B4DE] uppercase tracking-wider block"
              >
                Account Username / Code
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  disabled={loading || lockoutSeconds > 0}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., principal, sci_head, math_head"
                  className="w-full bg-[#3D055E] border border-[#A91079]/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#F806CC] transition pl-10"
                />
                <User className="w-4 h-4 text-[#D5B4DE] absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-bold text-[#D5B4DE] uppercase tracking-wider block"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  disabled={loading || lockoutSeconds > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••••••"
                  className="w-full bg-[#3D055E] border border-[#A91079]/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#F806CC] transition pl-10 pr-10"
                />
                <Lock className="w-4 h-4 text-[#D5B4DE] absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-[#D5B4DE] hover:text-white transition cursor-pointer"
                  title={showPassword ? "Hide Password" : "Show Password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {capsLockActive && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold mt-1.5">
                  <AlertCircle className="w-3 h-3" />
                  <span>Caps Lock is ON</span>
                </div>
              )}
            </div>

            {/* Remember Me & Protocol */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-[#D5B4DE] hover:text-white transition">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#570A57] bg-[#220137] text-[#A91079] focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] font-medium">Keep session active (7 days)</span>
              </label>

              <span className="text-[10px] font-mono text-[#A58BAA]">
                TLS 1.3
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className="w-full py-3 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#A91079]/30 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed border border-[#F806CC]/30"
            >
              {loading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-white" />
                  <span>Authenticating Credentials...</span>
                </>
              ) : lockoutSeconds > 0 ? (
                <>
                  <Clock className="w-4 h-4 text-amber-300 animate-spin" />
                  <span>Security Lockout ({lockoutSeconds}s)</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#F806CC]" />
                  <span>Sign In as School Admin / Dept Head</span>
                </>
              )}
            </button>

            {/* Zero-Friction Teacher Access Button */}
            {onOpenTeacherPocket && (
              <div className="pt-3 border-t border-[#570A57]/60">
                <button
                  type="button"
                  onClick={onOpenTeacherPocket}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#3D055E] hover:bg-[#570A57] border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>Are you a Teacher? View Pocket Schedule ➔</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
};
