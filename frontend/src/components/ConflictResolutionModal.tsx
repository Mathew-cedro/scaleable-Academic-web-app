import { useState } from "react";
import {
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  FileText,
  ArrowRight,
  Copy,
  Printer,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface DiffItem {
  action: string;
  slot_id: number;
  section_name: string;
  subject_name: string;
  day_of_week: number;
  period_index: number;
  original_teacher_name?: string;
  new_teacher_name?: string;
  reason: string;
}

interface DiffResult {
  disruption_cost: number;
  displaced_count: number;
  reassigned_count: number;
  unaffected_count: number;
  diff_items: DiffItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  latencyMs: number;
  disruptionCost: number;
  diff?: DiffResult;
  llmReport?: string;
  title?: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const ConflictResolutionModal = ({
  isOpen,
  onClose,
  latencyMs,
  disruptionCost,
  diff,
  llmReport,
  title = "Schedule Optimization & Repair Summary",
}: Props) => {
  const [activeTab, setActiveTab] = useState<"metrics" | "report">("metrics");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    if (llmReport) {
      navigator.clipboard.writeText(llmReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5CCE3] w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-[#570A57] to-[#A91079] text-white rounded-xl shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">
                DepEd Workload Compliance & Schedule Optimization Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E5CCE3] bg-white px-6">
          <button
            onClick={() => setActiveTab("metrics")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === "metrics"
                ? "border-[#A91079] text-[#A91079]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Zap className="w-4 h-4" />
            Algorithmic Metrics & Diff ({diff?.diff_items?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === "report"
                ? "border-[#A91079] text-[#A91079]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            DepEd Workload & Compliance Report
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === "metrics" && (
            <div className="space-y-4">
              {/* Metrics KPI Cards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-[#FDF2FA] border border-[#E5CCE3]">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-[#A91079] uppercase tracking-wider mb-0.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Solver Latency</span>
                  </div>
                  <div className="text-xl font-extrabold text-[#2E0249]">
                    {latencyMs.toFixed(1)} ms
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Disruption Cost</span>
                  </div>
                  <div className="text-xl font-extrabold text-amber-900">
                    {disruptionCost}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Classes Reassigned</span>
                  </div>
                  <div className="text-xl font-extrabold text-emerald-900">
                    {diff?.reassigned_count || 0}
                  </div>
                </div>
              </div>

              {/* Schedule Changes Diff Table */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Schedule Delta & Reassignment Log
                </h3>

                {(!diff || !diff.diff_items || diff.diff_items.length === 0) ? (
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-[#E5CCE3] rounded-xl text-xs text-slate-500">
                    <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">Zero Schedule Disruption</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      The schedule is fully balanced and optimal.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {diff.diff_items.map((item, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl border border-[#E5CCE3] bg-white shadow-2xs text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.action === "REASSIGNED"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-[#FDF2FA] text-[#A91079] border border-[#E5CCE3]"
                              }`}
                            >
                              {item.action}
                            </span>
                            <span className="font-bold text-slate-900">
                              {item.section_name} • {item.subject_name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {DAYS[item.day_of_week] || `Day ${item.day_of_week}`} (P{item.period_index})
                          </span>
                        </div>

                        {item.original_teacher_name && item.new_teacher_name && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-700 font-medium pt-0.5">
                            <span className="line-through text-red-600">{item.original_teacher_name}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-emerald-700 font-bold">{item.new_teacher_name}</span>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-500 italic">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "report" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  DepEd Form 7 Workload Compliance Narrative (OpenRouter AI / Deterministic Engine)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? "Copied!" : "Copy Report"}</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-96">
                {llmReport || "No compliance report generated."}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
          >
            Close Summary
          </button>
        </div>
      </div>
    </div>
  );
};
