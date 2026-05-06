import { LocationDetail } from "./LocationDetail";
import type { Id } from "@/convex/_generated/dataModel";

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LocationDetail id={id as Id<"locations">} />;
}
