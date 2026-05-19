"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, MapPin, SearchX } from "lucide-react";
import { cn } from "@/app/_lib/cn";
import { formatTimeRange } from "../_lib/format";
import type { ListLocation } from "./LocationsList";

type SortKey = "name" | "town" | "day" | "time";
type SortDir = "asc" | "desc";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function LocationsTable({ locations }: { locations: ListLocation[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const copy = [...locations];
    copy.sort((a, b) => {
      const aFirst = a.schedules[0];
      const bFirst = b.schedules[0];
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "town") cmp = a.town.localeCompare(b.town);
      else if (sortKey === "day")
        cmp = (aFirst?.dayOfWeek ?? 99) - (bFirst?.dayOfWeek ?? 99);
      else if (sortKey === "time")
        cmp = (aFirst?.startTime ?? "").localeCompare(bFirst?.startTime ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [locations, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (!locations.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
          <SearchX className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          No fields match your filters.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Adjust the filters above, or clear them to browse all towns.
        </p>
      </div>
    );
  }

  return (
    <div className="relative max-h-[520px] overflow-auto">
      {/* Faint pitch-line backdrop matching the filter rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 38px, #064e3b 38px 39px)",
        }}
      />
      <table className="relative w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-md dark:bg-zinc-950/95">
          <tr>
            <Th onClick={() => onSort("name")} active={sortKey === "name"} dir={sortDir}>
              Field
            </Th>
            <Th onClick={() => onSort("town")} active={sortKey === "town"} dir={sortDir}>
              Town
            </Th>
            <Th onClick={() => onSort("day")} active={sortKey === "day"} dir={sortDir}>
              Day
            </Th>
            <Th onClick={() => onSort("time")} active={sortKey === "time"} dir={sortDir}>
              Start
            </Th>
            <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              This week
            </th>
            <th className="w-12 px-4 py-3" aria-hidden="true" />
          </tr>
          {/* hairline under the header with emerald glow, mirroring the rest of the app */}
          <tr aria-hidden="true">
            <td colSpan={6} className="p-0">
              <div className="relative h-px bg-zinc-200 dark:bg-zinc-800">
                <div className="absolute inset-x-12 inset-y-0 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          {sorted.map((l, i) => (
            <tr
              key={l._id}
              className={cn(
                "group cursor-pointer border-b border-zinc-100/80 transition hover:bg-emerald-50/60 dark:border-zinc-800/60 dark:hover:bg-emerald-950/30",
                i % 2 === 1 && "bg-zinc-50/40 dark:bg-zinc-900/30",
              )}
            >
              <Td>
                <Link
                  href={`/locations/${l._id}`}
                  className="-mx-4 block px-4 py-1 font-semibold text-zinc-900 group-hover:text-emerald-800 dark:text-zinc-100 dark:group-hover:text-emerald-200"
                >
                  {l.name}
                </Link>
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <MapPin className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {l.town}
                </span>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {l.schedules.map((s) => (
                    <span
                      key={s._id}
                      className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {DAY_SHORT[s.dayOfWeek] ?? "—"}
                    </span>
                  ))}
                </div>
              </Td>
              <Td>
                <div className="flex flex-col gap-0.5 text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                  {l.schedules.map((s) => (
                    <span key={s._id}>{formatTimeRange(s.startTime, s.endTime)}</span>
                  ))}
                </div>
              </Td>
              <Td>
                <div className="flex flex-col gap-1">
                  {l.schedules.map((s) => (
                    <StatusPill key={s._id} on={s.thisWeek.isOn} reason={s.thisWeek.reason} />
                  ))}
                </div>
              </Td>
              <Td className="text-right">
                <Link
                  href={`/locations/${l._id}`}
                  aria-label={`Open ${l.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_4px_12px_rgba(16,185,129,0.45)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
}) {
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] transition",
          active
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
        )}
      >
        {children}
        <Arrow
          className={cn(
            "h-3 w-3 transition",
            active ? "opacity-100" : "opacity-25",
          )}
        />
      </button>
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function StatusPill({ on, reason }: { on: boolean; reason?: string }) {
  return (
    <span
      title={!on && reason ? reason : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]",
        on
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
          : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          on
            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
            : "bg-rose-500",
        )}
      />
      {on ? "On" : "Off"}
    </span>
  );
}
