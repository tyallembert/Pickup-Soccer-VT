/* Vermont Pickup Soccer service worker.
 *
 * Deliberately small: push delivery, notification clicks, and an offline
 * screen. Nothing else is cached. The app's data comes from Convex over a
 * realtime subscription, so cached pages would only ever show stale fields and
 * schedules. Page loads always go to the network; only when that fails does
 * the installed app show offline.html instead of the browser's error page.
 */

const OFFLINE_CACHE = "vtps-offline-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [OFFLINE_URL, "/icon-192.png"];

// Take over immediately so a redeploy reaches users without them closing every
// tab — a stale worker would keep showing the previous notification format.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k)),
      );
      // Start the page request while the worker boots, so routing page loads
      // through it costs nothing.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === "GET" && request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          return preloaded || (await fetch(request));
        } catch {
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        }
      })(),
    );
    return;
  }
  // The offline page's icon, when the network is gone.
  if (request.method === "GET" && OFFLINE_ASSETS.includes(new URL(request.url).pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || Response.error())),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A payload we can't parse still deserves a notification: on iOS, failing
    // to show one after a push can cost the site its push permission.
    data = {};
  }

  const title = data.title || "Vermont Pickup Soccer";
  const options = {
    body: data.body || "Something needs your attention.",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: data.tag || "vtps",
    renotify: true,
    data: { url: data.url || "/admin" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Already looking at the right screen — just focus it.
      for (const client of clients) {
        if (new URL(client.url).pathname === url && "focus" in client) {
          return client.focus();
        }
      }

      // Otherwise reuse an open window rather than piling up new ones.
      for (const client of clients) {
        if ("navigate" in client && "focus" in client) {
          await client.navigate(url);
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    })(),
  );
});
