"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      onClick={async () => { await signOut(); router.push("/"); }}
      className="inline-flex h-10 shrink-0 items-center rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
    >
      Sign out
    </button>
  );
}
