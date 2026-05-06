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

export async function requireOwnerOf(
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
