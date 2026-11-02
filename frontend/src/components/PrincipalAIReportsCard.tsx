import { useState } from "react";
import {
  Sparkles,
  FileText,
  ShieldCheck,
  Building,
  Copy,
  Check,
  Printer,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import { api } from "../api/client";

interface Props {
  departmentsCount: number;
  sectionsCount: number;
  teachersCount: number;
  slotsCount: number;
  departmentId?: number | null;
  departmentName?: string;
  departmentCode?: string;
  requesterName?: string;
  requesterTitle?: string;
  isDeptHead?: boolean;
}

type ReportType = "EXECUTIVE_BRIEFING" | "WORKLOAD_AUDIT" | "RESOURCE_TRACK_ANALYSIS";

export const PrincipalAIReportsCard = ({
  departmentsCount,
  sectionsCount,
  teachersCount,
  slotsCount,
  departmentId,
  departmentName,
  departmentCode,
  requesterName,
  requesterTitle,
  isDeptHead = false,
}: Props) => {
  const [activeTab, setActiveTab] = useState<ReportType>("EXECUTIVE_BRIEFING");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportTimestamp, setReportTimestamp] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const reportTabs: { id: ReportType; label: string; icon: any; desc: string }[] = isDeptHead
    ? [
        {
          id: "EXECUTIVE_BRIEFING",
          label: `${departmentName || "Department"} Timetable Briefing`,
          icon: FileText,
          desc: `Operational status, contact periods, and zero-conflict verification for ${departmentName || "department"} subjects.`,
        },
        {
          id: "WORKLOAD_AUDIT",
          label: `${departmentName || "Department"} Faculty Workload Audit`,
          icon: ShieldCheck,
          desc: `Daily 6-hour caps, optimal workload balance, and homeroom advisory assignments for ${departmentName || "department"} teachers.`,
        },
        {
          id: "RESOURCE_TRACK_ANALYSIS",
          label: "Program Tracks & Substitute Readiness",
          icon: Building,
          desc: `Curricular tracks (BEC, STE, SPS, SPA, SPJ) coverage and department substitute dispatcher pool readiness.`,
        },
      ]
    : [
        {
          id: "EXECUTIVE_BRIEFING",
          label: "Master Timetable Briefing",
          icon: FileText,
          desc: "Whole-school timetable status, solver optimization, break preservation & deployment readiness.",
        },
        {
          id: "WORKLOAD_AUDIT",
          label: "Faculty Workload & Statutory Audit",
          icon: ShieldCheck,
          desc: "Daily 6-hour caps, optimal vs underload distribution, and advisory homeroom lock allocations.",
        },
        {
          id: "RESOURCE_TRACK_ANALYSIS",
          label: "Curricular Track & Space Analysis",
          icon: Building,
          desc: "Curricular tracks (BEC, STE, SPTVE, SPA) contact hours and room collision-free metrics.",
        },
      ];

  const presetQueries = isDeptHead
    ? [
        `Audit ${departmentName || "department"} 6-hour daily caps`,
        `Verify ${departmentName || "department"} faculty optimal load balance`,
        `Check ${departmentName || "department"} substitute pool readiness`,
        `Audit ${departmentName || "department"} advisory homeroom locks`,
      ]
    : [
        "Audit daily 6-hour caps across departments",
        "Verify Monday Period 1 Class Adviser Homeroom lock",
        "Check Special Curricular Tracks contact hours",
        "Analyze substitute pool readiness for on-leave teachers",
      ];

  const handleGenerateReport = async (tabToUse: ReportType = activeTab, promptToUse: string = customPrompt) => {
    try {
      setLoading(true);
      const res = await api.generateAIReport(
        tabToUse,
        promptToUse,
        departmentId,
        requesterName,
        requesterTitle
      );
      setReportText(res.report);
      setReportTimestamp(res.timestamp || new Date().toLocaleTimeString());
      setAiSource(res.ai_source || null);
      setAiModel(res.ai_model || null);
    } catch (e: any) {
      console.error("AI Report generation failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    if (!reportText) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>DepEd AI Report - ${requesterName || (isDeptHead ? "Department Head" : "Dr. Rolando Mariano")}</title>
            <style>
              body { font-family: monospace; white-space: pre-wrap; padding: 24px; font-size: 12px; line-height: 1.5; color: #1e293b; }
            </style>
          </head>
          <body>${reportText}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E5CCE3] shadow-xs p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5CCE3] pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-[#570A57] via-[#A91079] to-[#F806CC] text-white rounded-2xl shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-[#2E0249]">
                {isDeptHead
                  ? `${departmentName || "Department"} AI Intelligence & DepEd Compliance Reports`
                  : "AI Executive Intelligence & DepEd Compliance Reports"}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F3E5F2] text-[#A91079] border border-[#E5CCE3]">
                {isDeptHead ? `${departmentCode || "DEPT"} Head AI` : "Executive AI"}
              </span>
            </div>
            <p className="text-xs text-[#703372] mt-0.5">
              {isDeptHead
                ? `Generative AI synthesis for ${departmentName || "departmental"} timetable governance, faculty workload balancing, and curricular audits.`
                : "Generative AI synthesis for institutional timetable governance, faculty workload balancing, and curricular audits."}
            </p>
          </div>
        </div>

        {/* Live Operational Scope Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] font-bold text-slate-500 bg-[#FAF5FA] border border-[#E5CCE3] px-3 py-1.5 rounded-xl">
          <Zap className="w-3.5 h-3.5 text-[#A91079]" />
          <span>
            {isDeptHead
              ? `${departmentName || "Department"} • ${teachersCount} Faculty • ${slotsCount} Slots`
              : `${departmentsCount} Depts • ${sectionsCount} Sections • ${teachersCount} Faculty • ${slotsCount} Slots`}
          </span>
        </div>
      </div>

      {/* Step 1: Select Report Type */}
      <div>
        <div className="text-xs font-bold text-[#2E0249] mb-2 flex items-center justify-between">
          <span>1. Select Report Category</span>
          <span className="text-[11px] text-[#703372] font-semibold">
            {isDeptHead
              ? `Choose an official DepEd Department Head briefing template`
              : `Choose an official DepEd administrative briefing template`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (reportText) {
                    handleGenerateReport(tab.id, customPrompt);
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#FAF5FA] border-[#A91079] ring-2 ring-[#A91079]/20 shadow-xs"
                    : "bg-white border-[#E5CCE3] hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`p-1.5 rounded-xl ${
                        isSelected
                          ? "bg-[#A91079] text-white"
                          : "bg-[#F3E5F2] text-[#703372]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold text-[#2E0249]">
                      {tab.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#703372] leading-relaxed">
                    {tab.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Query Focus & Prompt Controls */}
      <div className="bg-[#FAF5FA] border border-[#E5CCE3] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#2E0249] flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#A91079]" />
            <span>Targeted Focus or In-Depth Analysis Query (Optional)</span>
          </label>
          <span className="text-[10px] text-[#703372] font-semibold">
            Click a preset or enter specific instructions
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={
              isDeptHead
                ? `e.g. Audit Grade 7 ${departmentName || "subject"} contact hours, check substitute availability...`
                : "e.g. Audit Grade 7 science contact hours, check substitute availability..."
            }
            className="flex-1 px-3.5 py-2 bg-white border border-[#E5CCE3] focus:border-[#A91079] rounded-xl text-xs font-semibold text-[#2E0249] placeholder-slate-400 focus:outline-hidden transition"
          />
          {customPrompt && (
            <button
              type="button"
              onClick={() => setCustomPrompt("")}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 font-bold cursor-pointer"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={() => handleGenerateReport(activeTab, customPrompt)}
            disabled={loading}
            className="px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-extrabold shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing & Drafting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{reportText ? "Regenerate Report" : "Generate AI Report"}</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Query Presets */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] text-slate-400 font-bold mr-1">Quick Prompts:</span>
          {presetQueries.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setCustomPrompt(q);
                handleGenerateReport(activeTab, q);
              }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-[#E5CCE3] hover:border-[#A91079] text-[#703372] hover:text-[#A91079] transition cursor-pointer shadow-2xs"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Report Viewer Display */}
      {reportText ? (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-[#2E0249]">
                Generated {isDeptHead ? `${departmentCode || "Department"} ` : "Executive "}Document
              </span>
              {reportTimestamp && (
                <span className="text-[10px] text-[#703372] font-semibold">
                  ({reportTimestamp})
                </span>
              )}
              {aiSource === "OPENROUTER_AI" ? (
                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  OpenRouter AI ({aiModel})
                </span>
              ) : (
                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-medium">
                  Statutory Prototype Engine
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl border border-[#E5CCE3] bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Document</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl border border-[#E5CCE3] bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          <div className="bg-[#FAF5FA] border border-[#E5CCE3] rounded-2xl p-5 overflow-x-auto shadow-inner">
            <pre className="font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-all">
              {reportText}
            </pre>
          </div>
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-[#E5CCE3] rounded-2xl flex flex-col items-center justify-center text-center space-y-2 bg-[#FAF5FA]/40">
          <div className="p-3 bg-[#F3E5F2] text-[#A91079] rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#2E0249]">
              No {isDeptHead ? `${departmentName || "Department"} ` : "Executive "}AI Report Generated Yet
            </h4>
            <p className="text-[11px] text-[#703372] max-w-md mt-0.5">
              Select a report template above and click "Generate AI Report" to synthesize an official DepEd compliance briefing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleGenerateReport("EXECUTIVE_BRIEFING", "")}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-[#A91079] hover:bg-[#8F0B66] text-white rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isDeptHead
                ? `Generate ${departmentName || "Department"} Briefing Now`
                : "Generate Master Timetable Briefing Now"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
