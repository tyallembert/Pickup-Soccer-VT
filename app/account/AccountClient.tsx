"use client";

import { useRef } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2, Hourglass, MapPin, Plus, Shield, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, initialsFromEmail } from "@/app/_components/ui/avatar";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";
import { SignOutButton } from "./SignOutButton";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Hourglass className="h-3 w-3" />,
  approved: <CheckCircle2 className="h-3 w-3" />,
  rejected: <XCircle className="h-3 w-3" />,
};

export function AccountClient({ email, role }: { email: string; role: string }) {
  // Gate the query on Convex's own auth-ready signal so it never races a
  // half-mounted token. While auth is loading, useQuery is "skipped" and
  // we render a skeleton instead of an indefinite "Loading…" line.
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const locations = useQuery(
    api.public.myLocations,
    isAuthenticated ? {} : "skip",
  );
  const isAdmin = role === "admin";
  const root = useRef<HTMLElement>(null);

  const isLoading = authLoading || locations === undefined;

  useGSAP(
    () => {
      if (isLoading || !root.current) return;
      const targets = root.current.querySelectorAll(".account-anim");
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

  if (isLoading) {
    return (
      <main
        ref={root}
        className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pt-24 pb-12"
      >
        <AccountSkeleton />
      </main>
    );
  }

  const counts = countByStatus(locations);

  return (
    <main
      ref={root}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pt-24 pb-12"
    >
      {/* Header card matching the wizard/owner page */}
      <header className="account-anim overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 p-6 text-white shadow-lg">
        <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-100/90">
          Your account
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-white/30">
              <AvatarFallback className="bg-white text-base text-emerald-900">
                {initialsFromEmail(email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{email}</h1>
              <p className="text-sm text-emerald-50/85">
                {isAdmin ? "Super-admin" : "Pickup soccer organizer"}
              </p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Admin shortcut */}
      {isAdmin ? (
        <Link
          href="/admin"
          className="account-anim flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <Shield className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
          <span className="flex-1">
            <span className="font-semibold">Admin tools</span>
            <span className="ml-2 text-emerald-800/70 dark:text-emerald-200/70">
              Review the moderation queue and manage approved fields.
            </span>
          </span>
          <span className="text-emerald-700 dark:text-emerald-300">→</span>
        </Link>
      ) : null}

      {/* Stats row */}
      <section className="account-anim grid grid-cols-3 gap-3">
        <StatCard label="Pending" count={counts.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
        <StatCard label="Approved" count={counts.approved} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Rejected" count={counts.rejected} icon={<XCircle className="h-4 w-4" />} tone="rose" />
      </section>

      {/* Locations list */}
      <section className="account-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
              Your fields
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Pickup games you organize
            </h2>
          </div>
          <Link
            href="/submit"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:scale-[1.03]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Link>
        </header>

        {locations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <MapPin className="h-8 w-8 text-emerald-500" aria-hidden />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              No fields yet
            </p>
            <p className="max-w-xs text-xs text-zinc-500">
              Submit your first pickup game to add it to the directory.
            </p>
            <Link
              href="/submit"
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow"
            >
              <Plus className="h-3.5 w-3.5" /> Add a pickup game
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {locations.map((l) => (
              <li key={l._id}>
                <Link
                  href={`/account/locations/${l._id}`}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                      {l.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {l.town}
                      {typeof l.dayOfWeek === "number" && l.startTime
                        ? ` · ${formatDayPlural(l.dayOfWeek)} at ${formatStartTime(l.startTime)}`
                        : null}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[l.status]}`}
                  >
                    {STATUS_ICON[l.status]}
                    {l.status}
                  </span>
                  <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function AccountSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-32 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
        <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
        <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
      </div>
      <div className="h-64 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
    </div>
  );
}

function countByStatus(
  locations: Array<{ status: string }> | undefined,
): { pending: number; approved: number; rejected: number } {
  const counts = { pending: 0, approved: 0, rejected: 0 };
  if (!locations) return counts;
  for (const l of locations) {
    if (l.status in counts) counts[l.status as keyof typeof counts]++;
  }
  return counts;
}

const TONE: Record<string, { bg: string; text: string; iconBg: string }> = {
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-200",
    iconBg: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-900 dark:text-emerald-200",
    iconBg: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-900 dark:text-rose-200",
    iconBg: "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100",
  },
};

function StatCard({
  label,
  count,
  icon,
  tone,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  tone: "amber" | "emerald" | "rose";
}) {
  const t = TONE[tone];
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${t.bg}`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold leading-none ${t.text}`}>{count}</p>
        <p className={`mt-1 text-[11px] font-semibold uppercase tracking-wider ${t.text} opacity-75`}>
          {label}
        </p>
      </div>
    </div>
  );
}
