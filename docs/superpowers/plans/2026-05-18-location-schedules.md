# Multi-slot locations via `locationSchedules` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-location `dayOfWeek` + `startTime` pair with a child `locationSchedules` table so a single field can host multiple weekly slots, each with its own cancellation state and recap history.

**Architecture:** Widen → backfill → narrow migration. Widen makes the new table exist alongside the legacy fields; backfill creates one schedule per location and patches every existing `gameDays` row with its `scheduleId`; the code switchover (which is most of the plan) repoints every read/write through the new shape; narrow removes the legacy fields. `gameDays` keys on `(scheduleId, date)` post-migration; `locationId` stays on `gameDays` as a cheap denormalized field for the "all sessions at this field" pull.

**Tech Stack:** Next.js 16 App Router (React 19), Convex 1.36 (no `@convex-dev/migrations` — we hand-roll the backfill as a self-scheduling internal mutation per `convex/_generated/ai/guidelines.md`), Vitest (pure-logic + `convex-test`), Tailwind, GSAP for animations, react-leaflet for the map.

**Reference spec:** `docs/superpowers/specs/2026-05-18-location-schedules-design.md`.

**Working directory:** All paths are relative to `/Users/tyallembert/Development/projects/pickup-soccer`. Run commands from that directory.

**Conventions:**
- Each task ends with a commit. Conventional-Commits-style messages. Direct commits to `main` are pre-approved by the user.
- Pure logic is verified by Vitest; Convex functions by `convex-test` (set up in `vitest.config.ts` already); UI changes by running `npm run dev` and exercising the feature in a browser.
- Whenever Convex code is touched, read `convex/_generated/ai/guidelines.md` first if you haven't this session — it overrides training-data Convex patterns.

**Pre-flight check (do once before Task 1):**

- [ ] **P.1: Read the spec.**

  Read `docs/superpowers/specs/2026-05-18-location-schedules-design.md` end to end. The plan below assumes its terminology and decisions.

- [ ] **P.2: Confirm baseline tests pass.**

  ```bash
  npm test
  ```
  Expected: green (or "no tests" — the project currently has `dates.test.ts` and possibly others).

- [ ] **P.3: Confirm `convex-test` is wired up.**

  Read `vitest.config.ts` (one file). Confirm `environment: "edge-runtime"` is set. If it isn't, install `@edge-runtime/vm` and `convex-test` per the Convex testing guidelines and add the environment line. The current project already has a `dates.test.ts` file — if that file passes today, the wiring is fine.

---

## Phase 1 — Widen schema

### Task 1: Add `locationSchedules` table and optional `scheduleId` on `gameDays`

**Files:**
- Modify: `convex/schema.ts`

**Steps:**

