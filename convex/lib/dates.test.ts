import { describe, expect, test } from "vitest";
import { mostRecentPastGameDay, upcomingGameDay } from "./dates";

describe("upcomingGameDay", () => {
  test("Saturday afternoon → next Monday", () => {
    const now = new Date("2026-05-02T18:00:00Z"); // 2pm EDT Sat
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday before start time → today", () => {
    const now = new Date("2026-05-04T21:00:00Z"); // 5pm EDT Mon, game at 6
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday after start time → next Monday", () => {
    const now = new Date("2026-05-04T23:00:00Z"); // 7pm EDT Mon
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-11");
  });

  test("dayOfWeek configurable — Wednesday game, Tuesday now → Wednesday", () => {
    const now = new Date("2026-05-05T18:00:00Z");
    expect(upcomingGameDay(now, 3, "18:00")).toBe("2026-05-06");
  });

  test("DST boundary — November fall-back week", () => {
    // 2026-11-02 is a Monday. EST (post fall-back).
    const now = new Date("2026-11-02T04:00:00Z");
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-11-02");
  });
});

describe("mostRecentPastGameDay", () => {
  test("Wednesday → previous Monday", () => {
    const now = new Date("2026-05-06T18:00:00Z");
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday before start time → previous Monday (today does not count)", () => {
    const now = new Date("2026-05-04T21:00:00Z");
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-04-27");
  });

  test("Monday after start time → today (game has begun)", () => {
    const now = new Date("2026-05-04T23:00:00Z");
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });
});
