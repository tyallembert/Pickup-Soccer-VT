import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

const BATCH = 25;

// One-shot backfill that creates a single locationSchedules row per legacy
// location (using its dayOfWeek + startTime) and stamps every existing
// gameDays row at that location with the new scheduleId. Idempotent:
// re-running skips locations that already have a schedule. Self-schedules
// until no more locations need processing.
export const runBackfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    const locations = await ctx.db.query("locations").take(BATCH * 4);
    let processed = 0;

    for (const loc of locations) {
      const existing = await ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", loc._id))
        .first();
      if (existing) continue;

      if (loc.dayOfWeek === undefined || loc.startTime === undefined) {
        continue;
      }

      const scheduleId = await ctx.db.insert("locationSchedules", {
        locationId: loc._id,
        dayOfWeek: loc.dayOfWeek,
        startTime: loc.startTime,
      });

      const days = await ctx.db
        .query("gameDays")
        .withIndex("by_location", (q) => q.eq("locationId", loc._id))
        .take(1000);
      for (const d of days) {
        if (d.scheduleId) continue;
        await ctx.db.patch(d._id, { scheduleId });
      }

      processed += 1;
      if (processed >= BATCH) break;
    }

    if (processed === BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.locationSchedules.runBackfill,
        {},
      );
    }

    return { processed };
  },
});
