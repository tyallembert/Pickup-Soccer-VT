"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import { Smartphone, X } from "lucide-react";
import { useInstall } from "@/app/_lib/use-install";

const DISMISS_KEY = "vtps:install-prompt-dismissed";

// A tiny store so dismissing updates the pill without a setState-in-effect and
// without reading localStorage during render (which would break hydration).
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Private mode and locked-down webviews throw on access.
    return false;
  }
}

/**
 * Points admins at /install when the app isn't on their home screen yet.
 *
 * Scoped to the admin area on purpose: notifications only go to admins, and a
 * site-wide install nag would be noise for the people just looking up a game.
 */
export function InstallPrompt() {
  const { verdict } = useInstall();
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to do — the pill just reappears next visit.
    }
    emit();
  }, []);

  const worthShowing =
    verdict !== "pending" &&
    verdict !== "installed" &&
    verdict !== "unsupported";

  if (dismissed || !worthShowing) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
      <Smartphone
        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm text-emerald-900 dark:text-emerald-100">
        Add the queue to your home screen to get alerts when something needs
        review.{" "}
        <Link
          href="/install"
          className="font-semibold underline underline-offset-2"
        >
          Set it up
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-1 shrink-0 rounded-full p-1.5 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
