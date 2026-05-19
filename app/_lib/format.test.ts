import { describe, expect, test } from "vitest";
import { formatTimeRange } from "./format";

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
