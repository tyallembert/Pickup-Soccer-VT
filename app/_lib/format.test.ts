import { describe, expect, test } from "vitest";
import { formatRelativeTime, formatTimeRange } from "./format";

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
