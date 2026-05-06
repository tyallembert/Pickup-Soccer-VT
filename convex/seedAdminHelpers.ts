import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const setAdminRole = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { role: "admin" });
  },
});
