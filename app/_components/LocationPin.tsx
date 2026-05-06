"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { LatLngExpression } from "leaflet";
import { VERMONT_CENTER } from "../_lib/geocode";

// React-Leaflet must be loaded client-only (Leaflet touches `window`).
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);

export type LocationPinProps = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  draggable?: boolean;
};

export function LocationPin({
  lat,
  lng,
  onChange,
  height = 280,
  draggable = true,
}: LocationPinProps) {
  const markerRef = useRef<L.Marker | null>(null);

  // Once on mount, fix the default Leaflet icon paths (Next bundles them as URLs)
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const icon = L.icon({
        iconUrl: (await import("leaflet/dist/images/marker-icon.png")).default.src,
        iconRetinaUrl: (await import("leaflet/dist/images/marker-icon-2x.png")).default.src,
        shadowUrl: (await import("leaflet/dist/images/marker-shadow.png")).default.src,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      L.Marker.prototype.options.icon = icon;
    })();
  }, []);

  const center: LatLngExpression =
    lat !== null && lng !== null ? [lat, lng] : VERMONT_CENTER;

  return (
    <div style={{ height }} className="overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
      <MapContainer
        center={center}
        zoom={lat !== null && lng !== null ? 15 : 8}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {lat !== null && lng !== null ? (
          <Marker
            position={[lat, lng]}
            draggable={draggable}
            eventHandlers={{
              dragend: (e) => {
                const m = e.target as L.Marker;
                const pos = m.getLatLng();
                onChange(pos.lat, pos.lng);
              },
            }}
            ref={(m) => {
              markerRef.current = m as L.Marker | null;
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
