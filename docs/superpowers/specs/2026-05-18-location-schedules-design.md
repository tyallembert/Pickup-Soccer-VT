# Multi-slot locations via `locationSchedules` — Design

**Date:** 2026-05-18
**Status:** Approved, ready for implementation plan
**Supersedes:** the single-slot model from `2026-04-28-pickup-soccer-schema-design.md` (the per-location `dayOfWeek` + `startTime` fields).

## Goal

Let a single pickup-soccer location host more than one recurring weekly slot — e.g., a field that runs Tuesday 6 PM and Thursday 6 PM — without duplicating the location, splitting its maintainers, or stacking pins on the map. Each slot keeps its own cancellation state and recap history so the two sessions stay independent.

## Non-goals

- Per-slot ownership or per-slot maintainers. Co-maintainers continue to operate at the `locations` level and can manage every slot the location has.
- Per-slot admin re-approval. A primary owner can add or remove slots on an already-approved location without going back through moderation. Brand-new locations are still moderated once, as a unit.
- Seasonality / per-slot pause. Slots are either present or absent. A slot that pauses for winter is removed and re-added later. Venue changes by season continue to be modeled as separate locations (e.g., Vermont Womxn's Summer at Starr Farm vs. Winter at Miller Center are two locations).
- Per-slot details/markdown. The `details` blob stays at the location level; slot-specific notes go in there as prose.
- Calendar exports, recurrence rules other than weekly, or one-off non-weekly events.

## Confirmed product decisions

- **Q1 — gameDays scope:** per-slot. `gameDays` keys on `(scheduleId, date)`.
- **Q2 — end time:** each schedule carries an optional `endTime`.
- **Q3 — submission flow:** the submit form lets the user add multiple slots in one submission. Admin approves the whole location once.
- **Q4 — day filter semantics:** match-any. A field with Tue + Thu slots appears under both day filters.

## Data model

### `locationSchedules` (new table)

A child of `locations`. One row per recurring weekly slot.

| Field | Type | Notes |
|---|---|---|
| `locationId` | `Id<"locations">` | Parent field/park. |
| `dayOfWeek` | `number` (0–6, 0 = Sunday) | Same encoding as the legacy `locations.dayOfWeek`. |
| `startTime` | `string` ("HH:mm", 24-hour) | Same encoding as legacy `startTime`. |
| `endTime` | `string \| undefined` ("HH:mm", 24-hour) | Optional. When present, list views render "6–8 PM"; when absent, they render "starts 6 PM" as today. |

Indexes:

- `by_location` on `["locationId"]` — fetch every slot for a field (location detail page, submit/edit, NextUpGame fan-out).
- `by_dayOfWeek` on `["dayOfWeek"]` — supports server-side match-any day filtering across all approved locations.

Display order within a location is `_creationTime` ascending. No explicit `order` field; the submit form preserves insertion order naturally, and the cost of resequencing later (delete + re-insert) is acceptable for the size of this list (~1–5 per location in practice).

### `locations` (updated)

Drop `dayOfWeek` and `startTime` after the migration narrows. Every other field is unchanged. The location still owns `name`, `town`, `address`, `lat`, `lng`, `details`, `ownerId`, `status`, etc., and is what `locationMaintainers` and `gameDays` foreign-key into.

### `gameDays` (updated)

| Change | Detail |
|---|---|
| Add `scheduleId` | `v.id("locationSchedules")`, required after migration. Identifies which slot the row belongs to. |
| Keep `locationId` | Denormalized but immutable (a schedule's `locationId` never changes), so it stays cheap and makes "every recap at this field across slots" a single index lookup. |
| New index `by_schedule_and_date` | `["scheduleId", "date"]`. Replaces `by_location_and_date` as the canonical upsert key. |
| Keep index `by_location` | `["locationId"]`. Used by the location-detail "last session" pull and by `deleteLocation`. |
| Drop index `by_location_and_date` | No longer needed once writes route through `by_schedule_and_date`. |

### `locationMaintainers` (unchanged)

Maintainers stay at the location level. An approved maintainer can manage every slot.

## Date logic

`convex/lib/dates.ts` already exposes `upcomingGameDay(now, dayOfWeek, startTime)` and `mostRecentPastGameDay(now, dayOfWeek, startTime)`. Both signatures stay as-is — they're already slot-shaped, just previously called with location fields. Callers pass each schedule's own `dayOfWeek` + `startTime`.

The legacy module is otherwise untouched.

## Public read queries (`convex/public.ts`)

### Shape

`listLocations` and `getLocation` change from returning a flat location with `dayOfWeek`/`startTime`/`thisWeek`/`lastSession` to nesting that under a `schedules` array:

```ts
type PublicLocation = {
  _id: Id<"locations">;
  name: string;
  town: string;
  address: string;
  lat: number;
  lng: number;
  details: string;
  schedules: Array<{
    _id: Id<"locationSchedules">;
    dayOfWeek: number;
    startTime: string;
    endTime?: string;
    thisWeek: { date: string; isOn: boolean; reason?: string };
    lastSession: {
      date: string;
      turnout?: number;
      weatherCondition?: Doc<"gameDays">["weatherCondition"];
      weather?: string;
      recapNotes?: string;
    } | null;
  }>;
};
```

Each `thisWeek` and `lastSession` is computed per schedule, the same way `buildPublicLocation` currently computes them per location.

### `listLocations(args)`

`args.dayOfWeek` semantics become match-any. Implementation:

1. Fetch approved locations from `by_status` (or `by_status_and_town` when `args.town` is set), bounded `take(200)` as today.
2. For each location, fetch its schedules via `by_location`.
3. If `args.dayOfWeek` is set, keep the location only when at least one of its schedules matches that day. The location's `schedules` array still includes every schedule (the UI highlights matching chips — see Frontend); filtering out non-matching slots would make the directory feel like it's "hiding" the field's other times.
4. Pull every recent `gameDays` row for the location once via `by_location` (desc, `take(50)`), partition in memory by `scheduleId`, and feed each schedule its slice. For each kept schedule, fetch its `thisWeek` row directly with `by_schedule_and_date` (one index hit per schedule).

### `getLocation(id)`

Mirrors `listLocations` shape but fans out schedules for a single location. No filtering.

### `distinctTowns(args)`

Unchanged.

### Owner-side reads (`getMyLocation`, `myLocations`)

Same fan-out: `myLocations` returns `schedules: [{ dayOfWeek, startTime, endTime? }]` instead of the top-level pair. `getMyLocation` returns the per-schedule `thisWeek` + `lastSession` like the public side, plus the existing `viewerRole` / `viewerIsPrimaryOwner` fields.

### Query budget

For a typical 200-location result with ~1–2 schedules each, the read fans out to ~200–400 schedule lookups plus 200–400 thisWeek lookups plus the lastSession scan. That's still well within Convex transaction limits, but it's a real step-up from today. Two mitigations land naturally:

- The lastSession pull uses `by_location` once per location (not per schedule) and then partitions the rows by `scheduleId` in memory — same number of reads as today.
- The thisWeek upsert lookup is one index hit per schedule, which is bounded.

If `listLocations` grows past 200 results or schedules-per-location grows past ~3, revisit and consider denormalizing a per-schedule `nextThisWeek` cache. Not required for v1.

## Mutations

### `submissions.submitLocation` (updated)

Accept `schedules: v.array(v.object({ dayOfWeek: v.number(), startTime: v.string(), endTime: v.optional(v.string()) }))` with at least one entry. Validate min length 1 server-side. Insert the `locations` row first, then insert each `locationSchedules` row keyed back to it. The rate-limit check stays as-is.

### `submissions.resubmitLocation`

Unchanged. Schedules carry no `status`, so resubmission just flips the location's status back to `pending`.

### `owner.updateLocation` (updated)

Drop `dayOfWeek` and `startTime` from the args. Other fields (`name`, `town`, `address`, `lat`, `lng`, `details`) stay.

### `owner.setSchedules` (new)

```ts
setSchedules({
  id: Id<"locations">,
  schedules: Array<{
    _id?: Id<"locationSchedules">;       // present = update, absent = insert
    dayOfWeek: number;
    startTime: string;
    endTime?: string;
  }>,
})
```

Replaces the location's entire slot list. Identity is by `_id`, not by `(dayOfWeek, startTime, endTime)` — that way a user editing a slot's time (e.g. Tue 6 PM → Tue 7 PM) keeps the same `locationSchedules` row and its `gameDays` history intact. Implementation: requireOwnerOf, validate min length 1, then in one pass:

- For each incoming entry with an `_id`, `patch` the row (after asserting `locationId` matches).
- For each incoming entry without an `_id`, `insert` a new row.
- Any existing schedules whose `_id` is not in the incoming list are deleted.

If a slot is removed, its `gameDays` rows are kept (history) but no longer surface in the UI. Admin "delete location" already cascades through `by_location`, so they get cleaned up there if the location itself is deleted.

### `owner.setLocationStatus` → `owner.setScheduleStatus` (renamed + reshaped)

Takes `scheduleId: v.id("locationSchedules")` instead of `id: v.id("locations")`. Resolves the schedule, walks up to the location to enforce `requireOwnerOf`, computes the upcoming date from the schedule's `dayOfWeek`/`startTime`, and upserts the `gameDays` row keyed by `by_schedule_and_date`.

### `owner.saveRecap` → `owner.saveScheduleRecap` (renamed + reshaped)

Same reshape as setScheduleStatus. Takes `scheduleId`, computes `mostRecentPastGameDay` from the schedule's `dayOfWeek`/`startTime`, upserts `gameDays` by `by_schedule_and_date`.

### Admin mirrors (`convex/admin.ts`)

- `adminUpdateLocation`: drop `dayOfWeek` and `startTime`.
- `adminSetSchedules`: new, mirrors `owner.setSchedules`.
- `adminSetScheduleStatus`: replaces `adminSetLocationStatus`.
- `adminSaveScheduleRecap`: replaces `adminSaveRecap`.
- `deleteLocation`: existing cascade widens to include the location's `locationSchedules` rows.
- `adminGetLocation`, `allLocations`, `pendingLocations`: returns include `schedules: [{ _id, dayOfWeek, startTime, endTime? }]`.

### Maintainer mutations (unchanged)

All five maintainer mutations in `convex/maintainers.ts` stay as-is — they operate at the location level. `myMaintainedLocations` returns `schedules` instead of the top-level pair.

## Migration plan

`@convex-dev/migrations` is the runtime. The migration runs as widen → backfill → narrow, in that order, each phase as a separate deploy.

### Phase 1 — widen

- Add the `locationSchedules` table to the schema.
- Add `scheduleId: v.optional(v.id("locationSchedules"))` to `gameDays`.
- Make `dayOfWeek` and `startTime` on `locations` optional.
- Deploy. No code reads or writes through the new table yet.

### Phase 2 — backfill

A one-shot migration mutation iterates every `locations` row in batches and, for each:

1. If the location has no `locationSchedules` row yet, insert one with `dayOfWeek` = the location's legacy value, `startTime` = the legacy value, `endTime` undefined.
2. For every `gameDays` row at that location (looked up via `by_location`), patch in `scheduleId` pointing at the newly-inserted schedule.

The migration is idempotent: re-running skips locations that already have a schedule. Batch size and self-rescheduling follow the standard `@convex-dev/migrations` pattern.

### Phase 3 — code switchover

Swap every read and write path to the new shape (queries return `schedules: []`, mutations take `scheduleId`, the submit form sends a `schedules` array, the location detail page fans out per slot, etc.). All of this ships in one deploy. Until this phase, the old code paths keep working because the legacy fields are still readable.

### Phase 4 — narrow

- Make `gameDays.scheduleId` required.
- Drop `dayOfWeek` and `startTime` from `locations`.
- Drop the `by_location_and_date` index on `gameDays`.
- Deploy.

Rollback: between phases 2 and 4 the schema is wide enough to revert phase 3's code without touching data. Once phase 4 narrows the schema, rollback requires reintroducing the legacy fields and re-deriving them from the first schedule per location.

## Frontend

### Submit form (`app/submit/SubmitForm.tsx`)

The "When" step becomes a list of `{dayOfWeek, startTime, endTime?}` rows. UX:

- One row visible by default, seeded with `{dayOfWeek: 1, startTime: "18:00"}` (same defaults as today).
- "Add another time" button below the list appends a row with the same defaults.
- Each row has a "×" remove button, disabled when only one row remains.
- The day-of-week pill group and start/end time inputs are the same controls already used today, just instanced per row.
- Validation: every row's `startTime` is required; `endTime`, when present, must be strictly later than `startTime`.

`Draft` shape changes:

```ts
type Draft = {
  name: string;
  town: string;
  address: string;
  lat: number | null;
  lng: number | null;
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime?: string }>;
  details: string;
};
```

The `sessionStorage` draft key stays the same; on hydration, a legacy single-slot draft (with `dayOfWeek`/`startTime`) is upcast to a one-element `schedules` array.

### Location detail page (`app/locations/[id]/LocationDetail.tsx`)

The single "When" card becomes a vertical list — one card per schedule with day + time range, status chip (game on this week / cancelled with reason), and a "Last session" subsection inline.

Hero gradient logic:

- Green (status: at least one upcoming slot is on) if any schedule has `thisWeek.isOn !== false`.
- Amber (all upcoming slots cancelled) only when every schedule's `thisWeek.isOn === false`.

The status pill in the hero summarizes: "Game on this week" / "All cancelled this week" / "Some cancelled this week" (mixed state).

### NextUpGame card (`app/_components/NextUpGame.tsx`)

`pickNext` flattens locations × schedules into `(location, schedule, thisWeek)` triples and sorts by `(thisWeek.date, schedule.startTime, isOn, name)`. The card renders the field name + the picked slot's day/time. The `NextLocation` type moves to `NextSlot` shape.

### List / map (`app/_components/LocationsTable.tsx`, `LocationsMap.tsx`, pins)

- One row / pin per location.
- The "when" cell renders a chip per schedule: "Tue 6–8 PM", "Thu 6 PM".
- When a day filter is active, matching chips are highlighted; non-matching chips dim.
- Pin popovers list every slot with its own status indicator.

### Filters (`app/_components/Filters.tsx`)

No UI change. The query already exposes a day filter; the server enforces match-any.

### Account / location edit

- The account location page (`app/account/locations/[id]`) renders one status form + one recap form per schedule.
- The edit form gains the same multi-slot row editor from the submit form, wired to `owner.setSchedules`.

### Admin "view as user" preview

No special work — it renders the same components as the public site, which already absorb the new shape.

### Forms reused

`StatusForm.tsx` and `RecapForm.tsx` gain a `scheduleId` prop and call the new schedule-scoped mutations. The hero/decoration is unchanged.

## Testing

- Convex function tests (`convex-test`): submitting a location with N schedules creates N rows; `setSchedules` correctly diffs (add/remove/keep); `setScheduleStatus` and `saveScheduleRecap` upsert per `(scheduleId, date)`; `deleteLocation` cascades through schedules.
- Date helper tests already exist for `upcomingGameDay` and `mostRecentPastGameDay`; no new cases needed.
- Frontend: manual verification of the submit form's multi-row "When" step, the multi-slot location detail page, the next-up card picking the soonest slot across schedules, and the day filter highlighting only matching chips.
- Backfill: a `convex-test` case that seeds a few legacy `locations` + `gameDays` rows, runs the backfill, and asserts every gameDay has a `scheduleId` and every location has exactly one schedule with the migrated `dayOfWeek`/`startTime`.

## Open items punted to the plan

- Whether `setSchedules` should hard-stop or soft-warn when removing a slot that has historical `gameDays` rows. Default: silent (history is preserved on the schedule row even if the slot is removed; the UI just stops surfacing it).
- Soft cap on slots per location in the submit form. Default: 5, soft (a friendly warning above the threshold rather than a block).
- Whether the location detail's recap section shows every slot's history or only the most-recent-per-slot. Default: most-recent-per-slot, matching today's behavior.
