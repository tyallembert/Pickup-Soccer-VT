import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireAuth, requirePrimaryOwnerOf } from "./lib/auth";

export const requestMaintainership = mutation({
  args: { locationId: v.id("locations") },
  handler: async (ctx, { locationId }) => {
    const user = await requireAuth(ctx);
    const location = await ctx.db.get(locationId);
    if (!location || location.status !== "approved") {
      throw new ConvexError("Location not found");
    }
    if (location.ownerId === user._id) {
      throw new ConvexError("You already organize this field.");
    }
    const existing = await ctx.db
      .query("locationMaintainers")
      .withIndex("by_location_and_user", (q) =>
        q.eq("locationId", locationId).eq("userId", user._id),
      )
      .unique();
    if (existing) {
      throw new ConvexError(
        existing.status === "approved"
          ? "You already help maintain this field."
          : "Your request is already pending.",
      );
    }
    await ctx.db.insert("locationMaintainers", {
      locationId,
      userId: user._id,
      status: "pending",
      requestedAt: Date.now(),
    });
    return null;
  },
});

export const cancelMyRequest = mutation({
  args: { locationId: v.id("locations") },
  handler: async (ctx, { locationId }) => {
    const user = await requireAuth(ctx);
    const existing = await ctx.db
      .query("locationMaintainers")
      .withIndex("by_location_and_user", (q) =>
        q.eq("locationId", locationId).eq("userId", user._id),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const approveMaintainer = mutation({
  args: { id: v.id("locationMaintainers") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError("Request not found");
    await requirePrimaryOwnerOf(ctx, row.locationId);
    if (row.status === "approved") return null;
    await ctx.db.patch(row._id, {
      status: "approved",
      approvedAt: Date.now(),
    });
    return null;
  },
});

export const denyMaintainer = mutation({
  args: { id: v.id("locationMaintainers") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return null;
    await requirePrimaryOwnerOf(ctx, row.locationId);
    if (row.status !== "pending") {
      throw new ConvexError("Only pending requests can be denied.");
    }
    await ctx.db.delete(row._id);
    return null;
  },
});

export const revokeMaintainer = mutation({
  args: { id: v.id("locationMaintainers") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return null;
    await requirePrimaryOwnerOf(ctx, row.locationId);
    await ctx.db.delete(row._id);
    return null;
  },
});

export const listMaintainersForLocation = query({
  args: { locationId: v.id("locations") },
  handler: async (ctx, { locationId }) => {
    await requirePrimaryOwnerOf(ctx, locationId);
    const rows = await ctx.db
      .query("locationMaintainers")
      .withIndex("by_location_and_user", (q) => q.eq("locationId", locationId))
      .collect();
    return Promise.all(
      rows.map(async (r) => {
        const u = await ctx.db.get(r.userId);
        return {
          _id: r._id,
          status: r.status,
          requestedAt: r.requestedAt,
          approvedAt: r.approvedAt,
          email: u?.email ?? "",
        };
      }),
    );
  },
});

// Returns the viewer's relationship to a location. Returns null when the
// viewer is signed out. `status` is "owner" for the primary owner, otherwise
// "none" | "pending" | "approved".
export const getMyMaintainerStatus = query({
  args: { locationId: v.id("locations") },
  handler: async (ctx, { locationId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const location = await ctx.db.get(locationId);
    if (!location) return null;
    if (location.ownerId === user._id) {
      return { status: "owner" as const };
    }
    const row = await ctx.db
      .query("locationMaintainers")
      .withIndex("by_location_and_user", (q) =>
        q.eq("locationId", locationId).eq("userId", user._id),
      )
      .unique();
    return { status: (row?.status ?? "none") as "none" | "pending" | "approved" };
  },
});

export const myMaintainedLocations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const rows = await ctx.db
      .query("locationMaintainers")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "approved"),
      )
      .take(50);
    const results: Array<{
      _id: string;
      name: string;
      town: string;
      status: string;
      schedules: Array<{
        _id: string;
        dayOfWeek: number;
        startTime: string;
        endTime?: string;
      }>;
    }> = [];
    for (const r of rows) {
      const loc = await ctx.db.get(r.locationId);
      if (loc) {
        const schedules = await ctx.db
          .query("locationSchedules")
          .withIndex("by_location", (q) => q.eq("locationId", loc._id))
          .collect();
        results.push({
          _id: loc._id,
          name: loc.name,
          town: loc.town,
          status: loc.status,
          schedules: schedules.map((s) => ({
            _id: s._id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }
    }
    return results;
  },
});
