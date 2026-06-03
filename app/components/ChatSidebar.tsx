"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";

interface SelectedLocation {
  lat: number;
  lng: number;
}

interface ChatSidebarProps {
  selectedLocation: SelectedLocation | null;
}

type WizardStep = "idle" | "confirming" | "step1" | "step2" | "step3" | "chatting";
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

function buildAnalysisPrompt(location: SelectedLocation, data: WizardData): string {
  const projectLabels: Record<ProjectType, string> = {
    infrastructure: "Floating infrastructure / foundation (sauna, terrace, restaurant, café, commercial space)",
    pool: "Floating pool solution",
    event: "Floating event platform (concerts, sports, exhibitions, temporary use)",
    residential: "Floating residential housing (apartments, private homes)",
  };

  const sizeLabels: Record<SizeCategory, string> = {
    small: "Small (under 200 m²)",
    medium: "Medium (200–500 m²)",
    large: "Large (over 500 m²)",
  };

  const poolLabels: Record<PoolType, string> = {
    natural: "Natural water pool (lake/sea swimming — bottomless or grated)",
    heated: "Heated pool (Barge, Hybrid, or Multiuse type)",
    both: "Both heated and natural water pool",
  };

  const lines: string[] = [];

  lines.push(`PROJECT TYPE: ${data.projectType ? projectLabels[data.projectType] : "Not specified"}`);

  if (data.intendedUse) lines.push(`INTENDED USE: ${data.intendedUse}`);
  if (data.poolType) lines.push(`POOL TYPE: ${poolLabels[data.poolType]}`);
  if (data.sizeCategory) lines.push(`APPROXIMATE SIZE: ${sizeLabels[data.sizeCategory]}`);
  if (data.usagePeriod) lines.push(`OPERATION PERIOD: ${data.usagePeriod === "year-round" ? "Year-round" : "Seasonal / temporary"}`);

  const depthNote = data.waterDepth.trim()
    ? data.waterDepth.trim()
    : "Unknown — not provided by client. Apply the 2.0 m minimum threshold and flag for on-site confirmation.";

  const waveNote = data.waveHeight.trim()
    ? data.waveHeight.trim()
    : "Not provided — fetch from weather API and use that value.";

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
    ...(data.additionalNotes.trim() ? [`- Additional notes: ${data.additionalNotes.trim()}`] : []),
    ``,
    `Fetch marine conditions for these coordinates, then produce a full PRELIMINARY SITE ASSESSMENT for Bluet's internal sales team using the standard output format.`,
  ].join("\n");
}

