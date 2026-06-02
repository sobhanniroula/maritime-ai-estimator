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

// Tell Next.js this route can take up to 60 seconds (AI calls can be slow)
// Vercel Hobby (free) plan caps serverless functions at 10s.
// Vercel Pro allows up to 300s. Set to 30: works on Pro, silently capped to 10 on Hobby.
// gpt-5-mini + one tool call typically completes in 4-8s, so Hobby is fine in practice.
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
    model: githubModel("gpt-5-mini"),
    messages,

    // The system prompt defines the AI's personality and rules
    // It's like a briefing document the AI reads before every conversation
    system: `You are a Maritime Engineering Consultant AI for Bluet Oy, a Finnish company specializing in sustainable floating construction solutions.

YOUR MISSION: Analyze a coastal location's environmental conditions and recommend the right Bluet floating infrastructure product for the client's needs.

PROTOCOL - follow these steps in order:
1. When given GPS coordinates, ALWAYS call the 'getMarineConditions' tool first to get real environmental data.
2. Compare the conditions (wave height, wind, ice risk) against the product constraints below.
3. Recommend the most suitable product with clear technical reasoning.
4. Provide a preliminary budget estimate.
5. Be precise and technical, but still readable for a business owner.

BLUET PRODUCT DATABASE:
${productSpecs}

RESPONSE FORMAT - always structure your reply like this:
**📍 Location Assessment**
[Brief description of the location type: sheltered bay, open coast, archipelago, etc.]

**🌊 Environmental Conditions**
[List: wave height, wind speed, ice risk, water temp]

**✅ Recommended Solution**
[Product name + why it matches the conditions. Mention specific constraints that fit or are exceeded.]

**💰 Preliminary Budget Estimate**
[Price range from the product spec + note on factors that affect cost]

**⚠️ Special Considerations**
[Any installation requirements, seasonal factors, or risks the client should know about]`,

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
