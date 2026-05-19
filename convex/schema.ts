import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const weatherCondition = v.union(
  v.literal("sunny"),
  v.literal("cloudy"),
  v.literal("rainy"),
  v.literal("snowy"),
  v.literal("windy"),
  v.literal("cold"),
);

export const locationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export default defineSchema({
  ...authTables,

  // Index names "email" and "phone" must match exactly what @convex-dev/auth
  // expects internally — do not rename to follow the project's by_<field>
  // convention.
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  locations: defineTable({
    name: v.string(),
    town: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    dayOfWeek: v.optional(v.number()), // 0 = Sunday … 6 = Saturday
    startTime: v.optional(v.string()), // "HH:mm" 24-hour
    details: v.string(), // markdown
    ownerId: v.id("users"),
    status: locationStatus,
    rejectionReason: v.optional(v.string()),
    submittedAt: v.number(),
    approvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_status_and_town", ["status", "town"]),

  locationSchedules: defineTable({
    locationId: v.id("locations"),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.optional(v.string()),
  })
    .index("by_location", ["locationId"])
    .index("by_dayOfWeek", ["dayOfWeek"]),

  gameDays: defineTable({
    locationId: v.id("locations"),
    scheduleId: v.optional(v.id("locationSchedules")),
    date: v.string(), // "YYYY-MM-DD" in America/New_York
    isOn: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    turnout: v.optional(v.number()),
    weatherCondition: v.optional(weatherCondition),
    weather: v.optional(v.string()),
    recapNotes: v.optional(v.string()),
  })
    .index("by_location_and_date", ["locationId", "date"])
    .index("by_location", ["locationId"])
    .index("by_schedule_and_date", ["scheduleId", "date"]),

  // Co-maintainer relationships. The primary owner (locations.ownerId) approves
  // requests and can revoke. An "approved" row grants the same edit powers the
  // primary owner has, except it cannot manage other maintainers.
  locationMaintainers: defineTable({
    locationId: v.id("locations"),
    userId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("approved")),
    requestedAt: v.number(),
    approvedAt: v.optional(v.number()),
  })
    .index("by_location_and_user", ["locationId", "userId"])
    .index("by_location_and_status", ["locationId", "status"])
    .index("by_user_and_status", ["userId", "status"]),
});
