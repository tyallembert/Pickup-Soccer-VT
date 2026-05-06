"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      onClick={async () => { await signOut(); router.push("/"); }}
      className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
    >
      Sign out
    </button>
  );
}
