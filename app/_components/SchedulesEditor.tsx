"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleDot, Save, X } from "lucide-react";
import { cn } from "@/app/_lib/cn";
import {
  validateScheduleRow,
  type ScheduleRow,
} from "@/app/_components/SlotCard";
import { SlotsSection } from "@/app/_components/SlotsSection";

export type { ScheduleRow };

function rowsEqual(a: ScheduleRow[], b: ScheduleRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i]._id !== b[i]._id ||
      a[i].dayOfWeek !== b[i].dayOfWeek ||
      a[i].startTime !== b[i].startTime ||
      (a[i].endTime ?? "") !== (b[i].endTime ?? "")
    ) {
      return false;
    }
  }
  return true;
}

export function SchedulesEditor({
  initial,
  onSave,
}: {
  initial: ScheduleRow[];
  onSave: (rows: ScheduleRow[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<ScheduleRow[]>(initial);
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync from live Convex updates when the upstream snapshot changes.
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  const dirty = useMemo(() => !rowsEqual(rows, initial), [rows, initial]);
  const firstError = useMemo(() => {
    for (let i = 0; i < rows.length; i++) {
      const err = validateScheduleRow(rows[i]);
      if (err) return `Slot ${i + 1} — ${err}`;
    }
    if (rows.length < 1) return "A field needs at least one time slot.";
    return null;
  }, [rows]);

  const patchRow = (i: number, patch: Partial<ScheduleRow>) =>
    setRows((rs) => rs.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => {
    if (rows.length === 1) return;
    setRows((rs) => rs.filter((_, j) => j !== i));
  };
  const addRow = () =>
    setRows((rs) => [...rs, { dayOfWeek: 1, startTime: "18:00" }]);

  async function handleSave() {
    setError(null);
    if (firstError) {
      setError(firstError);
      return;
    }
    setPending(true);
    try {
      await onSave(rows);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  }

  const showSaved = savedAt !== null && Date.now() - savedAt < 4000;

  return (
    <div className="flex flex-col gap-3">
      <SlotsSection
        rows={rows}
        onPatch={patchRow}
        onRemove={removeRow}
        onAdd={addRow}
        headerSlot={
          dirty ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <CircleDot className="h-2 w-2" />
              Unsaved
            </span>
          ) : null
        }
      />

      {error ? (
        <p
          role="alert"
          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <X className="h-3 w-3" />
          {error}
        </p>
      ) : null}

      <footer className="flex items-center justify-end gap-3 pt-1">
        {showSaved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
            Saved
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty || firstError !== null}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition active:scale-[0.98]",
            !dirty || firstError !== null
              ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500"
              : "bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-sm shadow-emerald-600/30 hover:scale-[1.02] hover:shadow-md disabled:opacity-60",
          )}
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Saving
            </>
          ) : (
            <>
              <Save className="h-3 w-3" />
              Save
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
