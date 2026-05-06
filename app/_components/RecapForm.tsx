"use client";

import { useState } from "react";
import { formatDateLong } from "../_lib/format";

const CONDITIONS = ["sunny","cloudy","rainy","snowy","windy","cold"] as const;
type Condition = (typeof CONDITIONS)[number];

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

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await onSave({
          turnout: v.turnout === "" ? null : Number(v.turnout),
          weatherCondition: v.weatherCondition === "" ? null : v.weatherCondition,
          weather: v.weather || null,
          recapNotes: v.recapNotes || null,
        });
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">
        Last session recap
        {date ? <span className="ml-2 text-sm font-normal text-zinc-500">({formatDateLong(date)})</span> : null}
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        Turnout
        <input type="number" min={0} value={v.turnout}
          onChange={(e) => setV({ ...v, turnout: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">Weather condition</legend>
        <label className="flex items-center gap-1">
          <input type="radio" name="cond" value="" checked={v.weatherCondition === ""}
            onChange={() => setV({ ...v, weatherCondition: "" })} />
          (none)
        </label>
        {CONDITIONS.map((c) => (
          <label key={c} className="flex items-center gap-1">
            <input type="radio" name="cond" value={c} checked={v.weatherCondition === c}
              onChange={() => setV({ ...v, weatherCondition: c })} />
            {c}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Weather (free text)
        <input value={v.weather} onChange={(e) => setV({ ...v, weather: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes (markdown)
        <textarea rows={4} value={v.recapNotes} onChange={(e) => setV({ ...v, recapNotes: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Saving…" : "Save recap"}
      </button>
    </form>
  );
}
