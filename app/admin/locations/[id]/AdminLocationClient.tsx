"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  RotateCcw,
  Settings,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SettingsForm } from "@/app/_components/SettingsForm";
import { StatusForm } from "@/app/_components/StatusForm";
import { RecapForm } from "@/app/_components/RecapForm";
import { Avatar, AvatarFallback, initialsFromEmail } from "@/app/_components/ui/avatar";
import { SegmentedTabs, type SegmentedTab } from "@/app/_components/ui/segmented-tabs";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";
import { upcomingGameDay, mostRecentPastGameDay } from "@/convex/lib/dates";

type Status = "pending" | "approved" | "rejected";
type Tab = "details" | "thisWeek" | "lastSession";

const HEADER_THEME: Record<
  Status,
  { from: string; to: string; eyebrow: string; icon: React.ReactNode; badge: string }
> = {
  pending: {
    from: "from-amber-500",
    to: "to-orange-500",
    eyebrow: "Override · Pending",
    icon: <Hourglass className="h-3 w-3" />,
    badge: "PENDING",
  },
  approved: {
    from: "from-emerald-700",
    to: "to-emerald-500",
    eyebrow: "Override · Approved",
    icon: <CheckCircle2 className="h-3 w-3" />,
    badge: "APPROVED",
  },
  rejected: {
    from: "from-rose-700",
    to: "to-red-500",
    eyebrow: "Override · Rejected",
    icon: <XCircle className="h-3 w-3" />,
    badge: "REJECTED",
  },
};

export function AdminLocationClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.admin.adminGetLocation, { id });
  const update = useMutation(api.admin.adminUpdateLocation);
  const setStatus = useMutation(api.admin.adminSetScheduleStatus);
  const saveRecap = useMutation(api.admin.adminSaveScheduleRecap);
  const remoderate = useMutation(api.admin.remoderateLocation);
  const del = useMutation(api.admin.deleteLocation);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<Tab>("details");

  const status = (data?.status ?? "pending") as Status;
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
    }
    return items;
  }, [status]);

  useEffect(() => {
    if (!tabItems.some((t) => t.value === tab)) setTab("details");
  }, [tabItems, tab]);

  const root = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRunCount = useRef(0);
  useGSAP(
    () => {
      gsap.from(".admin-loc-anim", {
        y: 16,
        opacity: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.07,
      });
    },
    { scope: root, dependencies: [data?._id] },
  );

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

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;

  const theme = HEADER_THEME[status];
  const now = new Date();

  return (
    <div ref={root} className="flex flex-col gap-6">
      <header
        className={`admin-loc-anim overflow-hidden rounded-2xl bg-gradient-to-br ${theme.from} ${theme.to} p-6 text-white shadow-lg`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/85">
            {theme.eyebrow}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            {theme.icon}
            {theme.badge}
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold">{data.name}</h1>
        <p className="mt-1 inline-flex items-center gap-2 text-sm text-white/85">
          <Avatar className="h-6 w-6 border border-white/30">
            <AvatarFallback className="bg-white/20 text-[10px] text-white">
              {initialsFromEmail(data.ownerEmail)}
            </AvatarFallback>
          </Avatar>
          Owner: <strong className="font-semibold">{data.ownerEmail}</strong>
        </p>
      </header>

      {/* Admin control bar — destructive + status overrides live here */}
      <section className="admin-loc-anim flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50/80 px-4 py-3 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/70">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/90 text-white shadow-sm dark:bg-zinc-200 dark:text-zinc-900">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-700 dark:text-zinc-300">
            Admin controls
          </p>
        </div>

        <span className="ml-auto" aria-hidden />

        {status !== "pending" ? (
          <button
            onClick={() => remoderate({ id })}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Re-moderate
          </button>
        ) : null}

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50/40 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100/70 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-full bg-rose-50 px-2 py-1 dark:bg-rose-950/40">
            <span className="pl-1 text-xs font-medium text-rose-800 dark:text-rose-200">
              Delete this submission?
            </span>
            <button
              onClick={async () => {
                await del({ id });
                router.push("/admin/locations");
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(225,29,72,0.35)] transition hover:bg-rose-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Yes, delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-rose-50 dark:border-rose-900 dark:bg-zinc-950 dark:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {tabItems.length > 1 ? (
        <div className="admin-loc-anim">
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            items={tabItems}
            ariaLabel="Override sections"
          />
        </div>
      ) : null}

      <div ref={panelRef} className="admin-loc-anim">
        {tab === "details" ? (
          <PanelCard
            eyebrow="Field details"
            title="Override settings"
            subtitle="Edits here take effect immediately and bypass the owner."
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
                  await update({ id, ...v });
                }}
              />
              <AdminSchedulesEditor
                locationId={id}
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
            title="Override game-day status"
            subtitle="Force each upcoming slot on or off."
          >
            <div className="flex flex-col gap-6">
              {data.schedules.map((s) => (
                <div
                  key={s._id}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                    {formatDayPlural(s.dayOfWeek)} · {formatStartTime(s.startTime)}
                  </p>
                  <StatusForm
                    date={upcomingGameDay(now, s.dayOfWeek, s.startTime)}
                    isOn={true}
                    reason={undefined}
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
            title="Override recap"
            subtitle="Edit the recap for each slot as if you were the owner."
          >
            <div className="flex flex-col gap-6">
              {data.schedules.map((s) => (
                <div
                  key={s._id}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                    {formatDayPlural(s.dayOfWeek)} · {formatStartTime(s.startTime)}
                  </p>
                  <RecapForm
                    date={mostRecentPastGameDay(now, s.dayOfWeek, s.startTime)}
                    initial={{}}
                    onSave={async (v) => {
                      await saveRecap({ scheduleId: s._id, ...v });
                    }}
                  />
                </div>
              ))}
            </div>
          </PanelCard>
        ) : null}
      </div>
    </div>
  );
}

type ScheduleRow = {
  _id?: Id<"locationSchedules">;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
};

function AdminSchedulesEditor({
  locationId,
  initial,
}: {
  locationId: Id<"locations">;
  initial: ScheduleRow[];
}) {
  const setSchedules = useMutation(api.admin.adminSetSchedules);
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
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
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
        onClick={() => setRows((rs) => [...rs, { dayOfWeek: 1, startTime: "18:00" }])}
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
