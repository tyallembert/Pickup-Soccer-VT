import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const weatherCondition = v.union(
  v.literal("sunny"),
  v.literal("cloudy"),
  v.literal("rainy"),
  v.literal("snowy"),
  v.literal("windy"),
  v.literal("cold"),
);

export default defineSchema({
  ...authTables,

  // Override authTables.users to add a `role` field used by requireAdmin().
  // Index names must match exactly what @convex-dev/auth expects internally —
  // do not rename to follow the project's by_<field> convention.
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

  settings: defineTable({
    dayOfWeek: v.number(), // 0 = Sunday … 6 = Saturday
    startTime: v.string(), // "HH:mm" 24-hour, e.g. "18:00"
    location: v.string(),
    details: v.string(), // markdown
  }),

  gameDays: defineTable({
    date: v.string(), // "YYYY-MM-DD" in America/New_York
    isOn: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    turnout: v.optional(v.number()),
    weatherCondition: v.optional(weatherCondition),
    weather: v.optional(v.string()),
    recapNotes: v.optional(v.string()),
  }).index("by_date", ["date"]),
});
