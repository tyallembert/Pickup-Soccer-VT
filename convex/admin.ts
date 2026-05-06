import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { mostRecentPastGameDay, upcomingGameDay } from "./lib/dates";
import { locationStatus, weatherCondition } from "./schema";

export const pendingLocations = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("locations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc") // oldest first by _creationTime within the index
      .take(100);
    return Promise.all(
      rows.map(async (r) => {
        const owner = await ctx.db.get(r.ownerId);
        return {
          _id: r._id,
          name: r.name,
          town: r.town,
          ownerEmail: owner?.email ?? "",
          submittedAt: r.submittedAt,
        };
      }),
    );
  },
});

export const allLocations = query({
  args: { status: v.optional(locationStatus) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const rows = status
      ? await ctx.db
          .query("locations")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(500)
      : await ctx.db.query("locations").take(500);
    return Promise.all(
      rows.map(async (r) => {
        const owner = await ctx.db.get(r.ownerId);
        return {
          _id: r._id,
          name: r.name,
          town: r.town,
          status: r.status,
          ownerEmail: owner?.email ?? "",
          submittedAt: r.submittedAt,
          approvedAt: r.approvedAt,
          rejectionReason: r.rejectionReason,
        };
      }),
    );
  },
});

export const adminGetLocation = query({
  args: { id: v.id("locations") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const loc = await ctx.db.get(id);
    if (!loc) return null;
    const owner = await ctx.db.get(loc.ownerId);
    return {
      ...loc,
      ownerEmail: owner?.email ?? "",
    };
  },
});

// Moderation

export const approveLocation = mutation({
  args: { id: v.id("locations") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const loc = await ctx.db.get(id);
    if (!loc) throw new ConvexError("Location not found");
    await ctx.db.patch(id, {
      status: "approved",
      approvedAt: Date.now(),
      rejectionReason: undefined,
    });
    return null;
  },
});

export const rejectLocation = mutation({
  args: { id: v.id("locations"), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    await requireAdmin(ctx);
    const loc = await ctx.db.get(id);
    if (!loc) throw new ConvexError("Location not found");
    await ctx.db.patch(id, { status: "rejected", rejectionReason: reason });
    return null;
  },
});

export const remoderateLocation = mutation({
  args: { id: v.id("locations") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, {
      status: "pending",
      approvedAt: undefined,
      rejectionReason: undefined,
    });
    return null;
  },
});

export const deleteLocation = mutation({
  args: { id: v.id("locations") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    // Delete all gameDays rows for this location, then the location itself.
    // Convex mutation transaction limits handle 100s of rows easily; if a
    // single location ever has thousands of gameDays rows this can be made
    // batched + scheduled, but v2 doesn't need that.
    const days = await ctx.db
      .query("gameDays")
      .withIndex("by_location", (q) => q.eq("locationId", id))
      .take(1000);
    for (const d of days) {
      await ctx.db.delete(d._id);
    }
    await ctx.db.delete(id);
    return null;
  },
});

// Admin overrides — same shape as owner mutations, gated by requireAdmin.

export const adminUpdateLocation = mutation({
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
    await requireAdmin(ctx);
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const adminSetLocationStatus = mutation({
  args: {
    id: v.id("locations"),
    isOn: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { id, isOn, reason }) => {
    await requireAdmin(ctx);
    const loc = await ctx.db.get(id);
    if (!loc) throw new ConvexError("Location not found");
    const date = upcomingGameDay(new Date(), loc.dayOfWeek, loc.startTime);
    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_location_and_date", (q) =>
        q.eq("locationId", id).eq("date", date),
      )
      .unique();
    const patch = { isOn, reason: isOn ? undefined : reason };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", { locationId: id, date, ...patch });
    }
    return { date };
  },
});

export const adminSaveRecap = mutation({
  args: {
    id: v.id("locations"),
    turnout: v.optional(v.union(v.number(), v.null())),
    weatherCondition: v.optional(v.union(weatherCondition, v.null())),
    weather: v.optional(v.union(v.string(), v.null())),
    recapNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...args }) => {
    await requireAdmin(ctx);
    const loc = await ctx.db.get(id);
    if (!loc) throw new ConvexError("Location not found");
    const date = mostRecentPastGameDay(new Date(), loc.dayOfWeek, loc.startTime);

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
        q.eq("locationId", id).eq("date", date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", { locationId: id, date, ...patch });
    }
    return { date };
  },
});
