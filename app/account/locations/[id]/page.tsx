import { OwnerLocationClient } from "./OwnerLocationClient";
import type { Id } from "@/convex/_generated/dataModel";

export default async function OwnerLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OwnerLocationClient id={id as Id<"locations">} />;
}
