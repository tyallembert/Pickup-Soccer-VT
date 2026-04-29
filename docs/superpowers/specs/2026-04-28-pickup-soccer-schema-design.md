# Pickup Soccer (Waterbury, VT) — Schema & Admin Design

**Date:** 2026-04-28
**Status:** Approved, ready for implementation plan

## Goal

A simple public page that tells players when and where pickup soccer is happening in Waterbury, Vermont, whether it is on or cancelled for the upcoming game day, and a brief recap of the most recent session. A minimal admin interface lets a single trusted admin edit the schedule details, toggle the upcoming week's status, and record a recap after each session.

## Non-goals

- Player accounts, RSVPs, or attendance tracking.
- Multi-admin management UI or role hierarchies.
- Multi-season scheduling, recurring cancellation rules, or calendar exports.
- Notifications (email, SMS, push).
- More than one weekly game day. The system models exactly one recurring day, configurable via `settings.dayOfWeek` but defaulting to Monday.

## Data model

Two application tables, plus the standard tables Convex Auth manages internally (not designed here).

### `settings` (single row, admin-editable)

| Field | Type | Notes |
|---|---|---|
| `dayOfWeek` | `number` (0–6, where 0 = Sunday) | The weekly game day. Stored structured so the display can format it (e.g., "Mondays at 6:00pm") and so the upcoming-game-day logic can be driven by it rather than a hardcoded Monday. Default value seeded as Monday (`1`). |
| `startTime` | `string` ("HH:mm", 24-hour) | E.g., `"18:00"`. A string is simpler than a `Date` for a recurring time-of-day with no calendar date. |
| `location` | `string` | Field name and/or address. |
| `details` | `string` (markdown) | A freeform markdown blob covering style of play, goal-size note, shirt instructions, gear notes, donation amount, and anything else the admin wants to surface. |

The settings table always contains exactly one row. It is created by an internal seed mutation (`convex/seedSettings.ts`, run via `npx convex run seedSettings:run`) that inserts the row with sensible defaults if one does not already exist. The seed is idempotent and is run as part of the initial deployment, alongside the admin-user seed.

### `gameDays` (one row per explicitly-recorded game day)

A single row holds whatever has been recorded about that calendar date — pre-game scheduling state and/or a post-game recap. Every field other than `date` is optional. A cancelled day might have only `isOn`/`reason` set; a completed normal day might have only recap fields set; a row may also have both sides if the admin both pre-cancelled and later wrote a recap.

| Field | Type | Notes |
|---|---|---|
| `date` | `string` ("YYYY-MM-DD") | The game day this row is about (typically a Monday, but follows whatever `settings.dayOfWeek` is at the time the row is written). Stored as an ISO date string in America/New_York to avoid timezone drift. Indexed and unique. |
| `isOn` | `boolean \| undefined` | Pre-game scheduling state. `true` = explicitly on, `false` = cancelled, absent = not set (treated as on by default). |
| `reason` | `string \| undefined` | Optional cancellation reason, only meaningful when `isOn === false`. |
| `turnout` | `number \| undefined` | Approximate player count for that session. |
| `weatherCondition` | `"sunny" \| "cloudy" \| "rainy" \| "snowy" \| "windy" \| "cold" \| undefined` | Single-pick enum capturing the dominant weather for filtering and future analytics. |
| `weather` | `string \| undefined` | Free-text weather nuance, e.g., "rain held off until 6:30, then a downpour". |
| `recapNotes` | `string (markdown) \| undefined` | "Other useful info" — anything else worth remembering about the session. |

A row is created lazily, only when the admin explicitly writes either pre-game state or recap data. If no row exists for a given game day, that day is treated as `isOn: true` with no recap. This is what makes auto-rollover unnecessary: the absence of a row is the "default on" state.

Old `gameDays` rows are kept indefinitely as history. A future calendar view can read the full history from this same table without any schema change.

## "Upcoming game day" logic

A pure helper function computes the upcoming game day from `now` and `settings.dayOfWeek`:

- If today matches `settings.dayOfWeek` in America/New_York and the game start time (`settings.startTime`) has not yet passed → today.
- If today matches `settings.dayOfWeek` and the start time has passed → the same weekday next week.
- Otherwise → the next calendar occurrence of `settings.dayOfWeek`.

Convex functions run in UTC, so the helper applies the America/New_York offset (including DST) before doing date math, then formats the result back to `YYYY-MM-DD`.

The helper reads `settings.dayOfWeek` and `settings.startTime` rather than hardcoding Monday/6pm. This keeps the entire app driven by the editable settings row — if the admin changes the day or time, "the upcoming game day" automatically follows.

The helper is used by both the public read query and the admin write mutation, so the "what does upcoming mean" logic exists in exactly one place.

## Public read queries

Two queries, both unauthenticated.

### `getUpcomingWeek`

Returns the upcoming game day's status and the current settings.

