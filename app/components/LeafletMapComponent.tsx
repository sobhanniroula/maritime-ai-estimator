/**
 * LeafletMapComponent.tsx
 *
 * The actual interactive map rendered with React-Leaflet.
 * This file is ONLY loaded in the browser (never on the server)
 * because Leaflet uses browser APIs like window and document.
 *
 * HOW IT WORKS:
 * - Shows the Finnish / Nordic coastline by default
 * - User clicks anywhere → we capture latitude & longitude
 * - We drop a marker at that spot
 * - The parent component receives the coordinates via onLocationSelect()
 */

"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// Import Leaflet's default CSS: this provides marker icons and map styling
if (typeof window !== "undefined") {
  require("leaflet/dist/leaflet.css");
}

// FIX: Leaflet's default marker icons break in Next.js because of how webpack
// handles asset imports. We manually point to the CDN-hosted icon images instead.
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

interface ClickedLocation {
  lat: number;
  lng: number;
}

// This inner component listens for map click events
// It must be rendered *inside* a MapContainer to access the map instance
function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  // useMapEvents is a React-Leaflet hook that connects to the map's event system
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null; // This component renders nothing, it just listens
}

interface LeafletMapComponentProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function LeafletMapComponent({
  onLocationSelect,
}: LeafletMapComponentProps) {
  const [marker, setMarker] = useState<ClickedLocation | null>(null);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  function handleLocationSelect(lat: number, lng: number) {
    setMarker({ lat, lng });
    onLocationSelect(lat, lng);
  }

  return (
    // MapContainer sets up the map viewport
    // center = where to center the map (Helsinki/Finnish coast)
    // zoom = how far zoomed in (7 shows most of the Finnish coastline)
    <MapContainer
      center={[60.17, 24.94]}
      zoom={7}
      className="w-full h-full"
      style={{ background: "#1a2a3a" }}
    >
      {/* TileLayer provides the map imagery
          We use CartoDB's dark-themed tiles, they look great with our dark UI
          and are free for non-commercial use */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />

      {/* Register the click handler inside the map context */}
      <MapClickHandler onLocationSelect={handleLocationSelect} />

      {/* Show a marker wherever the user last clicked */}
      {marker && (
        <Marker position={[marker.lat, marker.lng]}>
          <Popup className="dark-popup">
            <div className="text-sm">
              <div className="font-semibold">📍 Selected Location</div>
              <div className="text-gray-600">
                {marker.lat.toFixed(4)}°N, {marker.lng.toFixed(4)}°E
              </div>
              <div className="text-blue-600 text-xs mt-1">
                Analysis in progress →
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
