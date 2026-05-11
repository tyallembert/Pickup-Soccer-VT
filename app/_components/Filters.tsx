"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  Crosshair,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/app/_lib/cn";
import posthog from "posthog-js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";

const DAYS = [
  { v: "0", short: "S", long: "Sun", full: "Sunday" },
  { v: "1", short: "M", long: "Mon", full: "Monday" },
  { v: "2", short: "T", long: "Tue", full: "Tuesday" },
  { v: "3", short: "W", long: "Wed", full: "Wednesday" },
  { v: "4", short: "T", long: "Thu", full: "Thursday" },
  { v: "5", short: "F", long: "Fri", full: "Friday" },
  { v: "6", short: "S", long: "Sat", full: "Saturday" },
] as const;

export function Filters({
  search,
  town,
  dayOfWeek,
  onChange,
  resultCount,
  totalCount,
}: {
  search: string;
  town: string;
  dayOfWeek: string;
  onChange: (next: { search: string; town: string; dayOfWeek: string }) => void;
  resultCount?: number;
  totalCount?: number;
}) {
  const towns = useQuery(api.public.distinctTowns) ?? [];
  const [townOpen, setTownOpen] = useState(false);

  const hasFilters = !!(search || town || dayOfWeek);
  const reset = () => onChange({ search: "", town: "", dayOfWeek: "" });
  const dayLabel = DAYS.find((d) => d.v === dayOfWeek)?.full;

  const showingFiltered =
    typeof resultCount === "number" &&
    typeof totalCount === "number" &&
    hasFilters &&
    resultCount !== totalCount;

  return (
    <div className="relative">
      {/* faint pitch-line texture across the rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 38px, #064e3b 38px 39px)",
        }}
      />

      <div className="relative flex flex-col gap-4 px-5 py-5 sm:px-6">
        {/* Header strip: eyebrow + result counter */}
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300">
              <Crosshair className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-800 dark:text-emerald-300">
              Find a field
            </span>
          </div>

          <ResultBadge
            count={resultCount}
            total={totalCount}
            filtered={showingFiltered}
          />
        </div>

        {/* Big search input */}
        <div className="group relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400" />
          <input
            value={search}
            onChange={(e) =>
              onChange({ search: e.target.value, town, dayOfWeek })
            }
            onBlur={(e) => {
              if (e.target.value) {
                posthog.capture("directory_filtered", { filter_type: "search" });
              }
            }}
            placeholder="Search by field name, town, or details…"
            aria-label="Search fields"
            className={cn(
              "w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-12 py-3 text-[15px] font-medium text-zinc-900 shadow-inner shadow-zinc-200/60 transition",
              "placeholder:text-zinc-500 placeholder:font-normal",
              "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200",
              "dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-600 dark:focus:bg-zinc-950 dark:focus:ring-emerald-900",
            )}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange({ search: "", town, dayOfWeek })}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 shadow-sm sm:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              <SlidersHorizontal className="h-3 w-3" />
              filter
            </kbd>
          )}
        </div>

        {/* Day-of-week pill row + town combobox */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <DayPills
            value={dayOfWeek}
            onChange={(v) => {
              if (v) posthog.capture("directory_filtered", { filter_type: "day", day_of_week: v });
              onChange({ search, town, dayOfWeek: v });
            }}
          />

          <div className="flex items-center gap-2">
            <Popover open={townOpen} onOpenChange={setTownOpen}>
              <PopoverTrigger
                aria-label="Filter by town"
                className={cn(
                  "group inline-flex h-10 min-w-[12rem] items-center gap-2 rounded-full border bg-white px-4 text-sm font-medium shadow-sm transition",
                  town
                    ? "border-emerald-400 text-emerald-900 ring-2 ring-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900/40"
                    : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
                )}
              >
                <MapPin
                  className={cn(
                    "h-4 w-4 shrink-0",
                    town ? "text-emerald-600" : "text-zinc-400",
                  )}
                />
                <span className="flex-1 truncate text-left">
                  {town || "Any town"}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent
                className="w-[18rem] overflow-hidden rounded-xl border-zinc-200 p-0 shadow-lg dark:border-zinc-800"
                align="end"
              >
                <Command>
                  <CommandInput placeholder="Search Vermont towns…" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>No towns yet.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__any__"
                        onSelect={() => {
                          onChange({ search, town: "", dayOfWeek });
                          setTownOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 text-emerald-600",
                            town === "" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="text-zinc-500">Any town</span>
                      </CommandItem>
                      {towns.map((t) => (
                        <CommandItem
                          key={t}
                          value={t}
                          onSelect={() => {
                            posthog.capture("directory_filtered", { filter_type: "town", town: t });
                            onChange({ search, town: t, dayOfWeek });
                            setTownOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 text-emerald-600",
                              town === t ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {t}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={reset}
              disabled={!hasFilters}
              aria-label="Clear all filters"
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold uppercase tracking-wider transition",
                hasFilters
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                  : "cursor-not-allowed border-zinc-200 bg-zinc-50/50 text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-700",
              )}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Active-filter chip strip */}
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-emerald-200/70 pt-3 dark:border-emerald-900/50">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-300/80">
              Filtering:
            </span>
            {search ? (
              <Chip
                icon={<Search className="h-3 w-3" />}
                label={`"${search}"`}
                onRemove={() => onChange({ search: "", town, dayOfWeek })}
              />
            ) : null}
            {dayLabel ? (
              <Chip
                icon={<CalendarDays className="h-3 w-3" />}
                label={dayLabel}
                onRemove={() => onChange({ search, town, dayOfWeek: "" })}
              />
            ) : null}
            {town ? (
              <Chip
                icon={<MapPin className="h-3 w-3" />}
                label={town}
                onRemove={() => onChange({ search, town: "", dayOfWeek })}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DayPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Day of week"
      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <DayPill
        active={value === ""}
        onClick={() => onChange("")}
        title="Any day"
        wide
      >
        Any
      </DayPill>
      {DAYS.map((d) => (
        <DayPill
          key={d.v}
          active={value === d.v}
          onClick={() => onChange(d.v)}
          title={d.full}
        >
          {d.short}
        </DayPill>
      ))}
    </div>
  );
}

function DayPill({
  active,
  onClick,
  title,
  wide,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      title={title}
      className={cn(
        "relative inline-flex h-8 select-none items-center justify-center rounded-full text-xs font-bold transition",
        wide ? "px-3" : "w-8",
        active
          ? "bg-emerald-600 text-white shadow-[0_3px_10px_rgba(16,185,129,0.45)]"
          : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800 dark:text-zinc-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200",
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  icon,
  label,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="group inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-2 pr-1 text-[11px] font-semibold text-emerald-900 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
      <span className="max-w-[14ch] truncate">{label}</span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 text-emerald-700 transition hover:bg-emerald-200 dark:text-emerald-300 dark:hover:bg-emerald-900"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ResultBadge({
  count,
  total,
  filtered,
}: {
  count?: number;
  total?: number;
  filtered: boolean;
}) {
  if (typeof count !== "number") {
    return (
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        Loading…
      </span>
    );
  }
  if (filtered && typeof total === "number") {
    return (
      <span className="inline-flex items-baseline gap-1.5 text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">
        <span className="text-base font-extrabold text-emerald-700 tabular-nums dark:text-emerald-300">
          {count}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">of</span>
        <span className="font-bold text-zinc-600 tabular-nums dark:text-zinc-400">
          {total}
        </span>
        <span className="text-zinc-500">{count === 1 ? "field" : "fields"}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1 text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">
      <span className="text-base font-extrabold text-emerald-700 tabular-nums dark:text-emerald-300">
        {count}
      </span>
      <span className="text-zinc-500">{count === 1 ? "field" : "fields"}</span>
    </span>
  );
}
