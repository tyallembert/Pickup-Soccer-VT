"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  formatDateLong,
  formatDayLong,
  formatStartTime,
} from "../_lib/format";

export type NextSchedule = {
  _id: string;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
  thisWeek: { date: string; isOn: boolean; reason?: string };
};

export type NextLocation = {
  _id: string;
  name: string;
  town: string;
  details: string;
  schedules: NextSchedule[];
};

type Pick = {
  locationId: string;
  name: string;
  town: string;
  details: string;
  schedule: NextSchedule;
};

function pickNext(locations: NextLocation[] | undefined): Pick | null {
  if (!locations || locations.length === 0) return null;
  const flat: Pick[] = [];
  for (const l of locations) {
    for (const s of l.schedules) {
      flat.push({
        locationId: l._id,
        name: l.name,
        town: l.town,
        details: l.details,
        schedule: s,
      });
    }
  }
  if (flat.length === 0) return null;
  flat.sort((a, b) => {
    if (a.schedule.thisWeek.date !== b.schedule.thisWeek.date) {
      return a.schedule.thisWeek.date < b.schedule.thisWeek.date ? -1 : 1;
    }
    if (a.schedule.startTime !== b.schedule.startTime) {
      return a.schedule.startTime < b.schedule.startTime ? -1 : 1;
    }
    if (a.schedule.thisWeek.isOn !== b.schedule.thisWeek.isOn) {
      return a.schedule.thisWeek.isOn ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return flat[0];
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
    { scope: root, dependencies: [next?.schedule._id, locations === undefined] },
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

  const rel = relativeDay(next.schedule.thisWeek.date);
  const time = formatStartTime(next.schedule.startTime);
  const dayName = formatDayLong(next.schedule.dayOfWeek);
  const isOff = !next.schedule.thisWeek.isOn;
  const reason = next.schedule.thisWeek.reason?.trim();

  const theme = isOff
    ? {
        cardBorder: "border-amber-200/70 dark:border-amber-900/60",
        cardShadow:
          "shadow-[0_10px_28px_rgba(245,158,11,0.18)] hover:shadow-[0_14px_32px_rgba(245,158,11,0.28)]",
        blockGradient: "from-amber-700 via-orange-600 to-amber-500",
        eyebrow: "Off this week",
        eyebrowColor: "text-amber-50/90",
        chipText: "Cancelled",
        ctaColor:
          "text-amber-700 group-hover:text-amber-600 dark:text-amber-300",
        accent: "text-amber-600 dark:text-amber-400",
      }
    : {
        cardBorder: "border-emerald-200/60 dark:border-emerald-900/60",
        cardShadow:
          "shadow-[0_10px_28px_rgba(16,185,129,0.14)] hover:shadow-[0_14px_32px_rgba(16,185,129,0.24)]",
        blockGradient: "from-emerald-700 via-emerald-600 to-emerald-500",
        eyebrow: "Next pickup",
        eyebrowColor: "text-emerald-100/90",
        chipText: rel,
        ctaColor:
          "text-emerald-700 group-hover:text-emerald-600 dark:text-emerald-300",
        accent: "text-emerald-600 dark:text-emerald-400",
      };

  return (
    <section ref={root} className="px-6 pt-8">
      <Link
        href={`/locations/${next.locationId}`}
        className={`next-up-anim group block overflow-hidden rounded-2xl border ${theme.cardBorder} bg-white transition hover:-translate-y-0.5 ${theme.cardShadow} dark:bg-zinc-950`}
      >
        <div className="flex flex-col items-stretch sm:flex-row">
          {/* Date block — gradient swaps to amber when the game is off */}
          <div
            className={`relative flex flex-col items-center justify-center gap-1 bg-gradient-to-br ${theme.blockGradient} px-6 py-6 text-white sm:w-48 sm:flex-shrink-0`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.3em] ${theme.eyebrowColor}`}
            >
              {theme.eyebrow}
            </p>
            <p
              className={`text-2xl font-bold uppercase leading-none tracking-wide ${
                isOff ? "line-through decoration-2 decoration-white/70" : ""
              }`}
            >
              {dayName}
            </p>
            <p
              className={`text-sm font-semibold tracking-wide ${
                isOff ? "text-white/80" : "text-white/95"
              }`}
            >
              {time}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur">
              {theme.chipText}
            </span>
            {/* Live dot — pings for active games, static for cancelled */}
            {isOff ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-3 inline-flex h-2 w-2 rounded-full bg-white/80"
              />
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-3 flex h-2 w-2 items-center justify-center"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-5">
            <h2 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {next.name}
            </h2>
            <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className={`h-3.5 w-3.5 ${theme.accent}`} />
                {next.town}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className={`h-3.5 w-3.5 ${theme.accent}`} />
                {formatDateLong(next.schedule.thisWeek.date)}
              </span>
            </p>
            {isOff ? (
              <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-line">
                  {reason || "Cancelled this week."}
                </span>
              </p>
            ) : next.details ? (
              <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
                {next.details}
              </p>
            ) : null}
            <div
              className={`mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition group-hover:gap-2 ${theme.ctaColor}`}
            >
              View details
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
