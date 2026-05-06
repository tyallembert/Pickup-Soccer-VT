"use client";

import Link from "next/link";
import { MotionShell } from "./MotionShell";
import { formatDayPlural, formatStartTime } from "../_lib/format";

export type ListLocation = {
  _id: string;
  name: string;
  town: string;
  dayOfWeek: number;
  startTime: string;
  thisWeek: { date: string; isOn: boolean; reason?: string };
  lastSession: { date: string; turnout?: number } | null;
};

export function LocationsList({ locations, keyHash }: { locations: ListLocation[]; keyHash?: string }) {
  if (!locations.length) {
    return <p className="px-6 text-sm text-zinc-500">No matches. Try clearing filters.</p>;
  }
  return (
    <MotionShell key={keyHash} variant="fade-up">
      <ul className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2">
        {locations.map((l) => (
          <li key={l._id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <Link href={`/locations/${l._id}`} className="block">
              <p className="text-base font-semibold">{l.name}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{l.town}</p>
              <p className="mt-1 text-sm">
                {formatDayPlural(l.dayOfWeek)} at {formatStartTime(l.startTime)}
              </p>
              {l.thisWeek.isOn ? (
                <p className="mt-2 text-xs uppercase tracking-wide text-green-700 dark:text-green-400">
                  ON this {l.thisWeek.date}
                </p>
              ) : (
                <p className="mt-2 text-xs uppercase tracking-wide text-red-700 dark:text-red-400">
                  OFF — {l.thisWeek.reason ?? "cancelled"}
                </p>
              )}
              {l.lastSession?.turnout !== undefined ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Last: {l.lastSession.turnout} players
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </MotionShell>
  );
}
