"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import posthog from "posthog-js";
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
  Lock,
  MapPin,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { LocationPin } from "@/app/_components/LocationPin";
import { SlotsSection } from "@/app/_components/SlotsSection";
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

type ScheduleDraft = { dayOfWeek: number; startTime: string; endTime?: string };

type Draft = {
  name: string;
  town: string;
  address: string;
  lat: number | null;
  lng: number | null;
  schedules: ScheduleDraft[];
  details: string;
};

const EMPTY_SCHEDULE: ScheduleDraft = { dayOfWeek: 1, startTime: "18:00" };

const EMPTY_DRAFT: Draft = {
  name: "",
  town: "",
  address: "",
  lat: null,
  lng: null,
  schedules: [EMPTY_SCHEDULE],
  details: "",
};

const STEPS = [
  { key: "basics", label: "Basics", Icon: Tag },
  { key: "where", label: "Where", Icon: MapPin },
  { key: "when", label: "When", Icon: CalendarDays },
  { key: "details", label: "Details", Icon: FileText },
] as const;

const LAST_STEP = STEPS.length - 1;

type FormStatus = "editing" | "submitting" | "redirecting";
type AuthStatus = "unknown" | "anonymous" | "authenticated";

type SubmitFormContextValue = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  step: number;
  direction: 1 | -1;
  goNext: () => void;
  goPrev: () => void;
  goTo: (target: number) => void;
  status: FormStatus;
  error: string | null;
  dismissError: () => void;
  attemptSubmit: () => Promise<void>;
  authStatus: AuthStatus;
  onAddressBlur: () => Promise<void>;
  stepsComplete: readonly boolean[];
  allComplete: boolean;
};

const SubmitFormContext = createContext<SubmitFormContextValue | null>(null);

function useSubmitForm(): SubmitFormContextValue {
  const ctx = useContext(SubmitFormContext);
  if (!ctx) {
    throw new Error("useSubmitForm must be used within SubmitFormProvider");
  }
  return ctx;
}

function validateStep(s: number, d: Draft): string | null {
  if (s === 0) {
    if (!d.name.trim()) return "Give the field a name.";
    if (!d.town.trim()) return "Pick a town in Vermont.";
  }
  if (s === 1) {
    if (!d.address.trim()) return "Add an address so we can place a pin.";
    if (d.lat === null || d.lng === null)
      return "Drop the pin on the map before continuing.";
  }
  if (s === 2) {
    if (d.schedules.length === 0) return "Add at least one game time.";
    for (let i = 0; i < d.schedules.length; i++) {
      const row = d.schedules[i];
      if (!row.startTime) return `Slot ${i + 1}: pick a start time.`;
      if (row.endTime && row.endTime <= row.startTime) {
        return `Slot ${i + 1}: end time must be after the start time.`;
      }
    }
  }
  return null;
}

function SubmitFormProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useQuery(api.public.me);
  const submitMutation = useMutation(api.submissions.submitLocation);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [status, setStatus] = useState<FormStatus>("editing");
  const [error, setError] = useState<string | null>(null);
  // Track which steps the user has actually entered. A step's data may pass
  // validation by default (e.g. the time field defaults to 18:00), so we
  // require an explicit visit before treating it as "complete" — otherwise the
  // stepper would falsely show progress for steps the user never opened.
  const [visited, setVisited] = useState<boolean[]>(() => {
    const v = new Array(STEPS.length).fill(false) as boolean[];
    v[0] = true;
    return v;
  });

  // Refs mirror state so attemptSubmit/goNext can read the freshest values
  // without depending on closures. The step guard inside attemptSubmit is the
  // last line of defense against an early submission, so it must never read a
  // stale step. We sync inside an effect (after commit) — user-initiated
  // event handlers fire between commits, so they always see the latest values.
  const stepRef = useRef(step);
  const statusRef = useRef(status);
  const draftRef = useRef(draft);
  useEffect(() => {
    stepRef.current = step;
    statusRef.current = status;
    draftRef.current = draft;
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        // Legacy drafts had flat dayOfWeek/startTime. Upcast to schedules[].
        if (
          parsed &&
          !Array.isArray((parsed as { schedules?: unknown }).schedules) &&
          typeof (parsed as { dayOfWeek?: unknown }).dayOfWeek === "number" &&
          typeof (parsed as { startTime?: unknown }).startTime === "string"
        ) {
          const upcast = {
            ...parsed,
            schedules: [
              {
                dayOfWeek: parsed.dayOfWeek as number,
                startTime: parsed.startTime as string,
              },
            ],
          } as Record<string, unknown>;
          delete upcast.dayOfWeek;
          delete upcast.startTime;
          setDraft(upcast as unknown as Draft);
        } else {
          setDraft(parsed as unknown as Draft);
        }
      } catch {
        // ignore corrupt draft
      }
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  // Mark each step as visited the first time it becomes active.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setVisited((prev) => {
      if (prev[step]) return prev;
      const next = prev.slice();
      next[step] = true;
      return next;
    });
  }, [step]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // On every step change, drop focus from whatever the user just clicked.
  // Prevents a focused Next button from "carrying over" into the Submit
  // button position and being activated by a stray Enter / repeat keypress.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  }, [step]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const goNext = useCallback(() => {
    setError(null);
    const current = stepRef.current;
    const err = validateStep(current, draftRef.current);
    if (err) {
      setError(err);
      return;
    }
    if (current < LAST_STEP) {
      setDirection(1);
      setStep(current + 1);
    }
  }, []);

  const goPrev = useCallback(() => {
    setError(null);
    const current = stepRef.current;
    if (current > 0) {
      setDirection(-1);
      setStep(current - 1);
    }
  }, []);

  const goTo = useCallback((target: number) => {
    // Free navigation — any step at any time. The Submit button stays locked
    // until every step is complete, so skipping ahead is harmless.
    setError(null);
    const current = stepRef.current;
    if (target === current || target < 0 || target >= STEPS.length) return;
    setDirection(target < current ? -1 : 1);
    setStep(target);
  }, []);

  const onAddressBlur = useCallback(async () => {
    const address = draftRef.current.address.trim();
    if (!address) return;
    const geo = await geocodeAddress(address);
    if (geo) update({ lat: geo.lat, lng: geo.lng });
  }, [update]);

  const attemptSubmit = useCallback(async () => {
    // Hard gate #1: the mutation can ONLY fire from the final step. Reading
    // the ref (not the closed-over state) ensures this check is always against
    // the freshest step, regardless of how this function was invoked.
    if (stepRef.current !== LAST_STEP) return;
    // Hard gate #2: never re-enter while a submission is in flight.
    if (statusRef.current !== "editing") return;

    setError(null);

    for (let s = 0; s < STEPS.length; s++) {
      const err = validateStep(s, draftRef.current);
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

    setStatus("submitting");
    try {
      const d = draftRef.current;
      const id = await submitMutation({
        name: d.name,
        town: d.town,
        address: d.address,
        lat: d.lat!,
        lng: d.lng!,
        details: d.details,
        schedules: d.schedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
      posthog.capture("location_submitted", {
        location_id: id,
        location_name: d.name,
        town: d.town,
        schedule_count: d.schedules.length,
      });
      sessionStorage.removeItem(STORAGE_KEY);
      setStatus("redirecting");
      router.push(`/account/locations/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
      setStatus("editing");
    }
  }, [me, router, submitMutation]);

  const authStatus: AuthStatus =
    me === undefined ? "unknown" : me === null ? "anonymous" : "authenticated";

  const stepsComplete = useMemo<readonly boolean[]>(
    () =>
      STEPS.map((_, i) => visited[i] && validateStep(i, draft) === null),
    [draft, visited],
  );
  const allComplete = useMemo(
    () => stepsComplete.every(Boolean),
    [stepsComplete],
  );

  const value = useMemo<SubmitFormContextValue>(
    () => ({
      draft,
      update,
      step,
      direction,
      goNext,
      goPrev,
      goTo,
      status,
      error,
      dismissError,
      attemptSubmit,
      authStatus,
      onAddressBlur,
      stepsComplete,
      allComplete,
    }),
    [
      draft,
      update,
      step,
      direction,
      goNext,
      goPrev,
      goTo,
      status,
      error,
      dismissError,
      attemptSubmit,
      authStatus,
      onAddressBlur,
      stepsComplete,
      allComplete,
    ],
  );

  return (
    <SubmitFormContext.Provider value={value}>
      {children}
    </SubmitFormContext.Provider>
  );
}

export function SubmitForm() {
  return (
    <SubmitFormProvider>
      <SubmitFormView />
    </SubmitFormProvider>
  );
}

function SubmitFormView() {
  const { error, dismissError, authStatus, step } = useSubmitForm();

  // The <form> element's onSubmit is a hard no-op. Submission can ONLY be
  // initiated by an explicit click on the Submit button (see FormFooter),
  // which calls attemptSubmit — which itself re-checks the step guard. This
  // makes it impossible for browser autofill, password managers, an Enter
  // keypress, or any other implicit form-submit path to fire the mutation.
  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl px-6 pt-24 pb-12">
      <Header />
      <Stepper />

      {authStatus === "anonymous" ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
          <span>
            Heads up — you&apos;ll need a free account to submit.
            We&apos;ll prompt you when you save.
          </span>
        </div>
      ) : null}

      <form
        onSubmit={onFormSubmit}
        noValidate
        className="relative rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 sm:p-6"
      >
        <FoulAlert error={error} onDismiss={dismissError} />
        <StepBody key={step} />
        <FormFooter />
      </form>
    </div>
  );
}

function Header() {
  return (
    <header className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-6 text-white shadow-[0_18px_50px_-20px_rgba(16,185,129,0.55)]">
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
  );
}

// --- Stepper geometry ---------------------------------------------------
// Bubble height/width in px. The connector rail's vertical position is exactly
// (BUBBLE_PX / 2) - (RAIL_PX / 2) so it threads through the center of every
// bubble at any zoom level.
const BUBBLE_PX = 40;
const RAIL_PX = 2;
const RAIL_TOP_PX = BUBBLE_PX / 2 - RAIL_PX / 2;
// Each step is one column of a CSS grid (1fr each). Bubble centers therefore
// sit at (i + 0.5) * (100/N)% across the container, which makes the rail
// endpoints fall on (1 / (2N)) * 100% from each side. No magic px offsets.
const COL_PCT = 100 / STEPS.length;
const HALF_COL_PCT = COL_PCT / 2;

function Stepper() {
  const { step, goTo, stepsComplete } = useSubmitForm();
  const fillRef = useRef<HTMLDivElement>(null);

  // The fill bar tracks the user's current step — independent of completion
  // status, which is communicated per-bubble. Smooth easing makes free
  // navigation (clicking any bubble) feel like a single fluid motion.
  useGSAP(
    () => {
      if (!fillRef.current) return;
      gsap.to(fillRef.current, {
        width: `${step * COL_PCT}%`,
        duration: 0.6,
        ease: "power3.out",
      });
    },
    { dependencies: [step] },
  );

  return (
    <div className="relative mb-5">
      {/* Rail (track) — endpoints align to first and last bubble centers. */}
      <div
        aria-hidden
        className="absolute rounded-full bg-zinc-200 dark:bg-zinc-800"
        style={{
          top: `${RAIL_TOP_PX}px`,
          height: `${RAIL_PX}px`,
          left: `${HALF_COL_PCT}%`,
          right: `${HALF_COL_PCT}%`,
        }}
      />
      {/* Rail fill — animates to current step's bubble center. */}
      <div
        ref={fillRef}
        aria-hidden
        className="absolute rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.45)]"
        style={{
          top: `${RAIL_TOP_PX}px`,
          height: `${RAIL_PX}px`,
          left: `${HALF_COL_PCT}%`,
          width: `${step * COL_PCT}%`,
        }}
      />

      <ol
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
      >
        {STEPS.map((s, i) => {
          const active = i === step;
          const complete = stepsComplete[i];
          const Icon = s.Icon;

          return (
            <li
              key={s.key}
              className="flex flex-col items-center gap-2"
              aria-current={active ? "step" : undefined}
            >
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to ${s.label}${complete ? " (complete)" : ""}`}
                className={cn(
                  "group relative flex shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-inset transition-[transform,box-shadow,background-color,color,ring-color] duration-300 ease-out",
                  active
                    ? "scale-110 bg-emerald-600 text-white ring-emerald-600 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.6)]"
                    : complete
                      ? "bg-emerald-600 text-white ring-emerald-600 hover:scale-[1.06] hover:shadow-[0_8px_20px_-8px_rgba(16,185,129,0.55)]"
                      : "bg-white text-zinc-400 ring-zinc-200 hover:scale-[1.06] hover:text-emerald-600 hover:ring-emerald-400 dark:bg-zinc-950 dark:text-zinc-500 dark:ring-zinc-800 dark:hover:ring-emerald-700",
                )}
                style={{ height: `${BUBBLE_PX}px`, width: `${BUBBLE_PX}px` }}
              >
                {/* Soft halo on the active bubble */}
                {active ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-1.5 rounded-full bg-emerald-400/25 blur-md"
                  />
                ) : null}
                {/* Completion sub-ring — a delicate outer outline that fades
                    in once the step has been visited and validates. */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -inset-1 rounded-full border-2 border-emerald-500/45 transition-opacity duration-300 ease-out dark:border-emerald-400/50",
                    complete ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="relative flex items-center justify-center">
                  {complete && !active ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
              </button>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-300",
                  active
                    ? "text-emerald-700 dark:text-emerald-300"
                    : complete
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
  );
}

function StepBody() {
  const { step, direction } = useSubmitForm();
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      gsap.fromTo(
        containerRef.current,
        { x: direction * 60, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
      );
    },
    { dependencies: [step] },
  );

  return (
    <div ref={containerRef} className="min-h-[320px]">
      {step === 0 ? <BasicsStep /> : null}
      {step === 1 ? <WhereStep /> : null}
      {step === 2 ? <WhenStep /> : null}
      {step === 3 ? <DetailsStep /> : null}
    </div>
  );
}

function FormFooter() {
  const {
    step,
    goPrev,
    goNext,
    attemptSubmit,
    status,
    authStatus,
    allComplete,
    stepsComplete,
  } = useSubmitForm();
  const isLast = step === LAST_STEP;
  const pending = status !== "editing";
  const locked = !allComplete;
  const completeCount = stepsComplete.filter(Boolean).length;

  return (
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

      {/* Distinct keys force React to fully unmount/remount the primary
          action button when transitioning between Next and Submit. Without
          this, React would reuse the same <button> DOM element across renders
          and a focused Next could "become" a focused Submit on the next
          render — letting a stray Enter activate it. */}
      {isLast ? (
        <button
          key="primary-submit"
          type="button"
          onClick={attemptSubmit}
          disabled={pending || locked}
          aria-disabled={pending || locked}
          title={
            locked
              ? `Complete every step to unlock submit (${completeCount}/${STEPS.length})`
              : undefined
          }
          className={cn(
            "group inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition active:scale-[0.99]",
            pending || !locked
              ? "bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/30 hover:scale-[1.02] hover:shadow-lg disabled:opacity-60"
              : "cursor-not-allowed bg-zinc-200 text-zinc-500 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-zinc-800",
          )}
        >
          {pending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Submitting…
            </>
          ) : locked ? (
            <>
              <Lock className="h-4 w-4" />
              <span>
                Locked · {completeCount}/{STEPS.length}
              </span>
            </>
          ) : authStatus === "anonymous" ? (
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
          key="primary-next"
          type="button"
          onClick={goNext}
          className="group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-500 hover:shadow-lg active:scale-[0.99]"
        >
          Next
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      )}
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

function BasicsStep() {
  const { draft, update } = useSubmitForm();
  return (
    <div className="flex flex-col gap-4">
      <Field label="Field or park name" hint="What do players call this place?">
        <input
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

function WhereStep() {
  const { draft, update, onAddressBlur } = useSubmitForm();
  const pinned = draft.lat !== null && draft.lng !== null;
  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Address"
        hint="We'll drop a pin when you tab out. You can also tap the map directly."
      >
        <input
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

function WhenStep() {
  const { draft, update } = useSubmitForm();

  const patchRow = (i: number, patch: Partial<ScheduleDraft>) => {
    const next = draft.schedules.slice();
    next[i] = { ...next[i], ...patch };
    update({ schedules: next });
  };
  const removeRow = (i: number) => {
    if (draft.schedules.length === 1) return;
    const next = draft.schedules.slice();
    next.splice(i, 1);
    update({ schedules: next });
  };
  const addRow = () =>
    update({ schedules: [...draft.schedules, { ...EMPTY_SCHEDULE }] });

  return (
    <SlotsSection
      rows={draft.schedules}
      onPatch={patchRow}
      onRemove={removeRow}
      onAdd={addRow}
      description="Pick the day and time this pickup happens every week. If it runs more than once a week (say, Tuesdays and Thursdays), add a time for each."
    />
  );
}

function DetailsStep() {
  const { draft, update } = useSubmitForm();
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
