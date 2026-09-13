# PWA + Admin Push — Device Test Plan

**Date:** 2026-09-13
**Covers:** `3cfe6c2` (feat(pwa): installable app + web push for admins)
**Design:** `docs/superpowers/specs/2026-09-13-pwa-admin-push-design.md`

The code is built and committed. What remains is the part no unit test can
reach: a real browser subscribing to a real push service, and a real phone
showing a notification.

## Already proven — do not re-test

| Claim | Evidence |
|---|---|
| Payload copy, admin-only fan-out, `excludeUserId`, 404/410 cleanup, digest counting | 46 passing tests (`npm test`) |
| Device detection across iOS/Android/iPadOS/in-app browsers | `app/_lib/platform.test.ts`, 12 fixture user-agents |
| `web-push` loads in Convex's Node runtime; VAPID signing, ECDH + HKDF + aes128gcm encryption, HTTPS delivery, and dead-endpoint classification all work | `npx convex run pushNode:send` against a live FCM endpoint returned `{delivered:0, dropped:1, failed:0}` |
| Manifest emits both `any` and `maskable` icons; all assets build | `npm run build` |

What is **not** proven: that a browser will hand us a subscription, that a
notification renders correctly on a phone, that the deep link opens the right
screen, and that iOS behaves once installed.

## Preconditions

```bash
# Push must be configured on whichever deployment the app points at.
npx convex run push:vapidPublicKey     # must print a key, not null
```

If that prints `null`, the toggle will say "Push isn't configured on the server
yet" and nothing else will work. Generate a pair and set all three vars:

```bash
node -e 'console.log(JSON.stringify(require("web-push").generateVAPIDKeys()))'
npx convex env set VAPID_PUBLIC_KEY  "<publicKey>"
npx convex env set VAPID_PRIVATE_KEY "<privateKey>"
npx convex env set VAPID_SUBJECT     "mailto:you@example.com"
```

You also need **an admin account** (`role: "admin"`) and, for the real-path
tests, **a second non-admin account** — see Trap 2.

---

## Lane A — Desktop Chrome on localhost

**No tunnel needed.** Service workers and the Push API both treat
`http://localhost` as a secure origin. This lane exercises the entire pipeline
end to end and is where any bug will surface fastest. Do this first; only move
to Lane B once it passes.

Start the app (nothing else heavy running — see Trap 7):

```bash
npm run dev
```

| # | Step | Expected |
|---|---|---|
| A1 | Open `http://localhost:3000/install` in Chrome | Icon tile renders on emerald; step 1 shows an **Install app** button (verdict `can-prompt`) |
| A2 | DevTools → Application → Service workers | `/sw.js` is **activated and running** |
| A3 | Sign in as the admin, go to `/admin/queue` | "Alerts on this device" card with a **Turn on alerts** button |
| A4 | Click **Turn on alerts**, accept the browser prompt | Button flips to **Turn off alerts**; the bell icon fills emerald |
| A5 | `npx convex data pushSubscriptions` | Exactly one row, `userId` = your admin, `endpoint` on `fcm.googleapis.com` |
| A6 | `npx convex run push:notifyAdmins '{"event":{"kind":"pendingDigest","pendingCount":3}}'` | OS notification: **Pending queue** / "3 submissions are waiting for review." with the ball icon |
| A7 | Click the notification | A tab focuses/opens on `/admin/queue` |
| A8 | `npx convex data pushSubscriptions` again | `lastSuccessAt` now set, `failureCount` 0 |
| A9 | Click **Turn off alerts**, then `npx convex data pushSubscriptions` | Table empty |
| A10 | Re-subscribe, then fire A6 twice in a row | The second notification **replaces** the first rather than stacking (shared `tag`) |

**A11 — dead-endpoint cleanup.** With one subscription present, open DevTools →
Application → Service workers → Unregister (this invalidates the endpoint
without telling the server), then fire A6. The push service returns 410 and the
row should disappear from `npx convex data pushSubscriptions`.

**A12 — install.** Click **Install app** in A1. Chrome installs the PWA; the app
opens in its own window; reloading `/install` now shows "The app is on your home
screen" with step 1 checked.

---

## Lane B — Phones

Push needs a **trusted** HTTPS origin. `next dev --experimental-https` issues a
self-signed cert, which a phone will not trust and the service worker will
refuse — so that shortcut does not work here. Two real options:

**B-opt-1 — Vercel preview deploy (recommended).** Closest to production, stable
URL, trusted cert, and it also exercises the deploy path. Requires VAPID keys
set on whichever Convex deployment the preview points at.

**B-opt-2 — Quick tunnel.** `npx cloudflared tunnel --url http://localhost:3000`
gives a `*.trycloudflare.com` HTTPS URL with no account. Faster to start, but
the URL changes every run — see Trap 1.

### B1 — iOS Safari (the important one)

Requires **iOS 16.4+**.

| # | Step | Expected |
|---|---|---|
| B1.1 | Open the HTTPS URL in **Safari**, go to `/install` | Step 1 shows Share-sheet instructions, not a button. Step 2 is dimmed and explains it unlocks after install |
| B1.2 | Share → Add to Home Screen → Add | App icon on the home screen: **soccer ball on emerald**, not a black tile (this is the apple-icon alpha fix) |
| B1.3 | Open the app **from the home screen** | Runs without Safari chrome; `/install` now shows "The app is on your home screen", step 1 checked, step 2 live |
| B1.4 | Sign in as admin, tap **Turn on alerts**, allow | iOS permission sheet appears and the button flips |
| B1.5 | From the laptop: `npx convex run push:notifyAdmins '{"event":{"kind":"pendingDigest","pendingCount":2}}'` | Notification on the lock screen with the ball icon |
| B1.6 | Tap it | The installed app opens on `/admin/queue` |
| B1.7 | Open the same URL in Safari **as a tab** (not installed) | `/install` again shows the Share instructions; the queue's toggle says iPhone needs the app on the Home Screen and offers an **Add to Home Screen** link |

