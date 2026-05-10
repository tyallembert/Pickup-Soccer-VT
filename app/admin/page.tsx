"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  CheckCircle2,
  Hourglass,
  ListChecks,
  Shield,
  XCircle,
} from "lucide-react";
import { useAdminData } from "./AdminDataProvider";
import { AdminSkeleton } from "./AdminSkeleton";

export default function AdminOverview() {
  const { allLocations: all, isLoading } = useAdminData();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (isLoading || !root.current) return;
      const targets = root.current.querySelectorAll(".admin-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 16,
        opacity: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.07,
      });
    },
    { scope: root, dependencies: [isLoading] },
  );

  const counts = { pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
  for (const r of all ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = (all?.length) ?? 0;
  const recent = (all ?? []).slice(0, 5);

  if (isLoading) {
    return (
      <div ref={root}>
        <AdminSkeleton />
      </div>
    );
  }

  return (
    <div ref={root} className="flex flex-col gap-6">
      {/* Header card */}
      <header className="admin-anim overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-300">
            Admin · Overview
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
            <Shield className="h-3 w-3" /> Live
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold">Pickup soccer dashboard</h1>
        <p className="mt-1 text-sm text-zinc-300">
          {total} field{total === 1 ? "" : "s"} in the directory.
        </p>
      </header>

      {/* Stats */}
      <section className="admin-anim grid grid-cols-3 gap-3">
        <StatCard
          tone="amber"
          label="Pending"
          count={counts.pending ?? 0}
          icon={<Hourglass className="h-4 w-4" />}
          href="/admin/queue"
          cta="Open queue"
        />
        <StatCard
          tone="emerald"
          label="Approved"
          count={counts.approved ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
          href="/admin/locations?status=approved"
        />
        <StatCard
          tone="rose"
          label="Rejected"
          count={counts.rejected ?? 0}
          icon={<XCircle className="h-4 w-4" />}
          href="/admin/locations?status=rejected"
        />
      </section>

      {/* Recent submissions */}
      <section className="admin-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
              Recent
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">Latest submissions</h2>
          </div>
          <Link
            href="/admin/locations"
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <ListChecks className="h-3.5 w-3.5" />
            View all
          </Link>
        </header>
        {!all ? (
          <p className="px-5 py-6 text-sm text-zinc-500">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">No submissions yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {recent.map((r) => (
              <li key={r._id}>
                <Link
                  href={`/admin/locations/${r._id}`}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="truncate text-xs text-zinc-500">{r.town}</p>
                  </div>
                  <StatusPill status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const TONE: Record<
  "amber" | "emerald" | "rose",
  { bg: string; text: string; iconBg: string; ring: string }
> = {
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-200",
    iconBg: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
    ring: "ring-amber-200 dark:ring-amber-900/60",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-900 dark:text-emerald-200",
    iconBg: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
    ring: "ring-emerald-200 dark:ring-emerald-900/60",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-900 dark:text-rose-200",
    iconBg: "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100",
    ring: "ring-rose-200 dark:ring-rose-900/60",
  },
};

function StatCard({
  tone,
  label,
  count,
  icon,
  href,
  cta,
}: {
  tone: "amber" | "emerald" | "rose";
  label: string;
  count: number;
  icon: React.ReactNode;
  href?: string;
  cta?: string;
}) {
  const t = TONE[tone];
  const inner = (
    <div className={`flex items-start gap-3 rounded-2xl px-4 py-4 transition group-hover:ring-2 ${t.bg} ${t.ring}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-2xl font-bold leading-none ${t.text}`}>{count}</p>
        <p
          className={`mt-1 text-[11px] font-semibold uppercase tracking-wider ${t.text} opacity-75`}
        >
          {label}
        </p>
        {cta ? (
          <p className={`mt-1 text-xs ${t.text} opacity-75 group-hover:opacity-100`}>
            {cta} →
          </p>
        ) : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="group block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: string; icon: React.ReactNode }> = {
    pending: {
      tone: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
      icon: <Hourglass className="h-3 w-3" />,
    },
    approved: {
      tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    rejected: {
      tone: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const m = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.tone}`}
    >
      {m.icon}
      {status}
    </span>
  );
}
