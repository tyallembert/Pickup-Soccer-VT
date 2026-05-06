"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { LocationPin } from "@/app/_components/LocationPin";
import { geocodeAddress } from "@/app/_lib/geocode";

const STORAGE_KEY = "pickup-soccer-submit-draft";

type Draft = {
  name: string;
  town: string;
  address: string;
  lat: number | null;
  lng: number | null;
  dayOfWeek: number;
  startTime: string;
  details: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  town: "",
  address: "",
  lat: null,
  lng: null,
  dayOfWeek: 1,
  startTime: "18:00",
  details: "",
};

export function SubmitForm() {
  const router = useRouter();
  const me = useQuery(api.public.me);
  const submit = useMutation(api.submissions.submitLocation);
  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === "undefined") return EMPTY_DRAFT;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    try { return JSON.parse(raw) as Draft; } catch { return EMPTY_DRAFT; }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist on every change.
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onAddressBlur = async () => {
    if (!draft.address.trim()) return;
    const geo = await geocodeAddress(draft.address);
    if (geo) update({ lat: geo.lat, lng: geo.lng });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (draft.lat === null || draft.lng === null) {
      setError("Drop the pin on the map before submitting.");
      return;
    }
    if (me === null) {
      router.push(`/signup?redirect=${encodeURIComponent("/submit")}`);
      return;
    }
    setPending(true);
    try {
      const id = await submit({
        name: draft.name,
        town: draft.town,
        address: draft.address,
        lat: draft.lat,
        lng: draft.lng,
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        details: draft.details,
      });
      sessionStorage.removeItem(STORAGE_KEY);
      router.push(`/account/locations/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Add a pickup game</h1>
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
        You&apos;ll need a free account to submit. We&apos;ll prompt you when you save.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          required value={draft.name} onChange={(e) => update({ name: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Town
        <input
          required value={draft.town} onChange={(e) => update({ town: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input
          required value={draft.address}
          onChange={(e) => update({ address: e.target.value })}
          onBlur={onAddressBlur}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div>
        <p className="mb-1 text-sm">Map pin (drag to fine-tune)</p>
        <LocationPin
          lat={draft.lat}
          lng={draft.lng}
          onChange={(lat, lng) => update({ lat, lng })}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Day of week
        <select value={draft.dayOfWeek} onChange={(e) => update({ dayOfWeek: parseInt(e.target.value, 10) })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label, i) => (
            <option key={i} value={i}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start time
        <input type="time" required value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Details (markdown)
        <textarea rows={6} value={draft.details} onChange={(e) => update({ details: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900" />
      </label>

      <button type="submit" disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Submitting…" : me === null ? "Continue to sign up" : "Submit for review"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
