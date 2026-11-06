import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Users,
  Calendar,
  Layers,
  ShieldCheck,
  Compass,
} from "lucide-react";

interface Props {
  isGenerating: boolean;
  sectionCount: number;
  periodDuration: number;
}

export const GenerationCockpitModal: React.FC<Props> = ({
  isGenerating,
  sectionCount,
  periodDuration,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const steps = [
    {
      title: "Auditing Curricula & Faculty Envelopes",
      desc: "Validating DepEd RA 4670 workload bounds and section subject quotas...",
      icon: Users,
    },
    {
      title: "Phase 1: Faculty-to-Section Optimization",
      desc: "Balancing departmental assignments & prioritizing class advisers (-1000 weight)...",
      icon: Layers,
    },
    {
      title: "Phase 2: Conflict-Free Period Placement",
      desc: "Placing core subjects in Periods 1–7 and locking Monday Period 1 Homeroom...",
      icon: Calendar,
    },
    {
      title: "Specialized Track Routing (Period 8/9)",
      desc: "Incentivizing SPS Sports, STE Research, SPA Arts into dedicated extended slots...",
      icon: Compass,
    },
    {
      title: "Finalizing & Verifying Zero Collisions",
      desc: "Ensuring zero teacher clashes, room isolation, and saving official slots...",
      icon: ShieldCheck,
    },
  ];

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2800);

    return () => {
      clearInterval(timer);
      clearInterval(stepInterval);
    };
  }, [isGenerating, steps.length]);

  if (!isGenerating) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5CCE3] w-full max-w-lg overflow-hidden flex flex-col p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-[#570A57] to-[#A91079] text-white rounded-2xl shadow-sm">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                AI Timetable Generation Cockpit
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Solving for {sectionCount} sections • {periodDuration} mins/period
              </p>
            </div>
          </div>

          <div className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 tabular-nums">
            {elapsedSeconds}s elapsed
          </div>
        </div>

        {/* Live Step Progression */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-start gap-3 ${
                  isCurrent
                    ? "bg-[#FDF2FA] border-[#A91079] shadow-xs ring-1 ring-[#A91079]/20"
                    : isDone
                    ? "bg-slate-50/70 border-slate-200 opacity-80"
                    : "bg-transparent border-transparent opacity-40"
                }`}
              >
                <div className="mt-0.5">
                  {isDone ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  ) : isCurrent ? (
                    <RefreshCw className="w-5 h-5 text-[#A91079] animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold ${
                        isCurrent
                          ? "text-[#A91079]"
                          : isDone
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    {isDone && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Done
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-[#A91079] bg-[#FDF2FA] px-2 py-0.5 rounded-md border border-[#E5CCE3] animate-pulse">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Animated Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-bold text-slate-600">
            <span>OR-Tools CP-SAT Solver Status</span>
            <span className="text-[#A91079]">
              {Math.min(100, Math.round(((currentStep + 1) / steps.length) * 100))}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className="bg-gradient-to-r from-[#A91079] to-[#F806CC] h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(100, Math.round(((currentStep + 1) / steps.length) * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
