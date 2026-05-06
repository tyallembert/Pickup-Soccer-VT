"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function SignUpForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mx-auto flex w-full max-w-sm flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const fd = new FormData(e.currentTarget);
        const password = fd.get("password") as string;
        const confirm = fd.get("confirm") as string;
        if (password !== confirm) {
          setError("Passwords don't match.");
          setPending(false);
          return;
        }
        try {
          await signIn("password", {
            email: fd.get("email") as string,
            password,
            flow: "signUp",
          });
          router.push(params.get("redirect") ?? "/account");
        } catch (e) {
          const message = e instanceof Error ? e.message : "";
          if (message.toLowerCase().includes("already")) {
            setError("An account already exists for that email. Sign in instead.");
          } else {
            setError("Couldn't create an account. Check your email and try again.");
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required autoComplete="new-password" minLength={8}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm password
        <input name="confirm" type="password" required autoComplete="new-password" minLength={8}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button type="submit" disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Creating account…" : "Create account"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          href={`/signin${params.get("redirect") ? `?redirect=${encodeURIComponent(params.get("redirect")!)}` : ""}`}
          className="underline"
        >
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}
