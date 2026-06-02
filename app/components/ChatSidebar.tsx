/**
 * ChatSidebar.tsx
 *
 * The AI chat interface on the right side of the screen.
 *
 * HOW IT WORKS:
 * 1. useChat() from the Vercel AI SDK manages the entire chat state
 * 2. When `selectedLocation` changes (user clicked the map), we automatically
 *    send a message to the AI asking it to analyze those coordinates
 * 3. The AI response streams in character-by-character (like ChatGPT)
 * 4. We show a loading indicator while the AI is "thinking" or calling tools
 * 5. A "Generate Proposal" button sends a follow-up request for a formal document
 */

"use client";

import { useChat } from "ai/react";
import { useEffect, useRef } from "react";

interface SelectedLocation {
  lat: number;
  lng: number;
}

interface ChatSidebarProps {
  selectedLocation: SelectedLocation | null;
}

export default function ChatSidebar({ selectedLocation }: ChatSidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // useChat is the core hook from the Vercel AI SDK
  // It handles: sending messages, receiving streaming responses, managing state
  // api: points to our Next.js API route at /api/chat
  const { messages, input, handleInputChange, handleSubmit, append, isLoading } =
    useChat({ api: "/api/chat" });

  // When the user clicks on the map, selectedLocation changes
  // We react to that change by automatically sending an analysis request to the AI
  // useEffect with [selectedLocation] dependency runs every time it changes
  useEffect(() => {
    if (!selectedLocation) return;

    // append() adds a new user message and triggers the AI to respond
    // We construct a natural-language prompt with the coordinates
    append({
      role: "user",
      content: `Please analyze the maritime conditions and recommend a Bluet solution for this location: Latitude ${selectedLocation.lat.toFixed(4)}°N, Longitude ${selectedLocation.lng.toFixed(4)}°E.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  // Auto-scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When the user wants a formal proposal, we send a specific follow-up prompt
  function handleGenerateProposal() {
    append({
      role: "user",
      content:
        "Based on your analysis, please generate a formal Preliminary Project Proposal document. Include: Project Overview, Site Conditions Summary, Recommended Solution, Technical Specifications, Budget Breakdown, Timeline, and Next Steps.",
    });
  }

  // Find the last assistant message to decide whether to show the proposal button
  const hasAiResponse = messages.some((m) => m.role === "assistant");

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-white font-semibold text-sm">
            AI Marine Consultant
          </h2>
        </div>
        <p className="text-slate-500 text-xs mt-1">
          Click the map to analyze a coastal location
        </p>
      </div>

      {/* Message list — scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Empty state shown before any interaction */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-4xl mb-3">🌊</div>
            <h3 className="text-slate-300 font-medium text-sm mb-1">
              Select a coastal location
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Click anywhere on the map to start an AI-powered site analysis.
              The AI will assess wave conditions, wind, ice risk, and recommend
              the right Bluet solution.
            </p>
          </div>
        )}

        {/* Render each message in the conversation */}
        {messages.map((message) => {
          // Only render user and assistant messages in the UI
          // Other roles (like "data") are internal SDK state
          if (message.role !== "user" && message.role !== "assistant") return null;

          const isUser = message.role === "user";

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
                {/* Check if the AI is currently calling our weather tool */}
                {/* toolInvocations is populated while the AI is mid-thought */}
                {!isUser &&
                  message.toolInvocations &&
                  message.toolInvocations.length > 0 && (
                    <div className="flex items-center gap-2 text-blue-400 text-xs mb-2 pb-2 border-b border-slate-700">
                      <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Accessing marine weather data...
                    </div>
                  )}

                {/* The actual message content — whitespace-pre-wrap preserves line breaks */}
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          );
        })}

        {/* Loading indicator — shown while the AI is responding */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-xl rounded-bl-sm px-4 py-3 text-sm">
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

        {/* Invisible div at the bottom — we scroll to this to always show latest message */}
        <div ref={messagesEndRef} />
      </div>

      {/* "Generate Proposal" button — shown only after the AI has responded */}
      {hasAiResponse && !isLoading && (
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={handleGenerateProposal}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>📄</span>
            Generate Preliminary Proposal
          </button>
        </div>
      )}

      {/* Manual input area — user can ask follow-up questions */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-slate-800"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a follow-up question..."
            disabled={isLoading}
            className="flex-1 bg-slate-800 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
