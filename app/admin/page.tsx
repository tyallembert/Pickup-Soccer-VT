"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

export default function AdminOverview() {
  const all = useQuery(api.admin.allLocations, {});
  if (!all) return <p>Loading…</p>;
  const counts = { pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return (
    <section>
      <h1 className="text-2xl font-semibold">Overview</h1>
      <ul className="mt-4 grid grid-cols-3 gap-3">
        <li className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-3xl font-semibold">{counts.pending ?? 0}</p>
          <p className="text-sm">pending</p>
          <Link href="/admin/queue" className="mt-1 block text-sm underline">Open queue →</Link>
        </li>
        <li className="rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950">
          <p className="text-3xl font-semibold">{counts.approved ?? 0}</p>
          <p className="text-sm">approved</p>
        </li>
        <li className="rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
          <p className="text-3xl font-semibold">{counts.rejected ?? 0}</p>
          <p className="text-sm">rejected</p>
        </li>
      </ul>
    </section>
  );
}
