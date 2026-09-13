"use client";

import { useEffect } from "react";
import { startCapturingInstallPrompt } from "@/app/_lib/install-prompt";

/**
 * Registers the push service worker and starts listening for
 * `beforeinstallprompt`.
 *
 * Mounted once from the root layout rather than from the install page, because
 * the browser fires the install event early in the page's life — a listener
 * attached when /install mounts would usually miss it and the Install button
 * would never appear.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    startCapturingInstallPrompt();

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
