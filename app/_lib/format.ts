import type { Season, SeasonBoundary } from "@/convex/lib/season";

const DAY_NAMES_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_NAMES_PLURAL = ["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"];

export function formatDayPlural(d: number) { return DAY_NAMES_PLURAL[d] ?? "Game days"; }
export function formatDayLong(d: number) { return DAY_NAMES_LONG[d] ?? "the game"; }

export function formatStartTime(t: string | null | undefined) {
  if (!t || typeof t !== "string" || !t.includes(":")) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDateLong(s: string) {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
}

export function formatTimeRange(
  start: string | null | undefined,
  end?: string | null,
) {
  const s = formatStartTime(start);
  if (!s) return "";
  const e = end ? formatStartTime(end) : "";
  return e ? `${s} – ${e}` : `starts ${s}`;
}

/** "just now", "5m ago", "3h ago", "2d ago", "4mo ago". */
export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const minutes = Math.round((now - ts) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatMonth(month: number, short = false) {
  return (short ? MONTHS_SHORT : MONTHS_LONG)[month - 1] ?? "";
}

function formatBoundary(b: SeasonBoundary, short: boolean) {
  const m = formatMonth(b.month, short);
  return b.day ? `${m} ${b.day}` : m;
}

/** "April – October", "April 15 – October 31", or with `short` "Apr – Oct". */
export function formatSeason(season: Season, short = false) {
  return `${formatBoundary(season.start, short)} – ${formatBoundary(season.end, short)}`;
}

/** "Thu, Apr 1" for a "YYYY-MM-DD" date. */
export function formatDateShort(s: string) {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}
