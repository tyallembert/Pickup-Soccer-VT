"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { VERMONT_CENTER } from "../_lib/geocode";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const MarkerClusterGroup = dynamic(() => import("react-leaflet-cluster"), { ssr: false });

import { formatDayPlural, formatStartTime } from "../_lib/format";

export type MapLocation = {
  _id: string;
  name: string;
  town: string;
  lat: number;
  lng: number;
  dayOfWeek: number;
  startTime: string;
};

export function LocationsMap({ locations }: { locations: MapLocation[] }) {
  // Defer the icon-fix to client mount (same pattern as LocationPin).
  const [iconReady, setIconReady] = useState(false);
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
      setIconReady(true);
    })();
  }, []);

  if (!iconReady) {
    return <div style={{ height: 480 }} className="rounded-md bg-zinc-100 dark:bg-zinc-900" />;
  }

  return (
    <div style={{ height: 480 }} className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
      <MapContainer
        center={VERMONT_CENTER}
        zoom={8}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup>
          {locations.map((l) => (
            <Marker key={l._id} position={[l.lat, l.lng]}>
              <Popup>
                <strong>{l.name}</strong>
                <div>{l.town}</div>
                <div>
                  {formatDayPlural(l.dayOfWeek)} at {formatStartTime(l.startTime)}
                </div>
                <a href={`/locations/${l._id}`} className="underline">View details</a>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
