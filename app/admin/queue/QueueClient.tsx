"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Hourglass, ListChecks, MapPin, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, initialsFromEmail } from "@/app/_components/ui/avatar";
import { useAdminData } from "../AdminDataProvider";
import { AdminSkeleton } from "../AdminSkeleton";

export function QueueClient() {
  const { pendingLocations: rows, isLoading } = useAdminData();
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

  return (
    <div ref={root} className="flex flex-col gap-6">
      <header className="queue-anim overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/90">
            Moderation queue
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            <Hourglass className="h-3 w-3" /> Pending
          </span>
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <ListChecks className="h-6 w-6" />
          Awaiting review
        </h1>
        <p className="mt-1 text-sm text-amber-50/90">
          Approve to publish, or reject with a reason for the submitter.
        </p>
      </header>

      <section className="queue-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {!rows || rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Sparkles className="h-8 w-8 text-emerald-500" aria-hidden />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              All caught up
            </p>
            <p className="max-w-xs text-xs text-zinc-500">
              No submissions are waiting for review right now.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {rows.map((r) => (
              <li key={r._id} className="queue-anim">
                <Link
                  href={`/admin/queue/${r._id}`}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800">
                    <AvatarFallback className="bg-amber-100 text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                      {initialsFromEmail(r.ownerEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.name}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-zinc-500">
                      <MapPin className="h-3 w-3" />
                      {r.town}
                      <span className="mx-1">·</span>
                      <span className="truncate" title={r.ownerEmail}>
                        {r.ownerEmail}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                    <Hourglass className="h-3 w-3" /> Review
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
    </div>
  );
}
