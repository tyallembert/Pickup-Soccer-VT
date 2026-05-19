"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import type { Map as LeafletMap } from "leaflet";
import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import gsap from "gsap";
import { formatDayPlural, formatTimeRange } from "../_lib/format";
import { VERMONT_LEAFLET_MAX_BOUNDS, VERMONT_RING_LATLNG } from "../_lib/vermont";

export type MapSchedule = {
  _id: string;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
  thisWeek: { isOn: boolean };
};

export type MapLocation = {
  _id: string;
  name: string;
  town: string;
  lat: number;
  lng: number;
  schedules: MapSchedule[];
};

const VT_CENTER: [number, number] = [43.95, -72.65];
const INITIAL_ZOOM = 8;
const MIN_ZOOM = 8;
const MAX_ZOOM = 16;

// Wide rectangle, a Vermont-shaped hole punched through it.
const MASK_OUTER: [number, number][] = [
  [38.0, -80.0],
  [38.0, -65.0],
  [49.0, -65.0],
  [49.0, -80.0],
  [38.0, -80.0],
];

export default function LocationsMapClient({
  locations,
  chromeless = false,
  height = 520,
}: {
  locations: MapLocation[];
  chromeless?: boolean;
  height?: number;
}) {
  const [iconReady, setIconReady] = useState(false);
  const [customIcon, setCustomIcon] = useState<L.DivIcon | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Build a custom emerald DivIcon (CSS-driven via the .vt-pin class).
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const icon = new L.DivIcon({
        className: "vt-pin-wrapper",
        html: `<div class="vt-pin" aria-hidden="true"></div>`,
        iconSize: [28, 38],
        iconAnchor: [14, 38],
        popupAnchor: [0, -34],
      });
      setCustomIcon(icon);
      setIconReady(true);
    })();
  }, []);

  // Marker fade-in once the cluster has rendered.
  useEffect(() => {
    if (!iconReady || !wrapperRef.current) return;
    const raf = requestAnimationFrame(() => {
      const icons = wrapperRef.current?.querySelectorAll(".vt-pin");
      if (icons && icons.length > 0) {
        gsap.from(icons, {
          scale: 0,
          opacity: 0,
          duration: 0.35,
          ease: "back.out(2)",
          stagger: 0.02,
          transformOrigin: "50% 100%",
        });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [iconReady, locations.length]);

  if (!iconReady) {
    return (
      <div
        style={{ height }}
        className={
          chromeless
            ? "bg-zinc-100 dark:bg-zinc-900"
            : "rounded-2xl bg-zinc-100 dark:bg-zinc-900"
        }
      />
    );
  }

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleReset = () =>
    mapRef.current?.setView(VT_CENTER, INITIAL_ZOOM, { animate: true });

  return (
    <div
      ref={wrapperRef}
      className={
        chromeless
          ? "relative overflow-hidden"
          : "relative overflow-hidden rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800"
      }
      style={{ height }}
    >
      {/* Custom map toolbar */}
      <div
        className="absolute right-3 top-3 z-[400] flex flex-col gap-1 rounded-full border border-zinc-200 bg-white/85 p-1 shadow-md backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80"
        role="group"
        aria-label="Map controls"
      >
        <ToolbarButton onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
          <ZoomIn size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
          <ZoomOut size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={handleReset} title="Reset view" aria-label="Reset view">
          <LocateFixed size={16} />
        </ToolbarButton>
      </div>

      <MapContainer
        ref={mapRef as React.Ref<LeafletMap>}
        center={VT_CENTER}
        zoom={INITIAL_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={VERMONT_LEAFLET_MAX_BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        scrollWheelZoom
        worldCopyJump={false}
        style={{ height: "100%", width: "100%", background: "#f6f5ee" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        />

        {/* Subtle gray-out outside Vermont */}
        <Polygon
          positions={[MASK_OUTER, VERMONT_RING_LATLNG]}
          pathOptions={{
            stroke: false,
            fillColor: "#1f2937",
            fillOpacity: 0.32,
            interactive: false,
          }}
        />

        {/* Vermont border */}
        <Polyline
          positions={VERMONT_RING_LATLNG}
          pathOptions={{
            color: "#10b981",
            weight: 2.5,
            opacity: 0.95,
            interactive: false,
          }}
        />

        <MarkerClusterGroup chunkedLoading>
          {customIcon
            ? locations.map((l) => (
                <Marker key={l._id} position={[l.lat, l.lng]} icon={customIcon}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-zinc-900">{l.name}</div>
                      <div className="text-xs text-zinc-600">{l.town}</div>
                      <ul className="m-0 list-none p-0 text-xs text-emerald-700">
                        {l.schedules.map((s) => (
                          <li key={s._id} className="flex items-center gap-1.5">
                            <span
                              className={
                                s.thisWeek.isOn
                                  ? "inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                                  : "inline-block h-1.5 w-1.5 rounded-full bg-rose-500"
                              }
                            />
                            {formatDayPlural(s.dayOfWeek)} at {formatTimeRange(s.startTime, s.endTime)}
                          </li>
                        ))}
                      </ul>
                      <a
                        href={`/locations/${l._id}`}
                        className="mt-1 inline-block text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                      >
                        View details →
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))
            : null}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

function ToolbarButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 transition hover:bg-emerald-100 hover:text-emerald-800 active:scale-95 dark:text-zinc-200 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-200"
    >
      {children}
    </button>
  );
}
