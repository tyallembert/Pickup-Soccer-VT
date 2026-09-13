import { v } from "convex/values";

// Notification copy lives here, as pure functions, so it can be unit-tested
// without standing up the Node runtime that actually delivers the push.

export type PushEvent =
  | {
      kind: "locationPending";
      locationId: string;
      name: string;
      town: string;
    }
  | { kind: "userSignup"; userId: string; email?: string }
  | { kind: "maintainerRequest"; locationId: string; name: string }
  | { kind: "pendingDigest"; pendingCount: number };

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /**
   * Notifications sharing a tag replace one another on the device. Keying the
   * tag to the entity means a resubmitted location updates its existing
   * notification rather than stacking a duplicate.
   */
  tag: string;
};

export function buildPushPayload(event: PushEvent): PushPayload {
  switch (event.kind) {
    case "locationPending":
      return {
        title: "New field awaiting review",
        body: `${event.name} — ${event.town}`,
        url: `/admin/queue/${event.locationId}`,
        tag: `location:${event.locationId}`,
      };

    case "userSignup":
      return {
        title: "New signup",
        body: event.email ?? "A new account was created.",
        url: `/admin/users/${event.userId}`,
        tag: `user:${event.userId}`,
      };

    case "maintainerRequest":
      return {
        title: "Co-maintainer request",
        body: `Someone asked to help maintain ${event.name}.`,
        url: `/admin/locations/${event.locationId}`,
        tag: `maintainer:${event.locationId}`,
      };

    case "pendingDigest": {
      const n = event.pendingCount;
      return {
        title: "Pending queue",
        body:
          n === 1
            ? "1 submission is waiting for review."
            : `${n} submissions are waiting for review.`,
        url: "/admin/queue",
        tag: "digest",
      };
    }
  }
}

// Convex validator mirroring PushEvent, shared by the internal mutation and the
// Node action so the union is declared once.
export const pushEventValidator = v.union(
  v.object({
    kind: v.literal("locationPending"),
    locationId: v.id("locations"),
    name: v.string(),
    town: v.string(),
  }),
  v.object({
    kind: v.literal("userSignup"),
    userId: v.id("users"),
    email: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("maintainerRequest"),
    locationId: v.id("locations"),
    name: v.string(),
  }),
  v.object({
    kind: v.literal("pendingDigest"),
    pendingCount: v.number(),
  }),
);

export const pushPayloadValidator = v.object({
  title: v.string(),
  body: v.string(),
  url: v.string(),
  tag: v.string(),
});

export const pushTargetValidator = v.object({
  endpoint: v.string(),
  p256dh: v.string(),
  auth: v.string(),
});
