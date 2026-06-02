/**
 * page.tsx — Main Application Page
 *
 * This is the root page of the app. It acts as the "conductor" that:
 * 1. Holds the currently-selected map location in state
 * 2. Passes it to the ChatSidebar (which auto-triggers the AI analysis)
 * 3. Manages the ProposalPreview modal
 *
 * LAYOUT:
 * ┌─────────────────────────────────────┬──────────────────────┐
 * │           Interactive Map           │   AI Chat Sidebar    │
 * │           (60% width)               │   (40% width)        │
 * │   Click coast → AI analyzes it      │  Streaming response  │
 * │                                     │  [Generate Proposal] │
 * └─────────────────────────────────────┴──────────────────────┘
 */

"use client";

import { useState } from "react";
import MapWrapper from "./components/MapWrapper";
import ChatSidebar from "./components/ChatSidebar";
import ProposalPreview from "./components/ProposalPreview";

interface SelectedLocation {
  lat: number;
  lng: number;
}

export default function Home() {
  // Tracks which location the user last clicked on the map
  // When this changes, ChatSidebar automatically sends an AI analysis request
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);

  // Controls whether the proposal modal is shown
  const [showProposal, setShowProposal] = useState(false);

  // Stores the proposal text (set when user clicks "Generate Proposal")
  const [proposalContent, setProposalContent] = useState("");

  // Called by the map when the user clicks a location
  function handleLocationSelect(lat: number, lng: number) {
    // We create a new object even if coordinates are the same
    // This ensures the useEffect in ChatSidebar always fires
    setSelectedLocation({ lat, lng });
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Top navigation bar */}
      <header className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            B
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-none">
              Bluet Maritime AI Estimator
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Floating Infrastructure Cost Analysis
            </p>
          </div>
        </div>

        {/* Status chip */}
        <div className="flex items-center gap-2 bg-slate-800 rounded-full px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 text-xs">AI Agent Active</span>
        </div>
      </header>

      {/* Main content area — map + sidebar side by side */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map area — 60% of the width */}
        <div className="relative flex-[6] overflow-hidden">
          <MapWrapper onLocationSelect={handleLocationSelect} />

          {/* Instruction overlay shown when no location has been selected yet */}
          {!selectedLocation && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur text-white text-sm px-5 py-3 rounded-xl border border-slate-700 pointer-events-none text-center">
              <div className="font-medium">Click any coastal area to analyze</div>
              <div className="text-slate-400 text-xs mt-1">
                AI will assess wave conditions &amp; recommend a Bluet solution
              </div>
            </div>
          )}

          {/* Show coordinates of the selected location */}
          {selectedLocation && (
            <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur text-white text-xs px-3 py-2 rounded-lg border border-slate-700">
              📍 {selectedLocation.lat.toFixed(4)}°N,{" "}
              {selectedLocation.lng.toFixed(4)}°E
            </div>
          )}
        </div>

        {/* Chat sidebar — 40% of the width */}
        <div className="flex-[4] overflow-hidden">
          <ChatSidebar selectedLocation={selectedLocation} />
        </div>
      </div>

      {/* Proposal Preview modal — rendered on top of everything when active */}
      {showProposal && proposalContent && (
        <ProposalPreview
          content={proposalContent}
          location={selectedLocation}
          onClose={() => setShowProposal(false)}
        />
      )}
    </div>
  );
}
