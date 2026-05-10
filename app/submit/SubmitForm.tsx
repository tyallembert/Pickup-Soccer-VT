"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  FileText,
  MapPin,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { LocationPin } from "@/app/_components/LocationPin";
import { geocodeAddress } from "@/app/_lib/geocode";
import { VERMONT_TOWNS } from "@/app/_lib/vermont-towns";
import { cn } from "@/app/_lib/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/_components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/_components/ui/command";

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

const STEPS = [
  { key: "basics", label: "Basics", Icon: Tag },
  { key: "where", label: "Where", Icon: MapPin },
  { key: "when", label: "When", Icon: CalendarDays },
  { key: "details", label: "Details", Icon: FileText },
] as const;

export function SubmitForm() {
  const router = useRouter();
  const me = useQuery(api.public.me);
  const submit = useMutation(api.submissions.submitLocation);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate draft from sessionStorage after mount so SSR and first client
  // render match (avoids hydration mismatch).
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setDraft(JSON.parse(raw) as Draft);
      } catch {
        // ignore corrupt draft
      }
    }
    setHydrated(true);
  }, []);

  // Persist draft on every change. Skip until hydrated so we don't overwrite
  // the saved draft with EMPTY_DRAFT on first mount.
  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Slide the active step in.
  const stepRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!stepRef.current) return;
      gsap.fromTo(
        stepRef.current,
        { x: direction * 60, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
      );
    },
    { dependencies: [step] },
  );

  // Animate progress bar fill.
  const fillRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!fillRef.current) return;
      gsap.to(fillRef.current, {
        width: `${((step + 1) / STEPS.length) * 100}%`,
        duration: 0.5,
        ease: "power3.out",
      });
    },
    { dependencies: [step] },
  );

  const onAddressBlur = async () => {
    if (!draft.address.trim()) return;
    const geo = await geocodeAddress(draft.address);
    if (geo) update({ lat: geo.lat, lng: geo.lng });
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!draft.name.trim()) return "Give the field a name.";
      if (!draft.town.trim()) return "Pick a town in Vermont.";
    }
    if (s === 1) {
      if (!draft.address.trim()) return "Add an address so we can place a pin.";
      if (draft.lat === null || draft.lng === null)
        return "Drop the pin on the map before continuing.";
    }
    if (s === 2) {
      if (!draft.startTime) return "What time does the game kick off?";
    }
    return null;
  };

  const goNext = () => {
    setError(null);
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goPrev = () => {
    setError(null);
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Enter in any input would otherwise submit the form. On any non-final
    // step, treat the form submit as "Next" so the user isn't accidentally
    // skipped to signup or to the actual submission.
    if (step !== STEPS.length - 1) {
      goNext();
      return;
    }

    for (let s = 0; s < STEPS.length; s++) {
      const err = validateStep(s);
      if (err) {
        setError(err);
        setDirection(1);
        setStep(s);
        return;
      }
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
        lat: draft.lat!,
        lng: draft.lng!,
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

  const isLast = step === STEPS.length - 1;

  return (
    <div className="relative mx-auto w-full max-w-2xl px-6 pt-24 pb-12">
      {/* Header card with pitch corner-arc decoration */}
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-6 text-white shadow-[0_18px_50px_-20px_rgba(16,185,129,0.55)]">
        {/* Pitch lines decoration */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-white/15"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-4 h-36 w-36 rounded-full border border-white/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-50/90">
              New pickup game
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Add a field.
            </h1>
            <p className="mt-1.5 max-w-md text-sm text-emerald-50/90">
              Tell us where and when. We&apos;ll review and post it on the map
              for the rest of the state.
            </p>
          </div>
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur sm:inline-flex">
            <Sparkles className="h-5 w-5" />
          </span>
        </div>
      </header>

      {/* Stepper rail with connecting progress line */}
      <div className="relative mb-3 px-1">
        {/* Track + animated fill behind the dots */}
        <div className="absolute inset-x-5 top-[18px] h-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div
          ref={fillRef}
          className="absolute left-5 top-[18px] h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
          style={{ width: `calc(${(step / Math.max(1, STEPS.length - 1)) * 100}% * 0.96)` }}
        />
        <ol className="relative flex items-start justify-between gap-2">
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            const Icon = s.Icon;
            return (
              <li
                key={s.key}
                className="flex flex-col items-center gap-1.5"
                aria-current={active ? "step" : undefined}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (i < step) {
                      setDirection(-1);
                      setStep(i);
                    }
                  }}
                  disabled={i > step}
                  className={cn(
                    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition",
                    active &&
                      "scale-110 border-emerald-600 bg-emerald-600 text-white shadow-[0_4px_14px_rgba(16,185,129,0.55)]",
                    done && !active && "border-emerald-600 bg-emerald-600 text-white",
                    !active &&
                      !done &&
                      "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950",
                    i <= step ? "cursor-pointer" : "cursor-default",
                  )}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </button>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em]",
                    active
                      ? "text-emerald-700 dark:text-emerald-300"
                      : done
                        ? "text-zinc-700 dark:text-zinc-300"
                        : "text-zinc-400 dark:text-zinc-600",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {me === null ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
          <span>
            Heads up — you&apos;ll need a free account to submit.
            We&apos;ll prompt you when you save.
          </span>
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="relative rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 sm:p-6"
      >
        <FoulAlert error={error} onDismiss={() => setError(null)} />

        <div ref={stepRef} key={step} className="min-h-[320px]">
          {step === 0 ? <BasicsStep draft={draft} update={update} /> : null}
          {step === 1 ? (
            <WhereStep draft={draft} update={update} onAddressBlur={onAddressBlur} />
          ) : null}
          {step === 2 ? <WhenStep draft={draft} update={update} /> : null}
          {step === 3 ? <DetailsStep draft={draft} update={update} /> : null}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-dashed border-zinc-200 pt-5 dark:border-zinc-800">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 0}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-5 py-2.5 text-sm font-semibold transition",
              step === 0
                ? "cursor-not-allowed border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700"
                : "border-zinc-300 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {isLast ? (
            <button
              type="submit"
              disabled={pending}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:scale-[1.02] hover:shadow-lg active:scale-[0.99] disabled:opacity-50"
            >
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting…
                </>
              ) : me === null ? (
                <>
                  Continue to sign up
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit for review
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-500 hover:shadow-lg active:scale-[0.99]"
            >
              Next
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function FoulAlert({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!error || !ref.current) return;
      gsap.fromTo(
        ref.current,
        { y: -8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.25, ease: "power3.out" },
      );
      gsap.fromTo(
        ref.current,
        { x: -6 },
        {
          x: 0,
          duration: 0.35,
          ease: "elastic.out(1.2, 0.4)",
          delay: 0.05,
        },
      );
    },
    { dependencies: [error] },
  );

  if (!error) return null;
  return (
    <div
      ref={ref}
      role="alert"
      className="mb-5 flex items-start gap-3 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-sm dark:border-rose-900 dark:bg-rose-950/50"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_3px_10px_rgba(225,29,72,0.4)]">
        <AlertCircle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-rose-700 dark:text-rose-300">
          Foul · fix this
        </p>
        <p className="mt-0.5 text-sm font-medium text-rose-900 dark:text-rose-100">
          {error}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded-full p-1 text-rose-700 transition hover:bg-rose-200 dark:text-rose-300 dark:hover:bg-rose-900"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900";

function BasicsStep({
  draft,
  update,
}: {
  draft: Draft;
  update: (p: Partial<Draft>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Field or park name" hint="What do players call this place?">
        <input
          required
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Waterbury Rec Field"
          className={inputCls}
        />
      </Field>
      <Field label="Town" hint="Type to search every Vermont town.">
        <TownCombobox
          value={draft.town}
          onChange={(town) => update({ town })}
        />
      </Field>
    </div>
  );
}

function TownCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="Pick a Vermont town"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm shadow-sm transition",
          value ? "text-zinc-900" : "text-zinc-500",
          "hover:border-zinc-400",
          "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200",
          "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin
            className={cn(
              "h-4 w-4 shrink-0",
              value ? "text-emerald-600" : "text-zinc-400",
            )}
          />
          <span className="truncate">
            {value || "Search Vermont towns…"}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-zinc-200 p-0 shadow-lg dark:border-zinc-800"
      >
        <Command
          filter={(item, search) =>
            item.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Type a town…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No Vermont town matches.</CommandEmpty>
            <CommandGroup>
              {VERMONT_TOWNS.map((t) => (
                <CommandItem
                  key={t}
                  value={t}
                  onSelect={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-emerald-600",
                      value === t ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {t}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function WhereStep({
  draft,
  update,
  onAddressBlur,
}: {
  draft: Draft;
  update: (p: Partial<Draft>) => void;
  onAddressBlur: () => void;
}) {
  const pinned = draft.lat !== null && draft.lng !== null;
  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Address"
        hint="We'll drop a pin when you tab out. You can also tap the map directly."
      >
        <input
          required
          value={draft.address}
          onChange={(e) => update({ address: e.target.value })}
          onBlur={onAddressBlur}
          placeholder="e.g. 49 Park St, Waterbury, VT"
          className={inputCls}
        />
      </Field>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Map pin
        </span>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <LocationPin
            lat={draft.lat}
            lng={draft.lng}
            onChange={(lat, lng) => update({ lat, lng })}
          />
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
            pinned
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              pinned ? "bg-emerald-500" : "bg-zinc-400",
            )}
          />
          {pinned
            ? "Pin set — drag to fine-tune."
            : "Drop a pin to continue (tap the map or tab out of the address)."}
        </div>
      </div>
    </div>
  );
}

function WhenStep({
  draft,
  update,
}: {
  draft: Draft;
  update: (p: Partial<Draft>) => void;
}) {
  const days = [
    { short: "S", full: "Sun" },
    { short: "M", full: "Mon" },
    { short: "T", full: "Tue" },
    { short: "W", full: "Wed" },
    { short: "T", full: "Thu" },
    { short: "F", full: "Fri" },
    { short: "S", full: "Sat" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Day of week
        </span>
        <div
          role="radiogroup"
          aria-label="Day of week"
          className="inline-flex w-full items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {days.map((d, i) => {
            const active = draft.dayOfWeek === i;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={i}
                onClick={() => update({ dayOfWeek: i })}
                title={d.full}
                className={cn(
                  "flex h-9 flex-1 select-none items-center justify-center rounded-full text-xs font-bold transition",
                  active
                    ? "bg-emerald-600 text-white shadow-[0_3px_10px_rgba(16,185,129,0.45)]"
                    : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800 dark:text-zinc-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200",
                )}
              >
                <span className="sm:hidden">{d.short}</span>
                <span className="hidden sm:inline">{d.full}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Start time" hint="24-hour format auto-converts in the directory.">
        <input
          type="time"
          required
          value={draft.startTime}
          onChange={(e) => update({ startTime: e.target.value })}
          className={inputCls}
        />
      </Field>
    </div>
  );
}

function DetailsStep({
  draft,
  update,
}: {
  draft: Draft;
  update: (p: Partial<Draft>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Details"
        hint="Style of play, donation amount, gear, parking, etc. Markdown OK."
      >
        <textarea
          rows={8}
          value={draft.details}
          onChange={(e) => update({ details: e.target.value })}
          placeholder={
            "Casual coed pickup. Bring a light + dark shirt.\n$5 donation for goal rentals.\nWe play unless it's actively pouring."
          }
          className={cn(inputCls, "font-mono leading-relaxed")}
        />
      </Field>

      <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-zinc-950">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full border border-emerald-200 dark:border-emerald-900"
        />
        <div className="relative flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.45)]">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">
              Almost there
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
              An admin reviews submissions before they go live.
            </p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
              You&apos;ll be able to flip the weekly ON/OFF status and write
              session recaps from your account page once it&apos;s approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
