# PWA + Admin Push Notifications — Design

**Date:** 2026-09-13
**Status:** Approved, ready for implementation planning

## Problem

Super admins have no way to learn that work is waiting for them. A location
submission, a new signup, or a co-maintainer request lands in the database and
sits there until an admin happens to open `/admin/queue`. The queue is only
useful to someone already looking at it.

This design makes the site installable as a PWA and delivers Web Push
notifications to admins' phones and desktops when work arrives.

## Goals

- Installable on iOS and Android home screens with correct, unclipped icons.
- Admins opt in per device and receive a push within seconds of a triggering event.
- Notifications deep-link to the relevant admin screen.
- Dead subscriptions clean themselves up.

## Non-Goals

- Offline support. Convex is subscription-based and realtime; cached pages would
  show stale data and buy a cache-invalidation problem for no gain. The service
  worker registers **no** `fetch` handler.
- Notifications for non-admin users. The subscription table is keyed by `userId`
  rather than hardcoded to admins, so this is not blocked later, but no
  non-admin UI or send path is built now.
- Email or SMS fallback.

## Architecture

Send path: **Convex `"use node"` action running `web-push`.**

A mutation that changes admin-relevant state calls
`ctx.scheduler.runAfter(0, internal.push.notifyAdmins, {...})`. That internal
mutation resolves which admins are subscribed and schedules
`internal.pushNode.send`, a Node-runtime action that signs the VAPID JWT,
encrypts each payload, and delivers it to the browser push services.

Rejected alternatives:

- **Convex → `fetch()` a Next.js `/api/push/send` route.** Same library, plus a
  network hop and a shared-secret scheme between Convex and Next, to reach code
  Convex can run itself.
- **Third-party (OneSignal, Pusher Beams).** A vendor account, a second
  dashboard, and a per-device SDK to serve a handful of super admins.

`convex/_generated/ai/guidelines.md:262-263` permits `"use node"` but forbids it
in any file that also exports queries or mutations. The backend is therefore
split across two files along that line.

## Data Model

One new table in `convex/schema.ts`:

```ts
pushSubscriptions: defineTable({
  userId: v.id("users"),
  endpoint: v.string(),        // unique per browser+device
  p256dh: v.string(),
  auth: v.string(),
  userAgent: v.optional(v.string()),
  createdAt: v.number(),
  lastSuccessAt: v.optional(v.number()),
  failureCount: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_endpoint", ["endpoint"])
```

Rows are **per device, not per user**. An admin on a phone and a laptop has two
rows and receives two notifications. `endpoint` is the natural key the push
service issues; `savePushSubscription` upserts on it so re-subscribing the same
device never duplicates a row.

## Triggers

| Event | Hook point | Notification target |
|---|---|---|
| Location submitted or resubmitted | `convex/submissions.ts` — `submitLocation`, `resubmitLocation` | `/admin/queue/<id>` |
| New user signs up | `convex/auth.ts` — `callbacks.afterUserCreatedOrUpdated`, only when `existingUserId === null` | `/admin/users/<id>` |
| Co-maintainer requested | `convex/maintainers.ts` — `requestMaintainership` | `/admin/locations/<locationId>` |
| Daily pending-queue digest | `convex/crons.ts`, `0 12 * * *` UTC | `/admin/queue` |

`afterUserCreatedOrUpdated` exists in the installed `@convex-dev/auth` 0.0.91
(`node_modules/@convex-dev/auth/dist/server/types.d.ts:221`) and receives
`existingUserId: Id<"users"> | null`, which distinguishes a signup from a
sign-in.

`notifyAdmins` takes a discriminated event argument, and the payload builders
switch on `kind`:

```ts
event: v.union(
  v.object({ kind: v.literal("locationPending"),   locationId: v.id("locations"), name: v.string(), town: v.string() }),
  v.object({ kind: v.literal("userSignup"),        userId: v.id("users"),         email: v.optional(v.string()) }),
  v.object({ kind: v.literal("maintainerRequest"), locationId: v.id("locations"), name: v.string() }),
  v.object({ kind: v.literal("pendingDigest"),     pendingCount: v.number() }),
)
```

It also takes an optional `excludeUserId`. An admin who submits a location or
requests maintainership themselves should not be pushed about their own action;
callers pass the acting user's id. The digest passes nothing.

Each trigger is one `ctx.scheduler.runAfter(0, ...)` line added to a mutation
that already exists. Scheduling rather than calling inline keeps the originating
mutation's transaction small and prevents a push failure from rolling back a
user's submission.

**Digest behavior:** the cron skips sending entirely when the pending queue is
empty. Convex crons are UTC-only, so `0 12 * * *` is 8am EDT and 7am EST — the
digest drifts one hour across the DST boundary. Accepted; a two-cron workaround
is not worth the complexity.

## Backend Modules

