"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Hourglass,
  ShieldCheck,
  UserPlus2,
  X,
} from "lucide-react";
import posthog from "posthog-js";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, initialsFromEmail } from "@/app/_components/ui/avatar";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function MaintainersPanel({
  locationId,
  locationName,
}: {
  locationId: Id<"locations">;
  locationName: string;
}) {
  const rows = useQuery(api.maintainers.listMaintainersForLocation, {
    locationId,
  });
  const approve = useMutation(api.maintainers.approveMaintainer);
  const deny = useMutation(api.maintainers.denyMaintainer);
  const revoke = useMutation(api.maintainers.revokeMaintainer);

  if (rows === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");

  return (
    <div className="flex flex-col gap-6">
      {/* Pending requests */}
      <section>
        <header className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            <Hourglass className="h-3.5 w-3.5" />
            Pending requests
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              {pending.length}
            </span>
          </p>
        </header>
        {pending.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
            No pending requests right now.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {pending.map((m) => (
              <li
                key={m._id}
                className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-amber-500 text-xs text-white">
                    {initialsFromEmail(m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {m.email || "Unknown user"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Requested {relativeTime(m.requestedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await approve({ id: m._id });
                      posthog.capture("maintainer_approved", {
                        location_id: locationId,
                        location_name: locationName,
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow transition hover:bg-emerald-700"
                    aria-label="Approve maintainer"
                  >
                    <Check className="h-3 w-3" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deny({ id: m._id });
                      posthog.capture("maintainer_denied", {
                        location_id: locationId,
                        location_name: locationName,
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    aria-label="Deny maintainer"
                  >
                    <X className="h-3 w-3" />
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Approved maintainers */}
      <section>
        <header className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Approved maintainers
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] tabular-nums text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
              {approved.length}
            </span>
          </p>
        </header>
        {approved.length === 0 ? (
          <div className="mt-2 flex items-start gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <UserPlus2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              No one else helps maintain this field yet. Share the field link
              and others can request access from the public page.
            </p>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {approved.map((m) => (
              <li
                key={m._id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-emerald-600 text-xs text-white">
                    {initialsFromEmail(m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {m.email || "Unknown user"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Approved {m.approvedAt ? relativeTime(m.approvedAt) : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      typeof window !== "undefined" &&
                      !window.confirm(
                        `Revoke ${m.email || "this user"}'s maintainer access?`,
                      )
                    ) {
                      return;
                    }
                    await revoke({ id: m._id });
                    posthog.capture("maintainer_revoked", {
                      location_id: locationId,
                      location_name: locationName,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 dark:border-rose-900 dark:bg-zinc-950 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
