"use client";

import { useState } from "react";
import { formatDateLong, formatDayLong } from "../_lib/format";

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

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await onSave({
          isOn: next.isOn,
          reason: next.isOn ? undefined : next.reason || undefined,
        });
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">
        {formatDayLong(dayOfWeek)}, {formatDateLong(date)}
      </h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={next.isOn} onChange={(e) => setNext({ ...next, isOn: e.target.checked })} className="h-4 w-4" />
        Soccer is ON
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Reason (only used if OFF)
        <textarea rows={2} value={next.reason} onChange={(e) => setNext({ ...next, reason: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Saving…" : "Save status"}
      </button>
    </form>
  );
}
