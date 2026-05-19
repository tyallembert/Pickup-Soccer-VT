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
    details: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const { location } = await requireOwnerOf(ctx, id);
    await ctx.db.patch(location._id, patch);
    return null;
  },
});

export const setSchedules = mutation({
  args: {
    id: v.id("locations"),
    schedules: v.array(
      v.object({
        _id: v.optional(v.id("locationSchedules")),
        dayOfWeek: v.number(),
        startTime: v.string(),
        endTime: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { id, schedules }) => {
    const { location } = await requireOwnerOf(ctx, id);
    if (schedules.length < 1) {
      throw new ConvexError("A location must have at least one schedule.");
    }

    const existing = await ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", location._id))
      .collect();
    const incomingIds = new Set(
      schedules.filter((s) => s._id).map((s) => s._id as string),
    );

    for (const e of existing) {
      if (!incomingIds.has(e._id)) {
        await ctx.db.delete(e._id);
      }
    }

    for (const s of schedules) {
      if (s._id) {
        const row = await ctx.db.get(s._id);
        if (!row || row.locationId !== location._id) {
          throw new ConvexError("Schedule does not belong to this location.");
        }
        await ctx.db.patch(s._id, {
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        });
      } else {
        await ctx.db.insert("locationSchedules", {
          locationId: location._id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        });
      }
    }
    return null;
  },
});

export const setScheduleStatus = mutation({
  args: {
    scheduleId: v.id("locationSchedules"),
    isOn: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { scheduleId, isOn, reason }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new ConvexError("Schedule not found");
    const { location } = await requireOwnerOf(ctx, schedule.locationId);
    if (location.status !== "approved") {
      throw new ConvexError("Location must be approved before setting weekly status.");
    }
    const date = upcomingGameDay(new Date(), schedule.dayOfWeek, schedule.startTime);
    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_schedule_and_date", (q) =>
        q.eq("scheduleId", scheduleId).eq("date", date),
      )
      .unique();
    const patch = { isOn, reason: isOn ? undefined : reason };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", {
        locationId: location._id,
        scheduleId,
        date,
        ...patch,
      });
    }
    return { date, isOn };
  },
});

export const saveScheduleRecap = mutation({
  args: {
    scheduleId: v.id("locationSchedules"),
    turnout: v.optional(v.union(v.number(), v.null())),
    weatherCondition: v.optional(v.union(weatherCondition, v.null())),
    weather: v.optional(v.union(v.string(), v.null())),
    recapNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { scheduleId, ...args }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new ConvexError("Schedule not found");
    const { location } = await requireOwnerOf(ctx, schedule.locationId);
    if (location.status !== "approved") {
      throw new ConvexError("Location must be approved before writing a recap.");
    }
    const date = mostRecentPastGameDay(
      new Date(),
      schedule.dayOfWeek,
      schedule.startTime,
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
      .withIndex("by_schedule_and_date", (q) =>
        q.eq("scheduleId", scheduleId).eq("date", date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", {
        locationId: location._id,
        scheduleId,
        date,
        ...patch,
      });
    }
    return { date };
  },
});
