"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2, Hourglass, Layers, MapPin, Search, XCircle } from "lucide-react";
import { Input } from "@/app/_components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";
import { useAdminData } from "../AdminDataProvider";
import { AdminSkeleton } from "../AdminSkeleton";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

type Status = "pending" | "approved" | "rejected";

export function AllLocationsClient() {
  const [status, setStatus] = useState<"all" | Status>("all");
  const [q, setQ] = useState("");

  const { allLocations: rows, isLoading } = useAdminData();

  const filtered = (rows ?? [])
    .filter((r) => (status === "all" ? true : r.status === status))
    .filter((r) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return (
        r.name.toLowerCase().includes(needle) ||
        r.town.toLowerCase().includes(needle)
      );
    });

  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (isLoading || !root.current) return;
      const targets = root.current.querySelectorAll(".all-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 12,
        opacity: 0,
        duration: 0.4,
        ease: "power3.out",
        stagger: 0.04,
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

  return (
    <div ref={root} className="flex flex-col gap-6">
      <header className="all-anim overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-300">
            Admin · Locations
          </p>
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Layers className="h-6 w-6" />
          All locations
        </h1>
        <p className="mt-1 text-sm text-zinc-300">
          Browse, filter, and override any submission.
        </p>
      </header>

      {/* Filter bar */}
      <section className="all-anim rounded-2xl border border-zinc-200 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or town…"
              className="pl-9"
              aria-label="Search"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as "all" | Status)}
          >
            <SelectTrigger className="min-w-[10rem]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="all-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            {q ? "No matches." : "No locations yet."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {filtered.map((r) => (
              <li key={r._id}>
                <Link
                  href={`/admin/locations/${r._id}`}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{r.town}</p>
                  </div>
                  <StatusPill status={r.status} />
                  <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {rows ? (
          <footer className="border-t border-zinc-100 px-5 py-2 text-[11px] text-zinc-500 dark:border-zinc-900">
            Showing {filtered.length} of {rows.length}
            {status !== "all" ? ` ${status}` : ""}
            {filtered.length === 1 ? " location" : " locations"}.
          </footer>
        ) : null}
      </section>
    </div>
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
