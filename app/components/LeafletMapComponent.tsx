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

function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface LeafletMapComponentProps {
  onLocationSelect: (lat: number, lng: number) => void;
  theme: "dark" | "light";
}

const DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export default function LeafletMapComponent({
  onLocationSelect,
  theme,
}: LeafletMapComponentProps) {
  const [marker, setMarker] = useState<ClickedLocation | null>(null);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  function handleLocationSelect(lat: number, lng: number) {
    setMarker({ lat, lng });
    onLocationSelect(lat, lng);
  }

  const isDark = theme === "dark";

  return (
    <MapContainer
      center={[60.17, 24.94]}
      zoom={7}
      className="w-full h-full"
      style={{ background: isDark ? "#1a2a3a" : "#e8ecf0" }}
    >
      <TileLayer
        url={isDark ? DARK_TILES : LIGHT_TILES}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />

      <MapClickHandler onLocationSelect={handleLocationSelect} />

      {marker && (
        <Marker position={[marker.lat, marker.lng]}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-slate-800">📍 Selected Location</div>
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
