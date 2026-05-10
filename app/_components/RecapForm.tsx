"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Thermometer,
  Users,
  Wind,
} from "lucide-react";
import { cn } from "@/app/_lib/cn";
import { formatDateLong } from "../_lib/format";

const CONDITIONS = [
  { value: "sunny", label: "Sunny", icon: Sun },
  { value: "cloudy", label: "Cloudy", icon: Cloud },
  { value: "rainy", label: "Rainy", icon: CloudRain },
  { value: "snowy", label: "Snowy", icon: CloudSnow },
  { value: "windy", label: "Windy", icon: Wind },
  { value: "cold", label: "Cold", icon: Thermometer },
] as const;
type Condition = (typeof CONDITIONS)[number]["value"];

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-emerald-900";

export function RecapForm({
  date,
  initial,
  onSave,
}: {
  date: string | null;
  initial: {
    turnout?: number;
    weatherCondition?: Condition;
    weather?: string;
    recapNotes?: string;
  };
  onSave: (values: {
    turnout: number | null;
    weatherCondition: Condition | null;
    weather: string | null;
    recapNotes: string | null;
  }) => Promise<void>;
}) {
  const [v, setV] = useState({
    turnout: initial.turnout ?? "",
    weatherCondition: initial.weatherCondition ?? ("" as Condition | ""),
    weather: initial.weather ?? "",
    recapNotes: initial.recapNotes ?? "",
  });
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await onSave({
            turnout: v.turnout === "" ? null : Number(v.turnout),
            weatherCondition:
              v.weatherCondition === "" ? null : v.weatherCondition,
            weather: v.weather || null,
            recapNotes: v.recapNotes || null,
          });
          setSavedAt(Date.now());
        } finally {
          setPending(false);
        }
      }}
    >
      {/* Session-date chip */}
      {date ? (
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDateLong(date)}
        </div>
      ) : null}

      {/* Turnout */}
      <Field label="Turnout" hint="How many players showed up?">
        <div className="relative">
          <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={v.turnout}
            onChange={(e) => setV({ ...v, turnout: e.target.value })}
            className={`${inputCls} w-full pl-9`}
          />
        </div>
      </Field>

      {/* Weather condition picker */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Weather
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {CONDITIONS.map((c) => {
            const active = v.weatherCondition === c.value;
            const Icon = c.icon;
            return (
              <button
                type="button"
                key={c.value}
                onClick={() =>
                  setV({
                    ...v,
                    weatherCondition: active ? "" : c.value,
                  })
                }
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition",
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-emerald-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                )}
              >
                <Icon className="h-4 w-4" />
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          Tap again to clear.
        </p>
      </div>

      <Field label="Weather notes" hint="Optional free-form detail (humid, gusty, etc).">
        <input
          value={v.weather}
          onChange={(e) => setV({ ...v, weather: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field
        label="Recap"
        hint="Anything memorable — turnout vibes, score, callouts. Markdown OK."
      >
        <textarea
          rows={5}
          value={v.recapNotes}
          onChange={(e) => setV({ ...v, recapNotes: e.target.value })}
          className={`${inputCls} font-mono`}
        />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-[1.02] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save recap"}
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
      <span className="font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
