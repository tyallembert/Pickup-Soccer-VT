"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function QueueClient() {
  const rows = useQuery(api.admin.pendingLocations);
  if (!rows) return <p>Loading…</p>;
  if (rows.length === 0) return <p>No pending submissions.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r._id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <Link href={`/admin/queue/${r._id}`} className="flex items-center justify-between">
            <span>
              <span className="font-medium">{r.name}</span>
              <span className="ml-2 text-sm text-zinc-500">{r.town}</span>
            </span>
            <span className="text-xs text-zinc-500">{r.ownerEmail}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
