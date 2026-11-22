/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Season } from "./lib/season";

const modules = import.meta.glob("./**/*.ts");

const APR_OCT: Season = { start: { month: 4 }, end: { month: 10 } };

// Tuesday 2026-11-24, 10am in Vermont: an April–October field is off-season.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T15:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedField(
  t: ReturnType<typeof convexTest>,
  season: Season | undefined,
) {
  return t.run(async (ctx) => {
    const user = await ctx.db.insert("users", { email: "o@x.com", role: "user" });
    const loc = await ctx.db.insert("locations", {
      name: "Seasonal field",
      town: "Burlington",
      address: "1 Main",
      lat: 44.5,
      lng: -73.2,
      details: "",
      season,
      ownerId: user,
      status: "approved" as const,
      submittedAt: Date.now(),
      approvedAt: Date.now(),
    });
    const tueId = await ctx.db.insert("locationSchedules", {
      locationId: loc,
      dayOfWeek: 2,
      startTime: "18:00",
    });
    await ctx.db.insert("locationSchedules", {
      locationId: loc,
      dayOfWeek: 4,
      startTime: "18:00",
    });
    return { user, loc, tueId };
  });
}

test("an out-of-season field reads off-season with the first game back", async () => {
  const t = convexTest(schema, modules);
  const { loc } = await seedField(t, APR_OCT);

  const result = await t.query(api.public.getLocation, { id: loc });
  expect(result.season).toEqual(APR_OCT);
  expect(result.offSeason).toBe(true);
  expect(result.schedules.every((s) => !s.thisWeek.inSeason)).toBe(true);
  // Thursday 2027-04-01 comes before the first April Tuesday (the 6th).
  expect(result.resumesOn).toBe("2027-04-01");
});

test("a year-round field is never off-season", async () => {
  const t = convexTest(schema, modules);
  const { loc } = await seedField(t, undefined);

  const result = await t.query(api.public.getLocation, { id: loc });
  expect(result.season).toBeNull();
  expect(result.offSeason).toBe(false);
  expect(result.resumesOn).toBeNull();
  expect(result.schedules.every((s) => s.thisWeek.inSeason)).toBe(true);
});

test("weekly status can't be set for an out-of-season week", async () => {
  const t = convexTest(schema, modules);
  const { user, tueId } = await seedField(t, APR_OCT);
  const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });

  await expect(
    asUser.mutation(api.owner.setScheduleStatus, {
      scheduleId: tueId,
      isOn: false,
      reason: "snow",
    }),
  ).rejects.toThrow(/outside this field's season/);
});

test("a recap after the season lands on the season's last game", async () => {
  const t = convexTest(schema, modules);
  const { user, tueId } = await seedField(t, APR_OCT);
  const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });

  const { date } = await asUser.mutation(api.owner.saveScheduleRecap, {
    scheduleId: tueId,
    turnout: 14,
  });
  expect(date).toBe("2026-10-27");
});

test("setSchedules sets, keeps, and clears the season", async () => {
  const t = convexTest(schema, modules);
  const { user, loc, tueId } = await seedField(t, undefined);
  const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });
  const schedules = [{ _id: tueId, dayOfWeek: 2, startTime: "18:00" }];
  // t.run hands undefined back as null.
  const season = () =>
    t.run(async (ctx) => (await ctx.db.get(loc))!.season ?? null);

  const exact: Season = { start: { month: 4, day: 15 }, end: { month: 10, day: 31 } };
  await asUser.mutation(api.owner.setSchedules, { id: loc, schedules, season: exact });
  expect(await season()).toEqual(exact);

  // Clients from before seasons send no season: it stays.
  await asUser.mutation(api.owner.setSchedules, { id: loc, schedules });
  expect(await season()).toEqual(exact);

  await asUser.mutation(api.owner.setSchedules, { id: loc, schedules, season: null });
  expect(await season()).toBeNull();
});

test("an invalid season is rejected", async () => {
  const t = convexTest(schema, modules);
  const { user, loc, tueId } = await seedField(t, undefined);
  const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });

  await expect(
    asUser.mutation(api.owner.setSchedules, {
      id: loc,
      schedules: [{ _id: tueId, dayOfWeek: 2, startTime: "18:00" }],
      season: { start: { month: 4, day: 31 }, end: { month: 10 } },
    }),
  ).rejects.toThrow(/start day/);
});

test("admins get the same season guard on weekly status", async () => {
  const t = convexTest(schema, modules);
  const { tueId } = await seedField(t, APR_OCT);
  const admin = await t.run((ctx) =>
    ctx.db.insert("users", { email: "admin@x.com", role: "admin" }),
  );
  const asAdmin = t.withIdentity({ subject: admin, tokenIdentifier: admin });

  await expect(
    asAdmin.mutation(api.admin.adminSetScheduleStatus, {
      scheduleId: tueId,
      isOn: false,
    }),
  ).rejects.toThrow(/outside this field's season/);
});
