"use client";

import dynamic from "next/dynamic";

export type { MapLocation } from "./LocationsMap.client";

export const LocationsMap = dynamic(() => import("./LocationsMap.client"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 480 }} className="rounded-md bg-zinc-100 dark:bg-zinc-900" />
  ),
});
