"use client";

import { useState } from "react";
import { CalendarClock, Check, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/app/_lib/cn";
import { formatDateLong, formatDayLong } from "../_lib/format";
import posthog from "posthog-js";

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-emerald-900";

export function StatusForm({
  date,
  isOn,
  reason,
  dayOfWeek,
  onSave,
}: {
  date: string;
  isOn: boolean;
  reason: string | undefined;
  dayOfWeek: number;
  onSave: (next: { isOn: boolean; reason?: string }) => Promise<void>;
}) {
  const [next, setNext] = useState({ isOn, reason: reason ?? "" });
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          const payload = {
            isOn: next.isOn,
            reason: next.isOn ? undefined : next.reason || undefined,
          };
          await onSave(payload);
          posthog.capture("game_status_saved", {
            is_on: next.isOn,
            date,
            has_reason: !next.isOn && !!next.reason,
          });
          setSavedAt(Date.now());
        } finally {
          setPending(false);
        }
      }}
    >
      {/* Game-day chip */}
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CalendarClock className="h-3.5 w-3.5" />
        {formatDayLong(dayOfWeek)}, {formatDateLong(date)}
      </div>

      {/* On / off pill toggle */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Game-day status
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-1.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <button
            type="button"
            onClick={() => setNext({ ...next, isOn: true })}
            aria-pressed={next.isOn}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition",
              next.isOn
                ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.45)]"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            Game on
          </button>
          <button
            type="button"
            onClick={() => setNext({ ...next, isOn: false })}
            aria-pressed={!next.isOn}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition",
              !next.isOn
                ? "bg-rose-500 text-white shadow-[0_4px_12px_rgba(225,29,72,0.45)]"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            <XCircle className="h-4 w-4" />
            Game off
          </button>
        </div>
      </div>

      {/* Reason — only relevant when off */}
      {!next.isOn ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Why is it off?
          </span>
          <textarea
            rows={3}
            value={next.reason}
            placeholder="Field flooded, too cold, holiday — players will see this on the map."
            onChange={(e) => setNext({ ...next, reason: e.target.value })}
            className={inputCls}
          />
          <span className="text-xs text-zinc-500">
            Optional. Helps regulars know what to expect.
          </span>
        </label>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-[1.02] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save status"}
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
