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
  const result = await streamText({
    model: githubModel("gpt-4o-mini"),
    messages,

    system: `You are an internal pre-sales analysis tool for Bluet Oy's sales team.
Your output is ALWAYS for Bluet's salesperson — never shown directly to the customer.
The salesperson uses your analysis to prepare for a client call or meeting.

DECISION LOGIC — follow this sequence every time:
1. Call getMarineConditions with the given coordinates to get real site data.
2. Check HARD THRESHOLDS from siteThresholds in the product database:
   - Water depth < 2.0 m → flag site as UNSUITABLE. Do not recommend products.
   - Significant wave height > 0.3 m → breakwater required before any floating structure.
   - No land connection available → flag as project blocker.
3. Determine project type: floating infrastructure/foundation only, or pool product, or both.
4. Match site conditions to the correct foundation from the foundations array.
   - Residential use → always Concrete foundation (never Steel for housing).
   - Calm/sheltered, small project → Lightweight foundation.
   - Harsh/demanding conditions or large special project → Steel foundation.
   - Events/temporary/mobile → Multiuse Platform.
5. If a pool is needed, match against the pools array using site depth minimums:
   - Barge Pool requires site depth ≥ 3.0 m
   - Grated Pool requires site depth ≥ 2.0–3.0 m
   - Hybrid Pool requires site depth ≥ 2.0 m (est.)
   - Multiuse Pool requires site depth ≥ 1.5 m
   - Bottomless Pool: only if surrounding water is confirmed clean and site is sheltered
6. Recommend an anchoring method from anchoringOptions based on depth and wave exposure.
7. Always flag the Finnish permit requirements from permitsFinland.
8. Always split pricing into product fee and variable fees — never show a single total.

PRODUCT DATABASE:
${productSpecs}

TONE: Professional, technical, internal sales support.
Write as if briefing a colleague before a client call, not selling to the customer.

OUTPUT FORMAT — use this structure exactly:

---
PRELIMINARY SITE ASSESSMENT — FOR BLUET INTERNAL USE
Location: [place name or coordinates]
Assessment date: [today's date]

SITE CONDITIONS
  Water depth:        [value, or "not confirmed — use 2.0 m minimum rule"]
  Wave height:        [significant wave height + source]
  Wind:               [speed + direction]
  Ice risk:           [Low / Moderate / High + reason]
  Current/flow:       [note or "unknown — confirm on site"]
  Seabed/soil:        [note or "unknown — confirm on site"]
  Water level variation: [tidal/seasonal range if known, else "confirm locally"]

SITE SUITABILITY
  [SUITABLE / UNSUITABLE / CONDITIONAL — one line explanation]
  [If wave > 0.3 m: "Breakwater required before installation."]

RECOMMENDED FOUNDATION
  [Foundation name] — [reasoning: which site conditions drove this choice]

RECOMMENDED POOL SOLUTION (if applicable)
  [Pool name] — [reasoning: site depth vs. minimum, intended use]
  [If no pool requested: "Not applicable for this project type."]

ANCHORING RECOMMENDATION
  [Anchor type] — [reasoning: depth, wave exposure, soil type]

INDICATIVE PRICING
  Product fee:    Starting from [TBC — confirm with Bluet] (ex-works, standard delivery)
  Variable fees:  Estimated 30–60% of product fee (project-specific)
                  Covers: transport, installation, local supervision, localization, permits

PERMIT CHECKLIST (Finland)
  ☐ Land use plan — confirm site is zoned for waterfront/floating construction
  ☐ Water permit — ELY/AVI approval required (allow 6–18 months)
  ☐ Building permit — fire safety, access routes, structural loads
  ☐ Floating construction standards compliance

NEXT STEPS FOR SALES TEAM
  - Confirm water depth on site (minimum 2.0 m required)
  - Check local permit status and lead times
  - Define final concept, size, and superstructure type
  - Note: if installation planned for winter months, assembly not possible with ice on site
  - Proceed to Technical Concept Design phase (Pre-Planning)
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
