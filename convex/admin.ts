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
      .order("asc")
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

export const allUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(1000);
    return Promise.all(
      users.map(async (u) => {
        const owned = await ctx.db
          .query("locations")
          .withIndex("by_owner_and_status", (q) => q.eq("ownerId", u._id))
          .collect();
        return {
          _id: u._id,
          name: u.name ?? null,
          email: u.email ?? null,
          phone: u.phone ?? null,
          role: u.role ?? "user",
          image: u.image ?? null,
          createdAt: u._creationTime,
          locationsCount: owned.length,
        };
      }),
    );
  },
});

export const adminGetUser = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(id);
    if (!user) return null;
    const owned = await ctx.db
      .query("locations")
      .withIndex("by_owner_and_status", (q) => q.eq("ownerId", id))
      .collect();
    const maintainers = await ctx.db
      .query("locationMaintainers")
      .withIndex("by_user_and_status", (q) => q.eq("userId", id))
      .collect();
    const maintainerRows = await Promise.all(
      maintainers.map(async (m) => {
        const loc = await ctx.db.get(m.locationId);
        return {
          _id: m._id,
          locationId: m.locationId,
          locationName: loc?.name ?? "(deleted)",
          locationTown: loc?.town ?? "",
          status: m.status,
          requestedAt: m.requestedAt,
          approvedAt: m.approvedAt,
        };
      }),
    );
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      role: user.role ?? "user",
      image: user.image ?? null,
      createdAt: user._creationTime,
      ownedLocations: owned
        .map((l) => ({
          _id: l._id,
          name: l.name,
          town: l.town,
          status: l.status,
          submittedAt: l.submittedAt,
        }))
        .sort((a, b) => b.submittedAt - a.submittedAt),
      maintainers: maintainerRows.sort((a, b) => b.requestedAt - a.requestedAt),
    };
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
    const schedules = await ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", id))
      .collect();
    return {
      ...loc,
      ownerEmail: owner?.email ?? "",
      schedules: schedules.map((s) => ({
        _id: s._id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    };
  },
});

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
    const days = await ctx.db
      .query("gameDays")
      .withIndex("by_location", (q) => q.eq("locationId", id))
      .take(1000);
    for (const d of days) await ctx.db.delete(d._id);
    const schedules = await ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", id))
      .take(1000);
    for (const s of schedules) await ctx.db.delete(s._id);
    const maintainers = await ctx.db
      .query("locationMaintainers")
      .withIndex("by_location_and_user", (q) => q.eq("locationId", id))
      .take(1000);
    for (const m of maintainers) await ctx.db.delete(m._id);
    await ctx.db.delete(id);
    return null;
  },
});

export const adminUpdateLocation = mutation({
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
    await requireAdmin(ctx);
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const adminSetSchedules = mutation({
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
    await requireAdmin(ctx);
    if (schedules.length < 1) {
      throw new ConvexError("A location must have at least one schedule.");
    }
    const existing = await ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", id))
      .collect();
    const incomingIds = new Set(
      schedules.filter((s) => s._id).map((s) => s._id as string),
    );
    for (const e of existing) {
      if (!incomingIds.has(e._id)) await ctx.db.delete(e._id);
    }
    for (const s of schedules) {
      if (s._id) {
        const row = await ctx.db.get(s._id);
        if (!row || row.locationId !== id) {
          throw new ConvexError("Schedule does not belong to this location.");
        }
        await ctx.db.patch(s._id, {
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        });
      } else {
        await ctx.db.insert("locationSchedules", {
          locationId: id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        });
      }
    }
    return null;
  },
});

export const adminSetScheduleStatus = mutation({
  args: {
    scheduleId: v.id("locationSchedules"),
    isOn: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { scheduleId, isOn, reason }) => {
    await requireAdmin(ctx);
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new ConvexError("Schedule not found");
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
        locationId: schedule.locationId,
        scheduleId,
        date,
        ...patch,
      });
    }
    return { date };
  },
});

export const adminSaveScheduleRecap = mutation({
  args: {
    scheduleId: v.id("locationSchedules"),
    turnout: v.optional(v.union(v.number(), v.null())),
    weatherCondition: v.optional(v.union(weatherCondition, v.null())),
    weather: v.optional(v.union(v.string(), v.null())),
    recapNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { scheduleId, ...args }) => {
    await requireAdmin(ctx);
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new ConvexError("Schedule not found");
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
        locationId: schedule.locationId,
        scheduleId,
        date,
        ...patch,
      });
    }
    return { date };
  },
});
