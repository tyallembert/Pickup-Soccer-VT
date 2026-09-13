/* Vermont Pickup Soccer service worker.
 *
 * Deliberately minimal: push delivery and notification clicks only. There is no
 * fetch handler and no cache. The app's data comes from Convex over a realtime
 * subscription, so cached pages would only ever show stale fields and schedules.
 */

// Take over immediately so a redeploy reaches users without them closing every
// tab — a stale worker would keep showing the previous notification format.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
