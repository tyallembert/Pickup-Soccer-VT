"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SettingsForm } from "@/app/_components/SettingsForm";
import { StatusForm } from "@/app/_components/StatusForm";
import { RecapForm } from "@/app/_components/RecapForm";
import { MaintainersPanel } from "@/app/_components/MaintainersPanel";
import { SegmentedTabs, type SegmentedTab } from "@/app/_components/ui/segmented-tabs";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";
import posthog from "posthog-js";

type Tab = "details" | "thisWeek" | "lastSession" | "maintainers";

type Status = "pending" | "approved" | "rejected";

const STATUS_THEME: Record<
  Status,
  {
    headerFrom: string;
    headerTo: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge: string;
    badgeText: string;
  }
> = {
  pending: {
    headerFrom: "from-amber-500",
    headerTo: "to-orange-500",
    eyebrow: "Awaiting review",
    title: "Submitted!",
    subtitle: "Hang tight — an admin is reviewing your pickup game.",
    icon: <Hourglass className="h-5 w-5" />,
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
    badgeText: "PENDING",
  },
  approved: {
    headerFrom: "from-emerald-700",
    headerTo: "to-emerald-500",
    eyebrow: "Live on the directory",
    title: "You're on the map",
    subtitle: "Manage this week's status and write recaps below.",
    icon: <CheckCircle2 className="h-5 w-5" />,
    badge: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
    badgeText: "APPROVED",
  },
  rejected: {
    headerFrom: "from-rose-700",
    headerTo: "to-red-500",
    eyebrow: "Needs changes",
    title: "Submission rejected",
    subtitle: "Edit the details below and resubmit when ready.",
    icon: <XCircle className="h-5 w-5" />,
    badge: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
    badgeText: "REJECTED",
  },
};