| File | Runtime | Exports |
|---|---|---|
| `convex/push.ts` | default | `vapidPublicKey` (query), `savePushSubscription` (mutation), `deletePushSubscription` (mutation), `mySubscriptionStatus` (query), `notifyAdmins` (internal mutation), `applyDeliveryResults` (internal mutation), `sendPendingDigest` (internal mutation) |
| `convex/pushNode.ts` | `"use node"` | `send` (internal action) |
| `convex/lib/pushPayloads.ts` | pure | Title/body/url builders per event type |
| `convex/crons.ts` | — | Registers the digest against `internal.push.sendPendingDigest` |

- `vapidPublicKey` serves the public key from a Convex env var so it is not
  duplicated into a `NEXT_PUBLIC_*` var. One source of truth.
- `savePushSubscription` and `deletePushSubscription` require authentication
  (`requireAuth`), not admin. The opt-in UI is admin-only, but the mutations
  stay role-agnostic so a future user-facing notification does not need a
  migration.
- `notifyAdmins` is an **internal** mutation — unreachable from any client.
- `send` classifies each delivery as `ok`, `gone` (HTTP 404/410 — the push
  service saying the endpoint no longer exists) or `failed`, then applies the
  whole batch through one `applyDeliveryResults` call rather than one round
  trip per subscription. `gone` deletes the row; `failed` only increments
  `failureCount`. The action also returns a `{ delivered, dropped, failed }`
  summary so a delivery problem can be inspected with
  `npx convex run pushNode:send`.
- Payload construction lives in `convex/lib/pushPayloads.ts` as pure functions so
  it is unit-testable without standing up the Node runtime.

## Client

| File | Purpose |
|---|---|
| `public/sw.js` | Service worker: `push`, `notificationclick`, `install`/`activate`. Plain JS, no build step, root scope. |
| `app/_components/ServiceWorkerRegistrar.tsx` | Registers `/sw.js`; mounted once in the root layout; no-ops where unsupported. |
| `app/_lib/use-push.ts` | Hook: `{ supported, permission, subscribed, subscribe, unsubscribe, iosNeedsInstall }`. Owns base64url → `Uint8Array` VAPID conversion and reconciles `pushManager.getSubscription()` against the DB. |
| `app/admin/queue/PushToggle.tsx` | Bell toggle on `/admin/queue`. |
| `app/_components/InstallPrompt.tsx` | Dismissible add-to-home-screen pill, mounted in the **admin layout only**. |
| `app/_lib/platform.ts` | Pure UA/feature detection → a single `Platform` verdict. |
| `app/install/page.tsx` + `InstallClient.tsx` | Dedicated install page that detects the device and shows the one correct action. |

**Service worker handlers.** `push` calls `showNotification` with
`icon: /icon-192.png`, `badge: /badge-96.png`, a `tag` for coalescing repeats of
the same event type, and `data.url` for the deep link. `notificationclick`
focuses an already-open tab at that URL or opens one. `install`/`activate` call
`skipWaiting()` and `clients.claim()` so a redeploy takes effect without the user
closing every tab. There is no `fetch` handler and no cache.

**Toggle states.** Unsupported browser; iOS-not-yet-installed; permission
denied; off; on. Each state says what it is and what to do about it rather than
failing silently.

The control is a labelled button ("Turn on alerts" / "Turn off alerts"), not a
switch. A switch implies a clean binary, and half of this component's states —
unsupported browser, install-required, permission denied — are not on/off at
all. The button also names what will happen, which a switch cannot.

`InstallPrompt` is mounted in `app/admin/layout.tsx` rather than the root
layout. Notifications only go to admins, so a site-wide install banner would be
noise for someone who just wants to look up a game.

**Install prompt.** Captures `beforeinstallprompt` on Chrome/Android. iOS Safari
does not fire that event, so there it shows Share-sheet instructions instead.
Dismissal is remembered in `localStorage`.

### Install page (`/install`)

Admins are not all technical, and "install a PWA" has a different answer on
every browser. `/install` detects the device and shows exactly one action
instead of a matrix of caveats. `app/_lib/platform.ts` resolves the environment
to a single verdict, and the page renders one branch:

| Verdict | What the page shows |
|---|---|
| `installed` | "You're all set" + a link to turn on notifications |
| `can-prompt` | A real **Install app** button, wired to the captured `beforeinstallprompt` event |
| `ios-safari` | Share-sheet steps: Share → Add to Home Screen, with the icons drawn inline |
| `ios-other-browser` | "Open this page in Safari" + a copy-link button — no other iOS browser reliably installs to the Home Screen |
| `android-other-browser` | "Open this page in Chrome" + a copy-link button |
| `in-app-browser` | Instagram/Facebook/X/LinkedIn/Gmail webviews cannot install. "Open in your browser" + the platform-appropriate menu hint + copy link |
| `desktop-safari` | macOS Ventura+: Share → Add to Dock |
| `firefox-android` | Menu → Install, since Firefox never fires `beforeinstallprompt` |
| `unsupported` | Plain explanation and the copy-link button |

Detection rules, all in `platform.ts` so they are unit-testable against fixture
user-agent strings:

- **Installed**: `display-mode: standalone` media query, or `navigator.standalone`
  on iOS.
- **OS**: `iPadOS` reports a Mac UA, so iPad is caught by
  `navigator.maxTouchPoints > 1` on a "Macintosh" UA.
