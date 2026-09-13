import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import {
  buildPushPayload,
  pushEventValidator,
  type PushEvent,
} from "./lib/pushPayloads";

/**
 * The VAPID public key is served from here rather than duplicated into a
 * NEXT_PUBLIC_* env var, so the keypair has exactly one source of truth.
 * Returns null when unconfigured so the UI can say so instead of throwing.
 */
export const vapidPublicKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

/**
 * Upsert by endpoint. The push service issues one endpoint per browser+device,
 * so re-subscribing the same device must refresh the keys on the existing row
 * rather than accumulate duplicates.
 *
 * Requires authentication but deliberately NOT admin: only admins see the
 * opt-in UI today, but keeping the mutation role-agnostic means a future
 * user-facing notification needs no migration.
 */
export const savePushSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: user._id,
        p256dh: args.p256dh,
        auth: args.auth,
        userAgent: args.userAgent,
        failureCount: 0,
      });
      return null;
    }

    await ctx.db.insert("pushSubscriptions", {
      userId: user._id,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent,
      createdAt: Date.now(),
      failureCount: 0,
    });
    return null;
  },
});

export const deletePushSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const user = await requireAuth(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    // Only unsubscribe your own device. A stale endpoint that now belongs to
    // someone else is left alone.
    if (existing && existing.userId === user._id) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/** Whether THIS device (identified by its endpoint) is registered. */
export const mySubscriptionStatus = query({
  args: { endpoint: v.optional(v.string()) },
  handler: async (ctx, { endpoint }) => {
    const user = await requireAuth(ctx);
    if (!endpoint) return { subscribed: false };
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    return { subscribed: !!existing && existing.userId === user._id };
  },
});

/**
 * Fan out an event to every subscribed admin. Internal: unreachable from any
 * client. Callers schedule this rather than calling it inline so a push
 * failure can never roll back the user action that triggered it.
 */
export const notifyAdmins = internalMutation({
  args: {
    event: pushEventValidator,
    /** The acting user, so an admin is not pushed about their own action. */
    excludeUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, { event, excludeUserId }) => {
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    const targets: {
      endpoint: string;
      p256dh: string;
      auth: string;
    }[] = [];

    for (const admin of admins) {
      if (excludeUserId && admin._id === excludeUserId) continue;
      const subs = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", admin._id))
        .collect();
      for (const s of subs) {
        targets.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
      }
    }

    if (targets.length === 0) return null;

    await ctx.scheduler.runAfter(0, internal.pushNode.send, {
      subscriptions: targets,
      payload: buildPushPayload(event as PushEvent),
    });
    return null;
  },
});

/**
 * Applied in one transaction after the Node action has attempted every
 * delivery, rather than one round trip per subscription.
 *
 * "gone" is a 404/410 from the push service — the standard "this endpoint no
 * longer exists" answer — and the row is deleted. Anything else is transient:
 * the row stays and only its failure count moves.
 */
export const applyDeliveryResults = internalMutation({
  args: {
    results: v.array(
      v.object({
        endpoint: v.string(),
        status: v.union(
          v.literal("ok"),
          v.literal("gone"),
          v.literal("failed"),
        ),
      }),
    ),
  },
  handler: async (ctx, { results }) => {
    for (const r of results) {
      const row = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_endpoint", (q) => q.eq("endpoint", r.endpoint))
        .unique();
      if (!row) continue;

      if (r.status === "gone") {
        await ctx.db.delete(row._id);
      } else if (r.status === "ok") {
        await ctx.db.patch(row._id, {
          lastSuccessAt: Date.now(),
          failureCount: 0,
        });
      } else {
        await ctx.db.patch(row._id, {
          failureCount: (row.failureCount ?? 0) + 1,
        });
      }
    }
    return null;
  },
});

/** Cron entry point. Silent when the queue is empty. */
export const sendPendingDigest = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("locations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    if (pending.length === 0) return null;

    await ctx.scheduler.runAfter(0, internal.push.notifyAdmins, {
      event: { kind: "pendingDigest", pendingCount: pending.length },
    });
    return null;
  },
});
