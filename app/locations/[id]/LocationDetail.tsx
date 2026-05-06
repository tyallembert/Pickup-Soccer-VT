"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LocationPin } from "@/app/_components/LocationPin";
import { formatDateLong, formatDayPlural, formatStartTime } from "@/app/_lib/format";

export function LocationDetail({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.public.getLocation, { id });

  if (data === undefined) return <p className="px-6 py-12 text-sm text-zinc-500">Loading…</p>;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <p className="text-sm uppercase tracking-widest text-zinc-500">{data.town}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
        <p className="mt-2 text-base text-zinc-700 dark:text-zinc-300">{data.address}</p>
      </header>

      <p className="text-lg">
        {formatDayPlural(data.dayOfWeek)} at {formatStartTime(data.startTime)}
      </p>

      <LocationPin lat={data.lat} lng={data.lng} onChange={() => {}} draggable={false} height={240} />

      <pre className="whitespace-pre-wrap font-sans text-base text-zinc-700 dark:text-zinc-300">
        {data.details}
      </pre>

      {data.thisWeek.isOn ? (
        <section className="rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950">
          <p className="font-semibold">ON this {formatDateLong(data.thisWeek.date)}.</p>
        </section>
      ) : (
        <section className="rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
          <p className="font-semibold">
            NO SOCCER this {formatDateLong(data.thisWeek.date)}
          </p>
          {data.thisWeek.reason ? <p className="mt-1 text-sm">{data.thisWeek.reason}</p> : null}
        </section>
      )}

      {data.lastSession ? (
        <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Last session — {formatDateLong(data.lastSession.date)}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.lastSession.turnout !== undefined ? <li>{data.lastSession.turnout} players</li> : null}
            {data.lastSession.weatherCondition || data.lastSession.weather ? (
              <li>
                {data.lastSession.weatherCondition ?? null}
                {data.lastSession.weatherCondition && data.lastSession.weather ? " — " : null}
                {data.lastSession.weather ?? null}
              </li>
            ) : null}
          </ul>
          {data.lastSession.recapNotes ? (
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">
              {data.lastSession.recapNotes}
            </pre>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
