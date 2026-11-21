import { OwnerLocationClient, type Tab } from "./OwnerLocationClient";
import type { Id } from "@/convex/_generated/dataModel";

const TABS: readonly Tab[] = ["details", "thisWeek", "lastSession", "maintainers"];

export default async function OwnerLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return (
    <OwnerLocationClient
      id={id as Id<"locations">}
      initialTab={TABS.find((t) => t === tab)}
    />
  );
}
