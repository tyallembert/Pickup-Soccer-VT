"use client";

import dynamic from "next/dynamic";

export type { LocationPinProps } from "./LocationPin.client";

export const LocationPin = dynamic(() => import("./LocationPin.client"), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 280 }}
      className="overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
    />
  ),
});
