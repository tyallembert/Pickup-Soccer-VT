"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SettingsForm } from "@/app/_components/SettingsForm";
import { StatusForm } from "@/app/_components/StatusForm";
import { RecapForm } from "@/app/_components/RecapForm";
import { upcomingGameDay, mostRecentPastGameDay } from "@/convex/lib/dates";

export function AdminLocationClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.admin.adminGetLocation, { id });
  const update = useMutation(api.admin.adminUpdateLocation);
  const setStatus = useMutation(api.admin.adminSetLocationStatus);
  const saveRecap = useMutation(api.admin.adminSaveRecap);
  const remoderate = useMutation(api.admin.remoderateLocation);
  const del = useMutation(api.admin.deleteLocation);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!data) return <p>Loading…</p>;

  // Compute upcoming and most-recent dates client-side for the StatusForm/RecapForm props.
  const now = new Date();
  const upcoming = upcomingGameDay(now, data.dayOfWeek, data.startTime);
  const mostRecent = mostRecentPastGameDay(now, data.dayOfWeek, data.startTime);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-zinc-500">
          Owner: {data.ownerEmail} — status: <strong>{data.status}</strong>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {data.status !== "pending" ? (
          <button
            onClick={() => remoderate({ id })}
            className="rounded border border-zinc-400 px-3 py-1 text-sm"
          >
            Re-moderate (set to pending)
          </button>
        ) : null}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded border border-red-500 px-3 py-1 text-sm text-red-700"
          >
            Delete location
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-700">Are you sure?</span>
            <button
              onClick={async () => { await del({ id }); router.push("/admin/locations"); }}
              className="rounded bg-red-700 px-3 py-1 text-sm text-white"
            >
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded border border-zinc-400 px-3 py-1 text-sm">
              Cancel
            </button>
          </div>
        )}
      </div>

      <SettingsForm
        initial={{
          name: data.name, town: data.town, address: data.address,
          lat: data.lat, lng: data.lng,
          dayOfWeek: data.dayOfWeek, startTime: data.startTime, details: data.details,
        }}
        onSave={async (v) => { await update({ id, ...v }); }}
      />

      {data.status === "approved" ? (
        <>
          <StatusForm
            date={upcoming}
            isOn={true /* admin form starts neutral; user toggles */}
            reason={undefined}
            dayOfWeek={data.dayOfWeek}
            onSave={async ({ isOn, reason }) => { await setStatus({ id, isOn, reason }); }}
          />
          <RecapForm
            date={mostRecent}
            initial={{}}
            onSave={async (v) => { await saveRecap({ id, ...v }); }}
          />
        </>
      ) : null}
    </section>
  );
}
