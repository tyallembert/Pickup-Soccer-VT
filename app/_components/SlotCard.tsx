"use client";

import { Timer, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/app/_lib/cn";
import { Input } from "@/app/_components/ui/input";
import { DayPicker } from "@/app/_components/DayPicker";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/_components/ui/tooltip";

export type ScheduleRow = {
  _id?: Id<"locationSchedules">;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
};

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

// One weekly slot: day-of-week picker + start/end time inputs + remove button.
// Shared between the submit wizard's "When" step and the owner/admin edit
// page so both surfaces render slots identically. Validation and save flow
// stay with the parent — this card only renders.
export function SlotCard({
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
    <article className="slot-card group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 18px, #064e3b 18px 19px)",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700"
      />

      <div className="relative flex flex-col gap-2.5 px-3 py-2.5 pl-4">
        {/* Header (numbered pill + remove) only when there's more than one
            slot. With a single slot, the day + time speak for themselves —
            the number "1" of nothing reads as jargon. */}
        {canRemove ? (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-black tabular-nums text-white shadow-[0_2px_6px_rgba(16,185,129,0.4)]">
              {slotNumber}
            </span>
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
              <TooltipContent>Remove this time</TooltipContent>
            </Tooltip>
          </div>
        ) : null}

        <DayPicker
          value={row.dayOfWeek}
          onChange={(v) => onPatch({ dayOfWeek: v })}
          ariaLabel={`Day for slot ${slotNumber}`}
        />

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

export function validateScheduleRow(r: ScheduleRow): string | null {
  if (!r.startTime) return "Pick a start time.";
  if (r.endTime && r.endTime <= r.startTime) {
    return "End time must be after start time.";
  }
  return null;
}
