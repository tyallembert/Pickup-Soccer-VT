/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const locations = [
  {
    name: "Sunday Morning Pickup",
    town: "Shelburne",
    address: "166 Athletic Drive",
    lat: 44.38,
    lng: -73.22,
    details: "Indoor 7v7",
    status: "approved" as const,
    schedules: [
      { dayOfWeek: 0, startTime: "07:00" },
      { dayOfWeek: 3, startTime: "18:00", endTime: "20:00" },
    ],
  },
  {
    name: "Brattleboro Common",
    town: "Brattleboro",
    address: "1 Main St",
    lat: 42.85,
    lng: -72.56,
    details: "",
    status: "pending" as const,
    schedules: [{ dayOfWeek: 6, startTime: "10:00" }],
  },
];

test("run imports locations and schedules owned by the admin", async () => {
  const t = convexTest(schema, modules);
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "admin@example.com", role: "admin" }),
  );

  const inserted = await t.mutation(internal.seedLocations.run, {
    ownerEmail: "admin@example.com",
    locations,
  });
  expect(inserted).toBe(2);

  const { locs, schedules } = await t.run(async (ctx) => ({
    locs: await ctx.db.query("locations").collect(),
    schedules: await ctx.db.query("locationSchedules").collect(),
  }));
  expect(locs).toHaveLength(2);
  expect(locs.every((l) => l.ownerId === adminId)).toBe(true);
  const approved = locs.find((l) => l.status === "approved")!;
  const pending = locs.find((l) => l.status === "pending")!;
  expect(approved.approvedAt).toBeTypeOf("number");
  expect(pending.approvedAt).toBeUndefined();
  expect(schedules.filter((s) => s.locationId === approved._id)).toHaveLength(2);
  expect(schedules.filter((s) => s.locationId === pending._id)).toHaveLength(1);
});

test("run does nothing once any location exists", async () => {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("users", { email: "admin@example.com", role: "admin" }),
  );
  const args = { ownerEmail: "admin@example.com", locations };

  await t.mutation(internal.seedLocations.run, args);
  expect(await t.mutation(internal.seedLocations.run, args)).toBe(0);

  const count = await t.run(
    async (ctx) => (await ctx.db.query("locations").collect()).length,
  );
  expect(count).toBe(2);
});

test("run fails when the owner account does not exist", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(internal.seedLocations.run, {
      ownerEmail: "nobody@example.com",
      locations,
    }),
  ).rejects.toThrow(/seedAdmin:run/);
});
