"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CalendarClock, CheckCircle2, Hourglass, MapPin, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LocationPin } from "@/app/_components/LocationPin";
import { Avatar, AvatarFallback, initialsFromEmail } from "@/app/_components/ui/avatar";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";

export function ReviewClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.admin.adminGetLocation, { id });
  const approve = useMutation(api.admin.approveLocation);
  const reject = useMutation(api.admin.rejectLocation);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.from(".review-anim", {
        y: 16,
        opacity: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.07,
      });
    },
    { scope: root, dependencies: [data?._id] },
  );

  if (!data) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  const handleApprove = async () => {
    setError(null);
    setBusy(true);
    try {
      await approve({ id });
      router.push("/admin/queue");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't approve.");
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      setError("Add a reason so the submitter knows what to fix.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await reject({ id, reason });
      router.push("/admin/queue");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reject.");
      setBusy(false);
    }
  };

  return (
    <div ref={root} className="flex flex-col gap-6">
      <header className="review-anim overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/90">
            Awaiting your call
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            <Hourglass className="h-3 w-3" /> Pending
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold">Review submission</h1>
        <p className="mt-1 inline-flex items-center gap-2 text-sm text-amber-50/90">
          <Avatar className="h-6 w-6 border border-white/30">
            <AvatarFallback className="bg-white text-[10px] text-amber-900">
              {initialsFromEmail(data.ownerEmail)}
            </AvatarFallback>
          </Avatar>
          Submitted by <strong className="font-semibold">{data.ownerEmail}</strong>
        </p>
      </header>

      {/* Submission preview */}
      <section className="review-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Public preview
          </p>
        </header>
        <div className="flex flex-col gap-2 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {data.name}
          </h2>
          <p className="inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            <MapPin className="h-3.5 w-3.5" />
            {data.town}
            <span className="mx-1">·</span>
            <span className="text-xs text-zinc-500">{data.address}</span>
          </p>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CalendarClock className="h-4 w-4" />
            {formatDayPlural(data.dayOfWeek)} at {formatStartTime(data.startTime)}
          </p>
          {data.details ? (
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {data.details}
            </pre>
          ) : null}
        </div>
      </section>

      {/* Map preview */}
      <section className="review-anim">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Pin location
        </p>
        <LocationPin
          lat={data.lat}
          lng={data.lng}
          onChange={() => {}}
          draggable={false}
          height={240}
        />
      </section>

      {/* Action panel */}
      <section className="review-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            Decision
          </p>
          <h2 className="mt-0.5 text-base font-semibold">Approve or reject</h2>
        </header>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:scale-[1.02] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? "Approving…" : "Approve & publish"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowReject((s) => !s)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-zinc-950 dark:text-rose-300 dark:hover:bg-rose-950"
            >
              <XCircle className="h-4 w-4" />
              {showReject ? "Cancel reject" : "Reject…"}
            </button>
          </div>

          {showReject ? (
            <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900 dark:bg-rose-950/30">
              <label className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                Reason (shown to the submitter)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Pin doesn't match the address. Please drop it on the actual field."
                className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-rose-900 dark:bg-zinc-950"
              />
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={handleReject}
                className="self-start rounded-full bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
              >
                {busy ? "Rejecting…" : "Send rejection"}
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
