import { ReviewClient } from "./ReviewClient";
import type { Id } from "@/convex/_generated/dataModel";

export default async function QueueItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewClient id={id as Id<"locations">} />;
}
