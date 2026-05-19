"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import posthog from "posthog-js";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Cloud,
  CloudRain,
  CloudSnow,
  ExternalLink,
  MapPin,
  Sun,
  Thermometer,
  Users,
  Wind,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LocationPin } from "@/app/_components/LocationPin";
import { MaintainCTA } from "@/app/_components/MaintainCTA";
import {
  formatDateLong,
  formatDayPlural,
  formatTimeRange,
} from "@/app/_lib/format";

type Condition = "sunny" | "cloudy" | "rainy" | "snowy" | "windy" | "cold";

const WEATHER_META: Record<
  Condition,
  { Icon: LucideIcon; label: string; tone: string }
> = {
  sunny: { Icon: Sun, label: "Sunny", tone: "from-amber-500 to-orange-500" },
  cloudy: { Icon: Cloud, label: "Cloudy", tone: "from-zinc-500 to-zinc-600" },
  rainy: { Icon: CloudRain, label: "Rainy", tone: "from-sky-500 to-blue-600" },
  snowy: { Icon: CloudSnow, label: "Snowy", tone: "from-sky-300 to-cyan-500" },
  windy: { Icon: Wind, label: "Windy", tone: "from-teal-500 to-cyan-600" },
  cold: {
    Icon: Thermometer,
    label: "Cold",
    tone: "from-indigo-500 to-blue-600",
  },
};

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

export function LocationDetail({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.public.getLocation, { id });
  const root = useRef<HTMLElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (!data || tracked.current) return;
    tracked.current = true;
    posthog.capture("location_viewed", {
      location_id: id,
      location_name: data.name,
      town: data.town,
      schedule_count: data.schedules.length,
    });
  }, [data, id]);

  useGSAP(
    () => {
      if (!root.current) return;
      const targets = root.current.querySelectorAll(".loc-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 18,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.07,
        clearProps: "all",
      });
    },
    { scope: root, dependencies: [data?._id] },
  );

  if (data === undefined) {
    return (
      <main
        ref={root}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-24 pb-12"
      >
        <div className="h-44 animate-pulse rounded-2xl bg-gradient-to-br from-emerald-100 to-zinc-100 dark:from-emerald-950/30 dark:to-zinc-900" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-32 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      </main>
    );
  }

  const upcomingSchedules = data.schedules.slice().sort(
    (a, b) =>
      a.thisWeek.date.localeCompare(b.thisWeek.date) ||
      a.startTime.localeCompare(b.startTime),
  );
  const allOff = upcomingSchedules.every((s) => !s.thisWeek.isOn);
  const anyOff = upcomingSchedules.some((s) => !s.thisWeek.isOn);
  const heroFrom = allOff ? "from-amber-700" : "from-emerald-700";
  const heroVia = allOff ? "via-orange-600" : "via-emerald-600";
  const heroTo = allOff ? "to-amber-500" : "to-emerald-500";
  const heroShadow = allOff
    ? "shadow-[0_20px_60px_rgba(245,158,11,0.22)]"
    : "shadow-[0_20px_60px_rgba(16,185,129,0.20)]";
  const heroPillLabel = allOff
    ? "All cancelled this week"
    : anyOff
      ? "Some cancelled this week"
      : "Game on this week";
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    data.address,
  )}`;

  return (
    <main
      ref={root}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-24 pb-12"
    >
      <Link
        href="/"
        className="loc-anim inline-flex w-fit items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to the directory
      </Link>

      {/* Hero — status-themed gradient */}
      <header
        className={`loc-anim relative overflow-hidden rounded-2xl bg-gradient-to-br ${heroFrom} ${heroVia} ${heroTo} p-7 text-white ${heroShadow}`}
      >
        {/* Decorative pitch lines */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-15"
        >
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/40" />
          <span className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
          <span className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full border border-white/20" />
        </span>

        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/85">
            Pickup soccer · {data.town}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
            {data.name}
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/90">
            <MapPin className="h-3.5 w-3.5" />
            {data.address}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
              {allOff ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : (
                <span className="relative inline-flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              )}
              {heroPillLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Co-maintainer CTA — context-aware: shows the right state for owner,
          approved maintainer, pending request, or fresh "request access". */}
      <MaintainCTA
        locationId={data._id}
        locationName={data.name}
        town={data.town}
      />

      {/* When + Where */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="loc-anim flex flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            When
          </p>
          <ul className="flex flex-col gap-3">
            {upcomingSchedules.map((s) => {
              const rel = relativeDay(s.thisWeek.date);
              return (
                <li
                  key={s._id}
                  className="rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
                >
                  <p className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    {formatDayPlural(s.dayOfWeek)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {formatTimeRange(s.startTime, s.endTime)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                        s.thisWeek.isOn
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                      }`}
                    >
                      {s.thisWeek.isOn ? "On" : "Off"} · {rel}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {formatDateLong(s.thisWeek.date)}
                    </span>
                  </div>
                  {!s.thisWeek.isOn && s.thisWeek.reason ? (
                    <p className="mt-2 text-xs italic text-rose-700 dark:text-rose-300">
                      {s.thisWeek.reason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </article>

        <article className="loc-anim flex flex-col gap-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            Where
          </p>
          <p className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {data.town}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {data.address}
          </p>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              posthog.capture("maps_link_clicked", {
                location_id: id,
                location_name: data.name,
                town: data.town,
              })
            }
            className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
          >
            Open in Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </article>
      </div>

      {/* Map */}
      <section className="loc-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            On the map
          </p>
        </header>
        <LocationPin
          lat={data.lat}
          lng={data.lng}
          onChange={() => {}}
          draggable={false}
          height={280}
        />
      </section>

      {/* The lowdown */}
      {data.details ? (
        <section className="loc-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <header className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
              The lowdown
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              What to expect
            </h2>
          </header>
          <div className="px-5 py-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {data.details}
            </p>
          </div>
        </section>
      ) : null}

      {/* Last sessions */}
      {upcomingSchedules.some((s) => s.lastSession) ? (
        <section className="loc-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <header className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
              Last sessions
            </p>
          </header>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {upcomingSchedules
              .filter((s) => s.lastSession)
              .map((s) => {
                const last = s.lastSession!;
                const condition = last.weatherCondition as Condition | undefined;
                const weatherMeta = condition ? WEATHER_META[condition] : null;
                return (
                  <li key={s._id} className="px-5 py-4">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatDayPlural(s.dayOfWeek)} ·{" "}
                      {formatTimeRange(s.startTime, s.endTime)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDateLong(last.date)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {last.turnout !== undefined ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                          <Users className="h-3 w-3" />
                          {last.turnout} players
                        </span>
                      ) : null}
                      {weatherMeta ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-br ${weatherMeta.tone} px-2.5 py-0.5 text-[11px] font-bold text-white`}
                        >
                          <weatherMeta.Icon className="h-3 w-3" />
                          {weatherMeta.label}
                        </span>
                      ) : null}
                    </div>
                    {last.recapNotes ? (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {last.recapNotes}
                      </p>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
