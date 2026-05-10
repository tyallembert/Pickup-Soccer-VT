"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, CalendarClock, MapPin, Sparkles } from "lucide-react";
import {
  formatDateLong,
  formatDayLong,
  formatStartTime,
} from "../_lib/format";

export type NextLocation = {
  _id: string;
  name: string;
  town: string;
  details: string;
  dayOfWeek: number;
  startTime: string;
  thisWeek: { date: string; isOn: boolean };
};

function pickNext(locations: NextLocation[] | undefined): NextLocation | null {
  if (!locations) return null;
  const upcoming = locations.filter((l) => l.thisWeek.isOn);
  if (upcoming.length === 0) return null;
  return [...upcoming].sort((a, b) => {
    if (a.thisWeek.date !== b.thisWeek.date) {
      return a.thisWeek.date < b.thisWeek.date ? -1 : 1;
    }
    if (a.startTime !== b.startTime) {
      return a.startTime < b.startTime ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  })[0];
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function relativeDay(date: string): string {
  const today = todayString();
  if (date === today) return "Today";
  const [y, m, d] = date.split("-").map((x) => parseInt(x, 10));
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  return `In ${diffDays} days`;
}

export function NextUpGame({
  locations,
}: {
  locations: NextLocation[] | undefined;
}) {
  const next = useMemo(() => pickNext(locations), [locations]);
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!root.current) return;
      const targets = root.current.querySelectorAll(".next-up-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 18,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.08,
      });
    },
    { scope: root, dependencies: [next?._id, locations === undefined] },
  );

  if (locations === undefined) {
    return (
      <section ref={root} className="px-6 pt-8">
        <div className="h-[150px] animate-pulse rounded-2xl bg-gradient-to-br from-emerald-50 to-zinc-100 dark:from-emerald-950/40 dark:to-zinc-900" />
      </section>
    );
  }

  if (!next) {
    return (
      <section ref={root} className="px-6 pt-8">
        <div className="next-up-anim flex items-center gap-3 rounded-2xl border border-dashed border-emerald-300/70 bg-gradient-to-br from-emerald-50/70 to-white px-5 py-5 text-sm shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-zinc-950">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              No games on the schedule
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Nothing&rsquo;s queued up this week. Check the map below or
              submit your own pickup.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const rel = relativeDay(next.thisWeek.date);
  const time = formatStartTime(next.startTime);
  const dayName = formatDayLong(next.dayOfWeek);

  return (
    <section ref={root} className="px-6 pt-8">
      <Link
        href={`/locations/${next._id}`}
        className="next-up-anim group block overflow-hidden rounded-2xl border border-emerald-200/60 bg-white shadow-[0_10px_28px_rgba(16,185,129,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,185,129,0.24)] dark:border-emerald-900/60 dark:bg-zinc-950"
      >
        <div className="flex flex-col items-stretch sm:flex-row">
          {/* Date block — emerald gradient like the wizard / owner approved header */}
          <div className="relative flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 px-6 py-6 text-white sm:w-48 sm:flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-100/90">
              Next pickup
            </p>
            <p className="text-2xl font-bold uppercase leading-none tracking-wide">
              {dayName}
            </p>
            <p className="text-sm font-semibold tracking-wide text-white/95">
              {time}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur">
              {rel}
            </span>
            {/* live dot — same on-air motif used in status indicators */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-3 flex h-2 w-2 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-5">
            <h2 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {next.name}
            </h2>
            <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {next.town}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {formatDateLong(next.thisWeek.date)}
              </span>
            </p>
            {next.details ? (
              <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
                {next.details}
              </p>
            ) : null}
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-700 transition group-hover:gap-2 group-hover:text-emerald-600 dark:text-emerald-300">
              View details
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
