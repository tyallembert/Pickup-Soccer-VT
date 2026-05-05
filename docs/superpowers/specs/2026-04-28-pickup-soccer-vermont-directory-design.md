# Pickup Soccer (Vermont) — Directory Design (v2)

**Date:** 2026-04-28
**Status:** Approved, ready for implementation plan
**Supersedes:** `2026-04-28-pickup-soccer-schema-design.md` (the v1 single-Waterbury spec is retained for history but not implemented as-written; the v1 implementation work that was already completed — Convex Auth install, JWT keys, schema, password provider — is partially reused, partially rewritten, as called out below).

## Goal

A statewide directory of pickup soccer in Vermont. Anyone can browse a map and list of pickup games. Anyone can submit a new pickup game by creating an account; submissions enter a moderation queue and become public after the super-admin (Ty) approves them. Each location's owner can edit their own schedule, toggle whether the next game is on, and write post-session recaps.

## Non-goals

- Player accounts in the consumer sense (RSVPs, attendance tracking, friend lists, messaging).
- Multi-state expansion. The map and copy are Vermont-specific; broader scope is its own future redesign.
- Email notifications (approvals, password resets, game reminders). Owners check their account page; password reset can ship later.
- A second auth provider (Google OAuth) in v2. Email + password only at launch.
- Multi-day-per-week schedules within a single location. One location row models one weekly recurrence. A group running pickup at two times or two fields submits two locations.
- Photos, MVPs, scores, RSVP counts.
- Public commenting or any submitter-to-submitter contact.
- Native mobile app; the site is a responsive web app only.

## Tech additions over v1

- `react-leaflet` + `leaflet` + `react-leaflet-cluster` (or equivalent marker-clustering wrapper) — map view, free OpenStreetMap tiles, pin clustering at low zoom.
- `gsap` + `@gsap/react` — animation polish layer.
- Direct `fetch` to OpenStreetMap Nominatim for geocoding (no SDK, no API key).

Existing v1 dependencies (`convex`, `@convex-dev/auth`, `@auth/core@0.37.0`, `next 16.2.4`, `react 19`, `tailwindcss 4`) carry over unchanged.

## Data model

Three application tables plus the standard `authTables` from `@convex-dev/auth`.

### `users` (extends `authTables.users`)

Already in place from the v1 work in T2. Schema is unchanged: all the optional fields `@convex-dev/auth` reads/writes (`email`, `name`, `image`, `emailVerificationTime`, `phone`, `phoneVerificationTime`, `isAnonymous`) plus a `role` column.

| Field | Type | Notes |
|---|---|---|
| `role` | `"user" \| "admin" \| undefined` | `undefined` and `"user"` are equivalent; `"admin"` is the super-admin (Ty). |

