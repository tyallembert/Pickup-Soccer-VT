import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { requireOwnerOf } from "./lib/auth";
import { mostRecentPastGameDay, upcomingGameDay } from "./lib/dates";
import { weatherCondition } from "./schema";

export const updateLocation = mutation({
  args: {
    id: v.id("locations"),
    name: v.optional(v.string()),
    town: v.optional(v.string()),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    dayOfWeek: v.optional(v.number()),
    startTime: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const { location } = await requireOwnerOf(ctx, id);
    await ctx.db.patch(location._id, patch);
    return null;
  },
});

export const setLocationStatus = mutation({
  args: {
    id: v.id("locations"),
    isOn: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { id, isOn, reason }) => {
    const { location } = await requireOwnerOf(ctx, id);
    if (location.status !== "approved") {
      throw new ConvexError("Location must be approved before setting weekly status.");
    }
    const date = upcomingGameDay(new Date(), location.dayOfWeek, location.startTime);
    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_location_and_date", (q) =>
        q.eq("locationId", location._id).eq("date", date),
      )
      .unique();

    const patch = { isOn, reason: isOn ? undefined : reason };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", {
        locationId: location._id,
        date,
        ...patch,
      });
    }
    return { date, isOn };
  },
});

export const saveRecap = mutation({
  args: {
    id: v.id("locations"),
    turnout: v.optional(v.union(v.number(), v.null())),
    weatherCondition: v.optional(v.union(weatherCondition, v.null())),
    weather: v.optional(v.union(v.string(), v.null())),
    recapNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...args }) => {
    const { location } = await requireOwnerOf(ctx, id);
    if (location.status !== "approved") {
      throw new ConvexError("Location must be approved before writing a recap.");
    }
    const date = mostRecentPastGameDay(
      new Date(),
      location.dayOfWeek,
      location.startTime,
    );

    const patch: Record<string, unknown> = {};
    for (const key of [
      "turnout",
      "weatherCondition",
      "weather",
      "recapNotes",
    ] as const) {
      const value = args[key];
      if (value !== undefined) {
        patch[key] = value === null ? undefined : value;
      }
    }

    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_location_and_date", (q) =>
        q.eq("locationId", location._id).eq("date", date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", {
        locationId: location._id,
        date,
        ...patch,
      });
    }
    return { date };
  },
});
