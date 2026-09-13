import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        // Public sign-up is enabled. New accounts get role="user" by default.
        // The super-admin role is granted only by the seed script in Task 4.
        return {
          email: params.email as string,
          role: "user",
        };
      },
    }),
  ],
  callbacks: {
    // Runs on every sign-in; `existingUserId === null` is what distinguishes a
    // brand-new account from a returning one.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId !== null) return;

      const user = await ctx.db.get(userId);
      await ctx.scheduler.runAfter(0, internal.push.notifyAdmins, {
        event: {
          kind: "userSignup",
          userId,
          email: user?.email ?? undefined,
        },
        // An admin creating their own account should not be pushed about it.
        excludeUserId: userId,
      });
    },
  },
});
