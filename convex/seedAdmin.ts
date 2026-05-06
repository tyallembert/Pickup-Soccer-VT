"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD via `npx convex env set`",
      );
    }

    const existing = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: email },
    }).catch(() => null);
    if (existing) {
      console.log("Admin already exists:", existing.user._id);
      return existing.user._id;
    }

    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: { email },
      shouldLinkViaEmail: false,
    });

    await ctx.runMutation(internal.seedAdminHelpers.setAdminRole, {
      userId: user._id as Id<"users">,
    });
    console.log("Seeded admin:", user._id);
    return user._id;
  },
});
