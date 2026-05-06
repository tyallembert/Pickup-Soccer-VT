"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function SignInForm() {
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
        try {
          await signIn("password", {
            email: fd.get("email") as string,
            password: fd.get("password") as string,
            flow: "signIn",
          });
          router.push(params.get("redirect") ?? "/account");
        } catch {
          setError("Invalid email or password.");
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
        <input name="password" type="password" required autoComplete="current-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button type="submit" disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-zinc-600">
        New here?{" "}
        <Link
          href={`/signup${params.get("redirect") ? `?redirect=${encodeURIComponent(params.get("redirect")!)}` : ""}`}
          className="underline"
        >
          Create an account
        </Link>
        .
      </p>
    </form>
  );
}
