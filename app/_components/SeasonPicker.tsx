"use client";

import { useId, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { cn } from "@/app/_lib/cn";
import { formatMonth, formatSeason } from "@/app/_lib/format";
import {
  daysInMonth,
  type Season,
  type SeasonBoundary,
} from "@/convex/lib/season";

// Turning "Seasonal" on starts from the most common outdoor season.
const DEFAULT_SEASON: Season = { start: { month: 4 }, end: { month: 10 } };

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// February offers 29 for leap years, but a default end day is the 28th so
// "through February" doesn't read as a date that skips most years.
function lastDay(month: number) {
  return month === 2 ? 28 : daysInMonth(month);
}

function withMonth(b: SeasonBoundary, month: number): SeasonBoundary {
  if (b.day === undefined) return { month };
  return { month, day: Math.min(b.day, daysInMonth(month)) };
}

/**
 * Year-round or seasonal, for the whole field. A season is a start and end
 * month (whole months), or exact days when "Exact days" is checked. It
 * repeats every year and may wrap the new year (October → April).
 */
export function SeasonPicker({
  value,
  onChange,
}: {
  value: Season | null;
  onChange: (next: Season | null) => void;
}) {
  // Unchecking "Seasonal" and checking it again brings the last season back.
  const [remembered, setRemembered] = useState<Season>(value ?? DEFAULT_SEASON);
  const set = (next: Season) => {
    setRemembered(next);
    onChange(next);
  };
  const exact = value
    ? value.start.day !== undefined || value.end.day !== undefined
    : false;
  const wraps = value
    ? value.start.month > value.end.month ||
      (value.start.month === value.end.month &&
        (value.start.day ?? 1) > (value.end.day ?? 31))
    : false;

  return (
    <section className="flex flex-col gap-3 border-t border-dashed border-emerald-200/70 pt-3.5 dark:border-emerald-900/50">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
        <CalendarRange className="h-3 w-3" />
        Season
      </p>

      <CheckRow
        checked={value !== null}
        onChange={(on) => onChange(on ? remembered : null)}
        label="Seasonal"
        hint={
          value
            ? "Only runs part of the year."
            : "Runs year-round. Check this if it stops for part of the year."
        }
      />

      {value ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid grid-cols-2 gap-3">
            <BoundaryField
              label="Starts"
              boundary={value.start}
              exact={exact}
              onChange={(start) => set({ ...value, start })}
            />
            <BoundaryField
              label="Ends"
              boundary={value.end}
              exact={exact}
              onChange={(end) => set({ ...value, end })}
            />
          </div>

          <CheckRow
            checked={exact}
            onChange={(on) =>
              set(
                on
                  ? {
                      start: { month: value.start.month, day: value.start.day ?? 1 },
                      end: {
                        month: value.end.month,
                        day: value.end.day ?? lastDay(value.end.month),
                      },
                    }
                  : {
                      start: { month: value.start.month },
                      end: { month: value.end.month },
                    },
              )
            }
            label="Exact days"
            hint="Pick the day it starts and ends, not just the month."
          />

          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            Runs {formatSeason(value)} every year
            {wraps ? ", across the new year" : ""}.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl py-1 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-emerald-600"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        <span className="text-xs leading-snug text-zinc-500 dark:text-zinc-400">
          {hint}
        </span>
      </span>
    </label>
  );
}

function BoundaryField({
  label,
  boundary,
  exact,
  onChange,
}: {
  label: string;
  boundary: SeasonBoundary;
  exact: boolean;
  onChange: (next: SeasonBoundary) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`${id}-month`}
        className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300"
      >
        {label}
      </label>
      <NativeSelect
        id={`${id}-month`}
        value={boundary.month}
        onChange={(month) => onChange(withMonth(boundary, month))}
        options={MONTHS.map((m) => ({ value: m, label: formatMonth(m) }))}
      />
      {exact ? (
        <NativeSelect
          aria-label={`${label} day`}
          value={boundary.day ?? 1}
          onChange={(day) => onChange({ month: boundary.month, day })}
          options={Array.from({ length: daysInMonth(boundary.month) }, (_, i) => ({
            value: i + 1,
            label: String(i + 1),
          }))}
        />
      ) : null}
    </div>
  );
}

// Native, so phones show their own picker wheel.
function NativeSelect({
  id,
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number;
  onChange: (next: number) => void;
  options: { value: number; label: string }[];
  "aria-label"?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={cn(
          "h-11 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-zinc-300 bg-white pr-8 pl-3 text-sm font-semibold text-zinc-900 shadow-sm transition",
          "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none",
          "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
      />
    </div>
  );
}
