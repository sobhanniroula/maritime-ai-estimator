"use client";

import { useState } from "react";
import MapWrapper from "./components/MapWrapper";
import ChatSidebar from "./components/ChatSidebar";
import ProposalPreview from "./components/ProposalPreview";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./contexts/ThemeContext";

interface SelectedLocation {
  lat: number;
  lng: number;
}

export default function Home() {
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalContent, setProposalContent] = useState("");
  const { theme } = useTheme();

  function handleLocationSelect(lat: number, lng: number) {
    setSelectedLocation({ lat, lng });
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950">
      {/* Top navigation bar */}
      <header className="flex items-center justify-between px-4 md:px-5 py-2.5 md:py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center font-bold text-lg md:text-xl pb-1 md:pb-2">
            🌊
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-white font-semibold text-sm leading-none">
              Maritime AI Estimator
            </h1>
            <p className="text-slate-500 text-xs mt-0.5 hidden md:block">
              Floating Infrastructure Cost Analysis
            </p>
          </div>
        </div>

        {/* Right side: status chip + theme toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-2 md:px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span className="text-slate-600 dark:text-slate-300 text-xs hidden md:inline">
              AI Agent Active
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content area:
          Desktop: map left (60%) + sidebar right (40%), side by side
          Mobile:  map top (30% height) + sidebar bottom (70% height), stacked */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Map area */}
        <div className="relative h-[30%] md:h-auto md:flex-[6] shrink-0 overflow-hidden">
          <MapWrapper onLocationSelect={handleLocationSelect} theme={theme} />

          {/* Instruction overlay shown when no location has been selected yet */}
          {!selectedLocation && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-slate-800 dark:text-white text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-none text-center whitespace-nowrap">
              <div className="font-medium text-xs md:text-sm">
                Click any coastal area to analyze
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 hidden md:block">
                AI will assess wave conditions &amp; recommend a solution
              </div>
            </div>
          )}

          {/* Show coordinates of the selected location */}
          {selectedLocation && (
            <div className="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-slate-800 dark:text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              📍 {selectedLocation.lat.toFixed(4)}°N,{" "}
              {selectedLocation.lng.toFixed(4)}°E
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div className="h-[70%] md:h-auto md:flex-[4] overflow-hidden">
          <ChatSidebar selectedLocation={selectedLocation} />
        </div>
      </div>

      {/* Proposal Preview modal */}
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
