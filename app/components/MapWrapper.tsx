"use client";

import dynamic from "next/dynamic";

const LeafletMapComponent = dynamic(() => import("./LeafletMapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading map...
      </div>
    </div>
  ),
});

interface MapWrapperProps {
  onLocationSelect: (lat: number, lng: number) => void;
  theme: "dark" | "light";
}

export default function MapWrapper({ onLocationSelect, theme }: MapWrapperProps) {
  return <LeafletMapComponent onLocationSelect={onLocationSelect} theme={theme} />;
}
