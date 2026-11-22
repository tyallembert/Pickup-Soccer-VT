import { describe, expect, test } from "vitest";
import {
  isInSeason,
  lastInSeasonDate,
  nextInSeasonDate,
  validateSeason,
  type Season,
} from "./season";

const APR_OCT: Season = { start: { month: 4 }, end: { month: 10 } };
const OCT_APR: Season = { start: { month: 10 }, end: { month: 4 } };
const EXACT: Season = { start: { month: 4, day: 15 }, end: { month: 10, day: 15 } };

describe("isInSeason", () => {
  test("no season means year-round", () => {
    expect(isInSeason("2026-01-15", undefined)).toBe(true);
    expect(isInSeason("2026-01-15", null)).toBe(true);
  });

  test("month-only season covers the whole start and end months", () => {
    expect(isInSeason("2026-03-31", APR_OCT)).toBe(false);
    expect(isInSeason("2026-04-01", APR_OCT)).toBe(true);
    expect(isInSeason("2026-07-04", APR_OCT)).toBe(true);
    expect(isInSeason("2026-10-31", APR_OCT)).toBe(true);
    expect(isInSeason("2026-11-01", APR_OCT)).toBe(false);
  });

  test("a season can wrap the new year", () => {
    expect(isInSeason("2026-09-30", OCT_APR)).toBe(false);
    expect(isInSeason("2026-10-01", OCT_APR)).toBe(true);
    expect(isInSeason("2026-12-25", OCT_APR)).toBe(true);
    expect(isInSeason("2027-01-10", OCT_APR)).toBe(true);
    expect(isInSeason("2027-04-30", OCT_APR)).toBe(true);
    expect(isInSeason("2027-05-01", OCT_APR)).toBe(false);
  });

  test("exact days are inclusive on both ends", () => {
    expect(isInSeason("2026-04-14", EXACT)).toBe(false);
    expect(isInSeason("2026-04-15", EXACT)).toBe(true);
    expect(isInSeason("2026-10-15", EXACT)).toBe(true);
    expect(isInSeason("2026-10-16", EXACT)).toBe(false);
  });

  test("a season ending in February covers leap day", () => {
    const novFeb: Season = { start: { month: 11 }, end: { month: 2 } };
    expect(isInSeason("2028-02-29", novFeb)).toBe(true);
    expect(isInSeason("2027-02-28", novFeb)).toBe(true);
    expect(isInSeason("2027-03-01", novFeb)).toBe(false);
  });

  test("a single month", () => {
    const june: Season = { start: { month: 6 }, end: { month: 6 } };
    expect(isInSeason("2026-06-30", june)).toBe(true);
    expect(isInSeason("2026-07-01", june)).toBe(false);
  });
});

describe("validateSeason", () => {
  test("accepts month-only and exact seasons", () => {
    expect(validateSeason(APR_OCT)).toBeNull();
    expect(validateSeason(EXACT)).toBeNull();
    expect(validateSeason({ start: { month: 2, day: 29 }, end: { month: 3 } })).toBeNull();
  });

  test("rejects bad months and days", () => {
    expect(validateSeason({ start: { month: 0 }, end: { month: 10 } })).toMatch(/start month/);
    expect(validateSeason({ start: { month: 4 }, end: { month: 13 } })).toMatch(/end month/);
    expect(validateSeason({ start: { month: 4, day: 31 }, end: { month: 10 } })).toMatch(/start day/);
    expect(validateSeason({ start: { month: 4 }, end: { month: 2, day: 30 } })).toMatch(/end day/);
    expect(validateSeason({ start: { month: 4.5 }, end: { month: 10 } })).toMatch(/start month/);
  });
});

describe("in-season stepping", () => {
  test("next returns the date itself when it's in season", () => {
    expect(nextInSeasonDate("2026-07-07", APR_OCT)).toBe("2026-07-07");
  });

  test("next steps a week at a time into the coming season", () => {
    // Tuesdays: 2026-11-24 is off-season; the first April Tuesday is 2027-04-06.
    expect(nextInSeasonDate("2026-11-24", APR_OCT)).toBe("2027-04-06");
  });

  test("last steps back to the final game of the season", () => {
    // Tuesdays: the last October Tuesday of 2026 is the 27th.
    expect(lastInSeasonDate("2026-11-24", APR_OCT)).toBe("2026-10-27");
  });

  test("year-round never moves", () => {
    expect(nextInSeasonDate("2026-11-24", null)).toBe("2026-11-24");
    expect(lastInSeasonDate("2026-11-24", null)).toBe("2026-11-24");
  });
});
