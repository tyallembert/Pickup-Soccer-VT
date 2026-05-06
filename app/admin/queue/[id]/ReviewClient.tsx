"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LocationPin } from "@/app/_components/LocationPin";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";

export function ReviewClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.admin.adminGetLocation, { id });
  const approve = useMutation(api.admin.approveLocation);
  const reject = useMutation(api.admin.rejectLocation);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data) return <p>Loading…</p>;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Review submission</h1>
      <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">By {data.ownerEmail}</p>
        <p className="text-lg font-semibold">{data.name}</p>
        <p>{data.town}</p>
        <p>{data.address}</p>
        <p>
          {formatDayPlural(data.dayOfWeek)} at {formatStartTime(data.startTime)}
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{data.details}</pre>
      </div>
      <LocationPin lat={data.lat} lng={data.lng} onChange={() => {}} draggable={false} height={240} />

      <div className="flex gap-3">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await approve({ id });
            router.push("/admin/queue");
          }}
          className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Approve
        </button>
      </div>

      <details className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-semibold">Reject</summary>
        <textarea
          rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection (will be shown to owner)"
          className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            await reject({ id, reason });
            router.push("/admin/queue");
          }}
          className="mt-2 rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Reject submission
        </button>
      </details>
    </section>
  );
}
