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
  const setStatus = useMutation(api.admin.adminSetLocationStatus);
  const saveRecap = useMutation(api.admin.adminSaveRecap);
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
  const upcoming = upcomingGameDay(now, data.dayOfWeek, data.startTime);
  const mostRecent = mostRecentPastGameDay(now, data.dayOfWeek, data.startTime);

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
            <SettingsForm
              initial={{
                name: data.name,
                town: data.town,
                address: data.address,
                lat: data.lat,
                lng: data.lng,
                dayOfWeek: data.dayOfWeek,
                startTime: data.startTime,
                details: data.details,
              }}
              onSave={async (v) => {
                await update({ id, ...v });
              }}
            />
          </PanelCard>
        ) : null}

        {tab === "thisWeek" && status === "approved" ? (
          <PanelCard
            eyebrow="This week"
            title="Override game-day status"
            subtitle="Force the upcoming game on or off."
          >
            <StatusForm
              date={upcoming}
              isOn={true}
              reason={undefined}
              dayOfWeek={data.dayOfWeek}
              onSave={async ({ isOn, reason }) => {
                await setStatus({ id, isOn, reason });
              }}
            />
          </PanelCard>
        ) : null}

        {tab === "lastSession" && status === "approved" ? (
          <PanelCard
            eyebrow="Last session"
            title="Override recap"
            subtitle="Edit the recap as if you were the owner."
          >
            <RecapForm
              date={mostRecent}
              initial={{}}
              onSave={async (v) => {
                await saveRecap({ id, ...v });
              }}
            />
          </PanelCard>
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
