"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Hourglass,
  ShieldCheck,
  UserPlus2,
  X,
} from "lucide-react";
import posthog from "posthog-js";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Public location detail surface for any signed-in user (and a soft prompt for
// signed-out users) to request co-maintainer access. The primary owner sees a
// neutral "you organize this" link; existing maintainers see a quick path back
// to their owner page.
export function MaintainCTA({
  locationId,
  locationName,
  town,
}: {
  locationId: Id<"locations">;
  locationName: string;
  town: string;
}) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const status = useQuery(
    api.maintainers.getMyMaintainerStatus,
    isAuthenticated ? { locationId } : "skip",
  );
  const request = useMutation(api.maintainers.requestMaintainership);
  const cancel = useMutation(api.maintainers.cancelMyRequest);
  const [pending, setPending] = useState(false);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <Link
        href="/signin"
        className="loc-anim group flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm shadow-sm transition hover:bg-emerald-100/70 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
          <UserPlus2 className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
            Help maintain this field
          </span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">
            Sign in to request co-maintainer access from the organizer.
          </span>
        </span>
        <span className="text-emerald-700 transition group-hover:translate-x-0.5 dark:text-emerald-300">
          →
        </span>
      </Link>
    );
  }

  // Signed in but status query hasn't returned yet.
  if (status === undefined || status === null) return null;

  if (status.status === "owner") {
    return (
      <Link
        href={`/account/locations/${locationId}`}
        className="loc-anim group flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm shadow-sm transition hover:bg-emerald-100/70 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
            You organize this field
          </span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">
            Edit details, set weekly status, and approve helpers.
          </span>
        </span>
        <span className="text-emerald-700 transition group-hover:translate-x-0.5 dark:text-emerald-300">
          Manage →
        </span>
      </Link>
    );
  }

  if (status.status === "approved") {
    return (
      <Link
        href={`/account/locations/${locationId}`}
        className="loc-anim group flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm shadow-sm transition hover:bg-emerald-100/70 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
            You help maintain this field
          </span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">
            Open your dashboard to edit details and post recaps.
          </span>
        </span>
        <span className="text-emerald-700 transition group-hover:translate-x-0.5 dark:text-emerald-300">
          Manage →
        </span>
      </Link>
    );
  }

  if (status.status === "pending") {
    return (
      <div className="loc-anim flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-sm shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
          <Hourglass className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            Request pending
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            The organizer will see your request and decide. You&rsquo;ll get
            access here once approved.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await cancel({ locationId });
              posthog.capture("maintainer_request_cancelled", {
                location_id: locationId,
                location_name: locationName,
                town,
              });
            } finally {
              setPending(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-100 dark:hover:bg-amber-950/40"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    );
  }

  // status.status === "none"
  return (
    <div className="loc-anim flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
        <UserPlus2 className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
          Help organize this field
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Request co-maintainer access — once the organizer approves, you can
          set weekly status and post recaps too.
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await request({ locationId });
            posthog.capture("maintainer_requested", {
              location_id: locationId,
              location_name: locationName,
              town,
            });
          } finally {
            setPending(false);
          }
        }}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow transition hover:scale-[1.03] disabled:opacity-50"
      >
        {pending ? "Requesting…" : "Request access"}
      </button>
    </div>
  );
}