- [ ] **Step 1.1: Add the new table and update `gameDays`.**

  Edit `convex/schema.ts`. Within the `defineSchema({ ... })` block:

  1. Make `dayOfWeek` and `startTime` on `locations` optional. Replace the two lines:
     ```ts
     dayOfWeek: v.number(),
     startTime: v.string(),
     ```
     with:
     ```ts
     dayOfWeek: v.optional(v.number()),
     startTime: v.optional(v.string()),
     ```

  2. Add `scheduleId` to `gameDays` as optional, and add a new index. The `gameDays` block becomes:
     ```ts
     gameDays: defineTable({
       locationId: v.id("locations"),
       scheduleId: v.optional(v.id("locationSchedules")),
       date: v.string(),
       isOn: v.optional(v.boolean()),
       reason: v.optional(v.string()),
       turnout: v.optional(v.number()),
       weatherCondition: v.optional(weatherCondition),
       weather: v.optional(v.string()),
       recapNotes: v.optional(v.string()),
     })
       .index("by_location_and_date", ["locationId", "date"])
       .index("by_location", ["locationId"])
       .index("by_schedule_and_date", ["scheduleId", "date"]),
     ```
     (Both old indexes stay during the widen phase — they'll be used by legacy code paths until we narrow.)

  3. Add a new table after `locations` (before `gameDays` is fine too — order is irrelevant):
     ```ts
     locationSchedules: defineTable({
       locationId: v.id("locations"),
       dayOfWeek: v.number(),
       startTime: v.string(),
       endTime: v.optional(v.string()),
     })
       .index("by_location", ["locationId"])
       .index("by_dayOfWeek", ["dayOfWeek"]),
     ```

- [ ] **Step 1.2: Push the schema and confirm no validation errors.**

  ```bash
  npx convex dev --once --typecheck disable
  ```
  Expected: schema deploys cleanly. If Convex complains about existing data, the existing `locations` rows have non-optional `dayOfWeek`/`startTime` — making them optional is purely a widening change and should not fail.

- [ ] **Step 1.3: Commit.**

  ```bash
  git add convex/schema.ts
  git commit -m "feat(schema): widen for locationSchedules child table

  Add locationSchedules table, optional scheduleId on gameDays, and make
  the legacy dayOfWeek/startTime on locations optional so the backfill
  migration can run without breaking existing code paths."
  ```

---

## Phase 2 — Backfill migration

### Task 2: Self-scheduling backfill mutation

**Files:**
- Create: `convex/migrations/locationSchedules.ts`
- Test: `convex/migrations/locationSchedules.test.ts`

**Background:** The migration is one `internalMutation` that processes one batch per invocation, then schedules itself to run again with the next cursor. Each batch:

1. Reads up to `BATCH` (= 25) locations that don't yet have a `locationSchedules` row.
2. For each such location: insert one schedule from its legacy `dayOfWeek`/`startTime`; then walk the location's `gameDays` rows via `by_location` and patch each with the new `scheduleId`.
3. If anything was processed, schedules itself for another run via `ctx.scheduler.runAfter(0, ...)`. Otherwise stops.

A location is "done" iff at least one `locationSchedules` row exists for it. That makes the migration idempotent: re-running it is a no-op once everything has converged.

**Steps:**

- [ ] **Step 2.1: Write the failing test.**

  Create `convex/migrations/locationSchedules.test.ts`:

  ```ts
  /// <reference types="vite/client" />
  import { convexTest } from "convex-test";
  import { expect, test } from "vitest";
  import { internal } from "../_generated/api";
  import schema from "../schema";
  import type { Id } from "../_generated/dataModel";

  const modules = import.meta.glob("../**/*.ts");

  test("backfill creates one schedule per location and patches gameDays", async () => {
    const t = convexTest(schema, modules);

    // Seed: a user, two legacy locations, two legacy gameDays at each.
    const { userA, locA, locB } = await t.run(async (ctx) => {
      const userA = await ctx.db.insert("users", {
        email: "a@example.com",
        role: "user",
      });
      const locA = await ctx.db.insert("locations", {
        name: "Field A",
        town: "Burlington",
        address: "1 A St",
        lat: 44.5,
        lng: -73.2,
        dayOfWeek: 1,
        startTime: "18:00",
        details: "",
        ownerId: userA,
        status: "approved" as const,
        submittedAt: Date.now(),
      });
      const locB = await ctx.db.insert("locations", {
        name: "Field B",
        town: "Montpelier",
        address: "1 B St",
        lat: 44.25,
        lng: -72.5,
        dayOfWeek: 4,
        startTime: "19:00",
        details: "",
        ownerId: userA,
        status: "approved" as const,
        submittedAt: Date.now(),
      });
      await ctx.db.insert("gameDays", {
        locationId: locA,
        date: "2026-05-04",
        isOn: false,
        reason: "rain",
      });
      await ctx.db.insert("gameDays", {
        locationId: locA,
        date: "2026-05-11",
        turnout: 12,
      });
      await ctx.db.insert("gameDays", {
        locationId: locB,
        date: "2026-05-07",
        turnout: 8,
      });
      return { userA, locA, locB };
    });

    // Run the migration to completion. The mutation reschedules itself, so
    // poll until no more pending scheduler items target it.
    await t.mutation(internal.migrations.locationSchedules.runBackfill, {});
    await t.finishAllScheduledFunctions(() => Promise.resolve());

    // Each location now has exactly one schedule with the migrated values.
    const { schedules, gameDays } = await t.run(async (ctx) => {
      const schedules = await ctx.db.query("locationSchedules").collect();
      const gameDays = await ctx.db.query("gameDays").collect();
      return { schedules, gameDays };
    });

    expect(schedules).toHaveLength(2);
    const aSched = schedules.find((s) => s.locationId === locA)!;
    const bSched = schedules.find((s) => s.locationId === locB)!;
    expect(aSched.dayOfWeek).toBe(1);
    expect(aSched.startTime).toBe("18:00");
    expect(aSched.endTime).toBeUndefined();
    expect(bSched.dayOfWeek).toBe(4);
    expect(bSched.startTime).toBe("19:00");

    // Every gameDay has a scheduleId pointing at the right schedule.
    expect(gameDays).toHaveLength(3);
    for (const gd of gameDays) {
      const expected = gd.locationId === locA ? aSched._id : bSched._id;
      expect(gd.scheduleId).toBe(expected);
    }
  });

  test("backfill is idempotent", async () => {
    const t = convexTest(schema, modules);
    const { loc, sched } = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", { email: "z@z.com", role: "user" });
      const loc = await ctx.db.insert("locations", {
        name: "Field Z",
        town: "Stowe",
        address: "1 Z St",
        lat: 44.4,
        lng: -72.7,
        dayOfWeek: 2,
        startTime: "17:30",
        details: "",
        ownerId: user,
        status: "approved" as const,
        submittedAt: Date.now(),
      });
      const sched = await ctx.db.insert("locationSchedules", {
        locationId: loc,
        dayOfWeek: 2,
        startTime: "17:30",
      });
      return { loc, sched };
    });

    await t.mutation(internal.migrations.locationSchedules.runBackfill, {});
    await t.finishAllScheduledFunctions(() => Promise.resolve());

    const schedules = await t.run((ctx) =>
      ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", loc))
        .collect(),
    );
    expect(schedules).toHaveLength(1);
    expect(schedules[0]._id).toBe(sched);
  });
  ```

- [ ] **Step 2.2: Run the test to verify it fails.**

  ```bash
  npm test -- convex/migrations/locationSchedules.test.ts
  ```
  Expected: FAIL — `internal.migrations.locationSchedules.runBackfill` is not exported yet.

- [ ] **Step 2.3: Implement the migration.**

  Create `convex/migrations/locationSchedules.ts`:

  ```ts
  import { v } from "convex/values";
  import { internalMutation } from "../_generated/server";
  import { internal } from "../_generated/api";

  const BATCH = 25;

  // One-shot backfill that creates a single locationSchedules row per legacy
  // location (using its dayOfWeek + startTime) and stamps every existing
  // gameDays row at that location with the new scheduleId. Idempotent:
  // re-running skips locations that already have a schedule. Self-schedules
  // until no more locations need processing.
  export const runBackfill = internalMutation({
    args: {},
    handler: async (ctx) => {
      const locations = await ctx.db.query("locations").take(BATCH * 4);
      let processed = 0;

      for (const loc of locations) {
        const existing = await ctx.db
          .query("locationSchedules")
          .withIndex("by_location", (q) => q.eq("locationId", loc._id))
          .first();
        if (existing) continue;

        if (loc.dayOfWeek === undefined || loc.startTime === undefined) {
          // A location with no legacy schedule fields and no new schedules
          // shouldn't exist in practice. Skip rather than crash.
          continue;
        }

        const scheduleId = await ctx.db.insert("locationSchedules", {
          locationId: loc._id,
          dayOfWeek: loc.dayOfWeek,
          startTime: loc.startTime,
        });

        const days = await ctx.db
          .query("gameDays")
          .withIndex("by_location", (q) => q.eq("locationId", loc._id))
          .take(1000);
        for (const d of days) {
          if (d.scheduleId) continue;
          await ctx.db.patch(d._id, { scheduleId });
        }

        processed += 1;
        if (processed >= BATCH) break;
      }

      if (processed === BATCH) {
        await ctx.scheduler.runAfter(
          0,
          internal.migrations.locationSchedules.runBackfill,
          {},
        );
      }

      return { processed };
    },
  });
  ```

- [ ] **Step 2.4: Run the tests to verify they pass.**

  ```bash
  npm test -- convex/migrations/locationSchedules.test.ts
  ```
  Expected: both tests PASS.

- [ ] **Step 2.5: Commit.**

  ```bash
  git add convex/migrations/locationSchedules.ts convex/migrations/locationSchedules.test.ts
  git commit -m "feat(convex): backfill mutation for locationSchedules

  Self-scheduling internalMutation that gives every existing location one
  locationSchedules row from its legacy dayOfWeek+startTime and patches
  the location's gameDays rows with the new scheduleId. Idempotent so it
  can be re-run safely."
  ```

- [ ] **Step 2.6: Run the backfill on the dev deployment.**

  ```bash
  npx convex run migrations/locationSchedules:runBackfill
  ```
  Expected: returns `{ processed: <N> }`. Re-run; the second call should return `{ processed: 0 }`. Verify in the dashboard that every `locations` row now has exactly one `locationSchedules` row and every `gameDays` row has a `scheduleId`.

  **Do not skip this step.** Subsequent backend tasks assume the backfill has run on dev.

---

## Phase 3a — Backend reshape

Every task in this phase routes through the new `scheduleId`-keyed shape. The legacy fields stay on `locations` until Phase 4 so we can ship one task at a time without breaking deployed code mid-flight.

### Task 3: Fan out `public.listLocations` and `getLocation` per schedule

**Files:**
- Modify: `convex/public.ts`
- Test: `convex/public.test.ts` (new)

**Steps:**

- [ ] **Step 3.1: Write the failing test.**

  Create `convex/public.test.ts`:

  ```ts
  /// <reference types="vite/client" />
  import { convexTest } from "convex-test";
  import { expect, test } from "vitest";
  import { api } from "./_generated/api";
  import schema from "./schema";

  const modules = import.meta.glob("./**/*.ts");

  test("listLocations returns one entry per location with a schedules array", async () => {
    const t = convexTest(schema, modules);
    const { locA } = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", { email: "a@a.com", role: "user" });
      const locA = await ctx.db.insert("locations", {
        name: "Two-slot field",
        town: "Burlington",
        address: "1 Main",
        lat: 44.5,
        lng: -73.2,
        details: "",
        ownerId: user,
        status: "approved" as const,
        submittedAt: Date.now(),
      });
      await ctx.db.insert("locationSchedules", {
        locationId: locA,
        dayOfWeek: 2,
        startTime: "18:00",
        endTime: "20:00",
      });
      await ctx.db.insert("locationSchedules", {
        locationId: locA,
        dayOfWeek: 4,
        startTime: "18:00",
      });
      return { locA };
    });

    const result = await t.query(api.public.listLocations, {});
    expect(result).toHaveLength(1);
    const loc = result[0];
    expect(loc._id).toBe(locA);
    expect(loc.schedules).toHaveLength(2);
    expect(loc.schedules[0].dayOfWeek).toBe(2);
    expect(loc.schedules[0].endTime).toBe("20:00");
    expect(loc.schedules[1].dayOfWeek).toBe(4);
    expect(loc.schedules[1].endTime).toBeUndefined();
    // Per-schedule thisWeek defaults to isOn: true when no gameDays row exists.
    expect(loc.schedules[0].thisWeek.isOn).toBe(true);
    expect(loc.schedules[0].lastSession).toBeNull();
  });

  test("dayOfWeek filter is match-any across schedules", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", { email: "b@b.com", role: "user" });
      const loc = await ctx.db.insert("locations", {
        name: "Tue+Thu field",
        town: "Burlington",
        address: "1 X",
        lat: 44.5,
        lng: -73.2,
        details: "",
        ownerId: user,
        status: "approved" as const,
        submittedAt: Date.now(),
      });
      await ctx.db.insert("locationSchedules", {
        locationId: loc,
        dayOfWeek: 2,
        startTime: "18:00",
      });
      await ctx.db.insert("locationSchedules", {
        locationId: loc,
        dayOfWeek: 4,
        startTime: "18:00",
      });
      // Plus a Tuesday-only field
      const loc2 = await ctx.db.insert("locations", {
        name: "Tue-only field",
        town: "Stowe",
        address: "2 X",
        lat: 44.4,
        lng: -72.7,
        details: "",
        ownerId: user,
        status: "approved" as const,
        submittedAt: Date.now(),
      });
      await ctx.db.insert("locationSchedules", {
        locationId: loc2,
        dayOfWeek: 2,
        startTime: "18:00",
      });
    });

    // Tuesday filter (dayOfWeek=2) — both fields should appear.
    const tue = await t.query(api.public.listLocations, { dayOfWeek: 2 });
    expect(tue.map((l) => l.name).sort()).toEqual(["Tue+Thu field", "Tue-only field"]);

    // Thursday filter (dayOfWeek=4) — only the multi-slot field appears.
    const thu = await t.query(api.public.listLocations, { dayOfWeek: 4 });
    expect(thu.map((l) => l.name)).toEqual(["Tue+Thu field"]);
  });
  ```

- [ ] **Step 3.2: Run the test to verify it fails.**

  ```bash
  npm test -- convex/public.test.ts
  ```
  Expected: FAIL — the current `listLocations` returns flat `dayOfWeek`/`startTime`, not `schedules`.

- [ ] **Step 3.3: Rewrite `buildPublicLocation` and `listLocations`.**

  Replace the contents of `convex/public.ts`:

  ```ts
  import { v } from "convex/values";
  import { query } from "./_generated/server";
  import { ConvexError } from "convex/values";
  import { todayInTimezone, upcomingGameDay } from "./lib/dates";
  import type { Doc, Id } from "./_generated/dataModel";
  import type { QueryCtx } from "./_generated/server";
  import { getAuthUserId } from "@convex-dev/auth/server";
  import { requireAuth, requireOwnerOf } from "./lib/auth";

  type ScheduleView = {
    _id: Id<"locationSchedules">;
    dayOfWeek: number;
    startTime: string;
    endTime?: string;
    thisWeek: { date: string; isOn: boolean; reason?: string };
    lastSession:
      | {
          date: string;
          turnout?: number;
          weatherCondition?: Doc<"gameDays">["weatherCondition"];
          weather?: string;
          recapNotes?: string;
        }
      | null;
  };

  type PublicLocation = {
    _id: Id<"locations">;
    name: string;
    town: string;
    address: string;
    lat: number;
    lng: number;
    details: string;
    schedules: ScheduleView[];
  };

  function hasRecap(r: Doc<"gameDays">): boolean {
    return (
      r.turnout !== undefined ||
      r.weatherCondition !== undefined ||
      r.weather !== undefined ||
      r.recapNotes !== undefined
    );
  }

  async function buildSchedulesForLocation(
    ctx: QueryCtx,
    locationId: Id<"locations">,
    now: Date,
  ): Promise<ScheduleView[]> {
    const schedules = await ctx.db
      .query("locationSchedules")
      .withIndex("by_location", (q) => q.eq("locationId", locationId))
      .collect();

    // Pull recent gameDays once per location and partition in memory.
    const recentRows = await ctx.db
      .query("gameDays")
      .withIndex("by_location", (q) => q.eq("locationId", locationId))
      .order("desc")
      .take(50);
    const today = todayInTimezone(now);

    return Promise.all(
      schedules.map(async (s) => {
        const upcomingDate = upcomingGameDay(now, s.dayOfWeek, s.startTime);
        const upcomingRow = await ctx.db
          .query("gameDays")
          .withIndex("by_schedule_and_date", (q) =>
            q.eq("scheduleId", s._id).eq("date", upcomingDate),
          )
          .unique();

        const lastRow = recentRows.find(
          (r) => r.scheduleId === s._id && r.date < today && hasRecap(r),
        );
        const isOn = upcomingRow?.isOn ?? true;

        return {
          _id: s._id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          thisWeek: {
            date: upcomingDate,
            isOn,
            reason: isOn ? undefined : upcomingRow?.reason,
          },
          lastSession: lastRow
            ? {
                date: lastRow.date,
                turnout: lastRow.turnout,
                weatherCondition: lastRow.weatherCondition,
                weather: lastRow.weather,
                recapNotes: lastRow.recapNotes,
              }
            : null,
        };
      }),
    );
  }

  async function buildPublicLocation(
    ctx: QueryCtx,
    loc: Doc<"locations">,
    now: Date,
  ): Promise<PublicLocation> {
    const schedules = await buildSchedulesForLocation(ctx, loc._id, now);
    return {
      _id: loc._id,
      name: loc.name,
      town: loc.town,
      address: loc.address,
      lat: loc.lat,
      lng: loc.lng,
      details: loc.details,
      schedules,
    };
  }

  export const listLocations = query({
    args: {
      search: v.optional(v.string()),
      town: v.optional(v.string()),
      dayOfWeek: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
      const now = new Date();
      let rows: Doc<"locations">[];
      if (args.town) {
        rows = await ctx.db
          .query("locations")
          .withIndex("by_status_and_town", (q) =>
            q.eq("status", "approved").eq("town", args.town!),
          )
          .take(200);
      } else {
        rows = await ctx.db
          .query("locations")
          .withIndex("by_status", (q) => q.eq("status", "approved"))
          .take(200);
      }

      if (args.search) {
        const needle = args.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            r.town.toLowerCase().includes(needle),
        );
      }

      const built = await Promise.all(
        rows.map((r) => buildPublicLocation(ctx, r, now)),
      );

      if (args.dayOfWeek !== undefined) {
        return built.filter((l) =>
          l.schedules.some((s) => s.dayOfWeek === args.dayOfWeek),
        );
      }
      return built;
    },
  });

  export const getLocation = query({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => {
      const loc = await ctx.db.get(id);
      if (!loc || loc.status !== "approved") {
        throw new ConvexError("Location not found");
      }
      return buildPublicLocation(ctx, loc, new Date());
    },
  });

  export const distinctTowns = query({
    args: {},
    handler: async (ctx) => {
      const rows = await ctx.db
        .query("locations")
        .withIndex("by_status", (q) => q.eq("status", "approved"))
        .take(500);
      const towns = new Set(rows.map((r) => r.town));
      return Array.from(towns).sort();
    },
  });

  export const me = query({
    args: {},
    handler: async (ctx) => {
      const userId = await getAuthUserId(ctx);
      if (userId === null) return null;
      const user = await ctx.db.get(userId);
      if (!user) return null;
      return { _id: user._id, email: user.email ?? "", role: user.role ?? "user" };
    },
  });

  export const myLocations = query({
    args: {},
    handler: async (ctx) => {
      const user = await requireAuth(ctx);
      const rows = await ctx.db
        .query("locations")
        .withIndex("by_owner_and_status", (q) => q.eq("ownerId", user._id))
        .take(50);
      return Promise.all(
        rows.map(async (r) => {
          const schedules = await ctx.db
            .query("locationSchedules")
            .withIndex("by_location", (q) => q.eq("locationId", r._id))
            .collect();
          return {
            _id: r._id,
            name: r.name,
            town: r.town,
            status: r.status,
            rejectionReason: r.rejectionReason,
            submittedAt: r.submittedAt,
            schedules: schedules.map((s) => ({
              _id: s._id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
          };
        }),
      );
    },
  });

  export const getMyLocation = query({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => {
      const { location, role } = await requireOwnerOf(ctx, id);
      const now = new Date();
      const schedules =
        location.status === "approved"
          ? await buildSchedulesForLocation(ctx, location._id, now)
          : (
              await ctx.db
                .query("locationSchedules")
                .withIndex("by_location", (q) => q.eq("locationId", location._id))
                .collect()
            ).map<ScheduleView>((s) => ({
              _id: s._id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              thisWeek: { date: "", isOn: true },
              lastSession: null,
            }));
      return {
        ...location,
        schedules,
        viewerRole: role,
        viewerIsPrimaryOwner: role === "owner" || role === "admin",
      };
    },
  });
  ```

  Note: for pending/rejected locations, `getMyLocation` returns the schedules list with stub `thisWeek` and `lastSession` (the owner UI only renders those tabs for approved locations).

- [ ] **Step 3.4: Run the tests to verify they pass.**

  ```bash
  npm test -- convex/public.test.ts
  ```
  Expected: both tests PASS.

- [ ] **Step 3.5: Confirm TypeScript builds.**

  ```bash
  npx convex dev --once --typecheck enable
  ```
  Expected: type errors only in the frontend files we haven't migrated yet (e.g. `LocationDetail.tsx` reading `data.dayOfWeek`). Those will be fixed in Phase 3b. Errors in `convex/owner.ts`, `convex/admin.ts`, `convex/submissions.ts`, or `convex/maintainers.ts` are **not** acceptable yet — those should still compile because they only touch fields that are now optional on `locations` (they still call `loc.dayOfWeek!`-style access patterns indirectly). If any of those break, stop and re-read them.

- [ ] **Step 3.6: Commit.**

  ```bash
  git add convex/public.ts convex/public.test.ts
  git commit -m "feat(convex): fan out public reads per schedule

  listLocations, getLocation, getMyLocation, and myLocations now return a
  schedules array carrying per-slot thisWeek and lastSession. Day filter
  is match-any across a location's schedules."
  ```

### Task 4: Rework owner mutations to be schedule-scoped

**Files:**
- Modify: `convex/owner.ts`
- Test: `convex/owner.test.ts` (new)

**Steps:**

- [ ] **Step 4.1: Write the failing test.**

  Create `convex/owner.test.ts`:

  ```ts
  /// <reference types="vite/client" />
  import { convexTest } from "convex-test";
  import { expect, test } from "vitest";
  import { api } from "./_generated/api";
  import schema from "./schema";
  import type { Id } from "./_generated/dataModel";

  const modules = import.meta.glob("./**/*.ts");

  async function seedField(t: ReturnType<typeof convexTest>) {
    return t.run(async (ctx) => {
      const user = await ctx.db.insert("users", {
        email: "owner@x.com",
        role: "user",
      });
      const loc = await ctx.db.insert("locations", {
        name: "Multi field",
        town: "Burlington",
        address: "1 Main",
        lat: 44.5,
        lng: -73.2,
        details: "",
        ownerId: user,
        status: "approved" as const,
        submittedAt: Date.now(),
        approvedAt: Date.now(),
      });
      const tueId = await ctx.db.insert("locationSchedules", {
        locationId: loc,
        dayOfWeek: 2,
        startTime: "18:00",
      });
      const thuId = await ctx.db.insert("locationSchedules", {
        locationId: loc,
        dayOfWeek: 4,
        startTime: "18:00",
      });
      return { user, loc, tueId, thuId };
    });
  }

  test("setScheduleStatus upserts gameDays keyed by (scheduleId, date)", async () => {
    const t = convexTest(schema, modules);
    const { user, tueId, thuId, loc } = await seedField(t);
    const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });

    await asUser.mutation(api.owner.setScheduleStatus, {
      scheduleId: tueId,
      isOn: false,
      reason: "rain",
    });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("gameDays")
        .withIndex("by_location", (q) => q.eq("locationId", loc))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].scheduleId).toBe(tueId);
    expect(rows[0].isOn).toBe(false);
    expect(rows[0].reason).toBe("rain");
    // Thursday is untouched
    const thuRows = rows.filter((r) => r.scheduleId === thuId);
    expect(thuRows).toHaveLength(0);
  });

  test("setSchedules adds, updates, and removes slots while preserving _id", async () => {
    const t = convexTest(schema, modules);
    const { user, loc, tueId, thuId } = await seedField(t);
    const asUser = t.withIdentity({ subject: user, tokenIdentifier: user });

    // Edit Tue to 19:00 (same _id), drop Thu, add Sat.
    await asUser.mutation(api.owner.setSchedules, {
      id: loc,
      schedules: [
        { _id: tueId, dayOfWeek: 2, startTime: "19:00" },
        { dayOfWeek: 6, startTime: "10:00" },
      ],
    });

    const after = await t.run((ctx) =>
      ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", loc))
        .collect(),
    );
    expect(after).toHaveLength(2);
    const tue = after.find((s) => s._id === tueId)!;
    expect(tue.startTime).toBe("19:00");
    const sat = after.find((s) => s.dayOfWeek === 6)!;
    expect(sat.startTime).toBe("10:00");
    expect(after.find((s) => s._id === thuId)).toBeUndefined();
  });
  ```

- [ ] **Step 4.2: Run the test to verify it fails.**

  ```bash
  npm test -- convex/owner.test.ts
  ```
  Expected: FAIL — `api.owner.setScheduleStatus` and `api.owner.setSchedules` don't exist yet.

- [ ] **Step 4.3: Rewrite `convex/owner.ts`.**

  Replace the contents of `convex/owner.ts`:

  ```ts
  import { v } from "convex/values";
  import { mutation } from "./_generated/server";
  import { ConvexError } from "convex/values";
  import { requireOwnerOf } from "./lib/auth";
  import { mostRecentPastGameDay, upcomingGameDay } from "./lib/dates";
  import { weatherCondition } from "./schema";

  export const updateLocation = mutation({
    args: {
      id: v.id("locations"),
      name: v.optional(v.string()),
      town: v.optional(v.string()),
      address: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      details: v.optional(v.string()),
    },
    handler: async (ctx, { id, ...patch }) => {
      const { location } = await requireOwnerOf(ctx, id);
      await ctx.db.patch(location._id, patch);
      return null;
    },
  });

  export const setSchedules = mutation({
    args: {
      id: v.id("locations"),
      schedules: v.array(
        v.object({
          _id: v.optional(v.id("locationSchedules")),
          dayOfWeek: v.number(),
          startTime: v.string(),
          endTime: v.optional(v.string()),
        }),
      ),
    },
    handler: async (ctx, { id, schedules }) => {
      const { location } = await requireOwnerOf(ctx, id);
      if (schedules.length < 1) {
        throw new ConvexError("A location must have at least one schedule.");
      }

      const existing = await ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", location._id))
        .collect();
      const incomingIds = new Set(
        schedules.filter((s) => s._id).map((s) => s._id as string),
      );

      // Delete existing schedules that aren't in the incoming list.
      for (const e of existing) {
        if (!incomingIds.has(e._id)) {
          await ctx.db.delete(e._id);
        }
      }

      // Upsert each incoming schedule.
      for (const s of schedules) {
        if (s._id) {
          const row = await ctx.db.get(s._id);
          if (!row || row.locationId !== location._id) {
            throw new ConvexError("Schedule does not belong to this location.");
          }
          await ctx.db.patch(s._id, {
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        } else {
          await ctx.db.insert("locationSchedules", {
            locationId: location._id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }
      return null;
    },
  });

  export const setScheduleStatus = mutation({
    args: {
      scheduleId: v.id("locationSchedules"),
      isOn: v.boolean(),
      reason: v.optional(v.string()),
    },
    handler: async (ctx, { scheduleId, isOn, reason }) => {
      const schedule = await ctx.db.get(scheduleId);
      if (!schedule) throw new ConvexError("Schedule not found");
      const { location } = await requireOwnerOf(ctx, schedule.locationId);
      if (location.status !== "approved") {
        throw new ConvexError("Location must be approved before setting weekly status.");
      }
      const date = upcomingGameDay(new Date(), schedule.dayOfWeek, schedule.startTime);
      const existing = await ctx.db
        .query("gameDays")
        .withIndex("by_schedule_and_date", (q) =>
          q.eq("scheduleId", scheduleId).eq("date", date),
        )
        .unique();
      const patch = { isOn, reason: isOn ? undefined : reason };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("gameDays", {
          locationId: location._id,
          scheduleId,
          date,
          ...patch,
        });
      }
      return { date, isOn };
    },
  });

  export const saveScheduleRecap = mutation({
    args: {
      scheduleId: v.id("locationSchedules"),
      turnout: v.optional(v.union(v.number(), v.null())),
      weatherCondition: v.optional(v.union(weatherCondition, v.null())),
      weather: v.optional(v.union(v.string(), v.null())),
      recapNotes: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, { scheduleId, ...args }) => {
      const schedule = await ctx.db.get(scheduleId);
      if (!schedule) throw new ConvexError("Schedule not found");
      const { location } = await requireOwnerOf(ctx, schedule.locationId);
      if (location.status !== "approved") {
        throw new ConvexError("Location must be approved before writing a recap.");
      }
      const date = mostRecentPastGameDay(
        new Date(),
        schedule.dayOfWeek,
        schedule.startTime,
      );

      const patch: Record<string, unknown> = {};
      for (const key of [
        "turnout",
        "weatherCondition",
        "weather",
        "recapNotes",
      ] as const) {
        const value = args[key];
        if (value !== undefined) {
          patch[key] = value === null ? undefined : value;
        }
      }

      const existing = await ctx.db
        .query("gameDays")
        .withIndex("by_schedule_and_date", (q) =>
          q.eq("scheduleId", scheduleId).eq("date", date),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("gameDays", {
          locationId: location._id,
          scheduleId,
          date,
          ...patch,
        });
      }
      return { date };
    },
  });
  ```

  The legacy `setLocationStatus` and `saveRecap` exports are gone. Any frontend file still calling them will break until Phase 3b — which is the point.

- [ ] **Step 4.4: Run the tests to verify they pass.**

  ```bash
  npm test -- convex/owner.test.ts
  ```
  Expected: both tests PASS.

- [ ] **Step 4.5: Commit.**

  ```bash
  git add convex/owner.ts convex/owner.test.ts
  git commit -m "feat(convex): schedule-scoped owner mutations

  Replace setLocationStatus/saveRecap with setScheduleStatus/saveScheduleRecap
  (both keyed on scheduleId) and add setSchedules for diff-based slot list
  updates. updateLocation drops dayOfWeek/startTime from its args."
  ```

### Task 5: Update `submissions.submitLocation` to take a schedules array

**Files:**
- Modify: `convex/submissions.ts`
- Test: `convex/submissions.test.ts` (new)

**Steps:**

- [ ] **Step 5.1: Write the failing test.**

  Create `convex/submissions.test.ts`:

  ```ts
  /// <reference types="vite/client" />
  import { convexTest } from "convex-test";
  import { expect, test } from "vitest";
  import { api } from "./_generated/api";
  import schema from "./schema";

  const modules = import.meta.glob("./**/*.ts");

  test("submitLocation creates location and schedules in one mutation", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "u@x.com", role: "user" }),
    );
    const asUser = t.withIdentity({ subject: userId, tokenIdentifier: userId });

    const locId = await asUser.mutation(api.submissions.submitLocation, {
      name: "Two-slot park",
      town: "Burlington",
      address: "1 Main",
      lat: 44.5,
      lng: -73.2,
      details: "",
      schedules: [
        { dayOfWeek: 2, startTime: "18:00", endTime: "20:00" },
        { dayOfWeek: 4, startTime: "18:00" },
      ],
    });

    const { loc, schedules } = await t.run(async (ctx) => {
      const loc = await ctx.db.get(locId);
      const schedules = await ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", locId))
        .collect();
      return { loc, schedules };
    });
    expect(loc!.status).toBe("pending");
    expect(schedules).toHaveLength(2);
  });

  test("submitLocation rejects empty schedules", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "u@x.com", role: "user" }),
    );
    const asUser = t.withIdentity({ subject: userId, tokenIdentifier: userId });
    await expect(
      asUser.mutation(api.submissions.submitLocation, {
        name: "x",
        town: "x",
        address: "x",
        lat: 0,
        lng: 0,
        details: "",
        schedules: [],
      }),
    ).rejects.toThrow();
  });
  ```

- [ ] **Step 5.2: Run the test to verify it fails.**

  ```bash
  npm test -- convex/submissions.test.ts
  ```
  Expected: FAIL — `submitLocation` still expects flat `dayOfWeek`/`startTime`.

- [ ] **Step 5.3: Rewrite `convex/submissions.ts`.**

  Replace the contents:

  ```ts
  import { v } from "convex/values";
  import { mutation } from "./_generated/server";
  import { ConvexError } from "convex/values";
  import { requireAuth, requirePrimaryOwnerOf } from "./lib/auth";

  const MAX_NOT_YET_APPROVED = 3;

  export const submitLocation = mutation({
    args: {
      name: v.string(),
      town: v.string(),
      address: v.string(),
      lat: v.number(),
      lng: v.number(),
      details: v.string(),
      schedules: v.array(
        v.object({
          dayOfWeek: v.number(),
          startTime: v.string(),
          endTime: v.optional(v.string()),
        }),
      ),
    },
    handler: async (ctx, args) => {
      const user = await requireAuth(ctx);

      if (args.schedules.length < 1) {
        throw new ConvexError("A location must have at least one schedule.");
      }

      const pending = await ctx.db
        .query("locations")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", user._id).eq("status", "pending"),
        )
        .take(MAX_NOT_YET_APPROVED + 1);
      const rejected = await ctx.db
        .query("locations")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", user._id).eq("status", "rejected"),
        )
        .take(MAX_NOT_YET_APPROVED + 1);
      if (pending.length + rejected.length >= MAX_NOT_YET_APPROVED) {
        throw new ConvexError(
          "You have too many submissions awaiting review. Finish your existing ones first.",
        );
      }

      const { schedules, ...locArgs } = args;
      const id = await ctx.db.insert("locations", {
        ...locArgs,
        ownerId: user._id,
        status: "pending",
        submittedAt: Date.now(),
      });
      for (const s of schedules) {
        await ctx.db.insert("locationSchedules", {
          locationId: id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        });
      }
      return id;
    },
  });

  export const resubmitLocation = mutation({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => {
      const { location } = await requirePrimaryOwnerOf(ctx, id);
      if (location.status !== "rejected") {
        throw new ConvexError("Only rejected submissions can be resubmitted.");
      }
      await ctx.db.patch(location._id, {
        status: "pending",
        rejectionReason: undefined,
      });
      return null;
    },
  });
  ```

- [ ] **Step 5.4: Run the tests to verify they pass.**

  ```bash
  npm test -- convex/submissions.test.ts
  ```
  Expected: both tests PASS.

- [ ] **Step 5.5: Commit.**

  ```bash
  git add convex/submissions.ts convex/submissions.test.ts
  git commit -m "feat(convex): submitLocation accepts schedules array

  Drops the legacy dayOfWeek/startTime args and requires a schedules
  array with at least one entry. Schedules are inserted alongside the
  pending location in the same mutation."
  ```

### Task 6: Mirror the changes in `convex/admin.ts`

**Files:**
- Modify: `convex/admin.ts`

**Steps:**

- [ ] **Step 6.1: Rewrite `convex/admin.ts`.**

  Replace the contents:

  ```ts
  import { v } from "convex/values";
  import { query, mutation } from "./_generated/server";
  import { ConvexError } from "convex/values";
  import { requireAdmin } from "./lib/auth";
  import { mostRecentPastGameDay, upcomingGameDay } from "./lib/dates";
  import { locationStatus, weatherCondition } from "./schema";

  export const pendingLocations = query({
    args: {},
    handler: async (ctx) => {
      await requireAdmin(ctx);
      const rows = await ctx.db
        .query("locations")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .order("asc")
        .take(100);
      return Promise.all(
        rows.map(async (r) => {
          const owner = await ctx.db.get(r.ownerId);
          return {
            _id: r._id,
            name: r.name,
            town: r.town,
            ownerEmail: owner?.email ?? "",
            submittedAt: r.submittedAt,
          };
        }),
      );
    },
  });

  export const allLocations = query({
    args: { status: v.optional(locationStatus) },
    handler: async (ctx, { status }) => {
      await requireAdmin(ctx);
      const rows = status
        ? await ctx.db
            .query("locations")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(500)
        : await ctx.db.query("locations").take(500);
      return Promise.all(
        rows.map(async (r) => {
          const owner = await ctx.db.get(r.ownerId);
          return {
            _id: r._id,
            name: r.name,
            town: r.town,
            status: r.status,
            ownerEmail: owner?.email ?? "",
            submittedAt: r.submittedAt,
            approvedAt: r.approvedAt,
            rejectionReason: r.rejectionReason,
          };
        }),
      );
    },
  });

  export const adminGetLocation = query({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => {
      await requireAdmin(ctx);
      const loc = await ctx.db.get(id);
      if (!loc) return null;
      const owner = await ctx.db.get(loc.ownerId);
      const schedules = await ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", id))
        .collect();
      return {
        ...loc,
        ownerEmail: owner?.email ?? "",
        schedules: schedules.map((s) => ({
          _id: s._id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      };
    },
  });

  export const approveLocation = mutation({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => {
      await requireAdmin(ctx);
      const loc = await ctx.db.get(id);
      if (!loc) throw new ConvexError("Location not found");
      await ctx.db.patch(id, {
        status: "approved",
        approvedAt: Date.now(),
        rejectionReason: undefined,
      });
      return null;
    },
  });

  export const rejectLocation = mutation({
    args: { id: v.id("locations"), reason: v.string() },
    handler: async (ctx, { id, reason }) => {
      await requireAdmin(ctx);
      const loc = await ctx.db.get(id);
      if (!loc) throw new ConvexError("Location not found");
      await ctx.db.patch(id, { status: "rejected", rejectionReason: reason });
      return null;
    },
  });

  export const remoderateLocation = mutation({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => {
      await requireAdmin(ctx);
      await ctx.db.patch(id, {
        status: "pending",
        approvedAt: undefined,
        rejectionReason: undefined,
      });
      return null;
    },
  });

  export const deleteLocation = mutation({
    args: { id: v.id("locations") },
    handler: async (ctx, { id }) => {
      await requireAdmin(ctx);
      const days = await ctx.db
        .query("gameDays")
        .withIndex("by_location", (q) => q.eq("locationId", id))
        .take(1000);
      for (const d of days) await ctx.db.delete(d._id);
      const schedules = await ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", id))
        .take(1000);
      for (const s of schedules) await ctx.db.delete(s._id);
      const maintainers = await ctx.db
        .query("locationMaintainers")
        .withIndex("by_location_and_user", (q) => q.eq("locationId", id))
        .take(1000);
      for (const m of maintainers) await ctx.db.delete(m._id);
      await ctx.db.delete(id);
      return null;
    },
  });

  export const adminUpdateLocation = mutation({
    args: {
      id: v.id("locations"),
      name: v.optional(v.string()),
      town: v.optional(v.string()),
      address: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      details: v.optional(v.string()),
    },
    handler: async (ctx, { id, ...patch }) => {
      await requireAdmin(ctx);
      await ctx.db.patch(id, patch);
      return null;
    },
  });

  export const adminSetSchedules = mutation({
    args: {
      id: v.id("locations"),
      schedules: v.array(
        v.object({
          _id: v.optional(v.id("locationSchedules")),
          dayOfWeek: v.number(),
          startTime: v.string(),
          endTime: v.optional(v.string()),
        }),
      ),
    },
    handler: async (ctx, { id, schedules }) => {
      await requireAdmin(ctx);
      if (schedules.length < 1) {
        throw new ConvexError("A location must have at least one schedule.");
      }
      const existing = await ctx.db
        .query("locationSchedules")
        .withIndex("by_location", (q) => q.eq("locationId", id))
        .collect();
      const incomingIds = new Set(
        schedules.filter((s) => s._id).map((s) => s._id as string),
      );
      for (const e of existing) {
        if (!incomingIds.has(e._id)) await ctx.db.delete(e._id);
      }
      for (const s of schedules) {
        if (s._id) {
          const row = await ctx.db.get(s._id);
          if (!row || row.locationId !== id) {
            throw new ConvexError("Schedule does not belong to this location.");
          }
          await ctx.db.patch(s._id, {
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        } else {
          await ctx.db.insert("locationSchedules", {
            locationId: id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }
      return null;
    },
  });

  export const adminSetScheduleStatus = mutation({
    args: {
      scheduleId: v.id("locationSchedules"),
      isOn: v.boolean(),
      reason: v.optional(v.string()),
    },
    handler: async (ctx, { scheduleId, isOn, reason }) => {
      await requireAdmin(ctx);
      const schedule = await ctx.db.get(scheduleId);
      if (!schedule) throw new ConvexError("Schedule not found");
      const date = upcomingGameDay(new Date(), schedule.dayOfWeek, schedule.startTime);
      const existing = await ctx.db
        .query("gameDays")
        .withIndex("by_schedule_and_date", (q) =>
          q.eq("scheduleId", scheduleId).eq("date", date),
        )
        .unique();
      const patch = { isOn, reason: isOn ? undefined : reason };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("gameDays", {
          locationId: schedule.locationId,
          scheduleId,
          date,
          ...patch,
        });
      }
      return { date };
    },
  });

  export const adminSaveScheduleRecap = mutation({
    args: {
      scheduleId: v.id("locationSchedules"),
      turnout: v.optional(v.union(v.number(), v.null())),
      weatherCondition: v.optional(v.union(weatherCondition, v.null())),
      weather: v.optional(v.union(v.string(), v.null())),
      recapNotes: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, { scheduleId, ...args }) => {
      await requireAdmin(ctx);
      const schedule = await ctx.db.get(scheduleId);
      if (!schedule) throw new ConvexError("Schedule not found");
      const date = mostRecentPastGameDay(
        new Date(),
        schedule.dayOfWeek,
        schedule.startTime,
      );
      const patch: Record<string, unknown> = {};
      for (const key of [
        "turnout",
        "weatherCondition",
        "weather",
        "recapNotes",
      ] as const) {
        const value = args[key];
        if (value !== undefined) {
          patch[key] = value === null ? undefined : value;
        }
      }
      const existing = await ctx.db
        .query("gameDays")
        .withIndex("by_schedule_and_date", (q) =>
          q.eq("scheduleId", scheduleId).eq("date", date),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert("gameDays", {
          locationId: schedule.locationId,
          scheduleId,
          date,
          ...patch,
        });
      }
      return { date };
    },
  });
  ```

- [ ] **Step 6.2: Commit.**

  ```bash
  git add convex/admin.ts
  git commit -m "feat(convex): mirror schedule-scoped mutations in admin

  adminSetSchedules / adminSetScheduleStatus / adminSaveScheduleRecap
  replace the location-level mutations. adminGetLocation includes the
  schedules array. deleteLocation cascades through locationSchedules."
  ```

### Task 7: Update `convex/maintainers.myMaintainedLocations` to return schedules

**Files:**
- Modify: `convex/maintainers.ts`

**Steps:**

- [ ] **Step 7.1: Edit `myMaintainedLocations`.**

  Open `convex/maintainers.ts`. In `myMaintainedLocations` (the only function that exposes `dayOfWeek`/`startTime` on its return), replace the `results.push(...)` block with:

  ```ts
  const schedules = await ctx.db
    .query("locationSchedules")
    .withIndex("by_location", (q) => q.eq("locationId", loc._id))
    .collect();
  results.push({
    _id: loc._id,
    name: loc.name,
    town: loc.town,
    status: loc.status,
    schedules: schedules.map((s) => ({
      _id: s._id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  });
  ```

  And update the inferred `results` type at the top of the function. Replace the existing declaration:

  ```ts
  const results: Array<{
    _id: string;
    name: string;
    town: string;
    status: string;
    dayOfWeek: number;
    startTime: string;
  }> = [];
  ```

  with:

  ```ts
  const results: Array<{
    _id: string;
    name: string;
    town: string;
    status: string;
    schedules: Array<{
      _id: string;
      dayOfWeek: number;
      startTime: string;
      endTime?: string;
    }>;
  }> = [];
  ```

- [ ] **Step 7.2: Commit.**

  ```bash
  git add convex/maintainers.ts
  git commit -m "feat(convex): myMaintainedLocations returns schedules array"
  ```

---

## Phase 3b — Frontend reshape

Frontend tasks compile against the new backend shape. Run `npm run dev` at any point to spot-check; the dev server hot-reloads.

### Task 8: Add `formatTimeRange` to the format helpers

**Files:**
- Modify: `app/_lib/format.ts`
- Test: `app/_lib/format.test.ts` (new)

**Steps:**

- [ ] **Step 8.1: Write the failing test.**

  Create `app/_lib/format.test.ts`:

  ```ts
  import { describe, expect, test } from "vitest";
  import { formatTimeRange } from "./format";

  describe("formatTimeRange", () => {
    test("renders start–end when both present", () => {
      expect(formatTimeRange("18:00", "20:00")).toBe("6:00 PM – 8:00 PM");
    });
    test("falls back to 'starts X' without end", () => {
      expect(formatTimeRange("18:00")).toBe("starts 6:00 PM");
    });
    test("falls back to empty when start is missing", () => {
      expect(formatTimeRange("", "20:00")).toBe("");
    });
  });
  ```

- [ ] **Step 8.2: Run the test to verify it fails.**

  ```bash
  npm test -- app/_lib/format.test.ts
  ```
  Expected: FAIL — `formatTimeRange` not exported.

- [ ] **Step 8.3: Add `formatTimeRange` to `app/_lib/format.ts`.**

  Append to the file:

  ```ts
  export function formatTimeRange(
    start: string | null | undefined,
    end?: string | null,
  ) {
    const s = formatStartTime(start);
    if (!s) return "";
    const e = end ? formatStartTime(end) : "";
    return e ? `${s} – ${e}` : `starts ${s}`;
  }
  ```

- [ ] **Step 8.4: Run the test to verify it passes.**

  ```bash
  npm test -- app/_lib/format.test.ts
  ```
  Expected: PASS.

- [ ] **Step 8.5: Commit.**

  ```bash
  git add app/_lib/format.ts app/_lib/format.test.ts
  git commit -m "feat(format): add formatTimeRange helper

  Renders '6:00 PM – 8:00 PM' when end is present, 'starts 6:00 PM' when
  it isn't. Used by the multi-slot list/table/detail views."
  ```

### Task 9: Rewrite the submit form's "When" step to be multi-slot

**Files:**
- Modify: `app/submit/SubmitForm.tsx`

The Draft type and mutation call already need updating; the "When" step changes from a single day-pill + time pair to a repeating row group.

**Steps:**

- [ ] **Step 9.1: Update the `Draft` type and defaults.**

  In `app/submit/SubmitForm.tsx`, replace the `Draft` type and `EMPTY_DRAFT`:

  ```ts
  type ScheduleDraft = { dayOfWeek: number; startTime: string; endTime?: string };

  type Draft = {
    name: string;
    town: string;
    address: string;
    lat: number | null;
    lng: number | null;
    schedules: ScheduleDraft[];
    details: string;
  };

  const EMPTY_SCHEDULE: ScheduleDraft = { dayOfWeek: 1, startTime: "18:00" };

  const EMPTY_DRAFT: Draft = {
    name: "",
    town: "",
    address: "",
    lat: null,
    lng: null,
    schedules: [EMPTY_SCHEDULE],
    details: "",
  };
  ```

- [ ] **Step 9.2: Update `validateStep` for the When step.**

  Replace the `if (s === 2)` block:

  ```ts
  if (s === 2) {
    if (d.schedules.length === 0) return "Add at least one game time.";
    for (let i = 0; i < d.schedules.length; i++) {
      const row = d.schedules[i];
      if (!row.startTime) return `Slot ${i + 1}: pick a start time.`;
      if (row.endTime && row.endTime <= row.startTime) {
        return `Slot ${i + 1}: end time must be after the start time.`;
      }
    }
  }
  ```

- [ ] **Step 9.3: Migrate the sessionStorage hydration to upcast legacy drafts.**

  Replace the hydration `useEffect` body (the one that reads `STORAGE_KEY`) with:

  ```ts
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        // Legacy drafts had flat dayOfWeek/startTime. Upcast to schedules[].
        if (
          parsed &&
          !Array.isArray((parsed as { schedules?: unknown }).schedules) &&
          typeof (parsed as { dayOfWeek?: unknown }).dayOfWeek === "number" &&
          typeof (parsed as { startTime?: unknown }).startTime === "string"
        ) {
          const upcast: Draft = {
            ...(parsed as unknown as Omit<Draft, "schedules"> & {
              dayOfWeek: number;
              startTime: string;
            }),
            schedules: [
              {
                dayOfWeek: parsed.dayOfWeek as number,
                startTime: parsed.startTime as string,
              },
            ],
          };
          // Remove legacy fields off the upcast.
          delete (upcast as Record<string, unknown>).dayOfWeek;
          delete (upcast as Record<string, unknown>).startTime;
          setDraft(upcast);
        } else {
          setDraft(parsed as unknown as Draft);
        }
      } catch {
        // ignore corrupt draft
      }
    }
    setHydrated(true);
  }, []);
  ```

- [ ] **Step 9.4: Update `attemptSubmit` to pass `schedules` to the mutation.**

  Replace the mutation call (search for `submitMutation({`):

  ```ts
  const id = await submitMutation({
    name: d.name,
    town: d.town,
    address: d.address,
    lat: d.lat!,
    lng: d.lng!,
    details: d.details,
    schedules: d.schedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  });
  posthog.capture("location_submitted", {
    location_id: id,
    location_name: d.name,
    town: d.town,
    schedule_count: d.schedules.length,
  });
  ```

- [ ] **Step 9.5: Rewrite `WhenStep` as a list of rows.**

  Replace the existing `WhenStep` component:

  ```tsx
  function WhenStep() {
    const { draft, update } = useSubmitForm();
    const days = [
      { short: "S", full: "Sun" },
      { short: "M", full: "Mon" },
      { short: "T", full: "Tue" },
      { short: "W", full: "Wed" },
      { short: "T", full: "Thu" },
      { short: "F", full: "Fri" },
      { short: "S", full: "Sat" },
    ];

    const patchRow = (i: number, patch: Partial<ScheduleDraft>) => {
      const next = draft.schedules.slice();
      next[i] = { ...next[i], ...patch };
      update({ schedules: next });
    };
    const removeRow = (i: number) => {
      if (draft.schedules.length === 1) return;
      const next = draft.schedules.slice();
      next.splice(i, 1);
      update({ schedules: next });
    };
    const addRow = () =>
      update({ schedules: [...draft.schedules, { ...EMPTY_SCHEDULE }] });

    return (
      <div className="flex flex-col gap-6">
        {draft.schedules.map((row, i) => (
          <div
            key={i}
            className="relative rounded-2xl border border-zinc-200 bg-white/60 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">
                Slot {i + 1}
              </p>
              {draft.schedules.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label={`Remove slot ${i + 1}`}
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Day of week
                </span>
                <div
                  role="radiogroup"
                  aria-label={`Day of week for slot ${i + 1}`}
                  className="inline-flex w-full items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {days.map((d, di) => {
                    const active = row.dayOfWeek === di;
                    return (
                      <button
                        key={di}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => patchRow(i, { dayOfWeek: di })}
                        title={d.full}
                        className={cn(
                          "flex h-9 flex-1 select-none items-center justify-center rounded-full text-xs font-bold transition",
                          active
                            ? "bg-emerald-600 text-white shadow-[0_3px_10px_rgba(16,185,129,0.45)]"
                            : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800 dark:text-zinc-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200",
                        )}
                      >
                        <span className="sm:hidden">{d.short}</span>
                        <span className="hidden sm:inline">{d.full}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Start time">
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => patchRow(i, { startTime: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="End time (optional)">
                  <input
                    type="time"
                    value={row.endTime ?? ""}
                    onChange={(e) =>
                      patchRow(i, { endTime: e.target.value || undefined })
                    }
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          + Add another time
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 9.6: Run the dev server and exercise the form.**

  ```bash
  npm run dev
  ```

  Open `http://localhost:3000/submit`, fill out a two-slot submission, and submit. Confirm the resulting page (Account → Your Locations) shows both slots. Confirm the form blocks submission with an empty start time.

- [ ] **Step 9.7: Commit.**

  ```bash
  git add app/submit/SubmitForm.tsx
  git commit -m "feat(submit): multi-slot When step

  Replace the single dayOfWeek/startTime input with a repeating row group.
  Min 1, no hard max, '× remove' disabled when only one row remains.
  Validation: each row needs a start time; optional end time must come
  after start. Legacy single-slot drafts in sessionStorage are upcast on
  hydration."
  ```

### Task 10: Update `LocationDetail.tsx` to render a schedule list

**Files:**
- Modify: `app/locations/[id]/LocationDetail.tsx`

**Steps:**

- [ ] **Step 10.1: Update consumption of the new shape.**

  In `LocationDetail`, replace usages of the flat fields with the schedules array. Concretely:

  1. Replace the import line:
     ```ts
     import {
       formatDateLong,
       formatDayPlural,
       formatStartTime,
     } from "@/app/_lib/format";
     ```
     with:
     ```ts
     import {
       formatDateLong,
       formatDayPlural,
       formatStartTime,
       formatTimeRange,
     } from "@/app/_lib/format";
     ```

  2. Replace the hero / "thisWeek" / "lastSession" derivations. After `if (data === undefined) ...`, replace the block beginning `const isOn = data.thisWeek.isOn;` through the closing `</main>` with:

     ```tsx
     const upcomingSchedules = data.schedules.slice().sort(
       (a, b) => a.thisWeek.date.localeCompare(b.thisWeek.date) || a.startTime.localeCompare(b.startTime),
     );
     const allOff = upcomingSchedules.every((s) => !s.thisWeek.isOn);
     const anyOff = upcomingSchedules.some((s) => !s.thisWeek.isOn);
     const heroFrom = allOff ? "from-amber-700" : "from-emerald-700";
     const heroVia = allOff ? "via-orange-600" : "via-emerald-600";
     const heroTo = allOff ? "to-amber-500" : "to-emerald-500";
     const heroShadow = allOff
       ? "shadow-[0_20px_60px_rgba(245,158,11,0.22)]"
       : "shadow-[0_20px_60px_rgba(16,185,129,0.20)]";
     const heroPillLabel = allOff
       ? "All cancelled this week"
       : anyOff
         ? "Some cancelled this week"
         : "Game on this week";
     const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
       data.address,
     )}`;
     ```

  3. Replace the hero pill markup (the `<div className="mt-5 flex flex-wrap items-center gap-2">...</div>` block) with a simpler version that just shows the summary pill and no per-date chip (per-date chips live below, per slot):

     ```tsx
     <div className="mt-5 flex flex-wrap items-center gap-2">
       <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
         {allOff ? (
           <XCircle className="h-3.5 w-3.5" />
         ) : (
           <span className="relative inline-flex h-2 w-2 items-center justify-center">
             <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
             <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
           </span>
         )}
         {heroPillLabel}
       </span>
     </div>
     ```

     Remove the `{!isOn && data.thisWeek.reason ? (...)} : null` block — per-slot reasons live below.

  4. Replace the "When + Where" grid's "When" card (`<article ...>` block beginning `<p ...>When</p>`) with a vertical list. Find the section starting with `{/* When + Where */}` and replace the FIRST `<article>` with:

     ```tsx
     <article className="loc-anim flex flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
       <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
         When
       </p>
       <ul className="flex flex-col gap-3">
         {upcomingSchedules.map((s) => {
           const rel = relativeDay(s.thisWeek.date);
           return (
             <li
               key={s._id}
               className="rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
             >
               <p className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                 <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                 {formatDayPlural(s.dayOfWeek)}
               </p>
               <p className="mt-0.5 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                 <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                 {formatTimeRange(s.startTime, s.endTime)}
               </p>
               <div className="mt-2 flex flex-wrap items-center gap-1.5">
                 <span
                   className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                     s.thisWeek.isOn
                       ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                       : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                   }`}
                 >
                   {s.thisWeek.isOn ? "On" : "Off"} · {rel}
                 </span>
                 <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                   {formatDateLong(s.thisWeek.date)}
                 </span>
               </div>
               {!s.thisWeek.isOn && s.thisWeek.reason ? (
                 <p className="mt-2 text-xs italic text-rose-700 dark:text-rose-300">
                   {s.thisWeek.reason}
                 </p>
               ) : null}
             </li>
           );
         })}
       </ul>
     </article>
     ```

  5. Replace the single `{data.lastSession ? (...) : null}` block at the bottom of the file with one section per schedule that has a lastSession:

     ```tsx
     {upcomingSchedules.some((s) => s.lastSession) ? (
       <section className="loc-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
         <header className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-900">
           <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
             Last sessions
           </p>
         </header>
         <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
           {upcomingSchedules
             .filter((s) => s.lastSession)
             .map((s) => {
               const last = s.lastSession!;
               const condition = last.weatherCondition as Condition | undefined;
               const weatherMeta = condition ? WEATHER_META[condition] : null;
               return (
                 <li key={s._id} className="px-5 py-4">
                   <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                     {formatDayPlural(s.dayOfWeek)} ·{" "}
                     {formatTimeRange(s.startTime, s.endTime)}
                   </p>
                   <p className="text-xs text-zinc-500">
                     {formatDateLong(last.date)}
                   </p>
                   <div className="mt-2 flex flex-wrap items-center gap-2">
                     {last.turnout !== undefined ? (
                       <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                         <Users className="h-3 w-3" />
                         {last.turnout} players
                       </span>
                     ) : null}
                     {weatherMeta ? (
                       <span
                         className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-br ${weatherMeta.tone} px-2.5 py-0.5 text-[11px] font-bold text-white`}
                       >
                         <weatherMeta.Icon className="h-3 w-3" />
                         {weatherMeta.label}
                       </span>
                     ) : null}
                   </div>
                   {last.recapNotes ? (
                     <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                       {last.recapNotes}
                     </p>
                   ) : null}
                 </li>
               );
             })}
         </ul>
       </section>
     ) : null}
     ```

  6. Remove the now-dead state from posthog capture: change `game_on: data.thisWeek.isOn` to `schedule_count: data.schedules.length` in the `useEffect`. The previous flat references no longer compile.

- [ ] **Step 10.2: Exercise in browser.**

  With `npm run dev` running, visit any approved location (find a `_id` via Convex dashboard or the homepage). Confirm: hero gradient is amber only when every slot is cancelled this week, when card shows one row per slot, last-sessions section lists per-slot recaps.

- [ ] **Step 10.3: Commit.**

  ```bash
  git add app/locations/[id]/LocationDetail.tsx
  git commit -m "feat(web): multi-slot location detail page

  Hero summarizes per-slot status (game on / some off / all off). The
  When card lists slots vertically; each carries its own status chip,
  date, time range, and cancellation reason. The Last sessions section
  shows one recap per slot."
  ```

### Task 11: Update `NextUpGame` to flatten across schedules

**Files:**
- Modify: `app/_components/NextUpGame.tsx`

**Steps:**

- [ ] **Step 11.1: Replace the type and `pickNext` with schedule-aware versions.**

  At the top of `NextUpGame.tsx`, replace the `NextLocation` type and `pickNext` function:

  ```ts
  export type NextSchedule = {
    _id: string;
    dayOfWeek: number;
    startTime: string;
    endTime?: string;
    thisWeek: { date: string; isOn: boolean; reason?: string };
  };

  export type NextLocation = {
    _id: string;
    name: string;
    town: string;
    details: string;
    schedules: NextSchedule[];
  };

  type Pick = {
    locationId: string;
    name: string;
    town: string;
    details: string;
    schedule: NextSchedule;
  };

  function pickNext(locations: NextLocation[] | undefined): Pick | null {
    if (!locations || locations.length === 0) return null;
    const flat: Pick[] = [];
    for (const l of locations) {
      for (const s of l.schedules) {
        flat.push({
          locationId: l._id,
          name: l.name,
          town: l.town,
          details: l.details,
          schedule: s,
        });
      }
    }
    if (flat.length === 0) return null;
    flat.sort((a, b) => {
      if (a.schedule.thisWeek.date !== b.schedule.thisWeek.date) {
        return a.schedule.thisWeek.date < b.schedule.thisWeek.date ? -1 : 1;
      }
      if (a.schedule.startTime !== b.schedule.startTime) {
        return a.schedule.startTime < b.schedule.startTime ? -1 : 1;
      }
      if (a.schedule.thisWeek.isOn !== b.schedule.thisWeek.isOn) {
        return a.schedule.thisWeek.isOn ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return flat[0];
  }
  ```

- [ ] **Step 11.2: Update the JSX to consume `Pick`.**

  Inside the `NextUpGame` component, after `const next = useMemo(...)`, replace every reference to `next.thisWeek` with `next.schedule.thisWeek`, `next.dayOfWeek` with `next.schedule.dayOfWeek`, `next.startTime` with `next.schedule.startTime`. The `next._id` link target becomes `next.locationId`. Concretely, replace the existing `const rel = relativeDay(next.thisWeek.date);` block and everything below it until the closing `</section>` with:

  ```tsx
  const rel = relativeDay(next.schedule.thisWeek.date);
  const time = formatStartTime(next.schedule.startTime);
  const dayName = formatDayLong(next.schedule.dayOfWeek);
  const isOff = !next.schedule.thisWeek.isOn;
  const reason = next.schedule.thisWeek.reason?.trim();

  const theme = isOff
    ? {
        cardBorder: "border-amber-200/70 dark:border-amber-900/60",
        cardShadow:
          "shadow-[0_10px_28px_rgba(245,158,11,0.18)] hover:shadow-[0_14px_32px_rgba(245,158,11,0.28)]",
        blockGradient: "from-amber-700 via-orange-600 to-amber-500",
        eyebrow: "Off this week",
        eyebrowColor: "text-amber-50/90",
        chipText: "Cancelled",
        ctaColor:
          "text-amber-700 group-hover:text-amber-600 dark:text-amber-300",
        accent: "text-amber-600 dark:text-amber-400",
      }
    : {
        cardBorder: "border-emerald-200/60 dark:border-emerald-900/60",
        cardShadow:
          "shadow-[0_10px_28px_rgba(16,185,129,0.14)] hover:shadow-[0_14px_32px_rgba(16,185,129,0.24)]",
        blockGradient: "from-emerald-700 via-emerald-600 to-emerald-500",
        eyebrow: "Next pickup",
        eyebrowColor: "text-emerald-100/90",
        chipText: rel,
        ctaColor:
          "text-emerald-700 group-hover:text-emerald-600 dark:text-emerald-300",
        accent: "text-emerald-600 dark:text-emerald-400",
      };

  return (
    <section ref={root} className="px-6 pt-8">
      <Link
        href={`/locations/${next.locationId}`}
        className={`next-up-anim group block overflow-hidden rounded-2xl border ${theme.cardBorder} bg-white transition hover:-translate-y-0.5 ${theme.cardShadow} dark:bg-zinc-950`}
      >
        {/* ...existing layout unchanged; references to next.* below already use next.schedule.* */}
        <div className="flex flex-col items-stretch sm:flex-row">
          <div
            className={`relative flex flex-col items-center justify-center gap-1 bg-gradient-to-br ${theme.blockGradient} px-6 py-6 text-white sm:w-48 sm:flex-shrink-0`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.3em] ${theme.eyebrowColor}`}
            >
              {theme.eyebrow}
            </p>
            <p
              className={`text-2xl font-bold uppercase leading-none tracking-wide ${
                isOff ? "line-through decoration-2 decoration-white/70" : ""
              }`}
            >
              {dayName}
            </p>
            <p
              className={`text-sm font-semibold tracking-wide ${
                isOff ? "text-white/80" : "text-white/95"
              }`}
            >
              {time}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur">
              {theme.chipText}
            </span>
            {isOff ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-3 inline-flex h-2 w-2 rounded-full bg-white/80"
              />
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-3 flex h-2 w-2 items-center justify-center"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col justify-center gap-1.5 px-5 py-5">
            <h2 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {next.name}
            </h2>
            <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className={`h-3.5 w-3.5 ${theme.accent}`} />
                {next.town}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className={`h-3.5 w-3.5 ${theme.accent}`} />
                {formatDateLong(next.schedule.thisWeek.date)}
              </span>
            </p>
            {isOff ? (
              <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-line">
                  {reason || "Cancelled this week."}
                </span>
              </p>
            ) : next.details ? (
              <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
                {next.details}
              </p>
            ) : null}
            <div
              className={`mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition group-hover:gap-2 ${theme.ctaColor}`}
            >
              View details
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
  ```

- [ ] **Step 11.3: Update the `useGSAP` dependency.**

  Replace `dependencies: [next?._id, locations === undefined]` with `dependencies: [next?.schedule._id, locations === undefined]`.

- [ ] **Step 11.4: Commit.**

  ```bash
  git add app/_components/NextUpGame.tsx
  git commit -m "feat(web): NextUpGame flattens locations x schedules

  pickNext now considers every (location, schedule) pair and picks the
  soonest one. The card links to the location and shows that specific
  slot's day, time, and status."
  ```

### Task 12: Update `LocationsTable.tsx` to render chips per schedule

**Files:**
- Modify: `app/_components/LocationsTable.tsx`
- Modify: `app/_components/LocationsList.tsx` (just the exported `ListLocation` type)

**Steps:**

- [ ] **Step 12.1: Replace the `ListLocation` type in `LocationsList.tsx`.**

  Edit `app/_components/LocationsList.tsx`. Replace:

  ```ts
  export type ListLocation = {
    _id: string;
    name: string;
    town: string;
    dayOfWeek: number;
    startTime: string;
    thisWeek: { date: string; isOn: boolean; reason?: string };
    lastSession: { date: string; turnout?: number } | null;
  };
  ```

  with:

  ```ts
  export type ListSchedule = {
    _id: string;
    dayOfWeek: number;
    startTime: string;
    endTime?: string;
    thisWeek: { date: string; isOn: boolean; reason?: string };
  };

  export type ListLocation = {
    _id: string;
    name: string;
    town: string;
    schedules: ListSchedule[];
  };
  ```

  The body of `LocationsList` already only reads `_id`, `name`, `town`, so no further changes are needed there. (If it does read `dayOfWeek` or `startTime` elsewhere in that file, replace those reads with `schedules[0]?.dayOfWeek`.)

- [ ] **Step 12.2: Rewrite the table to chip-per-schedule.**

  Open `app/_components/LocationsTable.tsx`. Replace `import { formatStartTime } from "../_lib/format";` with `import { formatTimeRange } from "../_lib/format";` and pull in `DAY_SHORT` already at the top.

  Update the sort to use the first matching schedule. Replace the `sorted` `useMemo`:

  ```ts
  const sorted = useMemo(() => {
    const copy = [...locations];
    copy.sort((a, b) => {
      const aFirst = a.schedules[0];
      const bFirst = b.schedules[0];
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "town") cmp = a.town.localeCompare(b.town);
      else if (sortKey === "day") cmp = (aFirst?.dayOfWeek ?? 99) - (bFirst?.dayOfWeek ?? 99);
      else if (sortKey === "time")
        cmp = (aFirst?.startTime ?? "").localeCompare(bFirst?.startTime ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [locations, sortKey, sortDir]);
  ```

  Replace the `<Td>` blocks for Day, Start, and This Week with chip-per-schedule rendering. Find the row template starting with `<Td>` containing `DAY_SHORT[l.dayOfWeek]` and replace those three `<Td>` cells with:

  ```tsx
  <Td>
    <div className="flex flex-wrap gap-1">
      {l.schedules.map((s) => (
        <span
          key={s._id}
          className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {DAY_SHORT[s.dayOfWeek] ?? "—"}
        </span>
      ))}
    </div>
  </Td>
  <Td>
    <div className="flex flex-col gap-0.5 text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
      {l.schedules.map((s) => (
        <span key={s._id}>{formatTimeRange(s.startTime, s.endTime)}</span>
      ))}
    </div>
  </Td>
  <Td>
    <div className="flex flex-col gap-1">
      {l.schedules.map((s) => (
        <StatusPill key={s._id} on={s.thisWeek.isOn} reason={s.thisWeek.reason} />
      ))}
    </div>
  </Td>
  ```

- [ ] **Step 12.3: Commit.**

  ```bash
  git add app/_components/LocationsList.tsx app/_components/LocationsTable.tsx
  git commit -m "feat(web): list view shows one chip per schedule

  ListLocation is now schedules-shaped. The table renders day, time, and
  status chips per slot inside a single row per location."
  ```

### Task 13: Update the Leaflet map popup to list every schedule

**Files:**
- Modify: `app/_components/LocationsMap.client.tsx`

**Steps:**

- [ ] **Step 13.1: Update the `MapLocation` type.**

  Replace:

  ```ts
  export type MapLocation = {
    _id: string;
    name: string;
    town: string;
    lat: number;
    lng: number;
    dayOfWeek: number;
    startTime: string;
  };
  ```

  with:

  ```ts
  export type MapSchedule = {
    _id: string;
    dayOfWeek: number;
    startTime: string;
    endTime?: string;
    thisWeek: { isOn: boolean };
  };

  export type MapLocation = {
    _id: string;
    name: string;
    town: string;
    lat: number;
    lng: number;
    schedules: MapSchedule[];
  };
  ```

- [ ] **Step 13.2: Rework the popup to iterate schedules.**

  Inside the `<Popup>`, replace the existing `<div className="text-xs text-emerald-700">` block with:

  ```tsx
  <ul className="m-0 list-none p-0 text-xs text-emerald-700">
    {l.schedules.map((s) => (
      <li key={s._id} className="flex items-center gap-1.5">
        <span
          className={
            s.thisWeek.isOn
              ? "inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
              : "inline-block h-1.5 w-1.5 rounded-full bg-rose-500"
          }
        />
        {formatDayPlural(s.dayOfWeek)} at {formatTimeRange(s.startTime, s.endTime)}
      </li>
    ))}
  </ul>
  ```

  Update the top-of-file import: `import { formatDayPlural, formatStartTime } from "../_lib/format";` → `import { formatDayPlural, formatTimeRange } from "../_lib/format";`.

- [ ] **Step 13.3: Commit.**

  ```bash
  git add app/_components/LocationsMap.client.tsx
  git commit -m "feat(web): map popups list each schedule with status dot"
  ```

### Task 14: Update `HomeView` glue and any preload typings

**Files:**
- Modify: `app/_components/HomeView.tsx` (only if its `MapLocation`/`ListLocation` mapping needs adjustment — it currently passes through the array as-is from the Convex query, which now has the new shape)

**Steps:**

- [ ] **Step 14.1: Search for stale references.**

  ```bash
  grep -rn "\.dayOfWeek\|\.startTime" convex app --include="*.ts" --include="*.tsx" | grep -v "_generated"
  ```

  Inspect each hit. A line reading from a schedule (`s.dayOfWeek`, `schedules[i].startTime`, etc.) is fine — schedules carry those fields. A line reading from a location shape (`loc.dayOfWeek`, `data.startTime`) is stale and must be repointed at `schedules[0]?.dayOfWeek` or, where the UI shows every slot, iterated over `schedules`.

- [ ] **Step 14.2: Run `tsc` once to find dangling typing issues.**

  ```bash
  npx tsc --noEmit
  ```

  Fix anything that surfaces. Most likely candidates: anywhere the public location's flat fields were read. The fix is to either read from `schedules[0]` or iterate.

- [ ] **Step 14.3: Commit (only if something was fixed).**

  ```bash
  git add -A
  git commit -m "fix(web): repoint stragglers at the schedules array"
  ```

### Task 15: Rework `OwnerLocationClient.tsx` to manage per-schedule state

**Files:**
- Modify: `app/account/locations/[id]/OwnerLocationClient.tsx`
- Modify: `app/_components/StatusForm.tsx` (no signature change; just adapts to being instanced per schedule)
- Modify: `app/_components/RecapForm.tsx` (same)

**Steps:**

- [ ] **Step 15.1: Switch the mutation references.**

  Near the top of `OwnerLocationClient`, replace:

  ```ts
  const setStatus = useMutation(api.owner.setLocationStatus);
  const saveRecap = useMutation(api.owner.saveRecap);
  ```

  with:

  ```ts
  const setStatus = useMutation(api.owner.setScheduleStatus);
  const saveRecap = useMutation(api.owner.saveScheduleRecap);
  ```

- [ ] **Step 15.2: Replace the "thisWeek" and "lastSession" panels.**

  In `OwnerLocationClient.tsx`, replace the JSX block beginning `{tab === "thisWeek" && status === "approved" && data.thisWeek ? (` and ending at `) : null}` (and the matching `lastSession` block) with these schedule-iterating panels. Substitute the existing two ternaries with:

  ```tsx
  {tab === "thisWeek" && status === "approved" ? (
    <PanelCard
      eyebrow="This week"
      title="Is the game on?"
      subtitle="Toggle each slot independently."
    >
      <div className="flex flex-col gap-6">
        {data.schedules.map((s) => (
          <div
            key={s._id}
            className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
              {formatDayPlural(s.dayOfWeek)} ·{" "}
              {formatStartTime(s.startTime)}
            </p>
            <StatusForm
              date={s.thisWeek.date}
              isOn={s.thisWeek.isOn}
              reason={s.thisWeek.reason}
              onSave={async ({ isOn, reason }) => {
                await setStatus({ scheduleId: s._id, isOn, reason });
              }}
            />
          </div>
        ))}
      </div>
    </PanelCard>
  ) : null}

  {tab === "lastSession" && status === "approved" ? (
    <PanelCard
      eyebrow="Last session"
      title="Recap"
      subtitle="One recap per slot."
    >
      <div className="flex flex-col gap-6">
        {data.schedules.map((s) => (
          <div
            key={s._id}
            className="rounded-2xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
              {formatDayPlural(s.dayOfWeek)} ·{" "}
              {formatStartTime(s.startTime)}
            </p>
            <RecapForm
              date={s.lastSession?.date ?? null}
              initial={{
                turnout: s.lastSession?.turnout,
                weatherCondition: s.lastSession?.weatherCondition,
                weather: s.lastSession?.weather,
                recapNotes: s.lastSession?.recapNotes,
              }}
              onSave={async (v) => {
                await saveRecap({ scheduleId: s._id, ...v });
              }}
            />
          </div>
        ))}
      </div>
    </PanelCard>
  ) : null}
  ```

- [ ] **Step 15.3: Replace the "Public preview" line that reads `data.dayOfWeek`/`data.startTime`.**

  Find the block beginning `<p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">` and replace its content with:

  ```tsx
  <div className="mt-1 flex flex-col gap-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
    {data.schedules.map((s) => (
      <p key={s._id} className="inline-flex items-center gap-1.5">
        <CalendarClock className="h-4 w-4" />
        {formatDayPlural(s.dayOfWeek)} at {formatStartTime(s.startTime)}
      </p>
    ))}
  </div>
  ```

- [ ] **Step 15.4: Update the "Edit submission" panel's SettingsForm wiring.**

  The existing `SettingsForm` takes `dayOfWeek` and `startTime` in its initial object; those fields need to come from the new schedule editor instead. We're going to split the SettingsForm responsibility: keep it for `name/town/address/lat/lng/details`, and add a separate schedules editor.

  Replace the `tab === "details" ? (...)` block with:

  ```tsx
  {tab === "details" ? (
    <PanelCard
      eyebrow="Field details"
      title="Edit submission"
      subtitle={
        status === "pending"
          ? "Tweaks before approval — go ahead."
          : "Updates here go live immediately."
      }
    >
      <div className="flex flex-col gap-6">
        <SettingsForm
          initial={{
            name: data.name,
            town: data.town,
            address: data.address,
            lat: data.lat,
            lng: data.lng,
            details: data.details,
          }}
          onSave={async (v) => {
            await update({ id: data._id, ...v });
          }}
        />
        <SchedulesEditor
          locationId={data._id}
          initial={data.schedules.map((s) => ({
            _id: s._id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          }))}
        />
      </div>
    </PanelCard>
  ) : null}
  ```

  Add the `SchedulesEditor` component at the bottom of the file (above the existing `PanelCard` helper):

  ```tsx
  function SchedulesEditor({
    locationId,
    initial,
  }: {
    locationId: Id<"locations">;
    initial: Array<{
      _id: Id<"locationSchedules">;
      dayOfWeek: number;
      startTime: string;
      endTime?: string;
    }>;
  }) {
    const setSchedules = useMutation(api.owner.setSchedules);
    const [rows, setRows] = useState(initial);
    const [pending, setPending] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    async function save() {
      setPending(true);
      try {
        await setSchedules({
          id: locationId,
          schedules: rows.map((r) => ({
            _id: r._id,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        });
        setSavedAt(Date.now());
      } finally {
        setPending(false);
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
          Slots
        </p>
        {rows.map((r, i) => (
          <div
            key={r._id ?? `new-${i}`}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Slot {i + 1}
              </p>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) => rs.filter((_, j) => j !== i))
                  }
                  className="rounded-full p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                  aria-label={`Remove slot ${i + 1}`}
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={r.dayOfWeek}
                onChange={(e) =>
                  setRows((rs) => {
                    const next = rs.slice();
                    next[i] = { ...next[i], dayOfWeek: Number(e.target.value) };
                    return next;
                  })
                }
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {days.map((d, di) => (
                  <option key={di} value={di}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={r.startTime}
                onChange={(e) =>
                  setRows((rs) => {
                    const next = rs.slice();
                    next[i] = { ...next[i], startTime: e.target.value };
                    return next;
                  })
                }
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                type="time"
                value={r.endTime ?? ""}
                onChange={(e) =>
                  setRows((rs) => {
                    const next = rs.slice();
                    next[i] = { ...next[i], endTime: e.target.value || undefined };
                    return next;
                  })
                }
                placeholder="End (optional)"
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setRows((rs) => [...rs, { _id: undefined as never, dayOfWeek: 1, startTime: "18:00" }])
          }
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          + Add another time
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 transition hover:scale-[1.02] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save slots"}
          </button>
          {savedAt && Date.now() - savedAt < 4000 ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-300">Saved</span>
          ) : null}
        </div>
      </div>
    );
  }
  ```

  The `_id: undefined as never` cast for new rows is intentional — the type allows `_id?` but we lose the optionality at the local row level for simplicity. The mutation accepts a missing `_id`.

  Also add `useState`, `useMutation`, `api`, and the `Id` type to the imports at the top if not already there:

  ```ts
  import { useState } from "react";
  import { useMutation } from "convex/react";
  import { api } from "@/convex/_generated/api";
  import type { Id } from "@/convex/_generated/dataModel";
  import { formatStartTime } from "@/app/_lib/format";
  ```

- [ ] **Step 15.5: Remove `dayOfWeek`/`startTime` from `SettingsForm`'s initial prop.**

  Open `app/_components/SettingsForm.tsx` and remove those two fields from the `initial` prop type and from the rendered controls. The day-of-week pill row + time input inside `SettingsForm` are replaced by the new `SchedulesEditor`; remove them entirely (they're now redundant). Match by reading the file first and removing only what's necessary.

- [ ] **Step 15.6: Exercise the page in the browser.**

  ```bash
  npm run dev
  ```

  Visit `/account/locations/<some-approved-loc>`. Confirm: details tab edits work, slots editor lets you add/remove/save slots, this-week tab shows one StatusForm per slot, last-session tab shows one RecapForm per slot.

- [ ] **Step 15.7: Commit.**

  ```bash
  git add app/account/locations/[id]/OwnerLocationClient.tsx app/_components/SettingsForm.tsx
  git commit -m "feat(web): per-schedule status/recap and slots editor

  OwnerLocationClient renders a StatusForm and RecapForm per slot,
  wires them through setScheduleStatus / saveScheduleRecap, and adds a
  SchedulesEditor for adding, editing, or removing slots via the new
  setSchedules mutation. SettingsForm sheds the dayOfWeek/startTime
  controls that moved into SchedulesEditor."
  ```

### Task 16: Update the admin location/queue pages

**Files:**
- Modify: `app/admin/locations/[id]/...` (read first to learn the exact filenames)
- Modify: `app/admin/queue/[id]/...` (read first)

**Steps:**

- [ ] **Step 16.1: Read the admin pages.**

  ```bash
  ls app/admin/locations/[id] app/admin/queue/[id]
  ```

  Open every `*.tsx` file in those directories. Note every reference to `api.admin.adminSetLocationStatus`, `api.admin.adminSaveRecap`, `api.admin.adminUpdateLocation`, `data.dayOfWeek`, `data.startTime`, and the `SettingsForm`/`StatusForm`/`RecapForm` props.

- [ ] **Step 16.2: Apply the same reshape as `OwnerLocationClient`.**

  - Switch mutation refs:
    - `api.admin.adminSetLocationStatus` → `api.admin.adminSetScheduleStatus`
    - `api.admin.adminSaveRecap` → `api.admin.adminSaveScheduleRecap`
    - Add `api.admin.adminSetSchedules` if any flow lets the admin edit the slot list.
  - For pages that show schedule info: iterate `data.schedules` and render per-slot.
  - For pages that pass props to `SettingsForm`: drop `dayOfWeek`/`startTime` from the `initial` object.

  Code patterns mirror Task 15 — copy-adapt the JSX for each panel.

- [ ] **Step 16.3: Exercise the admin queue.**

  As an admin user, visit `/admin/queue`. Open a pending submission with multiple slots. Approve. Visit `/admin/locations/<that-id>`. Confirm: details, status (per slot), recap (per slot) all work.

- [ ] **Step 16.4: Commit.**

  ```bash
  git add app/admin
  git commit -m "feat(admin): per-schedule status, recap, and slots editing

  Admin moderation surfaces now consume the schedules array and route
  through the admin schedule-scoped mutations."
  ```

### Task 17: End-to-end smoke test in the browser

**Files:** None. Manual verification only.

**Steps:**

- [ ] **Step 17.1: Cold-start the dev server.**

  ```bash
  npm run dev
  ```

- [ ] **Step 17.2: Submit a new two-slot location.**

  - Visit `/submit`, sign in if needed.
  - Fill out a name + town + address (let the geocode drop a pin).
  - On the When step, add a second slot (different day).
  - Submit.

- [ ] **Step 17.3: Admin-approve it.**

  As an admin (use the seeded admin), visit `/admin/queue`, approve the new submission.

- [ ] **Step 17.4: Confirm the public homepage.**

  - Homepage map: the new pin shows both slots in its popup.
  - Homepage list: row shows day + time chips per slot.
  - Day filter: filter by each slot's day, confirm the location appears in both.

- [ ] **Step 17.5: Confirm the location detail page.**

  - Visit `/locations/<id>`. Hero shows "Game on this week" (no recaps yet).
  - When card lists both slots, each with its own status chip.

- [ ] **Step 17.6: Cancel one slot, write a recap on the other.**

  - As owner, go to `/account/locations/<id>` → This week → toggle one slot off, save.
  - Last session → write a recap for the other slot, save.
  - Reload the public detail page: hero now says "Some cancelled this week," one slot shows Off with the reason, the other shows On.

- [ ] **Step 17.7: Commit any browser-shaken-out fixes from the above pass.**

  If anything is broken, fix it in a focused commit (don't bundle multiple unrelated fixes).

---

## Phase 4 — Narrow schema

### Task 18: Remove the legacy fields and indexes

**Files:**
- Modify: `convex/schema.ts`

**Steps:**

- [ ] **Step 18.1: Pre-flight: confirm no live code references `loc.dayOfWeek` or `loc.startTime`.**

  ```bash
  grep -rn "\.dayOfWeek\|\.startTime" convex app | grep -v test | grep -v "/_generated/" | grep -v "schedule"
  ```

  Expected: no remaining references. Every read should go through `schedules[i].dayOfWeek` / `.startTime`. If anything leaks, fix it before narrowing.

- [ ] **Step 18.2: Narrow the schema.**

  Edit `convex/schema.ts`:

  - Remove `dayOfWeek` and `startTime` from the `locations` table definition (delete the two lines).
  - In `gameDays`, change `scheduleId: v.optional(v.id("locationSchedules"))` to `scheduleId: v.id("locationSchedules")`.
  - Remove the `.index("by_location_and_date", ["locationId", "date"])` line from `gameDays`. Keep `by_location` and `by_schedule_and_date`.

- [ ] **Step 18.3: Deploy.**

  ```bash
  npx convex dev --once --typecheck enable
  ```

  Expected: clean deploy. If Convex refuses because some `gameDays` row is missing `scheduleId` or some `locations` row still has a legacy field, the backfill didn't fully run — go back to Step 2.6 and re-run.

- [ ] **Step 18.4: Run the full test suite.**

  ```bash
  npm test
  ```

  Expected: green.

- [ ] **Step 18.5: Delete the backfill code and its test.**

  The migration was a one-shot bridge between widen and narrow. Once narrowed, its test can no longer insert legacy-shaped locations (the legacy fields are gone from schema) and the migration itself has nothing left to backfill.

  ```bash
  rm convex/migrations/locationSchedules.ts convex/migrations/locationSchedules.test.ts
  rmdir convex/migrations 2>/dev/null || true
  ```

- [ ] **Step 18.6: Commit.**

  ```bash
  git add convex/schema.ts convex/migrations
  git commit -m "feat(schema): narrow locations / gameDays after backfill

  Removes legacy dayOfWeek/startTime from locations, requires scheduleId
  on gameDays, drops the by_location_and_date index, and deletes the
  one-shot backfill migration that bridged widen and narrow."
  ```

---

## Self-review (run before declaring done)

Read `docs/superpowers/specs/2026-05-18-location-schedules-design.md` once more and check each requirement against the tasks above:

- Schema additions / removals → Tasks 1, 18.
- `gameDays.scheduleId` added then required, `by_schedule_and_date` index → Tasks 1, 18.
- Per-schedule `thisWeek` + `lastSession` in public reads → Task 3.
- `setSchedules`, `setScheduleStatus`, `saveScheduleRecap` mutations → Task 4.
- `submitLocation` takes a schedules array → Task 5.
- Admin mirrors → Task 6.
- Maintainers' `myMaintainedLocations` reshape → Task 7.
- `formatTimeRange` helper → Task 8.
- Submit form's multi-row When step → Task 9.
- Location detail page renders per-schedule → Task 10.
- `NextUpGame` flattens across schedules → Task 11.
- List + map render per-schedule → Tasks 12, 13.
- Account page renders per-schedule status + recap forms + slots editor → Task 15.
- Admin pages mirror → Task 16.
- Backfill mutation → Task 2 + step 2.6.
- Manual e2e verification → Task 17.

If anything is missing, add a task. If anything is duplicated, prune.
