const TIMEZONE = "America/New_York";

function toLocalDateString(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

function localDayOfWeek(d: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function localMinutesSinceMidnight(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return hour * 60 + minute;
}

function parseStartTime(startTime: string): number {
  const [h, m] = startTime.split(":").map((s) => parseInt(s, 10));
  return h * 60 + m;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  const t = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const out = new Date(t);
  const yy = out.getUTCFullYear();
  const mm = String(out.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(out.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function upcomingGameDay(
  now: Date,
  dayOfWeek: number,
  startTime: string,
): string {
  const today = toLocalDateString(now);
  const todayDow = localDayOfWeek(now);
  const startMinutes = parseStartTime(startTime);
  const nowMinutes = localMinutesSinceMidnight(now);

  if (todayDow === dayOfWeek && nowMinutes < startMinutes) {
    return today;
  }

  let delta = (dayOfWeek - todayDow + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(today, delta);
}

export function mostRecentPastGameDay(
  now: Date,
  dayOfWeek: number,
  startTime: string,
): string {
  const today = toLocalDateString(now);
  const todayDow = localDayOfWeek(now);
  const startMinutes = parseStartTime(startTime);
  const nowMinutes = localMinutesSinceMidnight(now);

  if (todayDow === dayOfWeek && nowMinutes >= startMinutes) {
    return today;
  }

  let delta = (todayDow - dayOfWeek + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(today, -delta);
}

// Returns "YYYY-MM-DD" for *today* in TIMEZONE. Used by queries that filter
// for past dates.
export function todayInTimezone(now: Date): string {
  return toLocalDateString(now);
}
