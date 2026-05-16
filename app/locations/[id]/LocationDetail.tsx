"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import posthog from "posthog-js";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeft,
  CalendarClock,
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
  formatStartTime,
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
      game_on: data.thisWeek.isOn,
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

  const isOn = data.thisWeek.isOn;
  const heroFrom = isOn ? "from-emerald-700" : "from-amber-700";
  const heroVia = isOn ? "via-emerald-600" : "via-orange-600";
  const heroTo = isOn ? "to-emerald-500" : "to-amber-500";
  const heroShadow = isOn
    ? "shadow-[0_20px_60px_rgba(16,185,129,0.20)]"
    : "shadow-[0_20px_60px_rgba(245,158,11,0.22)]";
  const rel = relativeDay(data.thisWeek.date);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    data.address,
  )}`;
  const condition = data.lastSession?.weatherCondition as Condition | undefined;
  const weatherMeta = condition ? WEATHER_META[condition] : null;

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
              {isOn ? (
                <span className="relative inline-flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {isOn ? "Game on this week" : "Game off this week"}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDateLong(data.thisWeek.date)}
            </span>

            <span className="inline-flex items-center rounded-full bg-white/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              {rel}
            </span>
          </div>

          {!isOn && data.thisWeek.reason ? (
            <p className="mt-3 max-w-prose rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/95 backdrop-blur">
              <strong className="font-semibold">Reason:</strong>{" "}
              {data.thisWeek.reason}
            </p>
          ) : null}
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
        <article className="loc-anim flex flex-col gap-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            When
          </p>
          <p className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {formatDayPlural(data.dayOfWeek)}
          </p>
          <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {formatStartTime(data.startTime)}
          </p>
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

      {/* Last session */}
      {data.lastSession ? (
        <section className="loc-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <header className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
              Last session
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {formatDateLong(data.lastSession.date)}
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-5 px-5 py-4 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col gap-3">
              {data.lastSession.turnout !== undefined ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <Users className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                  <div>
                    <p className="text-2xl font-bold leading-none text-emerald-900 dark:text-emerald-100">
                      {data.lastSession.turnout}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Players
                    </p>
                  </div>
                </div>
              ) : null}
              {weatherMeta ? (
                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-br ${weatherMeta.tone} px-3 py-1.5 text-xs font-bold text-white shadow-sm`}
                >
                  <weatherMeta.Icon className="h-3.5 w-3.5" />
                  {weatherMeta.label}
                  {data.lastSession.weather ? (
                    <span className="font-medium opacity-90">
                      · {data.lastSession.weather}
                    </span>
                  ) : null}
                </div>
              ) : data.lastSession.weather ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {data.lastSession.weather}
                </p>
              ) : null}
            </div>
            {data.lastSession.recapNotes ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {data.lastSession.recapNotes}
              </p>
            ) : (
              <p className="text-sm italic text-zinc-500">
                No recap notes posted for this session.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
