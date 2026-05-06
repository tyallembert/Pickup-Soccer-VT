import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { locationStatus } from "./schema";

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
