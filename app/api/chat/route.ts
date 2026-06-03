/**
 * app/api/chat/route.ts
 *
 * This is the BRAIN of the application: the AI agent endpoint.
 *
 * HOW IT WORKS (step by step):
 * 1. The user clicks on the map → coordinates are sent here as a chat message
 * 2. We load our product knowledge base (products.json)
 * 3. We tell the AI who it is (system prompt) and give it tools to call
 * 4. The AI decides to call `getMarineConditions` to fetch weather data
 * 5. Our code runs the weather fetch and returns results to the AI
 * 6. The AI reads the weather data + product specs and writes a recommendation
 * 7. We stream the response back to the browser (character by character, live)
 *
 * KEY CONCEPT: "Tool Calling":
 * Instead of the AI making something up, we give it a real function it can call.
 * The AI says "I need weather data for lat X, lng Y" → our code fetches it → AI uses it.
 * This is what makes the response grounded in real data, not just hallucination.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getMarineConditions } from "@/tools/marineWeather";

// Vercel Pro allows up to 300s. Set to 30: works on Pro, silently capped to 10 on Hobby.
// gpt-4o-mini + one tool call typically completes in 4-8s, so Hobby is fine in practice.
export const maxDuration = 30;

// Set up the AI model using GitHub Models
// GitHub Models is accessed via your GitHub Personal Access Token
// It supports the same API format as OpenAI, so we use the OpenAI SDK adapter
const githubModel = createOpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.GITHUB_TOKEN ?? "",
  // "compatible" mode handles slight differences in the GitHub Models API
  compatibility: "compatible",
});

export async function POST(req: Request) {
  // The chat history arrives as a list of messages: [{role, content}, ...]
  const { messages } = await req.json();

  // Read the product knowledge base from disk
  // This is a plain JSON file we can edit easily during the challenge demo
  const productsFilePath = path.join(
    process.cwd(),
    "knowledge",
    "products.json",
  );
  const productSpecs = fs.readFileSync(productsFilePath, "utf8");

  // streamText is the core function from the Vercel AI SDK
  // It sends the AI's response as a stream so the UI shows it in real time
  const result = streamText({
    model: githubModel("gpt-4o-mini"),
    messages,

    system: `You are an internal pre-sales analysis tool for Bluet Oy's sales team.
Your output is for the salesperson only, never shown directly to the customer.

CRITICAL RULES:
1. WAVE HEIGHT PRIORITY: If the user message contains a client-provided wave height value, use THAT value for all suitability checks. Show the API-fetched value as "(live API: X.X m)" for reference only. Never flag a site as unsuitable based on API wave height if the client provided a lower value.
2. DEPTH SUITABILITY:
   - depth < 2.0 m → UNSUITABLE (hard threshold)
   - depth = 2.0 m exactly → CONDITIONAL (minimum just met: flag it, check product-specific minimums)
   - depth > 2.0 m → match against product minimums
3. FALLBACK VALUES: Never write "unknown". Use these Finnish coastal defaults and mark as "(est.)":
   - Current/flow → "Low (est.: sheltered Finnish coastal waters)"
   - Seabed/soil → "Glacial till or clay (est.: Finnish coastal geology)"
   - Water level variation → "0.3–0.5 m seasonal (Baltic Sea typical)"

DECISION SEQUENCE:
1. Call getMarineConditions for the coordinates.
2. Apply depth and wave rules above.
3. Foundation: Residential → Concrete only. Calm/small → Lightweight. Large/harsh → Steel. Events/temp → Multiuse Platform.
4. Pool by site depth: Barge ≥3.0 m · Grated 2–3 m · Hybrid ≥2.0 m · Multiuse Pool ≥1.5 m · Bottomless ≥2.0 m + clean water only.
5. Anchoring: Chain (standard) · Pile (demanding) · Seaflex or Mooring Arm (deep/wave-exposed).
6. Always include Finnish permit checklist.
7. Always split pricing: product fee + variable fees. Use prices from the product database below.

PRODUCT DATABASE:
${productSpecs}

TONE: Concise, technical, internal. Brief colleague-briefing style. Keep total response under 300 words.

OUTPUT FORMAT - use this structure exactly:

---
PRELIMINARY SITE ASSESSMENT  - FOR BLUET INTERNAL USE
Location: [coordinates or place name]   |   Date: [today's date]

SITE CONDITIONS
  Depth:           [value] ([client-provided / API / est.])
  Wave height:     [CLIENT value if given, else API value] [(live API: X.X m if different)]
  Wind:            [speed + direction]
  Ice risk:        [Low / Moderate / High] - [one-phrase reason]
  Current/flow:    [value or est.]
  Seabed/soil:     [value or est.]
  Water variation: [value or Baltic est.]

SUITABILITY: [SUITABLE / CONDITIONAL / UNSUITABLE]
→ [One sentence reason. If CONDITIONAL, name what needs confirming.]

RECOMMENDED SOLUTION
  Foundation:  [Name] - [one-line rationale]
  Pool:        [Name or "Not requested"] - [one-line rationale]
  Anchoring:   [Name] - [one-line rationale]

INDICATIVE PRICING (ex-works, indicative)
  Foundation:  [starting price from product database]
  Pool:        [starting price, or "N/A"]
  Variable:    est. 30–60% on top (transport, installation, permits, supervision)

PERMIT CHECKLIST (Finland)
  ☐ Land use plan   ☐ ELY/AVI water permit (6–18 months)   ☐ Building permit   ☐ Standards

NEXT STEPS
  • [1 project-specific action based on findings]
  • Confirm depth on site · check permit status and lead times
  • Ice constraint: no assembly with ice on site (~May–Nov installation window in Finland)
---`,

    // Tools are functions the AI can call during its "thinking" process
    // The AI chooses when to call them based on the conversation
    tools: {
      getMarineConditions: tool({
        description:
          "Fetches real-time marine weather data for a GPS location. Returns wave height, wind speed, ice risk, and water temperature. Always call this when you have coordinates to analyze.",
        // zod schema validates the inputs the AI passes to this function
        parameters: z.object({
          lat: z.number().describe("Latitude of the target location"),
          lng: z.number().describe("Longitude of the target location"),
        }),
        // execute is the actual function that runs when the AI calls this tool
        execute: async ({ lat, lng }) => {
          return await getMarineConditions(lat, lng);
        },
      }),
    },

    // maxSteps: allows the AI to call tools and then continue responding
    // Without this, it would stop after calling the tool
    // Flow: user message → AI calls tool → tool runs → AI reads result → AI writes response
    maxSteps: 5,
  });

  // Convert the stream to an HTTP response the browser's useChat hook understands
  return result.toDataStreamResponse();
}
