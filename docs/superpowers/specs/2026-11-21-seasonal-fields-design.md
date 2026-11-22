# Seasonal fields — Design

**Date:** 2026-11-21
**Status:** Approved (whole-field season; implementer's picks for the rest)
**Revisits:** the "Seasonality / per-slot pause" non-goal in `2026-05-18-location-schedules-design.md`.

## Why

Many Vermont pickup games only run part of the year (outdoor fields April–October,
indoor futsal October–April). Today every weekly slot repeats all year, so the
directory says "Game on this week" for a park that is under snow. The only
workaround is deleting the slot in the fall and re-adding it in the spring.

## Goals

- A field is either **year-round** (default) or **seasonal**.
- A seasonal field has a start and an end, picked by **month** (April → October)
  or, optionally, **exact days** (April 15 → October 31). The season repeats
  every year; no year is stored.
- Seasons may wrap the new year (October → April).
- Out of season, the field stays listed but reads "Off-season · back <date>",
  drops out of Next Up and "Game on this week", and owners can't cancel or
  recap out-of-season weeks.

## Non-goals

- Per-slot seasons (decided: the season belongs to the whole field).
- One-off date ranges for a single year, blackout weeks, or holiday skips. Single
  weeks are still cancelled through the weekly status.
- Hiding off-season fields from the directory or the day filter.

## Approaches considered

1. **Season on the field (chosen).** One optional `season` on `locations`.
   One control in the "When" section. Covers the common case; summer/winter
   venues are already separate fields.
2. **Season on each weekly slot.** Handles "Tuesdays all year, Saturdays only in
   summer" at one venue, but puts more controls on every slot card on a phone
   for a rare case.
3. **Delete/re-add slots (status quo).** No build, but owners must remember to
   do it twice a year and history looks like gaps.

## Data model

`locations.season`: optional

```ts
season?: {
  start: { month: number; day?: number }; // month 1–12
  end:   { month: number; day?: number };
}
```

- Absent = year-round. No migration: existing rows are year-round.
- `day` absent on `start` = 1st of the month; absent on `end` = last day of the
  month (February counts as 29 so leap years are covered).
- Keeping month-only vs exact-day distinct lets the UI display "April – October"
  rather than "April 1 – October 31", and restore the editor state.

## Season logic (`convex/lib/season.ts`, pure, shared with the client)

- `isInSeason(date, season)`: compare the date's `MM-DD` against the start/end
  keys; when start > end the season wraps the year.
- `validateSeason(season)`: integer months 1–12, integer days within the month.
- `nextInSeasonDate(fromDate, season)` / `lastInSeasonDate(fromDate, season)`:
  step a weekly game date forward/back by 7 days (bounded) to the nearest
  in-season occurrence.

## Reads

Per slot, `thisWeek` gains `inSeason: boolean` (is the upcoming occurrence in
season). Per location, public/owner reads add:

- `season: Season | null`
- `offSeason: boolean` — seasonal and every slot's upcoming occurrence is out of
  season.
- `resumesOn: string | null` — earliest in-season occurrence across slots
  ("back Tue, Apr 7"), only when off-season.

## Writes

- `submissions.submitLocation` accepts optional `season`.
- `owner.setSchedules` / `admin.adminSetSchedules` accept
  `season?: Season | null` (absent = unchanged, null = year-round). Optional so
  clients that predate this keep working across the Convex-first deploy.
- `setScheduleStatus` (owner + admin) rejects an out-of-season week.
- `saveScheduleRecap` (owner + admin) targets the most recent **in-season** past
  game, so the last game of the season can still be recapped in November.

## UI

- `SeasonPicker` in the shared slots section (submit wizard "When" step, owner
  and admin edit): a "Seasonal" checkbox; when checked, Starts/Ends month
  selects (native, for the phone wheel picker), an "Exact days" checkbox that
  adds day selects, and a one-line summary ("Runs April – October every year").
  Turning seasonal on defaults to April → October.
- Location detail: off-season hero (neutral gradient, "Off-season · back …"),
  per-slot "Off-season" chip, and a "Season: April – October" line.
- Directory table, map popups: "Off-season" status instead of On/Off.
- Next Up: skips out-of-season slots.
- Owner/admin "This week": out-of-season slots show a note instead of the
  toggle. Admin review shows the season.

## Mobile + drawer (same change set)

- Inputs, selects and textareas render at 16px on touch screens so iOS stops
  zooming on focus.
- The installed app's More sheet slides up from the bottom (and back down),
  replacing the global fade/zoom.
- Screenshot audit of admin + submit screens at 390px in browser and installed
  modes; fix overflow, cramped controls and small tap targets found there.

## Testing

- Unit: `isInSeason` (plain, wrapping, exact days, month-only end, Feb 29),
  `validateSeason`, next/last in-season stepping.
- Convex: setSchedules sets/clears season; status rejects out-of-season week;
  recap targets last in-season game; public read reports `offSeason`/`resumesOn`.
- Manual: phone-width screenshots of the season picker and off-season views.
