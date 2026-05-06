"use client";

import { useState } from "react";
import { LocationPin } from "./LocationPin";
import { geocodeAddress } from "../_lib/geocode";

export type SettingsFormValues = {
  name: string;
  town: string;
  address: string;
  lat: number;
  lng: number;
  dayOfWeek: number;
  startTime: string;
  details: string;
};

export function SettingsForm({
  initial,
  onSave,
}: {
  initial: SettingsFormValues;
  onSave: (values: SettingsFormValues) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await onSave(v);
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">Schedule settings</h2>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Town
        <input value={v.town} onChange={(e) => setV({ ...v, town: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input value={v.address}
          onChange={(e) => setV({ ...v, address: e.target.value })}
          onBlur={async () => {
            const geo = await geocodeAddress(v.address);
            if (geo) setV({ ...v, lat: geo.lat, lng: geo.lng });
          }}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <LocationPin lat={v.lat} lng={v.lng} onChange={(lat, lng) => setV({ ...v, lat, lng })} />
      <label className="flex flex-col gap-1 text-sm">
        Day of week
        <select value={v.dayOfWeek} onChange={(e) => setV({ ...v, dayOfWeek: parseInt(e.target.value, 10) })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label, i) => (
            <option key={i} value={i}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start time
        <input type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Details (markdown)
        <textarea rows={6} value={v.details} onChange={(e) => setV({ ...v, details: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
