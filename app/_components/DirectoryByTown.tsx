import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { cn } from "@/app/_lib/cn";
import { formatStartTime } from "@/app/_lib/format";

type DirectoryLocation = {
  _id: string;
  name: string;
  town: string;
  schedules: { _id: string; dayOfWeek: number; startTime: string }[];
};

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function DirectoryByTown({
  locations,
}: {
  locations: DirectoryLocation[];
}) {
  if (locations.length === 0) return null;

  const byTown = new Map<string, DirectoryLocation[]>();
  for (const l of locations) {
    const list = byTown.get(l.town);
    if (list) list.push(l);
    else byTown.set(l.town, [l]);
  }
  const towns = Array.from(byTown.keys()).sort((a, b) => a.localeCompare(b));

  for (const list of byTown.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <section
      id="all-fields"
      aria-labelledby="all-fields-heading"
      className="px-6 pt-10"
    >
      <header className="mb-5 flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          Full directory
        </span>
        <h2
          id="all-fields-heading"
          className="text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl"
        >
          Browse all pickup soccer fields in Vermont
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {locations.length} {locations.length === 1 ? "field" : "fields"} across{" "}
          {towns.length} {towns.length === 1 ? "town" : "towns"}.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {towns.map((town) => {
          const items = byTown.get(town)!;
          return (
            <article
              key={town}
              className="group/town relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_24px_-18px_rgba(16,185,129,0.55)] dark:border-zinc-800 dark:bg-zinc-950"
            >
              {/* top accent edge */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
              />

              <header className="px-4 pb-2.5 pt-3.5">
                <h3 className="inline-flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {town}
                </h3>
              </header>

              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {items.map((l) => (
                  <li key={l._id}>
                    <FieldRow location={l} />
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FieldRow({ location }: { location: DirectoryLocation }) {
  const activeDays = new Set(location.schedules.map((s) => s.dayOfWeek));
  const distinctTimes = Array.from(
    new Set(location.schedules.map((s) => formatStartTime(s.startTime))),
  ).filter(Boolean);
  const timeSummary = distinctTimes.join(" / ");
  const a11yLabel = location.schedules.length
    ? `Plays on ${Array.from(activeDays)
        .sort()
        .map((d) => DAY_FULL[d])
        .join(", ")} at ${timeSummary}`
    : "No schedule";

  return (
    <Link
      href={`/locations/${location._id}`}
      aria-label={`${location.name} — ${a11yLabel}`}
      className="group/row relative flex items-start gap-3 px-4 py-3 transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold leading-tight text-zinc-900 group-hover/row:text-emerald-800 dark:text-zinc-100 dark:group-hover/row:text-emerald-200">
          {location.name}
        </div>
        {location.schedules.length > 0 ? (
          <div className="mt-2 flex items-center gap-2">
            <DayTrack active={activeDays} />
            <span className="truncate text-[11px] font-semibold tabular-nums tracking-wide text-zinc-600 dark:text-zinc-300">
              {timeSummary}
            </span>
          </div>
        ) : (
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">
            No schedule yet
          </div>
        )}
      </div>

      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-300 transition group-hover/row:bg-emerald-600 group-hover/row:text-white group-hover/row:shadow-[0_4px_12px_rgba(16,185,129,0.45)] dark:text-zinc-700"
      >
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/row:-translate-y-px group-hover/row:translate-x-px" />
      </span>
    </Link>
  );
}

function DayTrack({ active }: { active: Set<number> }) {
  return (
    <div
      aria-hidden="true"
      className="inline-flex shrink-0 items-center gap-[3px] rounded-full border border-zinc-200 bg-white px-1.5 py-1 dark:border-zinc-800 dark:bg-zinc-950"
    >
      {DAY_LETTERS.map((letter, i) => {
        const on = active.has(i);
        return (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none transition",
              on
                ? "bg-emerald-600 text-white shadow-[0_1px_3px_rgba(16,185,129,0.5)]"
                : "text-zinc-300 dark:text-zinc-700",
            )}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}