function WizardProgress({ step }: { step: WizardStep }) {
  const stepMap: Partial<Record<WizardStep, number>> = { confirming: 0, step1: 1, step2: 2, step3: 3 };
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
          <div className={`flex items-center gap-1 ${stepNumber === n ? "text-white" : stepNumber > n ? "text-emerald-400" : "text-slate-600"}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
              stepNumber > n ? "bg-emerald-500 border-emerald-500 text-white" :
              stepNumber === n ? "bg-blue-600 border-blue-600 text-white" :
              "border-slate-700 text-slate-600"
            }`}>
              {stepNumber > n ? "✓" : n + 1}
            </div>
            <span className="text-[10px]">{label}</span>
          </div>
          {i < arr.length - 1 && <div className={`w-4 h-px ${stepNumber > n ? "bg-emerald-600" : "bg-slate-700"}`} />}
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

  const { messages, input, handleInputChange, handleSubmit, append, isLoading, setMessages } =
    useChat({ api: "/api/chat" });

  // Reset wizard whenever the user picks a new map location
  useEffect(() => {
    if (!selectedLocation) return;
    setWizardStep("confirming");
    setWizard(EMPTY_WIZARD);
    setMessages([]);
    setFirstMessageId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleProjectType(type: ProjectType) {
    if (type === "residential") {
      // Residential has no meaningful step 2 — jump straight to site data
      setWizard({ ...EMPTY_WIZARD, projectType: type, intendedUse: "Residential apartments or private home" });
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
    const msgId = await append({ role: "user", content: prompt });
    if (msgId) setFirstMessageId(msgId);
  }

  function handleGenerateProposal() {
    append({
      role: "user",
      content:
        "Using the site assessment above, generate a CLIENT-FACING Preliminary Project Proposal — a document Bluet would send to the client contact, NOT an internal tool output. Use professional, positive language. Structure:\n\n1. EXECUTIVE SUMMARY (2–3 sentences: what we propose and why this site works)\n2. PROPOSED SOLUTION (product names, key benefits in client-friendly terms — no internal notes or threshold jargon)\n3. INDICATIVE INVESTMENT (product fee starting from + variable fees range; present it as an investment, not a cost breakdown)\n4. PROJECT TIMELINE (5-stage: Concept Design → Permit Applications → Manufacturing → Delivery & Installation → Handover; give typical durations)\n5. PERMIT REQUIREMENTS (simplified 2–3 sentences for a non-technical client — no ELY/AVI acronyms unexplained)\n6. NEXT STEPS (3 concrete actions the client and Bluet take together)\n\nClose with a single call-to-action sentence. Keep to ~250 words total. Do NOT repeat the internal assessment format.",
    });
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
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-white font-semibold text-sm">AI Marine Consultant</h2>
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {wizardStep === "idle" && "Click the map to analyze a coastal location"}
          {wizardStep === "confirming" && "Confirm the selected location to continue"}
          {wizardStep === "step1" && "Step 1 of 3 — Select project type"}
          {wizardStep === "step2" && "Step 2 of 3 — Project details"}
          {wizardStep === "step3" && "Step 3 of 3 — Site information"}
          {wizardStep === "chatting" && "Internal pre-sales assessment — Bluet sales team"}
        </p>
      </div>

      {/* Progress bar (shown during wizard only) */}
      {wizardStep !== "idle" && wizardStep !== "chatting" && (
        <WizardProgress step={wizardStep} />
      )}

      {/* ── WIZARD PANELS ─────────────────────────────────────── */}
      {wizardStep !== "chatting" && (
        <div className="flex-1 overflow-y-auto px-4 py-5">

          {/* IDLE */}
          {wizardStep === "idle" && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-4xl mb-3">🌊</div>
              <h3 className="text-slate-300 font-medium text-sm mb-2">Select a coastal location</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Click anywhere on the map to begin a site assessment. The AI will analyze wave conditions, wind, ice risk, and recommend the right Bluet solution.
              </p>
            </div>
          )}

          {/* CONFIRMING */}
          {wizardStep === "confirming" && selectedLocation && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-2">Location selected</div>
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
                <p>Marine conditions (wave height, wind speed, ice risk) will be automatically fetched by the AI for this location.</p>
                <p className="mt-1.5">You&apos;ll be asked a few short questions about the project type and any site data you already have.</p>
              </div>

              <button
                onClick={() => setWizardStep("step1")}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3 px-4 rounded-xl text-sm font-medium transition-colors"
              >
                Confirm Location →
              </button>
            </div>
          )}

          {/* STEP 1 — Project type */}
          {wizardStep === "step1" && (
            <div className="space-y-3">
              <div className="mb-4">
                <h3 className="text-white font-medium text-sm">What type of solution does the client need?</h3>
                <p className="text-slate-500 text-xs mt-1">Select the primary project category</p>
              </div>

              {(
                [
                  { type: "infrastructure" as ProjectType, icon: "🏗️", label: "Floating Infrastructure", desc: "Sauna, terrace, restaurant, café, commercial space" },
                  { type: "pool" as ProjectType, icon: "🏊", label: "Floating Pool", desc: "Natural water, heated or hybrid pool" },
                  { type: "event" as ProjectType, icon: "🎪", label: "Event Platform", desc: "Concerts, sports, exhibitions, temporary use" },
                  { type: "residential" as ProjectType, icon: "🏠", label: "Residential Housing", desc: "Floating apartments or private homes" },
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
                      <div className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">{label}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                    </div>
                    <div className="ml-auto text-slate-600 group-hover:text-blue-400 transition-colors text-lg">›</div>
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

          {/* STEP 2 — Project details */}
          {wizardStep === "step2" && (
            <div className="space-y-5">
              {/* Infrastructure */}
              {wizard.projectType === "infrastructure" && (
                <>
                  <div>
                    <h3 className="text-white font-medium text-sm mb-1">What will be built on the water?</h3>
                    <p className="text-slate-500 text-xs mb-3">Select the primary intended use</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "Sauna or leisure terrace", label: "🧖 Sauna / Terrace" },
                        { value: "Restaurant or café", label: "🍽️ Restaurant / Café" },
                        { value: "Hotel or spa accommodation", label: "🏨 Hotel / Spa" },
                        { value: "Office or commercial space", label: "💼 Office / Commercial" },
                        { value: "Marina or dock facility", label: "⚓ Marina / Dock" },
                        { value: "Mixed use or other", label: "🔀 Mixed / Other" },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setWizard((w) => ({ ...w, intendedUse: value }))}
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
                    <p className="text-slate-400 text-xs mb-2">Approximate project size</p>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: "small" as SizeCategory, label: "Small", sub: "< 200 m²" },
                          { value: "medium" as SizeCategory, label: "Medium", sub: "200–500 m²" },
                          { value: "large" as SizeCategory, label: "Large", sub: "> 500 m²" },
                        ] as const
                      ).map(({ value, label, sub }) => (
                        <button
                          key={value}
                          onClick={() => setWizard((w) => ({ ...w, sizeCategory: value }))}
                          className={`flex-1 rounded-xl px-2 py-2.5 text-center transition-all border ${
                            wizard.sizeCategory === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          <div className="text-xs font-medium">{label}</div>
                          <div className="text-[10px] mt-0.5 opacity-70">{sub}</div>
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
                    <h3 className="text-white font-medium text-sm mb-1">What type of pool?</h3>
                    <p className="text-slate-500 text-xs mb-3">This determines the minimum site depth required</p>
                    <div className="space-y-2">
                      {(
                        [
                          { value: "natural" as PoolType, icon: "🌊", label: "Natural water pool", desc: "Uses surrounding water — Grated or Bottomless. Site depth min. 2–3 m." },
                          { value: "heated" as PoolType, icon: "🌡️", label: "Heated pool", desc: "Filtered + temperature-controlled — Barge, Hybrid or Multiuse. Site depth from 1.5 m." },
                          { value: "both" as PoolType, icon: "♾️", label: "Both", desc: "Combined facility with heated and natural water pools." },
                        ] as const
                      ).map(({ value, icon, label, desc }) => (
                        <button
                          key={value}
                          onClick={() => setWizard((w) => ({ ...w, poolType: value }))}
                          className={`w-full rounded-xl px-4 py-3 text-left transition-all border ${
                            wizard.poolType === value
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg leading-none mt-0.5">{icon}</span>
                            <div>
                              <div className="text-sm font-medium">{label}</div>
                              <div className={`text-xs mt-0.5 ${wizard.poolType === value ? "text-blue-200" : "text-slate-500"}`}>{desc}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-400 text-xs mb-2">Operation period</p>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: "year-round" as UsagePeriod, label: "☀️❄️ Year-round" },
                          { value: "seasonal" as UsagePeriod, label: "☀️ Summer seasonal" },
                        ] as const
                      ).map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setWizard((w) => ({ ...w, usagePeriod: value }))}
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
                    <h3 className="text-white font-medium text-sm mb-1">What type of event?</h3>
                    <p className="text-slate-500 text-xs mb-3">Multiuse Platform suits all event types — site depth 1–10 m</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "Concert or performing arts stage", label: "🎵 Concert / Stage" },
                        { value: "Sports field (padel, football, etc.)", label: "⚽ Sports Field" },
                        { value: "Market, exhibition or pop-up", label: "🎪 Market / Exhibition" },
                        { value: "Temporary dock or working platform", label: "⚓ Dock / Platform" },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setWizard((w) => ({ ...w, intendedUse: value }))}
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
                    <p className="text-slate-400 text-xs mb-2">How long is the platform needed?</p>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: "seasonal" as UsagePeriod, label: "📅 Temporary / one-off" },
                          { value: "year-round" as UsagePeriod, label: "🔁 Permanent / recurring" },
                        ] as const
                      ).map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setWizard((w) => ({ ...w, usagePeriod: value }))}
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

          {/* STEP 3 — Site data */}
          {wizardStep === "step3" && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-white font-medium text-sm">Site information</h3>
                <p className="text-slate-500 text-xs mt-1">
                  Provide any data you already have. Wave height and wind will be auto-fetched by the AI if left blank.
                </p>
              </div>

              {/* Water depth */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Water depth at site
                  <span className="ml-1.5 text-amber-400 font-normal">⚠ Critical — min. 2.0 m required</span>
                </label>
                <input
                  type="text"
                  value={wizard.waterDepth}
                  onChange={(e) => setWizard((w) => ({ ...w, waterDepth: e.target.value }))}
                  placeholder="e.g. 4.5 m — or leave blank if unknown"
                  className="w-full bg-slate-800 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-slate-600 text-[10px] mt-1.5">
                  Depth data cannot be auto-fetched. A client estimate or site survey value is preferred. If unknown, the AI will flag it for on-site confirmation.
                </p>
              </div>

              {/* Wave height */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Significant wave height
                  <span className="ml-1.5 text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={wizard.waveHeight}
                  onChange={(e) => setWizard((w) => ({ ...w, waveHeight: e.target.value }))}
                  placeholder="Leave blank — AI fetches from weather API"
                  className="w-full bg-slate-800 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-slate-600 text-[10px] mt-1.5">
                  Max 0.3 m without breakwater. Leave blank to use real-time weather data.
                </p>
              </div>

              {/* Additional notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Additional notes from client
                  <span className="ml-1.5 text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={wizard.additionalNotes}
                  onChange={(e) => setWizard((w) => ({ ...w, additionalNotes: e.target.value }))}
                  placeholder="e.g. protected bay, icy winters, rocky seabed, client already has a building permit..."
                  rows={3}
                  className="w-full bg-slate-800 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setWizardStep(wizard.projectType === "residential" ? "step1" : "step2")}
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
      {wizardStep === "chatting" && (
        <>
          {/* Context chip — shows what was analyzed */}
          {analysisLabel && selectedLocation && (
            <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>📍</span>
                <span>{selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lng.toFixed(4)}°E</span>
                <span className="text-slate-600">·</span>
                <span className="text-blue-400">{analysisLabel}</span>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((message) => {
              if (message.role !== "user" && message.role !== "assistant") return null;
              const isUser = message.role === "user";
              const isFirstMessage = message.id === firstMessageId;

              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-100 rounded-bl-sm"
                    }`}
                  >
                    {/* For the first (wizard-generated) message, show a summary instead of the raw prompt */}
                    {isUser && isFirstMessage ? (
                      <div className="text-xs opacity-80">
                        <div className="font-medium mb-1">Analysis request sent</div>
                        <div>{analysisLabel} · {selectedLocation?.lat.toFixed(3)}°N {selectedLocation?.lng.toFixed(3)}°E</div>
                        {wizard.waterDepth && <div>Depth: {wizard.waterDepth}</div>}
                      </div>
                    ) : (
                      <>
                        {!isUser && message.toolInvocations && message.toolInvocations.length > 0 && (
                          <div className="flex items-center gap-2 text-blue-400 text-xs mb-2 pb-2 border-b border-slate-700">
                            <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                            Fetching marine conditions...
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs">Analyzing marine conditions...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Generate proposal button */}
          {hasAiResponse && !isLoading && (
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 shrink-0">
              <button
                onClick={handleGenerateProposal}
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>📄</span>
                Generate Preliminary Proposal
              </button>
            </div>
          )}

          {/* Follow-up input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-slate-800 shrink-0">
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
