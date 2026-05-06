"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SettingsForm } from "@/app/_components/SettingsForm";
import { StatusForm } from "@/app/_components/StatusForm";
import { RecapForm } from "@/app/_components/RecapForm";

const BANNERS: Record<string, { tone: string; text: string }> = {
  pending: {
    tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    text: "Awaiting review. You can keep editing while you wait.",
  },
  approved: {
    tone: "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100",
    text: "Live on the directory.",
  },
  rejected: {
    tone: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
    text: "Edit your submission and resubmit.",
  },
};

export function OwnerLocationClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.public.getMyLocation, { id });
  const update = useMutation(api.owner.updateLocation);
  const setStatus = useMutation(api.owner.setLocationStatus);
  const saveRecap = useMutation(api.owner.saveRecap);
  const resubmit = useMutation(api.submissions.resubmitLocation);

  if (data === undefined) return <p className="px-6 py-12 text-sm text-zinc-500">Loading…</p>;

  const banner = BANNERS[data.status];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-zinc-500">{data.town}</p>
      </header>

      <div className={`rounded-md border p-3 text-sm ${banner.tone}`}>
        <p className="font-semibold uppercase tracking-wide">{data.status}</p>
        <p>{banner.text}</p>
        {data.status === "rejected" && data.rejectionReason ? (
          <p className="mt-1">Reason: {data.rejectionReason}</p>
        ) : null}
        {data.status === "rejected" ? (
          <button
            onClick={() => resubmit({ id: data._id })}
            className="mt-2 rounded border border-current px-3 py-1 text-sm"
          >
            Resubmit for review
          </button>
        ) : null}
      </div>

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
        onSave={async (v) => { await update({ id: data._id, ...v }); }}
      />

      {data.status === "approved" && data.thisWeek ? (
        <StatusForm
          date={data.thisWeek.date}
          isOn={data.thisWeek.isOn}
          reason={data.thisWeek.reason}
          dayOfWeek={data.dayOfWeek}
          onSave={async ({ isOn, reason }) => { await setStatus({ id: data._id, isOn, reason }); }}
        />
      ) : null}

      {data.status === "approved" ? (
        <RecapForm
          date={data.lastSession?.date ?? null}
          initial={{
            turnout: data.lastSession?.turnout,
            weatherCondition: data.lastSession?.weatherCondition,
            weather: data.lastSession?.weather,
            recapNotes: data.lastSession?.recapNotes,
          }}
          onSave={async (v) => { await saveRecap({ id: data._id, ...v }); }}
        />
      ) : null}
    </main>
  );
}
