import { describe, expect, test } from "vitest";
import {
  formatDateShort,
  formatRelativeTime,
  formatSeason,
  formatTimeRange,
} from "./format";

describe("formatTimeRange", () => {
  test("renders start–end when both present", () => {
    expect(formatTimeRange("18:00", "20:00")).toBe("6:00 PM – 8:00 PM");
  });
  test("falls back to 'starts X' without end", () => {
    expect(formatTimeRange("18:00")).toBe("starts 6:00 PM");
  });
  test("falls back to empty when start is missing", () => {
    expect(formatTimeRange("", "20:00")).toBe("");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 10, 21, 12, 0, 0);
  test("under a minute is just now", () => {
    expect(formatRelativeTime(now - 20_000, now)).toBe("just now");
  });
  test("steps up through minutes, hours, days, months", () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(formatRelativeTime(now - 90 * 86_400_000, now)).toBe("3mo ago");
  });
});

describe("formatSeason", () => {
  test("month-only seasons name whole months", () => {
    expect(formatSeason({ start: { month: 4 }, end: { month: 10 } })).toBe("April – October");
    expect(formatSeason({ start: { month: 10 }, end: { month: 4 } }, true)).toBe("Oct – Apr");
  });

  test("exact days show the day", () => {
    expect(
      formatSeason({ start: { month: 4, day: 15 }, end: { month: 10, day: 31 } }),
    ).toBe("April 15 – October 31");
  });
});

describe("formatDateShort", () => {
  test("weekday, month, day", () => {
    expect(formatDateShort("2027-04-01")).toBe("Thu, Apr 1");
  });
});