- **In-app browser**: UA contains `FBAN`/`FBAV`/`Instagram`/`Line`/`Twitter`/
  `LinkedIn`/`GSA`.
- **iOS browser**: `CriOS` (Chrome), `FxiOS` (Firefox), `EdgiOS` (Edge) — all
  WebKit underneath, but Add to Home Screen is only dependable in Safari, so
  they route to `ios-other-browser`.
- **`can-prompt`**: a `beforeinstallprompt` event was actually captured. The
  button is never shown on a guess; if the event never fires, the page falls
  through to the browser-specific branch.

Because `beforeinstallprompt` can fire before React mounts, it is captured by a
listener installed in `ServiceWorkerRegistrar` and stashed in a module-level
variable the hook reads on mount. Without that, the event is routinely missed
and the Install button never appears.

The copy-link button uses `navigator.clipboard.writeText` with a
`document.execCommand` fallback for older webviews, which is precisely where
this page matters most.

**iOS constraint.** iOS 16.4+ is required, and push works **only** when the app
has been added to the Home Screen. Safari-in-a-tab will never deliver a
notification, and `Notification.requestPermission()` is not even available
there. The toggle detects this (`navigator.standalone` / display-mode media
query) and shows install instructions rather than a dead switch.

## Icons

The existing assets do not survive the home screen:

| Asset | Problem |
|---|---|
| `app/apple-icon.png` (180×180) | Has an alpha channel. iOS discards alpha on home-screen icons and composites onto **black**, so the ball's black panels disappear into the tile. iOS also never pads or masks — it only rounds corners — so the art needs its own margin. |
| `public/icon-512-maskable.png` | Declared `purpose: "maskable"` but the ball spans ~85% of the canvas. Android's maskable safe zone is the centre **80% circle**; circle, squircle, and teardrop masks clip the ball's edges. Transparent, so the cropped margin renders unpredictably. |
| — | No maskable 192; no monochrome notification badge, so Android draws a grey blob in the status bar beside every push. |

`public/icon-192.png` and `public/icon-512.png` are correct as-is —
`purpose: "any"` should be transparent. `app/icon.png` (favicon) is untouched.

Generated from `public/icon-512.png` with `sharp`, already present in
`node_modules` as a Next transitive dependency — no new package:

| File | Size | Ground | Ball scale | Consumer |
|---|---|---|---|---|
| `app/apple-icon.png` | 180×180 | opaque `#10b981` | ~76% | iOS Home Screen, via Next's `apple-icon` file convention |
| `public/icon-192-maskable.png` | 192×192 | opaque `#10b981` | ~70% | Android launcher |
| `public/icon-512-maskable.png` | 512×512 | opaque `#10b981` | ~70% | Android launcher / splash |
| `public/badge-96.png` | 96×96 | transparent | white silhouette | Android status-bar badge |

Emerald `#10b981` is the existing `theme_color`; a black-and-white ball on
emerald reads as a brand mark and stands out against arbitrary wallpaper.

`app/manifest.ts` gains the maskable 192 entry. The rest of the manifest
(`display: standalone`, `scope: /`, `start_url: /`, theme and background colors)
is already correct and unchanged.

## Configuration

Three Convex environment variables, set with `npx convex env set`:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — a `mailto:` URL identifying the sender

New dependency: `web-push` and `@types/web-push`.

The keypair is generated locally with `web-push`'s `generateVAPIDKeys()` and set
on the **dev** deployment during implementation. Production secrets are set by
the project owner.

## Error Handling

| Failure | Behavior |
|---|---|
| Push service returns 404/410 | Subscription row deleted; admin silently loses that device until they re-opt-in |
| Push service returns 5xx or times out | `failureCount` incremented, row retained, that one notification lost |
| VAPID env vars missing | `send` throws with a clear message; triggering mutations are unaffected because the action is scheduled, not inline |
| Admin has no subscriptions | `notifyAdmins` returns without scheduling anything |
| User denies permission | Toggle reflects `denied` and explains how to reset it in browser settings |

A push failure never rolls back the user action that triggered it. That
separation is the reason every trigger schedules rather than calls inline.

## Testing

`convex-test` + vitest, matching the existing `convex/*.test.ts` pattern and the
`npm test` script:

- `savePushSubscription` upserts by endpoint — same device twice yields one row.
- `savePushSubscription` requires authentication.
- `notifyAdmins` fans out only to users with `role === "admin"`.
- `notifyAdmins` with no subscribed admins schedules nothing.
- `applyDeliveryResults` deletes `gone` rows, resets the counter on `ok`,
  increments it on `failed`, and tolerates an endpoint deleted mid-flight.
- `sendPendingDigest` schedules nothing when the pending queue is empty.
- `pushPayloads` builders produce the right title, body, and URL per event type.
- `platform.ts` resolves fixture user-agent strings to the right verdict, covering
  iPadOS-reports-as-Mac, the in-app browsers, and each iOS browser.

The Node action itself is a thin wrapper over `web-push`; its logic is the
payload building and the 404/410 branch, both covered above.
