"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  CalendarRange,
  Check,
  CircleDot,
  Plus,
  Save,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/app/_lib/cn";
import { Input } from "@/app/_components/ui/input";
import { DayPicker } from "@/app/_components/DayPicker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/_components/ui/tooltip";

export type ScheduleRow = {
  _id?: Id<"locationSchedules">;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
};

function rowKey(r: ScheduleRow, fallback: number): string {
  return r._id ?? `new-${fallback}`;
}

function parseMinutes(t: string | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatDuration(start: string, end: string | undefined): string | null {
  const s = parseMinutes(start);
  const e = parseMinutes(end);
  if (s === null || e === null) return null;
  if (e <= s) return null;
  const mins = e - s;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function validateRow(r: ScheduleRow): string | null {
  if (!r.startTime) return "Pick a kick-off time.";
  if (r.endTime && r.endTime <= r.startTime) {
    return "Full-time must be after kick-off.";
  }
  return null;
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
      const err = validateRow(rows[i]);
      if (err) return `Slot ${i + 1} — ${err}`;
    }
    if (rows.length < 1) return "A field needs at least one time slot.";
    return null;
  }, [rows]);

  useGSAP(
    () => {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll(".fixture-card");
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
            <FixtureCard
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

function FixtureCard({
  row,
  index,
  canRemove,
  onPatch,
  onRemove,
}: {
  row: ScheduleRow;
  index: number;
  canRemove: boolean;
  onPatch: (patch: Partial<ScheduleRow>) => void;
  onRemove: () => void;
}) {
  const duration = formatDuration(row.startTime, row.endTime);
  const slotNumber = index + 1;

  return (
    <article className="fixture-card group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      {/* Pitch watermark */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 18px, #064e3b 18px 19px)",
        }}
      />

      {/* Left stripe */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700"
      />

      <div className="relative flex flex-col gap-2.5 px-3 py-2.5 pl-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-black tabular-nums text-white shadow-[0_2px_6px_rgba(16,185,129,0.4)]">
            {slotNumber}
          </span>

          {canRemove ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRemove}
                  aria-label={`Remove slot ${slotNumber}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Remove slot</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label="Cannot remove the only slot"
                  className="inline-flex h-6 w-6 cursor-not-allowed items-center justify-center rounded-full text-zinc-300 dark:text-zinc-700"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Needs ≥1 slot</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Day selector — single indicator slides between days with a bounce */}
        <DayPicker
          value={row.dayOfWeek}
          onChange={(v) => onPatch({ dayOfWeek: v })}
          ariaLabel={`Day for slot ${slotNumber}`}
        />

        {/* Time block */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TimeColumn
            label="Start"
            value={row.startTime}
            onChange={(v) => onPatch({ startTime: v })}
          />
          <span
            className={cn(
              "mt-3 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest tabular-nums transition",
              duration
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600",
            )}
          >
            <Timer className="h-2 w-2" />
            {duration ?? "—"}
          </span>
          <TimeColumn
            label="End"
            value={row.endTime ?? ""}
            onChange={(v) => onPatch({ endTime: v || undefined })}
            optional
          />
        </div>
      </div>
    </article>
  );
}

function TimeColumn({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
        {label}
        {optional ? (
          <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400">
            optional
          </span>
        ) : null}
      </span>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-2 text-center text-xs font-bold tabular-nums"
      />
    </label>
  );
}
