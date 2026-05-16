"use client";

import { useState } from "react";
import { useQuery, usePreloadedQuery, type Preloaded } from "convex/react";
import { Map as MapIcon, Rows3 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/app/_lib/cn";
import { Filters } from "./Filters";
import { LocationsMap } from "./LocationsMap";
import { LocationsTable } from "./LocationsTable";
import { NextUpGame } from "./NextUpGame";
import { SoccerField } from "./SoccerField";

type ViewMode = "map" | "list";

export function HomeView({
  preloadedLocations,
  children,
}: {
  preloadedLocations: Preloaded<typeof api.public.listLocations>;
  children?: React.ReactNode;
}) {
  const [filters, setFilters] = useState({ search: "", town: "", dayOfWeek: "" });
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const baseLocations = usePreloadedQuery(preloadedLocations);
  const isFiltered = !!(filters.search || filters.town || filters.dayOfWeek);

  const filteredLocations = useQuery(
    api.public.listLocations,
    isFiltered
      ? {
          search: filters.search || undefined,
          town: filters.town || undefined,
          dayOfWeek:
            filters.dayOfWeek === ""
              ? undefined
              : parseInt(filters.dayOfWeek, 10),
        }
      : "skip",
  );

  const locations = isFiltered ? filteredLocations : baseLocations;
  const resultCount = locations?.length;
  const totalCount = baseLocations.length;

  return (
    <>
      <SoccerField />
      <NextUpGame locations={locations} />

      {children}

      <section id="locations" className="px-6 pb-16 pt-10">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_50px_-30px_rgba(16,185,129,0.55)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_18px_50px_-30px_rgba(16,185,129,0.35)]">
          <Filters
            {...filters}
            onChange={setFilters}
            resultCount={resultCount}
            totalCount={totalCount}
          />
          {/* hairline separator with a soft emerald glow */}
          <div className="relative h-px bg-zinc-200 dark:bg-zinc-800">
            <div className="absolute inset-x-12 inset-y-0 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          </div>

          <ViewBar value={viewMode} onChange={setViewMode} />

          {viewMode === "map" ? (
            <LocationsMap locations={locations ?? []} chromeless height={520} />
          ) : (
            <LocationsTable locations={locations ?? []} />
          )}
        </div>
      </section>
    </>
  );
}

function ViewBar({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 sm:px-6 dark:border-zinc-800">
      <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-400 sm:inline-flex dark:text-zinc-500">
        <span className="h-1 w-1 rounded-full bg-emerald-500" />
        Choose your view
      </span>
      <div
        role="radiogroup"
        aria-label="View mode"
        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <ViewBtn
          active={value === "map"}
          onClick={() => onChange("map")}
          icon={<MapIcon className="h-3.5 w-3.5" />}
          label="Map"
        />
        <ViewBtn
          active={value === "list"}
          onClick={() => onChange("list")}
          icon={<Rows3 className="h-3.5 w-3.5" />}
          label="List"
        />
      </div>
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 select-none items-center gap-1.5 rounded-full px-3.5 text-xs font-bold uppercase tracking-[0.14em] transition",
        active
          ? "bg-emerald-600 text-white shadow-[0_3px_10px_rgba(16,185,129,0.45)]"
          : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800 dark:text-zinc-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
