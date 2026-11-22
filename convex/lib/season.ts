// A field's season: the part of every year its weekly games run. Pure and free
// of server imports, so the client shares it with the Convex functions.
//
// A boundary without a day means the whole month: a start month begins on the
// 1st, an end month runs to its last day. February counts as 29 days so a
// "through February" season covers leap years; in other years Feb 29 never
// occurs and the comparison below still works.

export type SeasonBoundary = { month: number; day?: number };
export type Season = { start: SeasonBoundary; end: SeasonBoundary };

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Days in a 1-based month, with February as 29. */
export function daysInMonth(month: number): number {
  return MONTH_DAYS[month - 1] ?? 31;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function boundaryKey(b: SeasonBoundary, edge: "start" | "end"): string {
  const day = b.day ?? (edge === "start" ? 1 : daysInMonth(b.month));
  return `${pad(b.month)}-${pad(day)}`;
}

/** A human-readable problem with the season, or null when it's valid. */
export function validateSeason(season: Season): string | null {
  for (const [label, b] of [
    ["start", season.start],
    ["end", season.end],
  ] as const) {
    if (!Number.isInteger(b.month) || b.month < 1 || b.month > 12) {
      return `Pick a ${label} month.`;
    }
    if (
      b.day !== undefined &&
      (!Number.isInteger(b.day) || b.day < 1 || b.day > daysInMonth(b.month))
    ) {
      return `The ${label} day isn't in that month.`;
    }
  }
  return null;
}

/**
 * Whether a "YYYY-MM-DD" date falls inside the season. No season means
 * year-round. A season whose start comes after its end (October → April)
 * wraps the new year.
 */
export function isInSeason(
  date: string,
  season: Season | null | undefined,
): boolean {
  if (!season) return true;
  const md = date.slice(5);
  const start = boundaryKey(season.start, "start");
  const end = boundaryKey(season.end, "end");
  return start <= end ? start <= md && md <= end : md >= start || md <= end;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  const out = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`;
}

// A year of weekly steps plus slack. Any valid season contains at least one of
// each weekday within this many weeks of any date.
const MAX_WEEKS = 54;

/**
 * Steps a weekly game date forward a week at a time to the first in-season
 * occurrence (the date itself when it's already in season).
 */
export function nextInSeasonDate(
  fromDate: string,
  season: Season | null | undefined,
): string | null {
  let d = fromDate;
  for (let i = 0; i <= MAX_WEEKS; i++) {
    if (isInSeason(d, season)) return d;
    d = addDays(d, 7);
  }
  return null;
}

/** Like nextInSeasonDate, stepping back in time. */
export function lastInSeasonDate(
  fromDate: string,
  season: Season | null | undefined,
): string | null {
  let d = fromDate;
  for (let i = 0; i <= MAX_WEEKS; i++) {
    if (isInSeason(d, season)) return d;
    d = addDays(d, -7);
  }
  return null;
}
