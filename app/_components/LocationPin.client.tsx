"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { LocateFixed, MapPin, ZoomIn, ZoomOut } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import { VERMONT_LEAFLET_MAX_BOUNDS } from "../_lib/vermont";

const VT_CENTER: [number, number] = [43.95, -72.65];

export type LocationPinProps = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  draggable?: boolean;
};

export default function LocationPinClient({
  lat,
  lng,
  onChange,
  height = 280,
  draggable = true,
}: LocationPinProps) {
  const [iconReady, setIconReady] = useState(false);
  const [icon, setIcon] = useState<L.DivIcon | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      setIcon(
        new L.DivIcon({
          className: "vt-pin-wrapper",
          html: `<div class="vt-pin" aria-hidden="true"></div>`,
          iconSize: [28, 38],
          iconAnchor: [14, 38],
        }),
      );
      setIconReady(true);
    })();
  }, []);

  // Pan/fly to the pin when lat/lng change significantly (i.e., from
  // geocoding or programmatic update). Small drag deltas are ignored so
  // the map doesn't jitter while the user is fine-tuning the marker.
  useEffect(() => {
    if (lat == null || lng == null) {
      prevPosRef.current = null;
      return;
    }
    const prev = prevPosRef.current;
    prevPosRef.current = { lat, lng };
    const map = mapRef.current;
    if (!map) return;
    const isFirstPlace = !prev;
    const dist = prev
      ? Math.hypot(prev.lat - lat, prev.lng - lng)
      : Number.POSITIVE_INFINITY;
    // ~0.005° ≈ 500m — bigger than any drag fine-tune, smaller than
    // a town hop.
    if (isFirstPlace || dist > 0.005) {
      map.flyTo([lat, lng], 15, { duration: 0.8 });
    }
  }, [lat, lng]);

  if (!iconReady) {
    return (
      <div
        style={{ height }}
        className="overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
      />
    );
  }

  const center: LatLngExpression =
    lat !== null && lng !== null ? [lat, lng] : VT_CENTER;
  const initialZoom = lat !== null && lng !== null ? 15 : 7;

  const onZoomIn = () => mapRef.current?.zoomIn();
  const onZoomOut = () => mapRef.current?.zoomOut();
  const onReset = () =>
    lat !== null && lng !== null
      ? mapRef.current?.setView([lat, lng], 15, { animate: true })
      : mapRef.current?.setView(VT_CENTER, 7, { animate: true });

  const hasPin = lat !== null && lng !== null;

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar — above the map so it's never hidden */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {hasPin ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <MapPin className="h-3.5 w-3.5" />
              Pin set — drag, tap elsewhere, or use the controls →
            </span>
          ) : (
            "Tap the map to drop a pin"
          )}
        </p>
        <div
          className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          role="group"
          aria-label="Map controls"
        >
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-emerald-100 hover:text-emerald-800 active:scale-95 dark:text-zinc-200 dark:hover:bg-emerald-900/50"
          >
            <ZoomIn size={18} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-emerald-100 hover:text-emerald-800 active:scale-95 dark:text-zinc-200 dark:hover:bg-emerald-900/50"
          >
            <ZoomOut size={18} strokeWidth={2.25} />
          </button>
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
          <button
            type="button"
            onClick={onReset}
            aria-label="Recenter on pin"
            title="Recenter on pin"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-emerald-100 hover:text-emerald-800 active:scale-95 dark:text-zinc-200 dark:hover:bg-emerald-900/50"
          >
            <LocateFixed size={18} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Map */}
      <div
        style={{ height }}
        className="relative overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700"
      >
        <MapContainer
          ref={mapRef as React.Ref<LeafletMap>}
          center={center}
          zoom={initialZoom}
          minZoom={6}
          maxZoom={18}
          maxBounds={VERMONT_LEAFLET_MAX_BOUNDS}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          scrollWheelZoom={false}
          style={{
            height: "100%",
            width: "100%",
            background: "#f6f5ee",
            cursor: hasPin ? undefined : "crosshair",
          }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <ClickToPlace onPlace={onChange} />
          {hasPin && icon ? (
            <Marker
              position={[lat!, lng!]}
              icon={icon}
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
    </div>
  );
}

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
