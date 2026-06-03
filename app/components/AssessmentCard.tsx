"use client";

interface SiteCondition {
  label: string;
  value: string;
}
interface SolutionItem {
  type: string;
  name: string;
  rationale: string;
}
interface PricingItem {
  label: string;
  value: string;
}
type SuitabilityStatus = "SUITABLE" | "CONDITIONAL" | "UNSUITABLE";

export interface ParsedAssessment {
  location: string;
  date: string;
  siteConditions: SiteCondition[];
  suitabilityStatus: SuitabilityStatus | null;
  suitabilityReason: string;
  solution: SolutionItem[];
  pricing: PricingItem[];
  permits: string[];
  nextSteps: string[];
}

function extractSuitability(text: string): SuitabilityStatus | null {
  if (text.includes("UNSUITABLE")) return "UNSUITABLE";
  if (text.includes("CONDITIONAL")) return "CONDITIONAL";
  if (text.includes("SUITABLE")) return "SUITABLE";
  return null;
}

function splitPermits(line: string): string[] {
  return line
    .split("☐")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseAssessment(content: string): ParsedAssessment {
  const out: ParsedAssessment = {
    location: "",
    date: "",
    siteConditions: [],
    suitabilityStatus: null,
    suitabilityReason: "",
    solution: [],
    pricing: [],
    permits: [],
    nextSteps: [],
  };

  let section = "";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line === "---") continue;

    // Location / date
    if (line.startsWith("Location:")) {
      const [locPart, ...rest] = line.replace("Location:", "").split("|");
      out.location = locPart?.trim() ?? "";
      const datePart = rest.find((p) => p.includes("Date:")) ?? rest[0] ?? "";
      out.date = datePart.replace("Date:", "").trim();
      continue;
    }
    if (line.startsWith("Assessment date:")) {
      out.date = line.replace("Assessment date:", "").trim();
      continue;
    }

    // Section headers
    if (/^SITE CONDITIONS/.test(line)) {
      section = "conditions";
      continue;
    }
    if (/^SITE SUITABILITY/.test(line)) {
      section = "suitability_block";
      continue;
    }
    if (/^SUITABILITY:/.test(line)) {
      section = "suitability";
      out.suitabilityStatus = extractSuitability(
        line.replace(/^SUITABILITY:\s*/, ""),
      );
      continue;
    }
    if (/^RECOMMENDED (SOLUTION|FOUNDATION|POOL|ANCHORING)/.test(line)) {
      section = "solution";
      continue;
    }
    if (/^ANCHORING RECOMMENDATION/.test(line)) {
      section = "solution";
      continue;
    }
    if (/^INDICATIVE PRICING/.test(line)) {
      section = "pricing";
      continue;
    }
    if (/^PERMIT CHECKLIST/.test(line)) {
      section = "permits";
      const rest = line.replace(/^PERMIT CHECKLIST[^)]*\)?\s*/, "").trim();
      if (rest) out.permits.push(...splitPermits(rest));
      continue;
    }
    if (/^NEXT STEPS/.test(line)) {
      section = "nextsteps";
      continue;
    }

    switch (section) {
      case "conditions": {
        const ci = line.indexOf(":");
        if (ci > 0) {
          out.siteConditions.push({
            label: line.slice(0, ci).trim(),
            value: line.slice(ci + 1).trim(),
          });
        }
        break;
      }
      case "suitability": {
        if (!out.suitabilityReason)
          out.suitabilityReason = line.replace(/^[→>]\s*/, "");
        break;
      }
      case "suitability_block": {
        if (!out.suitabilityStatus)
          out.suitabilityStatus = extractSuitability(line);
        if (!out.suitabilityReason)
          out.suitabilityReason = line.replace(
            /^(SUITABLE|CONDITIONAL|UNSUITABLE)[:\s-]*/,
            "",
          );
        break;
      }
      case "solution": {
        const ci = line.indexOf(":");
        if (ci > 0) {
          const typeLabel = line.slice(0, ci).trim();
          const rest = line.slice(ci + 1).trim();
          const di = rest.indexOf(" - ");
          out.solution.push({
            type: typeLabel,
            name: di > 0 ? rest.slice(0, di).trim() : rest,
            rationale: di > 0 ? rest.slice(di + 3).trim() : "",
          });
        }
        break;
      }
      case "pricing": {
        const ci = line.indexOf(":");
        if (ci > 0)
          out.pricing.push({
            label: line.slice(0, ci).trim(),
            value: line.slice(ci + 1).trim(),
          });
        break;
      }
      case "permits": {
        if (line.includes("☐")) out.permits.push(...splitPermits(line));
        break;
      }
      case "nextsteps": {
        out.nextSteps.push(line.replace(/^[•·\-*›]\s*/, ""));
        break;
      }
    }
  }

  return out;
}

