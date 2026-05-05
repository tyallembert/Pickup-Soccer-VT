import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { DataModel } from "./_generated/dataModel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      // profile() runs only on the sign-up code path. Throwing here disables
      // public sign-up. The seed script bypasses this by calling
      // createAccount() directly from an internal action.
      profile() {
        throw new ConvexError("Public sign-up is disabled.");
      },
    }),
  ],
});
