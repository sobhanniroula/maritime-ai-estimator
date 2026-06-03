"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AssessmentCard, isAssessmentContent, parseAssessment } from "./AssessmentCard";

interface SelectedLocation {
  lat: number;
  lng: number;
}

interface ChatSidebarProps {
  selectedLocation: SelectedLocation | null;
}

type WizardStep =
  | "idle"
  | "confirming"
  | "step1"
  | "step2"
  | "step3"
  | "chatting";
type ProjectType = "infrastructure" | "pool" | "event" | "residential";
type PoolType = "natural" | "heated" | "both";
type SizeCategory = "small" | "medium" | "large";
type UsagePeriod = "year-round" | "seasonal";

interface WizardData {
  projectType: ProjectType | null;
  intendedUse: string | null;
  sizeCategory: SizeCategory | null;
  poolType: PoolType | null;
  usagePeriod: UsagePeriod | null;
  waterDepth: string;
  waveHeight: string;
  additionalNotes: string;
}

const EMPTY_WIZARD: WizardData = {
  projectType: null,
  intendedUse: null,
  sizeCategory: null,
  poolType: null,
  usagePeriod: null,
  waterDepth: "",
  waveHeight: "",
  additionalNotes: "",
};

interface ChatHistoryEntry {
  id: string;
  title: string;
  lat: number;
  lng: number;
  projectType: string;
  timestamp: number;
}

function buildAnalysisPrompt(
  location: SelectedLocation,
  data: WizardData,
): string {
  const projectLabels: Record<ProjectType, string> = {
    infrastructure:
      "Floating infrastructure / foundation (sauna, terrace, restaurant, café, commercial space)",
    pool: "Floating pool solution",
    event:
      "Floating event platform (concerts, sports, exhibitions, temporary use)",
    residential: "Floating residential housing (apartments, private homes)",
  };

  const sizeLabels: Record<SizeCategory, string> = {
    small: "Small (under 200 m²)",
    medium: "Medium (200–500 m²)",
    large: "Large (over 500 m²)",
  };

  const poolLabels: Record<PoolType, string> = {
    natural: "Natural water pool (lake/sea swimming: bottomless or grated)",
    heated: "Heated pool (Barge, Hybrid, or Multiuse type)",
    both: "Both heated and natural water pool",
  };

  const lines: string[] = [];

  lines.push(
    `PROJECT TYPE: ${data.projectType ? projectLabels[data.projectType] : "Not specified"}`,
  );

  if (data.intendedUse) lines.push(`INTENDED USE: ${data.intendedUse}`);
  if (data.poolType) lines.push(`POOL TYPE: ${poolLabels[data.poolType]}`);
  if (data.sizeCategory)
    lines.push(`APPROXIMATE SIZE: ${sizeLabels[data.sizeCategory]}`);
  if (data.usagePeriod)
    lines.push(
      `OPERATION PERIOD: ${data.usagePeriod === "year-round" ? "Year-round" : "Seasonal / temporary"}`,
    );

  const depthNote = data.waterDepth.trim()
    ? data.waterDepth.trim()
    : "Unknown: not provided by client. Apply the 2.0 m minimum threshold and flag for on-site confirmation.";

  const waveNote = data.waveHeight.trim()
    ? data.waveHeight.trim()
    : "Not provided: fetch from weather API and use that value.";

  return [
    `Please analyze this location for a Bluet floating construction project.`,
    ``,
    `LOCATION: Latitude ${location.lat.toFixed(4)}°N, Longitude ${location.lng.toFixed(4)}°E`,
    ``,
    ...lines,
    ``,
    `SITE DATA PROVIDED BY CLIENT:`,
    `- Water depth: ${depthNote}`,
    `- Significant wave height: ${waveNote}`,
    ...(data.additionalNotes.trim()
      ? [`- Additional notes: ${data.additionalNotes.trim()}`]
      : []),
    ``,
    `Fetch marine conditions for these coordinates, then produce a full PRELIMINARY SITE ASSESSMENT for Bluet's internal sales team using the standard output format.`,
  ].join("\n");
}

