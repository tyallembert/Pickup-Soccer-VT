import { UserDetailClient } from "./UserDetailClient";
import type { Id } from "@/convex/_generated/dataModel";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetailClient id={id as Id<"users">} />;
}
