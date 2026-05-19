import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";

type DirectoryLocation = {
  _id: string;
  name: string;
  town: string;
  schedules: { _id: string; dayOfWeek: number; startTime: string }[];
};

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
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_24px_-18px_rgba(16,185,129,0.55)] dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-900">
                <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {town}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                  {items.length} {items.length === 1 ? "field" : "fields"}
                </span>
              </header>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {items.map((l) => (
                  <li key={l._id}>
                    <Link
                      href={`/locations/${l._id}`}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30"
                    >
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {l.name}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                        {l.schedules.length > 0
                          ? l.schedules
                              .map((s) => `${formatDayPlural(s.dayOfWeek)} · ${formatStartTime(s.startTime)}`)
                              .join(", ")
                          : null}
                      </span>
                    </Link>
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
