/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("submitLocation creates location and schedules in one mutation", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "u@x.com", role: "user" }),
  );
  const asUser = t.withIdentity({ subject: userId, tokenIdentifier: userId });

  const locId = await asUser.mutation(api.submissions.submitLocation, {
    name: "Two-slot park",
    town: "Burlington",
    address: "1 Main",
    lat: 44.5,
    lng: -73.2,
    details: "",
    schedules: [
      { dayOfWeek: 2, startTime: "18:00", endTime: "20:00" },
      { dayOfWeek: 4, startTime: "18:00" },
    ],
  });

  const { loc, schedules } = await t.run(async (ctx) => {
    const loc = await ctx.db.get(locId);
    const schedules = await ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", locId))
      .collect();
    return { loc, schedules };
  });
  expect(loc!.status).toBe("pending");
  expect(schedules).toHaveLength(2);
});

test("submitLocation rejects empty schedules", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "u@x.com", role: "user" }),
  );
  const asUser = t.withIdentity({ subject: userId, tokenIdentifier: userId });
  await expect(
    asUser.mutation(api.submissions.submitLocation, {
      name: "x",
      town: "x",
      address: "x",
      lat: 0,
      lng: 0,
      details: "",
      schedules: [],
    }),
  ).rejects.toThrow();
});
