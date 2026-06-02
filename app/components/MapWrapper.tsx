/**
 * MapWrapper.tsx
 *
 * A thin wrapper that solves the biggest challenge with Leaflet + Next.js:
 * Leaflet uses browser-only APIs (window, document) that don't exist on the server.
 *
 * SOLUTION — Dynamic Import with ssr: false:
 * We use Next.js's `dynamic()` to tell it: "load this component only in the browser,
 * never try to render it on the server." This is the standard pattern for any
 * browser-only library in Next.js.
 */

"use client";

import dynamic from "next/dynamic";

// dynamic() creates a lazy-loaded component
// ssr: false means "skip server-side rendering for this component"
// loading: shows a placeholder while the component code is being downloaded
const LeafletMapComponent = dynamic(
  () => import("./LeafletMapComponent"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading map...
        </div>
      </div>
    ),
  }
);

interface MapWrapperProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

// This wrapper is what the rest of the app imports
// It passes the onLocationSelect callback down to the actual Leaflet component
export default function MapWrapper({ onLocationSelect }: MapWrapperProps) {
  return <LeafletMapComponent onLocationSelect={onLocationSelect} />;
}
