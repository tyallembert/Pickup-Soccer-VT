"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import posthog from "posthog-js";

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-emerald-900";

export function SignUpForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.from(".auth-card", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        ease: "power3.out",
        clearProps: "all",
      });
      gsap.from(".auth-field", {
        y: 10,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.06,
        delay: 0.25,
        clearProps: "all",
      });
      gsap.from(".auth-ball", {
        scale: 0.4,
        opacity: 0,
        rotation: -30,
        duration: 0.8,
        ease: "back.out(1.6)",
        delay: 0.1,
      });
      gsap.to(".auth-ball", {
        rotation: "+=360",
        duration: 24,
        ease: "none",
        repeat: -1,
      });
    },
    { scope: root },
  );

  const signinHref = `/signin${
    params.get("redirect")
      ? `?redirect=${encodeURIComponent(params.get("redirect")!)}`
      : ""
  }`;

  const passwordsMatch =
    password.length > 0 && confirm.length > 0 && password === confirm;
  const passwordOK = password.length >= 8;

  return (
    <div ref={root} className="relative z-10 w-full max-w-md">
      <div className="auth-ball pointer-events-none absolute -right-10 -top-16 h-32 w-32 opacity-55 drop-shadow-[0_10px_24px_rgba(245,158,11,0.4)] sm:h-40 sm:w-40">
        <Image
          src="/soccer-ball.png"
          alt=""
          fill
          sizes="(min-width: 640px) 160px, 128px"
          className="object-contain"
        />
      </div>

      <div className="auth-card relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_20px_60px_rgba(245,158,11,0.18)] dark:border-zinc-800 dark:bg-zinc-950">
        <header className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-6 pb-7 pt-6 text-white">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-50/90">
              Join the crew
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <UserPlus className="h-4 w-4" />
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">
            Get in the game.
          </h1>
          <p className="mt-1 text-sm text-white/90">
            Make an account to add and manage pickup soccer fields.
          </p>
          <span
            aria-hidden="true"
            className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
        </header>

        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            if (password !== confirm) {
              setError("Passwords don't match.");
              setPending(false);
              return;
            }
            try {
              const fd = new FormData(e.currentTarget);
              const email = fd.get("email") as string;
              await signIn("password", {
                email,
                password,
                flow: "signUp",
              });
              posthog.identify(email, { email });
              posthog.capture("user_signed_up", { email });
              router.push(params.get("redirect") ?? "/account");
            } catch (e) {
              const message = e instanceof Error ? e.message : "";
              if (message.toLowerCase().includes("already")) {
                setError(
                  "An account already exists for that email. Sign in instead.",
                );
              } else {
                setError(
                  "Couldn't create an account. Check your email and try again.",
                );
              }
            } finally {
              setPending(false);
            }
          }}
        >
          <Field icon={<Mail className="h-4 w-4" />} label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={`${inputCls} w-full pl-9`}
            />
          </Field>

          <Field icon={<KeyRound className="h-4 w-4" />} label="Password">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} w-full pl-9 pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </Field>

          <Field
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Confirm password"
          >
            <input
              name="confirm"
              type={showConfirm ? "text" : "password"}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${inputCls} w-full pl-9 pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </Field>

          {/* Live password checklist */}
          <ul className="auth-field flex flex-wrap gap-2 text-[11px]">
            <RuleChip ok={passwordOK} label="8+ characters" />
            <RuleChip ok={passwordsMatch} label="Passwords match" />
          </ul>

          {error ? (
            <div className="auth-field flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-500/30 transition hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50"
          >
            {pending ? (
              "Creating account…"
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create account
              </>
            )}
          </button>
        </form>

        <div className="auth-field border-t border-zinc-100 bg-zinc-50/60 px-6 py-4 text-center text-sm text-zinc-600 dark:border-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            href={signinHref}
            prefetch
            className="font-semibold text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-300"
          >
            Sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="auth-field flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          {icon}
        </span>
        {children}
      </div>
    </label>
  );
}

function RuleChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={
        ok
          ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
          : "inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
      }
    >
      <Check
        className={`h-3 w-3 ${ok ? "" : "opacity-30"}`}
        aria-hidden="true"
      />
      {label}
    </li>
  );
}