function AssessmentSkeleton() {
  return (
    <div className="space-y-3 w-full animate-pulse">
      <div className="pb-2 border-b border-slate-700">
        <div className="h-2 w-24 bg-slate-700 rounded mb-2" />
        <div className="h-3 w-40 bg-slate-600 rounded mb-1" />
        <div className="h-2 w-20 bg-slate-700 rounded mt-1" />
      </div>
      <div className="h-12 w-full bg-slate-700/50 rounded-lg border border-slate-700" />
      <div>
        <div className="h-2 w-20 bg-slate-700 rounded mb-2" />
        <div className="grid grid-cols-2 gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-slate-700/50 rounded-lg h-12" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-2 w-24 bg-slate-700 rounded mb-2" />
        <div className="bg-slate-700/50 rounded-lg h-16" />
      </div>
      <div>
        <div className="h-2 w-20 bg-slate-700 rounded mb-2" />
        <div className="space-y-1.5">
          <div className="bg-slate-700/50 rounded h-4 w-3/4" />
          <div className="bg-slate-700/50 rounded h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function WizardProgress({ step }: { step: WizardStep }) {
  const stepMap: Partial<Record<WizardStep, number>> = {
    confirming: 0,
    step1: 1,
    step2: 2,
    step3: 3,
  };
  const stepNumber = stepMap[step] ?? null;
  if (stepNumber === null) return null;
  return (
    <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-800 bg-slate-900/50">
      {[
        { n: 0, label: "Location" },
        { n: 1, label: "Type" },
        { n: 2, label: "Details" },
        { n: 3, label: "Site data" },
      ].map(({ n, label }, i, arr) => (
        <div key={n} className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 ${stepNumber === n ? "text-white" : stepNumber > n ? "text-emerald-400" : "text-slate-600"}`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                stepNumber > n
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : stepNumber === n
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-slate-700 text-slate-600"
              }`}
            >
              {stepNumber > n ? "✓" : n + 1}
            </div>
            <span className="text-[10px]">{label}</span>
          </div>
          {i < arr.length - 1 && (
            <div
              className={`w-4 h-px ${stepNumber > n ? "bg-emerald-600" : "bg-slate-700"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChatSidebar({ selectedLocation }: ChatSidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>("idle");
  const [wizard, setWizard] = useState<WizardData>(EMPTY_WIZARD);
  const [firstMessageId, setFirstMessageId] = useState<string | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [proposalSentAt, setProposalSentAt] = useState<number | null>(null);
  const [copiedProposal, setCopiedProposal] = useState(false);
  const [sidebarView, setSidebarView] = useState<"chat" | "history">("chat");
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    setMessages,
  } = useChat({ api: "/api/chat" });

  // Reset wizard whenever the user picks a new map location
  useEffect(() => {
    if (!selectedLocation) return;
    setWizardStep("confirming");
    setWizard(EMPTY_WIZARD);
    setMessages([]);
    setFirstMessageId(null);
    setProposalSentAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("maritime-ai-chat-history");
      if (stored) setChatHistory(JSON.parse(stored));
    } catch {}
  }, []);

  function handleNewChat() {
    setWizardStep("idle");
    setWizard(EMPTY_WIZARD);
    setMessages([]);
    setFirstMessageId(null);
    setProposalSentAt(null);
    setSidebarView("chat");
  }

  async function handleCopyProposal() {
    if (proposalSentAt === null) return;
    const proposalMsg = messages
      .slice(proposalSentAt)
      .find((m) => m.role === "assistant" && m.content.trim());
    if (!proposalMsg) return;
    try {
      await navigator.clipboard.writeText(proposalMsg.content);
      setCopiedProposal(true);
      setTimeout(() => setCopiedProposal(false), 5000);
    } catch {}
  }

  function handleProjectType(type: ProjectType) {
    if (type === "residential") {
      // Residential has no meaningful step 2 - jump straight to site data
      setWizard({
        ...EMPTY_WIZARD,
        projectType: type,
        intendedUse: "Residential apartments or private home",
      });
      setWizardStep("step3");
    } else {
      setWizard({ ...EMPTY_WIZARD, projectType: type });
      setWizardStep("step2");
    }
  }

  const step2CanContinue =
    wizard.projectType === "pool" ? !!wizard.poolType : !!wizard.intendedUse;

  async function handleRunAnalysis() {
    if (!selectedLocation) return;
    const prompt = buildAnalysisPrompt(selectedLocation, wizard);
    setWizardStep("chatting");
    const typeLabels: Record<string, string> = {
      infrastructure: "Floating Infrastructure",
      pool: "Floating Pool",
      event: "Event Platform",
      residential: "Residential Housing",
    };
    const typeLabel = wizard.projectType
      ? (typeLabels[wizard.projectType] ?? "Analysis")
      : "Analysis";
    const entry: ChatHistoryEntry = {
      id: Date.now().toString(),
      title: `${typeLabel} - ${selectedLocation.lat.toFixed(3)}N, ${selectedLocation.lng.toFixed(3)}E`,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      projectType: wizard.projectType ?? "",
      timestamp: Date.now(),
    };
    setChatHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 20);
      try {
        localStorage.setItem(
          "maritime-ai-chat-history",
          JSON.stringify(updated),
        );
      } catch {}
      return updated;
    });
    const msgId = await append({ role: "user", content: prompt });
    if (msgId) setFirstMessageId(msgId);
  }

  function handleGenerateProposal() {
    setProposalSentAt(messages.length);
    append({
      role: "user",
      content:
        "Using the site assessment above, generate a CLIENT-FACING Preliminary Project Proposal: a document Bluet would send to the client contact, NOT an internal tool output. Use professional, positive language and **markdown formatting** (## for section headers, **bold** for product names and key numbers, - for bullet lists).\n\nStructure:\n## Executive Summary\n2-3 sentences: what we propose and why this site works.\n\n## Proposed Solution\nProduct names with **bold**, key benefits in client-friendly terms; no internal notes or threshold jargon.\n\n## Indicative Investment\nProduct fee starting from + variable fees range; present as an investment, not a cost breakdown.\n\n## Project Timeline\n5 stages with typical durations: Concept Design, Permit Applications, Manufacturing, Delivery and Installation, Handover.\n\n## Permit Requirements\n2-3 sentences for a non-technical client; explain any authority names in plain language.\n\n## Next Steps\n3 concrete actions the client and Bluet take together.\n\nClose with a single call-to-action sentence. Keep to ~250 words total.",
    });
  }

  async function handleDownloadSummary() {
    setIsPdfGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const mg = 14;
      const cw = pageW - mg * 2;

      // Fill page with dark background
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, pageH, "F");

      // Header band
      doc.setFillColor(8, 14, 30);
      doc.rect(0, 0, pageW, 36, "F");
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 3, 36, "F");

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(226, 232, 240);
      doc.text("MARITIME AI ESTIMATOR", mg + 3, 13);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(147, 197, 253);
      doc.text(
        "Preliminary Site Assessment  -  Bluet Oy Internal Use",
        mg + 3,
        20,
      );

      const metaLine = [
        selectedLocation
          ? `${selectedLocation.lat.toFixed(4)}N, ${selectedLocation.lng.toFixed(4)}E`
          : "",
        new Date().toLocaleDateString("en-FI"),
        analysisLabel ?? "",
      ]
        .filter(Boolean)
        .join("   .   ");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(metaLine, mg + 3, 28);

      let y = 46;

      const assessMsg = messages.find(
        (m, idx) =>
          m.role === "assistant" &&
          m.content.trim() &&
          (proposalSentAt === null || idx < proposalSentAt),
      );

      const drawSection = (title: string) => {
        doc.setFillColor(59, 130, 246);
        doc.rect(mg, y, 2.5, 5.5, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(147, 197, 253);
        doc.text(title, mg + 5, y + 4);
        y += 9;
      };

      const checkPage = (needed: number) => {
        if (y + needed > pageH - 18) {
          doc.addPage();
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, pageW, pageH, "F");
          y = 16;
        }
      };

      if (assessMsg) {
        const d = parseAssessment(assessMsg.content);

        // Suitability badge
        if (d.suitabilityStatus) {
          const isSuitable = d.suitabilityStatus === "SUITABLE";
          const isConditional = d.suitabilityStatus === "CONDITIONAL";
          const bgR = isSuitable ? 6 : isConditional ? 55 : 50;
          const bgG = isSuitable ? 78 : isConditional ? 32 : 10;
          const bgB = isSuitable ? 59 : isConditional ? 7 : 10;
          const fgR = isSuitable ? 52 : isConditional ? 251 : 248;
          const fgG = isSuitable ? 211 : isConditional ? 191 : 113;
          const fgB = isSuitable ? 153 : isConditional ? 36 : 113;

          checkPage(22);
          doc.setFillColor(bgR, bgG, bgB);
          doc.rect(mg, y, cw, 18, "F");
          doc.setDrawColor(fgR, fgG, fgB);
          doc.setLineWidth(0.4);
          doc.rect(mg, y, cw, 18, "D");

          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(fgR, fgG, fgB);
          doc.text(d.suitabilityStatus, mg + 5, y + 7);

          if (d.suitabilityReason) {
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(226, 232, 240);
            const reasonLines = doc.splitTextToSize(
              d.suitabilityReason,
              cw - 10,
            ) as string[];
            doc.text(reasonLines[0] ?? "", mg + 5, y + 13);
          }
          y += 24;
        }

        // Site conditions grid
        if (d.siteConditions.length > 0) {
          const rows = Math.ceil(d.siteConditions.length / 2);
          checkPage(10 + rows * 15);
          drawSection("SITE CONDITIONS");
          const colW = (cw - 2) / 2;
          const tileH = 13;
          d.siteConditions.forEach((c, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const tx = mg + col * (colW + 2);
            const ty = y + row * (tileH + 1.5);
            doc.setFillColor(30, 41, 59);
            doc.rect(tx, ty, colW, tileH, "F");
            doc.setFontSize(5.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text(c.label.toUpperCase(), tx + 3, ty + 4.5);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(226, 232, 240);
            const valLines = doc.splitTextToSize(c.value, colW - 6) as string[];
            doc.text(valLines[0] ?? "", tx + 3, ty + 10);
          });
          y += rows * (tileH + 1.5) + 5;
        }

        // Recommended solution
        if (d.solution.length > 0) {
          checkPage(12 + d.solution.length * 16);
          drawSection("RECOMMENDED SOLUTION");
          d.solution.forEach((s) => {
            checkPage(16);
            doc.setFillColor(30, 41, 59);
            doc.rect(mg, y, cw, 14, "F");
            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(71, 85, 105);
            doc.text(s.type.toUpperCase(), mg + 3, y + 5.5);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(147, 197, 253);
            const nameLines = doc.splitTextToSize(s.name, cw - 28) as string[];
            doc.text(nameLines[0] ?? "", mg + 22, y + 5.5);
            if (s.rationale) {
              doc.setFontSize(7);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(148, 163, 184);
              const ratLines = doc.splitTextToSize(
                s.rationale,
                cw - 28,
              ) as string[];
              doc.text(ratLines[0] ?? "", mg + 22, y + 10.5);
            }
            y += 16;
          });
          y += 3;
        }

        // Indicative pricing
        if (d.pricing.length > 0) {
          checkPage(12 + d.pricing.length * 11);
          drawSection("INDICATIVE PRICING (ex-works)");
          doc.setFillColor(30, 41, 59);
          doc.rect(mg, y, cw, d.pricing.length * 11, "F");
          d.pricing.forEach((p, i) => {
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text(p.label.toUpperCase(), mg + 3, y + 7.5);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(226, 232, 240);
            const valLines = doc.splitTextToSize(
              p.value,
              cw - 35,
            ) as string[];
            doc.text(valLines[0] ?? "", pageW - mg - 3, y + 7.5, {
              align: "right",
            });
            if (i < d.pricing.length - 1) {
              doc.setDrawColor(51, 65, 85);
              doc.setLineWidth(0.3);
              doc.line(mg + 3, y + 11, pageW - mg - 3, y + 11);
            }
            y += 11;
          });
          y += 7;
        }

        // Permit checklist
        if (d.permits.length > 0) {
          checkPage(12 + d.permits.length * 7);
          drawSection("PERMIT CHECKLIST (FINLAND)");
          d.permits.forEach((p) => {
            checkPage(7);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text("[ ]", mg, y + 0.5);
            const pLines = doc.splitTextToSize(p, cw - 10) as string[];
            doc.text(pLines[0] ?? "", mg + 8, y + 0.5);
            y += 7;
          });
          y += 3;
        }

        // Next steps
        if (d.nextSteps.length > 0) {
          checkPage(12 + d.nextSteps.length * 7);
          drawSection("NEXT STEPS");
          d.nextSteps.forEach((s) => {
            checkPage(7);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text(">", mg, y + 0.5);
            const sLines = doc.splitTextToSize(s, cw - 7) as string[];
            doc.text(sLines[0] ?? "", mg + 5, y + 0.5);
            y += 7;
          });
        }
      } else {
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text("No assessment data available.", mg, y);
      }

      // Footer on all pages
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFillColor(8, 14, 30);
        doc.rect(0, pageH - 11, pageW, 11, "F");
        doc.setFillColor(59, 130, 246);
        doc.rect(0, pageH - 11, 3, 11, "F");
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(
          "MARITIME AI ESTIMATOR  -  Internal use only  -  Indicative, not a binding offer",
          mg + 3,
          pageH - 4,
        );
        doc.text(`${p} / ${total}`, pageW - mg, pageH - 4, {
          align: "right",
        });
      }

      const slug = selectedLocation
        ? `${selectedLocation.lat.toFixed(2)}N-${selectedLocation.lng.toFixed(2)}E`
        : "site";
      doc.save(
        `maritime-ai-assessment-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } finally {
      setIsPdfGenerating(false);
    }
  }

  const hasAiResponse = messages.some((m) => m.role === "assistant");

  // Summary of the wizard choices shown in the chat header area
  const analysisLabel = wizard.projectType
    ? {
        infrastructure: "Floating Infrastructure",
        pool: "Floating Pool",
        event: "Event Platform",
        residential: "Residential Housing",
      }[wizard.projectType]
    : null;

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-white font-semibold text-sm">
              AI Marine Consultant
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {wizardStep === "chatting" && (
              <button
                onClick={handleNewChat}
                title="Start a new analysis"
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                + New
              </button>
            )}
            <button
              onClick={() =>
                setSidebarView((v) => (v === "history" ? "chat" : "history"))
              }
              title="View analysis history"
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                sidebarView === "history"
                  ? "text-blue-400 bg-blue-950/60"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              History
            </button>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {wizardStep === "idle" &&
            "Click the map to analyze a coastal location"}
          {wizardStep === "confirming" &&
            "Confirm the selected location to continue"}
          {wizardStep === "step1" && "Step 1 of 3: Select project type"}
          {wizardStep === "step2" && "Step 2 of 3: Project details"}
          {wizardStep === "step3" && "Step 3 of 3: Site information"}
          {wizardStep === "chatting" &&
            "Internal pre-sales assessment - MARITIME AI ESTIMATOR"}
        </p>
      </div>

      {/* Progress bar (shown during wizard only) */}
      {sidebarView === "chat" && wizardStep !== "idle" && wizardStep !== "chatting" && (
        <WizardProgress step={wizardStep} />
      )}

      {/* History panel */}
      {sidebarView === "history" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-3">
            Recent Analyses
          </div>
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-slate-500 text-xs">No analyses yet</div>
              <div className="text-slate-600 text-[10px] mt-1">
                Run an analysis to see history here
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {chatHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-3"
                >
                  <div className="text-slate-200 text-xs font-medium leading-snug mb-1.5">
                    {entry.title}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>
                      {new Date(entry.timestamp).toLocaleDateString("en-FI", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-slate-700">·</span>
                    <span>
                      {entry.lat.toFixed(3)}N, {entry.lng.toFixed(3)}E
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 text-center text-[9px] text-slate-600 leading-relaxed px-2">
            History is stored locally in your browser.
            <br />
            Click-to-restore will be available in a future version.
          </div>
        </div>
      )}

      {/* ── WIZARD PANELS ─────────────────────────────────────── */}
      {sidebarView === "chat" && wizardStep !== "chatting" && (
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {/* IDLE */}
          {wizardStep === "idle" && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-4xl mb-3">🌊</div>
              <h3 className="text-slate-300 font-medium text-sm mb-2">
                Select a coastal location
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Click anywhere on the map to begin a site assessment. The AI
                will analyze wave conditions, wind, ice risk, and recommend the
                right floating solution.
              </p>
            </div>
          )}

          {/* CONFIRMING */}
          {wizardStep === "confirming" && selectedLocation && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-2">
                  Location selected
                </div>
                <div className="text-white font-mono text-base font-semibold">
                  {selectedLocation.lat.toFixed(4)}°N
                </div>
                <div className="text-white font-mono text-base font-semibold">
                  {selectedLocation.lng.toFixed(4)}°E
                </div>
                <div className="text-slate-500 text-xs mt-2">
                  Click elsewhere on the map to change location
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
                <p>
                  Marine conditions (wave height, wind speed, ice risk) will be
                  automatically fetched by the AI for this location.
                </p>
                <p className="mt-1.5">
                  You&apos;ll be asked a few short questions about the project
                  type and any site data you already have.
                </p>
              </div>

              <button
                onClick={() => setWizardStep("step1")}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3 px-4 rounded-xl text-sm font-medium transition-colors"
              >
                Confirm Location →
              </button>
            </div>
          )}

          {/* STEP 1 of 3: Project type */}
          {wizardStep === "step1" && (
            <div className="space-y-3">
              <div className="mb-4">
                <h3 className="text-white font-medium text-sm">
                  What type of solution does the client need?
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Select the primary project category
                </p>
              </div>

              {(
                [
                  {
                    type: "infrastructure" as ProjectType,
                    icon: "🏗️",
                    label: "Floating Infrastructure",
                    desc: "Sauna, terrace, restaurant, café, commercial space",
                  },
                  {
                    type: "pool" as ProjectType,
                    icon: "🏊",
                    label: "Floating Pool",
                    desc: "Natural water, heated or hybrid pool",
                  },
                  {
                    type: "event" as ProjectType,
                    icon: "🎪",
                    label: "Event Platform",
                    desc: "Concerts, sports, exhibitions, temporary use",
                  },
                  {
                    type: "residential" as ProjectType,
                    icon: "🏠",
                    label: "Residential Housing",
                    desc: "Floating apartments or private homes",
                  },
                ] as const
              ).map(({ type, icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => handleProjectType(type)}
                  className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl p-4 text-left transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5">{icon}</span>
                    <div>
                      <div className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">
                        {label}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {desc}
                      </div>
                    </div>
                    <div className="ml-auto text-slate-600 group-hover:text-blue-400 transition-colors text-lg">
                      ›
                    </div>
                  </div>
                </button>
              ))}

              <button
                onClick={() => setWizardStep("confirming")}
                className="w-full text-slate-500 hover:text-slate-300 py-2 text-xs transition-colors"
              >
                ← Back to location
              </button>
            </div>
          )}

          {/* STEP 2 of 3: Project details */}
          {wizardStep === "step2" && (
            <div className="space-y-5">
              {/* Infrastructure */}
              {wizard.projectType === "infrastructure" && (
                <>
                  <div>
                    <h3 className="text-white font-medium text-sm mb-1">
                      What will be built on the water?
                    </h3>
                    <p className="text-slate-500 text-xs mb-3">
                      Select the primary intended use
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          value: "Sauna or leisure terrace",
                          label: "🧖 Sauna / Terrace",
                        },
                        {
                          value: "Restaurant or café",
                          label: "🍽️ Restaurant / Café",
                        },
                        {
                          value: "Hotel or spa accommodation",
                          label: "🏨 Hotel / Spa",
                        },
                        {
                          value: "Office or commercial space",
                          label: "💼 Office / Commercial",
                        },
                        {
                          value: "Marina or dock facility",
                          label: "⚓ Marina / Dock",
                        },
                        {
                          value: "Mixed use or other",
                          label: "🔀 Mixed / Other",
                        },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setWizard((w) => ({ ...w, intendedUse: value }))
                          }
                          className={`rounded-xl px-3 py-2.5 text-xs text-left transition-all border ${
                            wizard.intendedUse === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-400 text-xs mb-2">
                      Approximate project size
                    </p>
                    <div className="flex gap-2">
                      {(
                        [
                          {
                            value: "small" as SizeCategory,
                            label: "Small",
                            sub: "< 200 m²",
                          },
                          {
                            value: "medium" as SizeCategory,
                            label: "Medium",
                            sub: "200–500 m²",
                          },
                          {
                            value: "large" as SizeCategory,
                            label: "Large",
                            sub: "> 500 m²",
                          },
                        ] as const
                      ).map(({ value, label, sub }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setWizard((w) => ({ ...w, sizeCategory: value }))
                          }
                          className={`flex-1 rounded-xl px-2 py-2.5 text-center transition-all border ${
                            wizard.sizeCategory === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          <div className="text-xs font-medium">{label}</div>
                          <div className="text-[10px] mt-0.5 opacity-70">
                            {sub}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Pool */}
              {wizard.projectType === "pool" && (
                <>
                  <div>
                    <h3 className="text-white font-medium text-sm mb-1">
                      What type of pool?
                    </h3>
                    <p className="text-slate-500 text-xs mb-3">
                      This determines the minimum site depth required
                    </p>
                    <div className="space-y-2">
                      {(
                        [
                          {
                            value: "natural" as PoolType,
                            icon: "🌊",
                            label: "Natural water pool",
                            desc: "Uses surrounding water  - Grated or Bottomless. Site depth min. 2–3 m.",
                          },
                          {
                            value: "heated" as PoolType,
                            icon: "🌡️",
                            label: "Heated pool",
                            desc: "Filtered + temperature-controlled  - Barge, Hybrid or Multiuse. Site depth from 1.5 m.",
                          },
                          {
                            value: "both" as PoolType,
                            icon: "♾️",
                            label: "Both",
                            desc: "Combined facility with heated and natural water pools.",
                          },
                        ] as const
                      ).map(({ value, icon, label, desc }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setWizard((w) => ({ ...w, poolType: value }))
                          }
                          className={`w-full rounded-xl px-4 py-3 text-left transition-all border ${
                            wizard.poolType === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg leading-none mt-0.5">
                              {icon}
                            </span>
                            <div>
                              <div className="text-sm font-medium">{label}</div>
                              <div
                                className={`text-xs mt-0.5 ${wizard.poolType === value ? "text-blue-200" : "text-slate-500"}`}
                              >
                                {desc}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-400 text-xs mb-2">
                      Operation period
                    </p>
                    <div className="flex gap-2">
                      {(
                        [
                          {
                            value: "year-round" as UsagePeriod,
                            label: "☀️❄️ Year-round",
                          },
                          {
                            value: "seasonal" as UsagePeriod,
                            label: "☀️ Summer seasonal",
                          },
                        ] as const
                      ).map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setWizard((w) => ({ ...w, usagePeriod: value }))
                          }
                          className={`flex-1 rounded-xl px-3 py-2.5 text-xs text-center transition-all border ${
                            wizard.usagePeriod === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Event */}
              {wizard.projectType === "event" && (
                <>
                  <div>
                    <h3 className="text-white font-medium text-sm mb-1">
                      What type of event?
                    </h3>
                    <p className="text-slate-500 text-xs mb-3">
                      Multiuse Platform suits all event types - site depth 1–10
                      m
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          value: "Concert or performing arts stage",
                          label: "🎵 Concert / Stage",
                        },
                        {
                          value: "Sports field (padel, football, etc.)",
                          label: "⚽ Sports Field",
                        },
                        {
                          value: "Market, exhibition or pop-up",
                          label: "🎪 Market / Exhibition",
                        },
                        {
                          value: "Temporary dock or working platform",
                          label: "⚓ Dock / Platform",
                        },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setWizard((w) => ({ ...w, intendedUse: value }))
                          }
                          className={`rounded-xl px-3 py-2.5 text-xs text-left transition-all border ${
                            wizard.intendedUse === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-400 text-xs mb-2">
                      How long is the platform needed?
                    </p>
                    <div className="flex gap-2">
                      {(
                        [
                          {
                            value: "seasonal" as UsagePeriod,
                            label: "📅 Temporary / one-off",
                          },
                          {
                            value: "year-round" as UsagePeriod,
                            label: "🔁 Permanent / recurring",
                          },
                        ] as const
                      ).map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setWizard((w) => ({ ...w, usagePeriod: value }))
                          }
                          className={`flex-1 rounded-xl px-3 py-2.5 text-xs text-center transition-all border ${
                            wizard.usagePeriod === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setWizardStep("step1")}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-2.5 rounded-xl text-xs transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setWizardStep("step3")}
                  disabled={!step2CanContinue}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 of 3: Site data */}
          {wizardStep === "step3" && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-white font-medium text-sm">
                  Site information
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Provide any data you already have. Wave height and wind will
                  be auto-fetched by the AI if left blank.
                </p>
              </div>

              {/* Water depth */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Water depth at site
                  <span className="ml-1.5 text-amber-400 font-normal">
                    ⚠ Critical - min. 2.0 m required
                  </span>
                </label>
                <input
                  type="text"
                  value={wizard.waterDepth}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, waterDepth: e.target.value }))
                  }
                  placeholder="e.g. 4.5 m  - or leave blank if unknown"
                  className="w-full bg-slate-800 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-slate-600 text-[10px] mt-1.5">
                  Depth data cannot be auto-fetched. A client estimate or site
                  survey value is preferred. If unknown, the AI will flag it for
                  on-site confirmation.
                </p>
              </div>

              {/* Wave height */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Significant wave height
                  <span className="ml-1.5 text-slate-500 font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={wizard.waveHeight}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, waveHeight: e.target.value }))
                  }
                  placeholder="Leave blank  - AI fetches from weather API"
                  className="w-full bg-slate-800 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-slate-600 text-[10px] mt-1.5">
                  Max 0.3 m without breakwater. Leave blank to use real-time
                  weather data.
                </p>
              </div>

              {/* Additional notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Additional notes from client
                  <span className="ml-1.5 text-slate-500 font-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={wizard.additionalNotes}
                  onChange={(e) =>
                    setWizard((w) => ({
                      ...w,
                      additionalNotes: e.target.value,
                    }))
                  }
                  placeholder="e.g. protected bay, icy winters, rocky seabed, client already has a building permit..."
                  rows={3}
                  className="w-full bg-slate-800 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() =>
                    setWizardStep(
                      wizard.projectType === "residential" ? "step1" : "step2",
                    )
                  }
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-2.5 rounded-xl text-xs transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleRunAnalysis}
                  className="flex-[2] bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Run AI Analysis →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHAT PHASE ────────────────────────────────────────── */}
      {sidebarView === "chat" && wizardStep === "chatting" && (
        <>
          {/* Context chip  - shows what was analyzed */}
          {analysisLabel && selectedLocation && (
            <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>📍</span>
                <span>
                  {selectedLocation.lat.toFixed(4)}°N,{" "}
                  {selectedLocation.lng.toFixed(4)}°E
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-blue-400">{analysisLabel}</span>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((message, msgIdx) => {
              if (message.role !== "user" && message.role !== "assistant")
                return null;
              const isUser = message.role === "user";
              const isFirstMessage = message.id === firstMessageId;
              const isProposalPrompt =
                isUser && proposalSentAt !== null && msgIdx === proposalSentAt;
              // Hide the currently streaming assistant message - skeleton shows instead
              const isCurrentlyStreaming =
                !isUser && isLoading && msgIdx === messages.length - 1;
              if (isCurrentlyStreaming) return null;

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-100 rounded-bl-sm"
                    }`}
                  >
                    {/* Auto-generated prompts: show compact labels instead of raw text */}
                    {isUser && isFirstMessage ? (
                      <div className="text-xs opacity-80">
                        <div className="font-medium mb-1">
                          Analysis request sent
                        </div>
                        <div>
                          {analysisLabel} · {selectedLocation?.lat.toFixed(3)}°N{" "}
                          {selectedLocation?.lng.toFixed(3)}°E
                        </div>
                        {wizard.waterDepth && (
                          <div>Depth: {wizard.waterDepth}</div>
                        )}
                      </div>
                    ) : isUser && isProposalPrompt ? (
                      <div className="text-xs opacity-80">
                        <div className="font-medium">
                          Generating preliminary proposal...
                        </div>
                      </div>
                    ) : (
                      <>
                        {!isUser &&
                          message.toolInvocations?.some(
                            (t) => t.state !== "result",
                          ) && (
                            <div className="flex items-center gap-2 text-blue-400 text-xs mb-2 pb-2 border-b border-slate-700">
                              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                              Fetching marine conditions...
                            </div>
                          )}
                        {!isUser && message.content ? (
                          isAssessmentContent(message.content) ? (
                            <AssessmentCard content={message.content} />
                          ) : (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => <h1 className="text-sm font-bold text-white mb-2 mt-1">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xs font-bold text-slate-100 mt-3 mb-1.5 border-b border-slate-700 pb-1">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-200 mt-2 mb-1">{children}</h3>,
                                p: ({ children }) => <p className="text-xs text-slate-200 mb-2 leading-relaxed last:mb-0">{children}</p>,
                                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                ul: ({ children }) => <ul className="space-y-1 mb-2 ml-3">{children}</ul>,
                                ol: ({ children }) => <ol className="space-y-1 mb-2 ml-3 list-decimal">{children}</ol>,
                                li: ({ children }) => <li className="text-xs text-slate-200 leading-relaxed">{children}</li>,
                                hr: () => <hr className="border-slate-700 my-2" />,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          )
                        ) : isUser ? (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start w-full">
                <div className="bg-slate-800 rounded-xl rounded-bl-sm px-4 py-3 max-w-[90%] w-full">
                  {!hasAiResponse ? (
                    <AssessmentSkeleton />
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-xs">
                        {proposalSentAt !== null
                          ? "Writing proposal..."
                          : "Thinking..."}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Action buttons */}
          {hasAiResponse && !isLoading && (
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 shrink-0 space-y-2">
              <button
                onClick={
                  proposalSentAt !== null
                    ? handleCopyProposal
                    : handleGenerateProposal
                }
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  proposalSentAt !== null
                    ? copiedProposal
                      ? "bg-emerald-900/60 border border-emerald-800 text-emerald-300"
                      : "bg-slate-700 hover:bg-slate-600 text-white"
                    : "bg-emerald-700 hover:bg-emerald-600 text-white"
                }`}
              >
                {proposalSentAt !== null ? (
                  copiedProposal ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy Proposal
                    </>
                  )
                ) : (
                  <>
                    <span>📄</span>
                    Generate Preliminary Proposal
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadSummary}
                disabled={isPdfGenerating}
                className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>{isPdfGenerating ? "⏳" : "📥"}</span>
                {isPdfGenerating ? "Generating PDF…" : "Download Summary PDF"}
              </button>
            </div>
          )}

          {/* Follow-up input */}
          <form
            onSubmit={handleSubmit}
            className="px-4 py-3 border-t border-slate-800 shrink-0"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask a follow-up question..."
                disabled={isLoading}
                className="flex-1 bg-slate-800 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
