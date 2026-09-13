"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

/**
 * The browser hands back the VAPID key requirement as a Uint8Array, and the key
 * itself travels as base64url. Neither atob nor the key format tolerates the
 * other's padding, so convert explicitly.
 */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToBase64Url(key: ArrayBuffer | null): string {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type UsePush = {
  /** This browser has the APIs at all. */
  supported: boolean;
  permission: PushPermission;
  /** Registered on the server for THIS device. */
  subscribed: boolean;
  /** Still working out the current state, or mid-request. */
  busy: boolean;
  error: string | null;
  /** Null until the VAPID key has loaded; the toggle stays disabled til then. */
  configured: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

export function usePush(): UsePush {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [endpoint, setEndpoint] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidKey = useQuery(api.push.vapidPublicKey);
  const status = useQuery(api.push.mySubscriptionStatus, { endpoint });
  const save = useMutation(api.push.savePushSubscription);
  const remove = useMutation(api.push.deletePushSubscription);

  // Reading the existing subscription means awaiting the service worker, so the
  // state genuinely cannot be derived during render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;

    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!ok) {
      setSupported(false);
      setPermission("unsupported");
      setReady(true);
      return;
    }

    setSupported(true);
    setPermission(Notification.permission as PushPermission);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setEndpoint(existing?.endpoint);
      } catch {
        if (!cancelled) setEndpoint(undefined);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const subscribe = useCallback(async () => {
    setError(null);
    if (!vapidKey) {
      setError("Push is not configured on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== "granted") {
        setError(
          result === "denied"
            ? "Notifications are blocked for this site in your browser settings."
            : "Notification permission was dismissed.",
        );
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      // Reuse an existing browser-side subscription rather than churning the
      // endpoint, which would orphan the row we already stored.
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      await save({
        endpoint: sub.endpoint,
        p256dh: keyToBase64Url(sub.getKey("p256dh")),
        auth: keyToBase64Url(sub.getKey("auth")),
        userAgent: navigator.userAgent,
      });
      setEndpoint(sub.endpoint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn on notifications.");
    } finally {
      setBusy(false);
    }
  }, [vapidKey, save]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await remove({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setEndpoint(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn off notifications.");
    } finally {
      setBusy(false);
    }
  }, [remove]);

  return {
    supported,
    permission,
    subscribed: status?.subscribed ?? false,
    busy: busy || !ready || status === undefined,
    error,
    configured: !!vapidKey,
    subscribe,
    unsubscribe,
  };
}
