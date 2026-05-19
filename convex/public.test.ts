/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("listLocations returns one entry per location with a schedules array", async () => {
  const t = convexTest(schema, modules);
  const { locA } = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", { email: "a@a.com", role: "user" });
    const locA = await ctx.db.insert("locations", {
      name: "Two-slot field",
      town: "Burlington",
      address: "1 Main",
      lat: 44.5,
      lng: -73.2,
      details: "",
      ownerId: user,
      status: "approved" as const,
      submittedAt: Date.now(),
    });
    await ctx.db.insert("locationSchedules", {
      locationId: locA,
      dayOfWeek: 2,
      startTime: "18:00",
      endTime: "20:00",
    });
    await ctx.db.insert("locationSchedules", {
      locationId: locA,
      dayOfWeek: 4,
      startTime: "18:00",
    });
    return { locA };
  });

  const result = await t.query(api.public.listLocations, {});
  expect(result).toHaveLength(1);
  const loc = result[0];
  expect(loc._id).toBe(locA);
  expect(loc.schedules).toHaveLength(2);
  expect(loc.schedules[0].dayOfWeek).toBe(2);
  expect(loc.schedules[0].endTime).toBe("20:00");
  expect(loc.schedules[1].dayOfWeek).toBe(4);
  expect(loc.schedules[1].endTime).toBeUndefined();
  expect(loc.schedules[0].thisWeek.isOn).toBe(true);
  expect(loc.schedules[0].lastSession).toBeNull();
});

test("dayOfWeek filter is match-any across schedules", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", { email: "b@b.com", role: "user" });
    const loc = await ctx.db.insert("locations", {
      name: "Tue+Thu field",
      town: "Burlington",
      address: "1 X",
      lat: 44.5,
      lng: -73.2,
      details: "",
      ownerId: user,
      status: "approved" as const,
      submittedAt: Date.now(),
    });
    await ctx.db.insert("locationSchedules", {
      locationId: loc,
      dayOfWeek: 2,
      startTime: "18:00",
    });
    await ctx.db.insert("locationSchedules", {
      locationId: loc,
      dayOfWeek: 4,
      startTime: "18:00",
    });
    const loc2 = await ctx.db.insert("locations", {
      name: "Tue-only field",
      town: "Stowe",
      address: "2 X",
      lat: 44.4,
      lng: -72.7,
      details: "",
      ownerId: user,
      status: "approved" as const,
      submittedAt: Date.now(),
    });
    await ctx.db.insert("locationSchedules", {
      locationId: loc2,
      dayOfWeek: 2,
      startTime: "18:00",
    });
  });

  const tue = await t.query(api.public.listLocations, { dayOfWeek: 2 });
  expect(tue.map((l) => l.name).sort()).toEqual(["Tue+Thu field", "Tue-only field"]);

  const thu = await t.query(api.public.listLocations, { dayOfWeek: 4 });
  expect(thu.map((l) => l.name)).toEqual(["Tue+Thu field"]);
});
