"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CalendarRange, Check, CircleDot, Plus, Save, X } from "lucide-react";
import { cn } from "@/app/_lib/cn";
import { TooltipProvider } from "@/app/_components/ui/tooltip";
import {
  SlotCard,
  validateScheduleRow,
  type ScheduleRow,
} from "@/app/_components/SlotCard";

export type { ScheduleRow };

function rowKey(r: ScheduleRow, fallback: number): string {
  return r._id ?? `new-${fallback}`;
}

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
  const listRef = useRef<HTMLDivElement>(null);

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

  useGSAP(
    () => {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll(".slot-card");
      if (items.length === 0) return;
      gsap.from(items, {
        y: 14,
        opacity: 0,
        duration: 0.42,
        ease: "power3.out",
        stagger: 0.07,
        clearProps: "all",
      });
    },
    { scope: listRef, dependencies: [rows.length] },
  );

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
    <TooltipProvider delayDuration={250}>
      <div className="flex flex-col gap-3.5">
        {/* Section header */}
        <header className="flex items-center justify-between gap-3 border-b border-dashed border-emerald-200/70 pb-2.5 dark:border-emerald-900/50">
          <div className="flex items-baseline gap-2">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
              <CalendarRange className="h-3 w-3" />
              Game times
            </p>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {rows.length === 1 ? "1 slot" : `${rows.length} slots`}
            </span>
            {dirty ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <CircleDot className="h-2 w-2" />
                Unsaved
              </span>
            ) : null}
          </div>
        </header>

        {error ? (
          <p
            role="alert"
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
          >
            <X className="h-3 w-3" />
            {error}
          </p>
        ) : null}

        {/* Slot list */}
        <div ref={listRef} className="flex flex-col gap-2.5">
          {rows.map((row, i) => (
            <SlotCard
              key={rowKey(row, i)}
              row={row}
              index={i}
              canRemove={rows.length > 1}
              onPatch={(p) => patchRow(i, p)}
              onRemove={() => removeRow(i)}
            />
          ))}

          {/* Add-slot ghost card */}
          <button
            type="button"
            onClick={addRow}
            className="group relative flex h-10 items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed border-emerald-300/80 bg-emerald-50/40 text-xs font-bold uppercase tracking-wider text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/50"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0 22px, #064e3b 22px 23px)",
              }}
            />
            <Plus className="relative h-3.5 w-3.5" strokeWidth={3} />
            <span className="relative">Add another time</span>
          </button>
        </div>

        {/* Save footer */}
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
    </TooltipProvider>
  );
}

