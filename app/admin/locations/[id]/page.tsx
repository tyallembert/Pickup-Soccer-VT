import { AdminLocationClient, type Tab } from "./AdminLocationClient";
import type { Id } from "@/convex/_generated/dataModel";

const TABS: readonly Tab[] = ["details", "thisWeek", "lastSession", "maintainers"];

export default async function AdminLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return (
    <AdminLocationClient
      id={id as Id<"locations">}
      initialTab={TABS.find((t) => t === tab)}
    />
  );
}
