import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { requireAuth, requirePrimaryOwnerOf } from "./lib/auth";

const MAX_NOT_YET_APPROVED = 3;

export const submitLocation = mutation({
  args: {
    name: v.string(),
    town: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    details: v.string(),
    schedules: v.array(
      v.object({
        dayOfWeek: v.number(),
        startTime: v.string(),
        endTime: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.schedules.length < 1) {
      throw new ConvexError("A location must have at least one schedule.");
    }

    const pending = await ctx.db
      .query("locations")
      .withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "pending"),
      )
      .take(MAX_NOT_YET_APPROVED + 1);
    const rejected = await ctx.db
      .query("locations")
      .withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", user._id).eq("status", "rejected"),
      )
      .take(MAX_NOT_YET_APPROVED + 1);
    if (pending.length + rejected.length >= MAX_NOT_YET_APPROVED) {
      throw new ConvexError(
        "You have too many submissions awaiting review. Finish your existing ones first.",
      );
    }

    const { schedules, ...locArgs } = args;
    const id = await ctx.db.insert("locations", {
      ...locArgs,
      ownerId: user._id,
      status: "pending",
      submittedAt: Date.now(),
    });
    for (const s of schedules) {
      await ctx.db.insert("locationSchedules", {
        locationId: id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      });
    }
    return id;
  },
});

export const resubmitLocation = mutation({
  args: { id: v.id("locations") },
  handler: async (ctx, { id }) => {
    const { location } = await requirePrimaryOwnerOf(ctx, id);
    if (location.status !== "rejected") {
      throw new ConvexError("Only rejected submissions can be resubmitted.");
    }
    await ctx.db.patch(location._id, {
      status: "pending",
      rejectionReason: undefined,
    });
    return null;
  },
});
