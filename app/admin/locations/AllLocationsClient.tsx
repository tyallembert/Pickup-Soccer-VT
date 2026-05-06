"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};

export function AllLocationsClient() {
  const [status, setStatus] = useState<"" | "pending" | "approved" | "rejected">("");
  const rows = useQuery(api.admin.allLocations, status ? { status } : {});

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All locations</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | "pending" | "approved" | "rejected")}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {!rows ? <p>Loading…</p> : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r._id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <Link href={`/admin/locations/${r._id}`} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-sm text-zinc-500">{r.town}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${STATUS_BADGE[r.status]}`}>{r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
