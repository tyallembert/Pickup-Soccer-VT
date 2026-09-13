"use node";

import webpush from "web-push";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  pushPayloadValidator,
  pushTargetValidator,
} from "./lib/pushPayloads";

type DeliveryStatus = "ok" | "gone" | "failed";

/**
 * Signs the VAPID JWT, encrypts each payload, and delivers to the browser push
 * services. Lives in its own file because the Convex guidelines forbid
 * `"use node"` in a module that also exports queries or mutations.
 */
export const send = internalAction({
  args: {
    subscriptions: v.array(pushTargetValidator),
    payload: pushPayloadValidator,
  },
  handler: async (ctx, { subscriptions, payload }) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      throw new Error(
        "Web push is not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY " +
          "and VAPID_SUBJECT with `npx convex env set`.",
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = JSON.stringify(payload);

    const settled = await Promise.allSettled(
      subscriptions.map((s) =>
        webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 * 12 },
        ),
      ),
    );

    const results = settled.map((outcome, i) => {
      const endpoint = subscriptions[i].endpoint;
      if (outcome.status === "fulfilled") {
        return { endpoint, status: "ok" as DeliveryStatus };
      }
      // 404/410 is the push service saying this endpoint is permanently gone,
      // which is how subscriptions expire. Everything else may be transient.
      const code = (outcome.reason as { statusCode?: number })?.statusCode;
      const status: DeliveryStatus =
        code === 404 || code === 410 ? "gone" : "failed";
      if (status === "failed") {
        console.error(
          `push delivery failed (${code ?? "no status"}):`,
          outcome.reason,
        );
      }
      return { endpoint, status };
    });

    await ctx.runMutation(internal.push.applyDeliveryResults, { results });

    // Returned rather than swallowed so a delivery problem can be inspected
    // with `npx convex run pushNode:send`.
    return {
      delivered: results.filter((r) => r.status === "ok").length,
      dropped: results.filter((r) => r.status === "gone").length,
      failed: results.filter((r) => r.status === "failed").length,
    };
  },
});
