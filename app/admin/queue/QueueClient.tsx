"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import posthog from "posthog-js";
import {
  Check,
  ChevronRight,
  Handshake,
  Hourglass,
  Inbox,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, initialsFromEmail } from "@/app/_components/ui/avatar";
import { PushToggle } from "@/app/_components/PushToggle";
import { formatRelativeTime } from "@/app/_lib/format";
import { useAdminData, type AdminMaintainerRequestRow } from "../AdminDataProvider";
import { AdminSkeleton } from "../AdminSkeleton";

/**
 * Everything waiting on an admin, in one place: people asking to help run a
 * field, and new fields awaiting review. Co-maintainer requests come first
 * because each one is a single yes/no, decided right on the row.
 */
export function QueueClient() {
  const {
    pendingLocations: fields,
    pendingMaintainers: requests,
    isLoading,
  } = useAdminData();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (isLoading || !root.current) return;
      const targets = root.current.querySelectorAll(".queue-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 12,
        opacity: 0,
        duration: 0.4,
        ease: "power3.out",
        stagger: 0.05,
      });
    },
    { scope: root, dependencies: [isLoading] },
  );

  if (isLoading) {
    return (
      <div ref={root}>
        <AdminSkeleton />
      </div>
    );
  }

  const fieldCount = fields?.length ?? 0;
  const requestCount = requests?.length ?? 0;
  const total = fieldCount + requestCount;

  return (
    <div ref={root} className="flex flex-col gap-6 app:gap-4">
      <header className="queue-anim overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-white shadow-lg app:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/90">
            Admin · Approvals
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            <Hourglass className="h-3 w-3" /> {total} waiting
          </span>
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold app:text-xl">
          <Inbox className="h-6 w-6 app:h-5 app:w-5" />
          Approvals
        </h1>
        <p className="mt-1 text-sm text-amber-50/90">
          Co-maintainer requests and new fields, all in one place.
        </p>
      </header>

      <section
        id="maintainers"
        className="queue-anim scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <SectionHeader
          icon={<Handshake className="h-3.5 w-3.5" />}
          eyebrow="Co-maintainer requests"
          title="People asking to help run a field"
          count={requestCount}
        />
        {requestCount === 0 ? (
          <EmptyRow text="No one is waiting for co-maintainer access." />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {requests!.map((r) => (
              <MaintainerRequestRow key={r._id} row={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="queue-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <SectionHeader
          icon={<MapPin className="h-3.5 w-3.5" />}
          eyebrow="New fields"
          title="Submissions awaiting review"
          count={fieldCount}
        />
        {fieldCount === 0 ? (
          <EmptyRow text="No field submissions are waiting for review." />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {fields!.map((r) => (
              <li key={r._id} className="queue-anim">
                <Link
                  href={`/admin/queue/${r._id}`}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900 dark:active:bg-zinc-900"
                >
                  <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800">
                    <AvatarFallback className="bg-amber-100 text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                      {initialsFromEmail(r.ownerEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words leading-snug text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {r.town} · {r.ownerEmail}
                    </p>
                  </div>
                  <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 sm:inline-flex dark:bg-amber-900/40 dark:text-amber-100">
                    <Hourglass className="h-3 w-3" /> Review
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {total === 0 ? (
        <div className="queue-anim flex flex-col items-center gap-2 py-2 text-center">
          <Sparkles className="h-7 w-7 text-emerald-500" aria-hidden />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            All caught up
          </p>
        </div>
      ) : null}

      <PushToggle className="queue-anim" />
    </div>
  );
}

function MaintainerRequestRow({ row }: { row: AdminMaintainerRequestRow }) {
  const approve = useMutation(api.maintainers.approveMaintainer);
  const deny = useMutation(api.maintainers.denyMaintainer);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "approve" | "deny") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "approve") await approve({ id: row._id });
      else await deny({ id: row._id });
      posthog.capture(kind === "approve" ? "maintainer_approved" : "maintainer_denied", {
        location_id: row.locationId,
        location_name: row.locationName,
        source: "admin_approvals",
      });
      // The row leaves the list on its own once the subscription updates.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <li className="queue-anim flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-sky-500 text-xs text-white">
            {initialsFromEmail(row.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {row.email || "Unknown user"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            wants to help run{" "}
            <Link
              href={`/admin/locations/${row.locationId}?tab=maintainers`}
              className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              {row.locationName}
            </Link>
            {row.locationTown ? ` · ${row.locationTown}` : null}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Requested {formatRelativeTime(row.requestedAt)}
          </p>
          {error ? (
            <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2 pl-12 sm:pl-0">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void act("approve")}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-60 sm:h-9 sm:flex-none sm:text-xs"
        >
          <Check className="h-4 w-4" />
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void act("deny")}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.97] disabled:opacity-60 sm:h-9 sm:flex-none sm:text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <X className="h-4 w-4" />
          {busy === "deny" ? "Denying…" : "Deny"}
        </button>
      </div>
    </li>
  );
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  count,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  count: number;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          {icon}
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      <span
        className={
          count > 0
            ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
            : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-500 dark:bg-zinc-900"
        }
      >
        {count}
      </span>
    </header>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-5 text-sm text-zinc-500">{text}</p>;
}
