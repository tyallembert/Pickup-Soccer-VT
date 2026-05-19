/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import type { Id } from "../_generated/dataModel";

// import.meta.glob from a subdirectory returns files in this directory with
// "./" prefix but sibling dirs with "../" prefix. convex-test's findModulesRoot
// derives the prefix from _generated paths ("../"), so files here would need
// "../migrations/" prefix. We normalize by remapping "./" → "../migrations/".
const _rawModules = import.meta.glob("../**/*.*s");
const _localModules = import.meta.glob("./**/*.*s");
const modules = {
  ..._rawModules,
  ...Object.fromEntries(
    Object.entries(_localModules).map(([k, v]) => [
      k.replace(/^\.\//, "../migrations/"),
      v,
    ]),
  ),
};

test("backfill creates one schedule per location and patches gameDays", async () => {
  const t = convexTest(schema, modules);

  const { userA, locA, locB } = await t.run(async (ctx) => {
    const userA = await ctx.db.insert("users", {
      email: "a@example.com",
      role: "user",
    });
    const locA = await ctx.db.insert("locations", {
      name: "Field A",
      town: "Burlington",
      address: "1 A St",
      lat: 44.5,
      lng: -73.2,
      dayOfWeek: 1,
      startTime: "18:00",
      details: "",
      ownerId: userA,
      status: "approved" as const,
      submittedAt: Date.now(),
    });
    const locB = await ctx.db.insert("locations", {
      name: "Field B",
      town: "Montpelier",
      address: "1 B St",
      lat: 44.25,
      lng: -72.5,
      dayOfWeek: 4,
      startTime: "19:00",
      details: "",
      ownerId: userA,
      status: "approved" as const,
      submittedAt: Date.now(),
    });
    await ctx.db.insert("gameDays", {
      locationId: locA,
      date: "2026-05-04",
      isOn: false,
      reason: "rain",
    });
    await ctx.db.insert("gameDays", {
      locationId: locA,
      date: "2026-05-11",
      turnout: 12,
    });
    await ctx.db.insert("gameDays", {
      locationId: locB,
      date: "2026-05-07",
      turnout: 8,
    });
    return { userA, locA, locB };
  });

  await t.mutation(internal.migrations.locationSchedules.runBackfill, {});
  await t.finishAllScheduledFunctions(() => Promise.resolve());

  const { schedules, gameDays } = await t.run(async (ctx) => {
    const schedules = await ctx.db.query("locationSchedules").collect();
    const gameDays = await ctx.db.query("gameDays").collect();
    return { schedules, gameDays };
  });

  expect(schedules).toHaveLength(2);
  const aSched = schedules.find((s) => s.locationId === locA)!;
  const bSched = schedules.find((s) => s.locationId === locB)!;
  expect(aSched.dayOfWeek).toBe(1);
  expect(aSched.startTime).toBe("18:00");
  expect(aSched.endTime).toBeUndefined();
  expect(bSched.dayOfWeek).toBe(4);
  expect(bSched.startTime).toBe("19:00");

  expect(gameDays).toHaveLength(3);
  for (const gd of gameDays) {
    const expected = gd.locationId === locA ? aSched._id : bSched._id;
    expect(gd.scheduleId).toBe(expected);
  }
});

test("backfill is idempotent", async () => {
  const t = convexTest(schema, modules);
  const { loc, sched } = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", { email: "z@z.com", role: "user" });
    const loc = await ctx.db.insert("locations", {
      name: "Field Z",
      town: "Stowe",
      address: "1 Z St",
      lat: 44.4,
      lng: -72.7,
      dayOfWeek: 2,
      startTime: "17:30",
      details: "",
      ownerId: user,
      status: "approved" as const,
      submittedAt: Date.now(),
    });
    const sched = await ctx.db.insert("locationSchedules", {
      locationId: loc,
      dayOfWeek: 2,
      startTime: "17:30",
    });
    return { loc, sched };
  });

  await t.mutation(internal.migrations.locationSchedules.runBackfill, {});
  await t.finishAllScheduledFunctions(() => Promise.resolve());

  const schedules = await t.run((ctx) =>
    ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", loc))
      .collect(),
  );
  expect(schedules).toHaveLength(1);
  expect(schedules[0]._id).toBe(sched);
});
