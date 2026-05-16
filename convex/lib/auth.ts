import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not authenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("Not authenticated");
  }
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new ConvexError("Forbidden");
  }
  return user;
}

export type LocationRole = "owner" | "admin" | "maintainer";

export type LocationAccess = {
  user: Doc<"users">;
  location: Doc<"locations">;
  role: LocationRole;
};

// Allows the primary owner, any admin, OR an approved co-maintainer.
export async function requireOwnerOf(
  ctx: QueryCtx | MutationCtx,
  locationId: Id<"locations">,
): Promise<LocationAccess> {
  const user = await requireAuth(ctx);
  const location = await ctx.db.get(locationId);
  if (!location) {
    throw new ConvexError("Location not found");
  }
  if (location.ownerId === user._id) {
    return { user, location, role: "owner" };
  }
  if (user.role === "admin") {
    return { user, location, role: "admin" };
  }
  const maintainer = await ctx.db
    .query("locationMaintainers")
    .withIndex("by_location_and_user", (q) =>
      q.eq("locationId", locationId).eq("userId", user._id),
    )
    .unique();
  if (maintainer && maintainer.status === "approved") {
    return { user, location, role: "maintainer" };
  }
  throw new ConvexError("Forbidden");
}

// Only the primary owner (or an admin) — used for managing maintainers and
// the resubmit-for-review flow.
export async function requirePrimaryOwnerOf(
  ctx: QueryCtx | MutationCtx,
  locationId: Id<"locations">,
): Promise<{ user: Doc<"users">; location: Doc<"locations"> }> {
  const user = await requireAuth(ctx);
  const location = await ctx.db.get(locationId);
  if (!location) {
    throw new ConvexError("Location not found");
  }
  const isOwner = location.ownerId === user._id;
  const isAdmin = user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new ConvexError("Forbidden");
  }
  return { user, location };
}