const suitabilityStyle: Record<
  SuitabilityStatus,
  { bg: string; border: string; text: string; dot: string }
> = {
  SUITABLE: {
    bg: "bg-emerald-900/40",
    border: "border-emerald-700",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  CONDITIONAL: {
    bg: "bg-amber-900/40",
    border: "border-amber-700",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  UNSUITABLE: {
    bg: "bg-red-900/40",
    border: "border-red-700",
    text: "text-red-300",
    dot: "bg-red-400",
  },
};

export function isAssessmentContent(content: string): boolean {
  return (
    content.includes("SITE CONDITIONS") &&
    (content.includes("SUITABILITY") || content.includes("RECOMMENDED"))
  );
}

export function AssessmentCard({ content }: { content: string }) {
  const d = parseAssessment(content);
  const sc = d.suitabilityStatus ? suitabilityStyle[d.suitabilityStatus] : null;

  if (d.siteConditions.length === 0 && !d.suitabilityStatus) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs w-full">
      {/* Header */}
      <div className="pb-2 border-b border-slate-700">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">
          Preliminary Site Assessment
        </div>
        {d.location && (
          <div className="text-slate-200 font-mono text-[11px]">
            {d.location}
          </div>
        )}
        {d.date && (
          <div className="text-slate-500 text-[10px] mt-0.5">{d.date}</div>
        )}
      </div>

      {/* Suitability badge */}
      {d.suitabilityStatus && sc && (
        // <div className={`rounded-lg px-3 py-2.5 border ${sc.bg} ${sc.border}`}>
        <div className={`rounded-lg px-3 py-2.5 border ${sc.border}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
            <span className={`font-bold tracking-wide ${sc.text}`}>
              {d.suitabilityStatus}
            </span>
          </div>
          {d.suitabilityReason && (
            <div className="text-slate-300 text-[11px] leading-snug">
              {d.suitabilityReason}
            </div>
          )}
        </div>
      )}

      {/* Site conditions grid */}
      {d.siteConditions.length > 0 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
            Site Conditions
          </div>
          <div className="grid grid-cols-2 gap-1">
            {d.siteConditions.map(({ label, value }) => (
              <div
                key={label}
                className="bg-slate-900/80 rounded-lg px-2.5 py-2"
              >
                <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">
                  {label}
                </div>
                <div className="text-slate-200 text-[11px] leading-snug">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended solution */}
      {d.solution.length > 0 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
            Recommended Solution
          </div>
          <div className="bg-slate-900/80 rounded-lg divide-y divide-slate-800">
            {d.solution.map(({ type, name, rationale }) => (
              <div key={type} className="flex items-start gap-3 px-2.5 py-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide w-16 shrink-0 pt-0.5">
                  {type}
                </span>
                <div className="min-w-0">
                  <div className="text-blue-300 text-[11px] font-medium">
                    {name}
                  </div>
                  {rationale && (
                    <div className="text-slate-400 text-[10px] mt-0.5 leading-snug">
                      {rationale}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      {d.pricing.length > 0 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
            Indicative Pricing
          </div>
          <div className="bg-slate-900/80 rounded-lg divide-y divide-slate-800">
            {d.pricing.map(({ label, value }) => (
              <div key={label} className="flex items-start gap-3 px-2.5 py-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide w-16 shrink-0 pt-0.5">
                  {label}
                </span>
                <span className="text-slate-200 text-[11px] leading-snug">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permits */}
      {d.permits.length > 0 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
            Permit Checklist (Finland)
          </div>
          <div className="space-y-1">
            {d.permits.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-slate-300 text-[11px]"
              >
                <span className="text-slate-600 mt-0.5 shrink-0">☐</span>
                <span className="leading-snug">{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {d.nextSteps.length > 0 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">
            Next Steps
          </div>
          <div className="space-y-1">
            {d.nextSteps.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-slate-300 text-[11px]"
              >
                <span className="text-slate-500 shrink-0 mt-0.5">›</span>
                <span className="leading-snug">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