### B2 — Android Chrome

| # | Step | Expected |
|---|---|---|
| B2.1 | Open the HTTPS URL → `/install` | An **Install app** button (`beforeinstallprompt` fires on Android Chrome) |
| B2.2 | Tap it, confirm | Installs; icon on the home screen is **not clipped** — the ball sits fully inside the circle mask (this is the 70% maskable fix) |
| B2.3 | Open from the launcher, sign in, **Turn on alerts** | Permission prompt, then subscribed |
| B2.4 | Fire the trigger from the laptop | Notification appears; the **status-bar icon is the ball silhouette, not a grey blob** (this is `badge-96.png`) |
| B2.5 | Tap it | Opens the app on `/admin/queue` |

### B3 — In-app browser

Send yourself the URL over Instagram DM, Facebook Messenger, or Gmail and open
it from inside that app. `/install` must show **"Open this page in Safari"** (or
Chrome on Android) with the explanation and a working **Copy link** button —
tap it and confirm the URL actually lands in the clipboard, since these webviews
are exactly where the async clipboard API tends to fail and the
`execCommand` fallback takes over.

### B4 — Other-browser branches

| Browser | Expected `/install` step 1 |
|---|---|
| Chrome on iOS | "Open this page in Safari. Chrome on iPhone and iPad can't add apps to the Home Screen." + Copy link |
| Firefox on Android | "Open the ⋮ menu → Choose Install, then confirm" |
| Safari on macOS | "Click Share in the Safari toolbar → Choose Add to Dock" |

---

## Lane C — The four real triggers

Lanes A/B use the synthetic `pendingDigest` event because it needs no ids. This
lane confirms the triggers actually fire from the mutations they're wired into.
Subscribe your **admin** device first, then act as the **second, non-admin
account** (Trap 2).

| Trigger | How to fire | Expected notification |
|---|---|---|
| Location submitted | Sign in as the non-admin, submit a field at `/submit` | "New field awaiting review" / "`<name>` — `<town>`" → `/admin/queue/<id>` |
| Location resubmitted | As admin reject it, then as the owner resubmit from `/account/locations/<id>` | Same copy, same deep link |
| New signup | Sign up a brand-new account at `/signup` | "New signup" / the new email → `/admin/users/<id>` |
| Co-maintainer request | As the non-admin, request maintainership on an approved field | "Co-maintainer request" / "Someone asked to help maintain `<name>`." → `/admin/locations/<id>` |
| Daily digest | Leave ≥1 location pending, then `npx convex run push:sendPendingDigest` | "Pending queue" / "N submissions are waiting for review." → `/admin/queue` |

Verify each notification's **deep link** lands on the right record, not just the
right screen.

The digest is silent when the queue is empty — that is correct behavior, not a
failure. Check what's actually pending with `npx convex data locations`
(`admin:pendingLocations` requires a signed-in admin and cannot be called
through `npx convex run`).

---

## Trigger reference — verified commands

These were run against the dev deployment and work as written:

```bash
npx convex run push:vapidPublicKey          # config check
npx convex run push:sendPendingDigest       # digest; silent if queue empty
npx convex data pushSubscriptions           # who is subscribed
npx convex data locations                   # what is pending
npx convex dashboard                        # logs, for failed deliveries

# Synthetic push to every subscribed admin — no ids required:
npx convex run push:notifyAdmins '{"event":{"kind":"pendingDigest","pendingCount":3}}'
```

---

## Traps

1. **Subscriptions are origin-scoped.** A subscription made on
   `abc.trycloudflare.com` is dead the moment the tunnel hands you a new URL.
   The rows linger until a send returns 410 and cleans them up. Prefer a stable
   preview URL, or clear the table between tunnel sessions.
2. **You will not notify yourself.** Every trigger passes `excludeUserId`, so an
   admin who submits a location gets nothing — by design. Test the real triggers
   from a second, non-admin account or you will chase a phantom bug.
3. **`beforeinstallprompt` only fires when not installed.** To re-test the
   Install button, uninstall the app first. It also won't fire on a second visit
   in some Chrome versions until the engagement heuristic is satisfied — if the
   button is missing, the page correctly falls back to ⋮-menu instructions.
4. **Denied permission is sticky.** Once blocked, no amount of clicking helps;
   the site must be reset in browser settings (Chrome: padlock → Site settings →
   Notifications → Reset). The toggle says this, which is itself worth verifying.
5. **iOS gives push only to the installed app.** Safari-in-a-tab will never
   deliver one, and permission can't even be requested there. If B1.4 shows no
   prompt, check you opened the app from the Home Screen.
6. **Editing `sw.js` needs a reload to take effect.** `skipWaiting()` +
   `clients.claim()` make the new worker active immediately, but the page you
   already have open is still running the old one until you refresh.
7. **Don't run a dev server and a build at once on this machine.** It has
   crashed twice doing that. One at a time.

---

## Sign-off

- [ ] Lane A passes end to end on desktop Chrome
- [ ] A11 (dead-endpoint cleanup) removes the row
- [ ] iOS: icon is emerald, not a black tile
- [ ] iOS: notification arrives in the installed app and deep-links correctly
- [ ] Android: launcher icon is uncropped; status-bar badge is the ball
- [ ] In-app browser shows the switch-browser branch and Copy link works
- [ ] All four real triggers fire with the right copy and the right deep link
- [ ] Production deployment has its own VAPID keys set
