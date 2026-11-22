import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { locationStatus, seasonValidator } from "./schema";

/**
 * Seeds a fresh deployment with docs/seed-data/pickup-games.json, owned by the
 * admin account. dev/bootstrap.mjs calls it after `seedAdmin:run`, passing the
 * file's `locations` without their `_`-prefixed bookkeeping keys (Convex
 * rejects field names that start with `_`).
 *
 * Does nothing once any location exists, so it is safe to re-run and can never
 * duplicate real data.
 */
export const run = internalMutation({
  args: {
    ownerEmail: v.string(),
    locations: v.array(
      v.object({
        name: v.string(),
        town: v.string(),
        address: v.string(),
        lat: v.number(),
        lng: v.number(),
        details: v.string(),
        season: v.optional(seasonValidator),
        status: locationStatus,
        schedules: v.array(
          v.object({
            dayOfWeek: v.number(),
            startTime: v.string(),
            endTime: v.optional(v.string()),
          }),
        ),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { ownerEmail, locations }) => {
    if ((await ctx.db.query("locations").first()) !== null) return 0;

    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .first();
    if (owner === null) {
      throw new Error(`No user with email ${ownerEmail}. Run seedAdmin:run first.`);
    }

    const now = Date.now();
    for (const { schedules, ...location } of locations) {
      const locationId = await ctx.db.insert("locations", {
        ...location,
        ownerId: owner._id,
        submittedAt: now,
        approvedAt: location.status === "approved" ? now : undefined,
      });
      for (const schedule of schedules) {
        await ctx.db.insert("locationSchedules", { locationId, ...schedule });
      }
    }
    return locations.length;
  },
});
