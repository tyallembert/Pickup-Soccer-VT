import { CalendarOff } from "lucide-react";
import { formatDateLong, formatSeason } from "@/app/_lib/format";
import type { Season } from "@/convex/lib/season";

/** Stands in for the weekly status form when the slot's next game day falls
 *  outside the field's season. */
export function OffSeasonNote({
  date,
  season,
}: {
  date: string;
  season: Season | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
      <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
      <p>
        Off-season: no game on {formatDateLong(date)}
        {season ? `. This field runs ${formatSeason(season)}` : ""}. There&rsquo;s
        nothing to set until the season starts again.
      </p>
    </div>
  );
}