Indexes: `email` and `phone` (both required by Convex Auth's internal lookups; names must not be renamed).

### `locations` (replaces v1's `settings`)

One row per pickup game. Holds everything needed to render the location on the map, in the list, and on its detail page.

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Display name, e.g., "Riverbend Park Pickup". |
| `town` | `string` | Free-text town name; used for filtering. |
| `address` | `string` | Street address as the submitter typed it. Used for human display, not parsed structurally. |
| `lat` | `number` | Latitude (auto-geocoded from address, then refined by submitter via draggable pin). |
| `lng` | `number` | Longitude (same). |
| `dayOfWeek` | `number` (0–6, where 0 = Sunday) | The recurring weekly game day. |
| `startTime` | `string` ("HH:mm", 24-hour) | E.g., `"18:00"`. |
| `details` | `string` (markdown) | Style of play, gear notes, donation, anything else the owner wants to surface. |
| `ownerId` | `Id<"users">` | The submitter's user id. Required — submission requires an account. |
| `status` | `"pending" \| "approved" \| "rejected"` | Moderation state. Public queries return only `approved`. |
| `rejectionReason` | `string \| undefined` | Set by the super-admin on `rejected`. Cleared on resubmit/approve. |
| `submittedAt` | `number` | `Date.now()` at insertion. |
| `approvedAt` | `number \| undefined` | Set when the admin approves. |

Indexes:
- `by_status` (`["status"]`) — moderation queue (pending), public list (approved).
- `by_owner` (`["ownerId"]`) — owner dashboard listings.
- `by_status_and_town` (`["status", "town"]`) — public list filtered by town.

### `gameDays` (now scoped per location)

| Field | Type | Notes |
|---|---|---|
| `locationId` | `Id<"locations">` | Foreign key. |
| `date` | `string` ("YYYY-MM-DD" in America/New_York) | The game day this row is about. |
| `isOn` | `boolean \| undefined` | Pre-game scheduling state. `true` = explicitly on, `false` = cancelled, absent = not set (treated as on by default). |
| `reason` | `string \| undefined` | Optional cancellation reason, only meaningful when `isOn === false`. |
| `turnout` | `number \| undefined` | Approximate player count for that session. |
| `weatherCondition` | `"sunny" \| "cloudy" \| "rainy" \| "snowy" \| "windy" \| "cold" \| undefined` | Single-pick enum. |
| `weather` | `string \| undefined` | Free-text nuance. |
| `recapNotes` | `string (markdown) \| undefined` | "Other useful info." |

Indexes:
- `by_location_and_date` (`["locationId", "date"]`) — point lookup for "this week" status and recap.
- `by_location` (`["locationId"]`) — descending scans for "last session" history.

A row is created lazily, only when an owner explicitly writes pre-game state or recap data. If no row exists for a given (locationId, date), the day is treated as `isOn: true` with no recap.

## Auth & roles

- Convex Auth with the password provider only. Sign-up *enabled*. The v1 `profile()` block that disabled signup is removed.
- Every new account is a normal user (`role` left `undefined` or set to `"user"` — code treats them equivalently).
- The super-admin role is granted only by the seed script (`convex/seedAdmin.ts`), which reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from Convex env, creates the account if missing via `createAccount`, then patches `role: "admin"`. Idempotent. No public path to admin role.
- Server-side helpers in `convex/lib/auth.ts`:
  - `requireAuth(ctx)` — returns the signed-in `Doc<"users">` or throws `"Not authenticated"`.
  - `requireOwnerOf(ctx, locationId)` — returns the user if they own the location *or* have `role === "admin"`; throws `"Forbidden"` otherwise.
  - `requireAdmin(ctx)` — throws unless `role === "admin"`.
- Per the project's Convex AI guidelines: never accept `userId` as a function argument. Identity is always derived via `getAuthUserId`/`ctx.auth`.

## "Upcoming game day" / "most recent past game day" logic

The pure helpers from v1 (`upcomingGameDay`, `mostRecentPastGameDay`) are reused without change. They are driven by `(now, dayOfWeek, startTime)` tuples — now read from a `locations` row instead of the singleton `settings` row. Timezone is America/New_York.

## Mutations

Every mutation begins with one of the auth helpers above.

### Public (signed-in) mutations

- `submitLocation({ name, town, address, lat, lng, dayOfWeek, startTime, details })`
  Auth: `requireAuth`.
  Inserts a new `locations` row with `ownerId = currentUser._id`, `status = "pending"`, `submittedAt = Date.now()`. Server-side rate limit: a user may have at most 3 pending-or-rejected (i.e., not-yet-approved) locations at one time. Past that, the mutation throws "Limit reached — finish your existing submissions first."
  Returns the new `Id<"locations">`.

- `resubmitLocation({ id })`
  Auth: `requireOwnerOf`.
  Allowed only when current `status === "rejected"`. Flips `status` back to `"pending"`, clears `rejectionReason`. Useful after an owner edits a rejected submission.

### Owner mutations (work for the owner of the location *or* admin)

- `updateLocation({ id, name?, town?, address?, lat?, lng?, dayOfWeek?, startTime?, details? })`
  Auth: `requireOwnerOf(id)`. Patches the row; allowed in any `status` (per the design choice that owners can edit pending and rejected rows freely).
- `setLocationStatus({ id, isOn, reason? })`
  Auth: `requireOwnerOf(id)`. Computes the upcoming game day from the location's `dayOfWeek`/`startTime` and upserts a `gameDays` row. Strips `reason` when `isOn === true`. Throws if the location's `status !== "approved"` (no point setting status on an unapproved location).
- `saveRecap({ id, turnout?, weatherCondition?, weather?, recapNotes? })`
  Auth: `requireOwnerOf(id)`. Computes the most recent past game day; upserts the `gameDays` row. Same semantics for `undefined` (leave alone) vs `null` (clear) as v1. Throws if `status !== "approved"`.

### Admin moderation mutations

- `approveLocation({ id })`
  Auth: `requireAdmin`. Sets `status = "approved"`, `approvedAt = Date.now()`, clears `rejectionReason`.
- `rejectLocation({ id, reason })`
  Auth: `requireAdmin`. Sets `status = "rejected"`, `rejectionReason = reason`. Does *not* delete the row — the owner can resubmit.
- `remoderateLocation({ id })`
  Auth: `requireAdmin`. Sets `status = "pending"`, clears `approvedAt` and `rejectionReason`. Used when an admin wants to take an approved location offline temporarily.
- `deleteLocation({ id })`
  Auth: `requireAdmin`. Deletes the `locations` row and all of its `gameDays` rows. Confirms via a destructive-action UI in the admin pages. (Implementation: query `gameDays` `by_location` and delete each in a loop, batched if needed.)

Admins also have override versions of the owner mutations for fixing typos on dormant accounts:
- `adminUpdateLocation`, `adminSetLocationStatus`, `adminSaveRecap` — same shape as the owner versions, but gated by `requireAdmin` and ignoring ownership.

The reason for separate functions instead of a single `if (admin || owner)` branch: keeps each function's auth check unambiguous and makes the audit trail clearer.

## Public read queries

All unauthenticated. All bounded.

- `listLocations({ search?, town?, dayOfWeek? })`
  Returns all `approved` locations, filtered by the optional args. For each location, inlines the upcoming-week status (computed from `gameDays`) and the latest recap (most recent past `gameDays` row with any recap field set), so the homepage list/map renders in one round-trip. Bounded `.take(200)` (plenty for VT scale).
- `getLocation({ id })`
  Returns one `approved` location with full details, upcoming-week status, and latest recap. Throws if the location is not `approved` (so deep links to pending/rejected locations 404 rather than leaking moderation state).

## Authenticated read queries

- `me()` — returns the signed-in user's email and role, or `null` if signed out.
- `myLocations()` — `requireAuth`. Returns the current user's locations regardless of status, with their statuses. Powers the `/account` page.
- `getMyLocation({ id })` — `requireOwnerOf`. Full detail (including `status` and any pending/rejected fields) for the owner's edit page.

## Admin read queries

- `pendingLocations()` — `requireAdmin`. All `pending` locations, oldest first. Powers the moderation queue.
- `allLocations({ status? })` — `requireAdmin`. All locations, optionally filtered by status. Powers the admin all-locations view.
- `adminGetLocation({ id })` — `requireAdmin`. Full detail for any location regardless of status.

## Submission flow (UX)

Entry point: a prominent "Add a pickup game" button on the homepage hero.

Page: `/submit`

1. **Top of form:** a soft warning banner — *"You'll need a free account to submit. We'll prompt you when you save."*
2. **Fields (in order):** name, town, address (with autocomplete-suggestion list pulled from existing approved locations' towns), map preview with draggable pin, day of week, start time, details (markdown textarea).
3. **Geocoding pipeline:**
   - On address blur, the client calls `https://nominatim.openstreetmap.org/search?q=<address>&format=json&countrycodes=us&viewbox=<VT bounds>&bounded=1`.
   - First result's `lat`/`lon` becomes the initial pin. If no result, the pin starts at Vermont's geographic center (≈ 44.0°N, -72.7°W) and the form shows "We couldn't find that address — drag the pin to the right spot."
   - Pin drag updates `(lat, lng)` in form state. Address text is *not* reverse-geocoded — we trust the submitter.
4. **Save behavior:**
   - **If signed in:** call `submitLocation` with the form data and the dragged pin's coordinates. Server stamps `ownerId`, sets `status: "pending"`, returns the new id. Client redirects to `/account/locations/<id>` with a "Pending review" banner.
   - **If not signed in:** stash form data in `sessionStorage`, redirect to `/signup?redirect=/submit&restore=true` (signup page also offers "Sign in instead"). After signup or sign-in, `/submit` re-hydrates from `sessionStorage` and auto-submits.

Spam considerations: rate limit (max 3 not-yet-approved locations per user) and the moderation queue are sufficient for v2. No CAPTCHA.

## Owner UI

- `/account` — server-gated by `requireAuth`. Header (email, sign-out), list of "Your locations" with status badges (`Pending`, `Approved`, `Rejected`), each linking to `/account/locations/<id>`. "Add another pickup game" link to `/submit`.
- `/account/locations/<id>` — server-gated by `requireOwnerOf`. Status banner at top:
  - `pending` — yellow. "Awaiting review. You can keep editing while you wait."
  - `approved` — green. "Live on the directory."
  - `rejected` — red. Shows `rejectionReason` if present. "Edit your submission and resubmit." Resubmit button calls `resubmitLocation`.
- Below the banner, three forms:
  1. **Schedule edit** — name, town, address, draggable map pin, day, time, details. Saves → `updateLocation`.
  2. **This week's status** — toggle "Soccer is ON / OFF for [date]" + reason textarea. Saves → `setLocationStatus`. Hidden when `status !== "approved"`.
  3. **Last session recap** — turnout, weather condition radio group, free-text weather, markdown notes. Saves → `saveRecap`. Hidden when `status !== "approved"`.

The draggable map pin is extracted into a shared client component `app/_components/LocationPin.tsx` and reused by `/submit` and the schedule-edit form.

There is no "delete location" button on the owner side. Owners who want to remove a location email the super-admin.

## Super-admin UI

All under `/admin/*`, server-gated by `requireAdmin`. Sign-in via the same `/signin` page; the gate redirects non-admins to `/`.

- `/admin` — overview. Three counts (pending, approved, rejected) and links into the deeper pages.
- `/admin/queue` — `pending` locations, oldest first. Each row: name, town, owner email, submitted-at, "Review" link.
- `/admin/queue/<id>` — single submission review. Read-only view of all submitted fields, a small map showing the geocoded pin, plus owner email/name. Actions: **Approve** (`approveLocation`), **Reject** (opens an inline reason textarea, then `rejectLocation`).
- `/admin/locations` — all locations across all statuses. Status filter chips. Each row links to `/admin/locations/<id>`.
- `/admin/locations/<id>` — admin-override edit page. Same three forms as the owner edit page, dispatching to `adminUpdateLocation`, `adminSetLocationStatus`, `adminSaveRecap`. Plus a "Re-moderate" button (`remoderateLocation`) and a "Delete location" button with a confirm dialog (`deleteLocation`).

Why admin mutations are separate functions and not just owner-with-override: keeps each function's auth check unambiguous; eliminates conditional auth branches that are easy to get wrong.

No email notifications in v2. Owners learn approval/rejection by checking `/account`.

## Public UI

### Homepage `/`

Top-to-bottom:
1. **Hero / header** — site title, one-line tagline, prominent "Add a pickup game" CTA. GSAP animates the title and CTA in on first paint; the map below pans to fit Vermont as the hero exits the viewport.
2. **Map view** — Leaflet + free OSM tiles, bounded to Vermont. One pin per `approved` location. Pin click opens a popup: name, town, schedule line, "View details" link. Pin clusters when zoomed out.
3. **Filter row** — search box (matches `name` or `town`, case-insensitive substring), town selector (populated from the distinct set of towns across approved locations), day-of-week selector. Filters apply to both visible pins and the list. (Counties/regions are deliberately not modeled; town granularity is what users recognize.)
4. **List** — every approved location, filtered. Each card: name, town, schedule line, current week's status (compact "ON tonight" / "OFF — [reason]"), turnout from latest recap if any. Click → `/locations/<id>`.

### Location detail page `/locations/<id>`

For an `approved` location only — `getLocation` throws otherwise, page renders a 404. Content:
- Name, town, address, full markdown details.
- Schedule line + a small map zoomed in on this one location.
- "This week" card — same status logic as v1's upcoming-week display, scoped to one location.
- "Last session" card — same as v1's latest recap, scoped to one location.

### Sign-in & sign-up pages

- `/signin` — email + password. On success, redirects to `redirect` query param or `/account`.
- `/signup` — email + password (with confirm). Calls Convex Auth's signup flow (`signIn("password", { ..., flow: "signUp" })`). Now allowed because the v1 `profile()` block is removed. After signup, redirects per `redirect` param or to `/account`.
- Both pages live outside any auth gate (the middleware redirects authenticated visitors away from `/signin` to `/account`, and away from `/signup` to wherever the redirect param said).

## Animation strategy (GSAP)

- A tiny `app/_components/MotionShell.tsx` lazy-imports GSAP on the client (no SSR). Pages opt into specific primitives: page entrance, hero parallax, list-item stagger on the homepage, pin-drop on map mount, route transitions.
- The exact animation choreography is *not* designed in this spec — it's a polish layer scoped at implementation time. The plan reserves a dedicated phase for it after the functional pages exist.

## Migration from the v1 work already done

Three commits already exist on `main` from the v1 single-Waterbury build:

- T1 (commit `82818ac`) — installed `@convex-dev/auth`, `@auth/core@0.37.0`, ran `npx @convex-dev/auth` to set JWT keys. **Reused as-is.**
- T2 (commits `9d0a5f5` + `7e0147a`) — Convex schema with `settings`, `gameDays`, and overridden `users` table. **Replaced.** `settings` is removed; `gameDays` gains `locationId`; `locations` is added; `users` keeps the `role` field. The v1 `gameDays.by_date` index is replaced by `gameDays.by_location_and_date` and `gameDays.by_location`.
- T3 (commit `088ad72`) — `convex/auth.config.ts`, `convex/auth.ts` (Password provider with sign-up disabled via `profile()` throw), `convex/http.ts`. **Modified.** `convex/auth.ts` is rewritten to enable signup; `convex/auth.config.ts` and `convex/http.ts` remain as-is.

The v2 plan starts from the current `main` (Convex Auth installed and JWT keys set) and treats the schema/auth changes as Task 1 of the new plan. No data migration is needed because the dev deployment has no real data yet.

## Out of scope (explicitly deferred)

- Email notifications (approve/reject/password-reset).
- Google OAuth (or any second auth provider).
- Multi-day-per-week schedules within one location row.
- Public commenting, RSVPs, attendance, or photos.
- Embedded calendar integrations (Google/Apple calendar feeds).
- Submission editing history / audit log.
- Soft-delete or archive states beyond `pending`/`approved`/`rejected`.
- Payment/donation handling.
- Scheduled cron jobs (e.g., auto-archive stale locations).
- Native mobile app or push notifications.
