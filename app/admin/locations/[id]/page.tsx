import { AdminLocationClient } from "./AdminLocationClient";
import type { Id } from "@/convex/_generated/dataModel";

export default async function AdminLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminLocationClient id={id as Id<"locations">} />;
}
