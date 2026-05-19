/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

async function seedField(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {
      email: "owner@x.com",
      role: "user",
    });
    const loc = await ctx.db.insert("locations", {
      name: "Multi field",
      town: "Burlington",
      address: "1 Main",
      lat: 44.5,
      lng: -73.2,
      details: "",
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
    const thuId = await ctx.db.insert("locationSchedules", {
      locationId: loc,
      dayOfWeek: 4,
      startTime: "18:00",
    });
    return { user, loc, tueId, thuId };
  });
}

test("setScheduleStatus upserts gameDays keyed by (scheduleId, date)", async () => {
  const t = convexTest(schema, modules);
  const { user, tueId, thuId, loc } = await seedField(t);
  const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });

  await asUser.mutation(api.owner.setScheduleStatus, {
    scheduleId: tueId,
    isOn: false,
    reason: "rain",
  });

  const rows = await t.run((ctx) =>
    ctx.db
      .query("gameDays")
      .withIndex("by_location", (q) => q.eq("locationId", loc))
      .collect(),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].scheduleId).toBe(tueId);
  expect(rows[0].isOn).toBe(false);
  expect(rows[0].reason).toBe("rain");
  const thuRows = rows.filter((r) => r.scheduleId === thuId);
  expect(thuRows).toHaveLength(0);
});

test("setSchedules adds, updates, and removes slots while preserving _id", async () => {
  const t = convexTest(schema, modules);
  const { user, loc, tueId, thuId } = await seedField(t);
  const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });

  await asUser.mutation(api.owner.setSchedules, {
    id: loc,
    schedules: [
      { _id: tueId, dayOfWeek: 2, startTime: "19:00" },
      { dayOfWeek: 6, startTime: "10:00" },
    ],
  });

  const after = await t.run((ctx) =>
    ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", loc))
      .collect(),
  );
  expect(after).toHaveLength(2);
  const tue = after.find((s) => s._id === tueId)!;
  expect(tue.startTime).toBe("19:00");
  const sat = after.find((s) => s.dayOfWeek === 6)!;
  expect(sat.startTime).toBe("10:00");
  expect(after.find((s) => s._id === thuId)).toBeUndefined();
});