```ts
{
  date: string;           // "2026-05-04"
  isOn: boolean;           // from gameDays row if present (and isOn is set), else true
  reason?: string;         // present only when isOn === false
  settings: {
    dayOfWeek: number;
    startTime: string;
    location: string;
    details: string;
  };
}
```

If no `settings` row exists yet, the query throws — the seed step is a prerequisite, not a fallback.

### `getLatestRecap`

Returns the most recent past `gameDays` row that has any recap field (`turnout`, `weatherCondition`, `weather`, or `recapNotes`) set, or `null` if none exists. "Past" means `date` is strictly before today in America/New_York.

```ts
{
  date: string;
  turnout?: number;
  weatherCondition?: "sunny" | "cloudy" | "rainy" | "snowy" | "windy" | "cold";
  weather?: string;
  recapNotes?: string;
} | null
```

## Admin write mutations

All admin mutations begin with `await requireAdmin(ctx)`, a helper that calls `ctx.auth.getUserIdentity()` and throws if the caller is not signed in. Because signup is disabled, "signed in" is equivalent to "is the admin."

- `setUpcomingStatus({ isOn, reason? })` — computes the upcoming game day's date via the helper, upserts a `gameDays` row keyed by that date. Strips `reason` when `isOn === true`.
- `updateSettings({ dayOfWeek?, startTime?, location?, details? })` — patches the single settings row. Each field is optional so the admin can update one at a time.
- `saveRecap({ turnout?, weatherCondition?, weather?, recapNotes? })` — server computes the target date as the most recent past occurrence of `settings.dayOfWeek` (mirror of the upcoming-game-day helper, looking backward instead of forward), then upserts a `gameDays` row keyed by that date. Recap fields are merged onto whatever pre-game state may already be on the row. For each recap field: `undefined` leaves the existing value untouched, an explicit empty string or `null` clears it.

## Auth

- Convex Auth with the password provider only. No OAuth, no magic links, no email sending.
- Public signup is disabled. The admin user is created once via a one-time seed script (`convex/seedAdmin.ts`, executed with `npx convex run seedAdmin:run`) that reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables. The seed is idempotent: if the user already exists, it does nothing.
- The seed script is an internal mutation, not a public mutation, so it cannot be called from the client.

## Admin UI (Next.js App Router)

- `/admin/login` — email + password form. On success, redirects to `/admin`. On failure, shows an inline error.
- `/admin` — protected page. Server-side check redirects unauthenticated visitors to `/admin/login`. The page contains:
  - A header showing the upcoming game day's date and current status.
  - A status form: a toggle for "Soccer is ON / OFF for [day-of-week, date]", plus a reason textarea that appears when OFF. Saves call `setUpcomingStatus`.
  - A settings form with inputs for `dayOfWeek`, `startTime`, `location`, and `details` (textarea, markdown). Saves call `updateSettings`.
  - A "Last session recap" form. The form header shows the date the recap is for, derived server-side from `settings.dayOfWeek` (most recent past occurrence). The form is prefilled from the existing `gameDays` row for that date if one exists. Inputs: `turnout` (number), `weatherCondition` (radio group of the six enum values), `weather` (text), `recapNotes` (markdown textarea). Saves call `saveRecap` (no date arg — the server recomputes it).
  - A sign-out button.

## Public UI

`/` renders the results of `getUpcomingWeek` and `getLatestRecap`.

Upcoming week section:

- When `isOn === true`: a schedule line built from settings (e.g., "Mondays at 6:00pm at [location]" — the day word and time are formatted from `dayOfWeek` and `startTime`), followed by `details` rendered as markdown.
- When `isOn === false`: a prominent banner — "NO SOCCER this [weekday name] ([date])" — with the reason rendered below if present. The schedule and details still render below the banner so players can see what the regular setup looks like.

Last session section (rendered directly below the upcoming-week section):

- When `getLatestRecap` returns non-null, render a compact "Last session" card showing the date, turnout if set ("14 players"), weather (a small icon or label from `weatherCondition` plus the free-text `weather`), and the markdown `recapNotes` if present.
- When `getLatestRecap` returns null, the section is omitted entirely (no empty placeholder).

## Out of scope (explicitly deferred)

- Multiple upcoming-week records visible to players (e.g., "next 4 Mondays"). Could be added later by changing the query and display, no schema change needed.
- A separate `donationAmount` numeric field. Currently folded into `details` markdown for flexibility.
- A second admin or admin-managed user list. Adding this later means flipping signup back on and adding a `role` field.
- Cron-based rollover. The lazy default-on rule makes a cron unnecessary; if scheduled cancellations (e.g., "off every Monday in July") become a need, that is a separate feature.
- A public calendar / archive view of past sessions. The `gameDays` table already supports this — it just needs a new query and page when wanted.
- Recap analytics (turnout averages over time, "we got rained out X% of Mondays this summer"). The `weatherCondition` enum is in place to enable this later.
- Photos, MVPs, scores, or other recap fields beyond turnout / weather / notes. Easy to add later if any of these become genuinely wanted.
