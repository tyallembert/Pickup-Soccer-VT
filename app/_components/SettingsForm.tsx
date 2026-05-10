"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/app/_lib/cn";
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-emerald-900";

export function SettingsForm({
  initial,
  onSave,
}: {
  initial: SettingsFormValues;
  onSave: (values: SettingsFormValues) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const update = (patch: Partial<SettingsFormValues>) => setV((x) => ({ ...x, ...patch }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await onSave(v);
          setSavedAt(Date.now());
        } finally {
          setPending(false);
        }
      }}
    >
      <Field label="Field or park name">
        <input
          value={v.name}
          onChange={(e) => update({ name: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field label="Town">
        <input
          value={v.town}
          onChange={(e) => update({ town: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field label="Address" hint="Tab out to re-geocode the pin.">
        <input
          value={v.address}
          onChange={(e) => update({ address: e.target.value })}
          onBlur={async () => {
            const geo = await geocodeAddress(v.address);
            if (geo) update({ lat: geo.lat, lng: geo.lng });
          }}
          className={inputCls}
        />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Map pin
        </p>
        <LocationPin
          lat={v.lat}
          lng={v.lng}
          onChange={(lat, lng) => update({ lat, lng })}
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          Drag the pin or click the map to fine-tune the spot.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Day of week
        </p>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((d, i) => {
            const active = v.dayOfWeek === i;
            return (
              <button
                type="button"
                key={d}
                onClick={() => update({ dayOfWeek: i })}
                className={cn(
                  "rounded-lg border py-2 text-sm font-semibold transition",
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
                )}
                aria-pressed={active}
                aria-label={d}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Start time">
        <input
          type="time"
          value={v.startTime}
          onChange={(e) => update({ startTime: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field label="Details" hint="Style of play, donation, gear, parking, etc. Markdown OK.">
        <textarea
          rows={6}
          value={v.details}
          onChange={(e) => update({ details: e.target.value })}
          className={`${inputCls} font-mono`}
        />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-[1.02] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {savedAt && Date.now() - savedAt < 4000 ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
