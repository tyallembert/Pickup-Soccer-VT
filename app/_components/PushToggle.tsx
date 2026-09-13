"use client";

import Link from "next/link";
import { Bell, BellOff, Loader2, TriangleAlert } from "lucide-react";
import { usePush } from "@/app/_lib/use-push";
import { useInstall } from "@/app/_lib/use-install";
import { cn } from "@/app/_lib/cn";

/**
 * Every state says what is true and what to do about it. A switch that silently
 * does nothing is the failure mode this component exists to avoid — especially
 * on iOS, where push is impossible until the app is on the Home Screen.
 */
export function PushToggle({ className }: { className?: string }) {
  const { supported, permission, subscribed, busy, error, configured, subscribe, unsubscribe } =
    usePush();
  const { os, verdict } = useInstall();

  const needsInstallFirst = os === "ios" && verdict !== "installed" && verdict !== "pending";

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            subscribed
              ? "bg-emerald-600 text-white"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
          )}
        >
          {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Alerts on this device
          </p>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {statusLine({ supported, configured, needsInstallFirst, permission, subscribed })}
          </p>

          {needsInstallFirst && (
            <Link
              href="/install"
              className="mt-3 inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Add to Home Screen
            </Link>
          )}

          {!needsInstallFirst && supported && configured && permission !== "denied" && (
            <button
              type="button"
              onClick={subscribed ? unsubscribe : subscribe}
              disabled={busy}
              className={cn(
                "mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-60",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
                subscribed
                  ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  : "bg-emerald-600 text-white hover:bg-emerald-700",
              )}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {subscribed ? "Turn off alerts" : "Turn on alerts"}
            </button>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-500">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function statusLine({
  supported,
  configured,
  needsInstallFirst,
  permission,
  subscribed,
}: {
  supported: boolean;
  configured: boolean;
  needsInstallFirst: boolean;
  permission: string;
  subscribed: boolean;
}) {
  if (!supported) return "This browser can't receive notifications.";
  if (needsInstallFirst)
    return "iPhone and iPad only send notifications once the app is on your Home Screen.";
  if (!configured) return "Push isn't configured on the server yet.";
  if (permission === "denied")
    return "Notifications are blocked for this site. Allow them in your browser settings, then reload this page.";
  if (subscribed)
    return "You'll get a notification here when a field, signup, or request needs review.";
  return "Get a notification here when a field, signup, or request needs review.";
}
