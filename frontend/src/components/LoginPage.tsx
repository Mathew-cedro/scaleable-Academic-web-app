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
} from "lucide-react";
import { api } from "../api/client";
import type { UserProfile } from "../api/client";

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage = ({ onLoginSuccess }: Props) => {
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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutSeconds > 0 || loading) return;

    if (!username.trim()) {
      setErrorMsg("Please enter your account username.");
      return;
    }
    if (!password.trim()) {
      setErrorMsg("Please enter your account password.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.login(username.trim(), password.trim(), rememberMe);
      // Persist authenticated profile and JWT token
      localStorage.setItem("schedmaster_token", res.token);
      localStorage.setItem("schedmaster_user", JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (err: any) {
      const message: string = err.message || "Authentication failed. Please verify your credentials.";
      setErrorMsg(message);

      // Check for lockout response
      const lockoutMatch = message.match(/locked (?:for|in) (\d+) seconds/i);
      if (lockoutMatch && lockoutMatch[1]) {
        setLockoutSeconds(parseInt(lockoutMatch[1], 10));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A012B] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Background Subtle Ambiance */}
      <div className="absolute top-0 -left-48 w-[500px] h-[500px] bg-[#570A57]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-48 w-[500px] h-[500px] bg-[#A91079]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#F806CC]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Form Centerpiece */}
      <main className="w-full max-w-md z-10 py-6">
        <div className="bg-[#2E0249]/90 backdrop-blur-xl rounded-3xl border border-[#570A57] p-7 sm:p-8 shadow-2xl space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2 pb-1">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-[#570A57] border border-[#F806CC]/30 items-center justify-center text-[#F806CC] shadow-lg shadow-purple-950/50 mb-1">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              DepEd SchedMaster
            </h1>
            <p className="text-xs text-[#D5B4DE] max-w-xs mx-auto">
              Junior High School Automated Timetable & Magna Carta Compliance System
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#570A57]/80 border border-[#A91079]/40 text-[10px] text-[#FAF5FA] font-semibold">
              <ShieldCheck className="w-3 h-3 text-[#F806CC]" />
              <span>Official Institutional Sign-In</span>
            </div>
          </div>

          {/* Error Notification Alert */}
          {errorMsg && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 transition ${
                lockoutSeconds > 0
                  ? "bg-amber-950/80 border border-amber-600/70 text-amber-200"
                  : "bg-red-950/80 border border-red-700/70 text-red-200"
              }`}
            >
              {lockoutSeconds > 0 ? (
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-semibold block">{errorMsg}</span>
                {lockoutSeconds > 0 && (
                  <span className="text-[11px] font-mono text-amber-300 mt-1 block">
                    Security cooldown: {lockoutSeconds} seconds remaining
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Secure Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-semibold text-[#D5B4DE] mb-1.5">
                Username / DepEd Account
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#A58BAA] absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErrorMsg(null);
                  }}
                  disabled={loading || lockoutSeconds > 0}
                  placeholder="Enter username (e.g. principal, science, math)"
                  autoComplete="username"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#220137]/90 border border-[#570A57] hover:border-[#A91079] focus:border-[#F806CC] focus:ring-1 focus:ring-[#F806CC] rounded-xl text-xs font-semibold text-white placeholder-[#9E6B9E] focus:outline-hidden transition disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-[#D5B4DE] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#A58BAA] absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  disabled={loading || lockoutSeconds > 0}
                  placeholder="Enter account password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-[#220137]/90 border border-[#570A57] hover:border-[#A91079] focus:border-[#F806CC] focus:ring-1 focus:ring-[#F806CC] rounded-xl text-xs font-semibold text-white placeholder-[#9E6B9E] focus:outline-hidden transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-[#A58BAA] hover:text-[#FAF5FA] absolute right-3 top-2.5 cursor-pointer transition"
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
                  <span>Sign In to SchedMaster</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
