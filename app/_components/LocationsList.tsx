"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { MotionShell } from "./MotionShell";
import { formatDayPlural, formatStartTime } from "../_lib/format";

export type ListSchedule = {
  _id: string;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
  thisWeek: { date: string; isOn: boolean; reason?: string };
};

export type ListLocation = {
  _id: string;
  name: string;
  town: string;
  schedules: ListSchedule[];
};

export function LocationsList({ locations, keyHash }: { locations: ListLocation[]; keyHash?: string }) {
  if (!locations.length) {
    return (
      <div className="mx-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
          <SearchX className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          No fields match your filters.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Try removing a filter chip above, or browse all towns.
        </p>
      </div>
    );
  }
  return (
    <MotionShell key={keyHash} variant="fade-up">
      <ul className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2">
        {locations.map((l) => (
          <li key={l._id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <Link href={`/locations/${l._id}`} className="block">
              <p className="text-base font-semibold">{l.name}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{l.town}</p>
              {l.schedules[0] && (
                <>
                  <p className="mt-1 text-sm">
                    {formatDayPlural(l.schedules[0].dayOfWeek)} at {formatStartTime(l.schedules[0].startTime)}
                  </p>
                  {l.schedules[0].thisWeek.isOn ? (
                    <p className="mt-2 text-xs uppercase tracking-wide text-green-700 dark:text-green-400">
                      ON this {l.schedules[0].thisWeek.date}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs uppercase tracking-wide text-red-700 dark:text-red-400">
                      OFF — {l.schedules[0].thisWeek.reason ?? "cancelled"}
                    </p>
                  )}
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </MotionShell>
  );
}
