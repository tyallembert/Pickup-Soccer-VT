import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";

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
});
