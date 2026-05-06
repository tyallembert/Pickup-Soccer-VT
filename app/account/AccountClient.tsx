"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignOutButton } from "./SignOutButton";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};

export function AccountClient({ email, role }: { email: string; role: string }) {
  const locations = useQuery(api.public.myLocations);
  const isAdmin = role === "admin";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your account</h1>
          <p className="text-sm text-zinc-500">{email}</p>
        </div>
        <SignOutButton />
      </header>

      {isAdmin ? (
        <p className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          You are signed in as the super-admin.{" "}
          <Link href="/admin" className="underline">Open the admin dashboard →</Link>
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your locations
        </h2>
        {locations === undefined ? (
          <p className="mt-2 text-sm text-zinc-500">Loading…</p>
        ) : locations.length === 0 ? (
          <p className="mt-2 text-sm">You haven&apos;t submitted any pickup games yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {locations.map((l) => (
              <li key={l._id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <Link href={`/account/locations/${l._id}`} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{l.name}</span>
                    <span className="ml-2 text-sm text-zinc-500">{l.town}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${STATUS_BADGE[l.status]}`}>
                    {l.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/submit" className="mt-3 inline-block text-sm underline">
          + Add another pickup game
        </Link>
      </section>
    </main>
  );
}