export function OwnerLocationClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.public.getMyLocation, { id });
  const update = useMutation(api.owner.updateLocation);
  const setStatus = useMutation(api.owner.setScheduleStatus);
  const saveRecap = useMutation(api.owner.saveScheduleRecap);
  const resubmit = useMutation(api.submissions.resubmitLocation);

  const root = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRunCount = useRef(0);
  const isLoading = data === undefined;
  const [tab, setTab] = useState<Tab>("details");

  const status = (data?.status ?? "pending") as Status;
  const isPrimary = data?.viewerIsPrimaryOwner ?? false;
  const viewerRole = data?.viewerRole;
  const tabItems = useMemo<SegmentedTab<Tab>[]>(() => {
    const items: SegmentedTab<Tab>[] = [
      { value: "details", label: "Field details", icon: <Settings className="h-3.5 w-3.5" /> },
    ];
    if (status === "approved") {
      items.push({
        value: "thisWeek",
        label: "This week",
        icon: <CalendarDays className="h-3.5 w-3.5" />,
      });
      items.push({
        value: "lastSession",
        label: "Last session",
        icon: <ClipboardList className="h-3.5 w-3.5" />,
      });
      if (isPrimary) {
        items.push({
          value: "maintainers",
          label: "Maintainers",
          icon: <Users className="h-3.5 w-3.5" />,
        });
      }
    }
    return items;
  }, [status, isPrimary]);

  useEffect(() => {
    if (!tabItems.some((t) => t.value === tab)) setTab("details");
  }, [tabItems, tab]);

  useGSAP(
    () => {
      if (isLoading || !root.current) return;
      const targets = root.current.querySelectorAll(".owner-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 16,
        opacity: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.08,
      });
    },
    { scope: root, dependencies: [isLoading] },
  );

  // Animate the active panel when the tab changes (skip the initial mount
  // so we don't double-animate alongside the entrance stagger above).
  useGSAP(
    () => {
      tabRunCount.current += 1;
      if (tabRunCount.current === 1) return;
      if (!panelRef.current) return;
      gsap.from(panelRef.current, {
        y: 10,
        opacity: 0,
        duration: 0.32,
        ease: "power2.out",
      });
    },
    { dependencies: [tab] },
  );

  if (isLoading) {
    return (
      <main ref={root} className="mx-auto w-full max-w-2xl px-6 pt-24 pb-12">
        <div className="h-32 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      </main>
    );
  }

  const theme = STATUS_THEME[status];

  return (
    <main
      ref={root}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pt-24 pb-12"
    >
      {/* Header card matching the submit-form aesthetic */}
      <header
        className={`owner-anim overflow-hidden rounded-2xl bg-gradient-to-br ${theme.headerFrom} ${theme.headerTo} p-6 text-white shadow-lg`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/80">
            {theme.eyebrow}
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest ${theme.badge}`}
          >
            {theme.icon}
            {theme.badgeText}
          </span>
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          {theme.title}
        </h1>
        <p className="mt-1 text-sm text-white/90">{theme.subtitle}</p>
      </header>

      {/* Submission preview — what the public will see */}
      <section className="owner-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            Public preview
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {data.name}
              </h2>
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                <MapPin className="h-3.5 w-3.5" />
                {data.town}
              </p>
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {data.schedules.map((s) => (
              <p key={s._id} className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                {formatDayPlural(s.dayOfWeek)} at {formatStartTime(s.startTime)}
              </p>
            ))}
          </div>
          {data.details ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
              {data.details}
            </p>
          ) : null}
        </div>
      </section>

      {/* Pending: animated "what happens next" stepper */}
      {status === "pending" ? (
        <section className="owner-anim rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            What happens next
          </p>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-amber-900 dark:text-amber-100">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                <Check className="h-3 w-3" />
              </span>
              You submitted the field.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                <Hourglass className="h-3 w-3" />
              </span>
              An admin reviews and approves.
            </li>
            <li className="flex items-start gap-2 opacity-60">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-900">
                3
              </span>
              Your field appears on the map and you can manage status + recaps.
            </li>
          </ol>
        </section>
      ) : null}

      {/* Rejection callout */}
      {status === "rejected" ? (
        <section className="owner-anim rounded-2xl border border-rose-200 bg-rose-50/70 px-5 py-4 dark:border-rose-900 dark:bg-rose-950/40">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
                Reason
              </p>
              <p className="mt-0.5 text-sm text-rose-900/90 dark:text-rose-100/90">
                {data.rejectionReason || "No reason provided."}
              </p>
              {isPrimary ? (
                <button
                  onClick={() => {
                    resubmit({ id: data._id });
                    posthog.capture("location_resubmitted", {
                      location_id: data._id,
                      location_name: data.name,
                      town: data.town,
                    });
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-rose-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Resubmit for review
                </button>
              ) : (
                <p className="mt-3 text-xs italic text-rose-800/80 dark:text-rose-200/80">
                  Only the primary organizer can resubmit this field.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Maintainer access banner — shown to approved co-maintainers so they
          know which powers they have on this field. */}
      {viewerRole === "maintainer" ? (
        <div className="owner-anim flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-xs font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          <span>
            You&rsquo;re a co-maintainer here. You can edit details, set weekly
            status, and write recaps. The primary organizer manages access.
          </span>
        </div>
      ) : null}

      {/* Tab strip — only show if there's more than one tab */}
      {tabItems.length > 1 ? (
        <div className="owner-anim">
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            items={tabItems}
            ariaLabel="Manage this location"
          />
        </div>
      ) : null}

      {/* Active panel */}
      <div ref={panelRef} className="owner-anim">
        {tab === "details" ? (
          <PanelCard
            eyebrow="Field details"
            title="Edit submission"
            subtitle={
              status === "pending"
                ? "Tweaks before approval — go ahead."
                : "Updates here go live immediately."
            }
          >
            <div className="flex flex-col gap-6">
              <SettingsForm
                initial={{
                  name: data.name,
                  town: data.town,
                  address: data.address,
                  lat: data.lat,
                  lng: data.lng,
                  details: data.details,
                }}
                onSave={async (v) => {
                  await update({ id: data._id, ...v });
                }}
              />
              <SchedulesEditor
                locationId={data._id}
                initial={data.schedules.map((s) => ({
                  _id: s._id,
                  dayOfWeek: s.dayOfWeek,
                  startTime: s.startTime,
                  endTime: s.endTime,
                }))}
              />
            </div>
          </PanelCard>
        ) : null}

        {tab === "thisWeek" && status === "approved" ? (
          <PanelCard
            eyebrow="This week"
            title="Is the game on?"
            subtitle="Toggle each slot independently."
          >
            <div className="flex flex-col gap-6">
              {data.schedules.map((s) => (
                <div
                  key={s._id}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                    {formatDayPlural(s.dayOfWeek)} ·{" "}
                    {formatStartTime(s.startTime)}
                  </p>
                  <StatusForm
                    date={s.thisWeek.date}
                    isOn={s.thisWeek.isOn}
                    reason={s.thisWeek.reason}
                    onSave={async ({ isOn, reason }) => {
                      await setStatus({ scheduleId: s._id, isOn, reason });
                    }}
                  />
                </div>
              ))}
            </div>
          </PanelCard>
        ) : null}

        {tab === "lastSession" && status === "approved" ? (
          <PanelCard
            eyebrow="Last session"
            title="Recap"
            subtitle="One recap per slot."
          >
            <div className="flex flex-col gap-6">
              {data.schedules.map((s) => (
                <div
                  key={s._id}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                    {formatDayPlural(s.dayOfWeek)} ·{" "}
                    {formatStartTime(s.startTime)}
                  </p>
                  <RecapForm
                    date={s.lastSession?.date ?? null}
                    initial={{
                      turnout: s.lastSession?.turnout,
                      weatherCondition: s.lastSession?.weatherCondition,
                      weather: s.lastSession?.weather,
                      recapNotes: s.lastSession?.recapNotes,
                    }}
                    onSave={async (v) => {
                      await saveRecap({ scheduleId: s._id, ...v });
                    }}
                  />
                </div>
              ))}
            </div>
          </PanelCard>
        ) : null}

        {tab === "maintainers" && status === "approved" && isPrimary ? (
          <PanelCard
            eyebrow="Co-maintainers"
            title="Approve and manage helpers"
            subtitle="Approved maintainers can edit every field above. Only you can grant or revoke access."
          >
            <MaintainersPanel locationId={data._id} locationName={data.name} />
          </PanelCard>
        ) : null}
      </div>
    </main>
  );
}

type ScheduleRow = {
  _id?: Id<"locationSchedules">;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
};

function SchedulesEditor({
  locationId,
  initial,
}: {
  locationId: Id<"locations">;
  initial: ScheduleRow[];
}) {
  const setSchedules = useMutation(api.owner.setSchedules);
  const [rows, setRows] = useState<ScheduleRow[]>(initial);
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  async function save() {
    setPending(true);
    try {
      await setSchedules({
        id: locationId,
        schedules: rows.map((r) => ({
          _id: r._id,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
      });
      setSavedAt(Date.now());
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
        Slots
      </p>
      {rows.map((r, i) => (
        <div
          key={r._id ?? `new-${i}`}
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Slot {i + 1}
            </p>
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  setRows((rs) => rs.filter((_, j) => j !== i))
                }
                className="rounded-full p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                aria-label={`Remove slot ${i + 1}`}
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={r.dayOfWeek}
              onChange={(e) =>
                setRows((rs) => {
                  const next = rs.slice();
                  next[i] = { ...next[i], dayOfWeek: Number(e.target.value) };
                  return next;
                })
              }
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {days.map((d, di) => (
                <option key={di} value={di}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={r.startTime}
              onChange={(e) =>
                setRows((rs) => {
                  const next = rs.slice();
                  next[i] = { ...next[i], startTime: e.target.value };
                  return next;
                })
              }
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              type="time"
              value={r.endTime ?? ""}
              onChange={(e) =>
                setRows((rs) => {
                  const next = rs.slice();
                  next[i] = {
                    ...next[i],
                    endTime: e.target.value || undefined,
                  };
                  return next;
                })
              }
              placeholder="End (optional)"
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows((rs) => [...rs, { dayOfWeek: 1, startTime: "18:00" }])
        }
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        + Add another time
      </button>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-[1.02] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save slots"}
        </button>
        {savedAt && Date.now() - savedAt < 4000 ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-300">Saved</span>
        ) : null}
      </div>
    </div>
  );
}

function PanelCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
