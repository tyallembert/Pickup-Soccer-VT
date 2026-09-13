"use client";

/**
 * Holds the browser's `beforeinstallprompt` event.
 *
 * The event fires early — routinely before React has mounted the page that
 * wants it — and it can only be used once. Capturing it in a module-level store
 * that is imported from the root layout is what makes the Install button
 * reliable; a component that only starts listening on mount misses it.
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

let started = false;

export function startCapturingInstallPrompt() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress Chrome's own mini-infobar so the app decides where to ask.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function subscribeToInstallPrompt(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function canPromptSnapshot() {
  return deferred !== null;
}

export function wasInstalledSnapshot() {
  return installed;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export async function triggerInstall(): Promise<InstallOutcome> {
  if (!deferred) return "unavailable";
  const event = deferred;
  // The event is single-use; clear it before awaiting so a double click can't
  // call prompt() twice and throw.
  deferred = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
