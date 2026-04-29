# Pickup Soccer v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Convex-backed Next.js site showing pickup soccer's upcoming Monday and the most recent session recap, plus a password-gated admin page to edit settings, toggle status, and write recaps.

**Architecture:** Convex backend with `settings` (single row), `gameDays` (one row per explicitly-recorded date), and the `authTables` from `@convex-dev/auth`. Next.js App Router frontend; `/admin` and `/signin` are gated by `middleware.ts`. Public queries are unauthenticated; all admin mutations call `requireAdmin(ctx)` server-side. Date logic respects America/New_York and is driven by `settings.dayOfWeek`.

**Tech Stack:** Next.js 16.2.4, React 19.2.4, Convex 1.36.1, `@convex-dev/auth` (latest), `@auth/core@0.37.0` (exact peer pin), Tailwind CSS 4, Vitest (for pure date-helper tests).

**Reference spec:** `docs/superpowers/specs/2026-04-28-pickup-soccer-schema-design.md`.

**Working directory note:** All file paths below are relative to `/Users/tyallembert/Development/projects/pickup-soccer`. Run all commands from that directory unless stated otherwise.

**Conventions used in this plan:**
- Each task starts with the exact files involved, then a list of bite-sized steps.
- Pure logic (date helpers) is built TDD with Vitest. Convex queries/mutations are verified manually via `npx convex run`. UI is verified by running the dev server and exercising it in a browser, per the project's CLAUDE.md.
- Commit at the end of each task with a Conventional-Commits-style message. The default branch is `main`; commit directly unless the user has switched branches.

---

## Phase 1 — Convex foundation

### Task 1: Install Convex Auth and run one-time env setup

**Files:**
- Modify: `package.json` (via `npm install`)

**Steps:**

- [ ] **Step 1.1: Install the Convex Auth packages**

```bash
npm install @convex-dev/auth @auth/core@0.37.0
```

The `@auth/core` version must be exactly `0.37.0` — `@convex-dev/auth` has a hard peer dependency on it. A newer minor will break.

- [ ] **Step 1.2: Verify Convex dev is running and authenticated**

Convex Auth's CLI initializer needs `npx convex dev` to have run at least once so the deployment exists. If `.env.local` does not contain `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`, run `npx convex dev` interactively first and let the user complete the GitHub OAuth flow, then come back.

```bash
cat .env.local
```

Expected: lines for `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`. If absent, stop and ask the user to run `npx convex dev`.

- [ ] **Step 1.3: Run the Convex Auth initializer**

```bash
npx @convex-dev/auth
```

This sets `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` on the Convex deployment. Verify:

```bash
npx convex env list
```

Expected output includes `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`.

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @convex-dev/auth and @auth/core"
```

---

### Task 2: Define the Convex schema

**Files:**
- Create: `convex/schema.ts`

**Steps:**

- [ ] **Step 2.1: Create `convex/schema.ts`**

```ts
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const weatherCondition = v.union(
  v.literal("sunny"),
  v.literal("cloudy"),
  v.literal("rainy"),
  v.literal("snowy"),
  v.literal("windy"),
  v.literal("cold"),
);

export default defineSchema({
  ...authTables,

  // Override authTables.users to add a `role` field used by requireAdmin().
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  }).index("email", ["email"]),

  settings: defineTable({
    dayOfWeek: v.number(), // 0 = Sunday … 6 = Saturday
    startTime: v.string(), // "HH:mm" 24-hour, e.g. "18:00"
    location: v.string(),
    details: v.string(), // markdown
  }),

  gameDays: defineTable({
    date: v.string(), // "YYYY-MM-DD" in America/New_York
    isOn: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    turnout: v.optional(v.number()),
    weatherCondition: v.optional(weatherCondition),
    weather: v.optional(v.string()),
    recapNotes: v.optional(v.string()),
  }).index("by_date", ["date"]),
});
```

Notes:
- The `users` redefinition overwrites `authTables.users`. The full set of optional fields above is exactly what Convex Auth itself reads/writes — do not omit any of them.
- `gameDays` has only `date` indexed; the spec doesn't require any other access pattern. Per Convex AI guidelines, queries must use this index instead of `.filter()`.

- [ ] **Step 2.2: Push the schema to the dev deployment**

```bash
npx convex dev --once
```

Expected: completes without schema errors. If `npx convex dev` is already running in another terminal, it will pick the schema up automatically — `--once` is just to confirm.

- [ ] **Step 2.3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(convex): define settings, gameDays, and authTables schema"
```

---

### Task 3: Convex Auth wiring (auth config, provider, HTTP routes)

**Files:**
- Create: `convex/auth.config.ts`
- Create: `convex/auth.ts`
- Create: `convex/http.ts`

**Steps:**

- [ ] **Step 3.1: Create `convex/auth.config.ts`**

```ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

`CONVEX_SITE_URL` is auto-populated by Convex (set in Task 1, Step 1.3). Do not set it manually.

- [ ] **Step 3.2: Create `convex/auth.ts`**

```ts
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { DataModel } from "./_generated/dataModel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      // profile() runs only on the sign-up code path. Throwing here disables
      // public sign-up. The seed script bypasses this by calling
      // createAccount() directly from an internal action.
      profile() {
        throw new ConvexError("Public sign-up is disabled.");
      },
    }),
  ],
});
```

- [ ] **Step 3.3: Create `convex/http.ts`**

```ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

- [ ] **Step 3.4: Push and verify**

```bash
npx convex dev --once
```

Expected: no errors. The Convex dashboard's Functions tab will now show `auth:signIn`, `auth:signOut`, `auth:store`, etc.

- [ ] **Step 3.5: Commit**

```bash
git add convex/auth.config.ts convex/auth.ts convex/http.ts
git commit -m "feat(convex): wire @convex-dev/auth password provider with sign-up disabled"
```

---

### Task 4: `requireAdmin` helper

**Files:**
- Create: `convex/lib/auth.ts`

**Steps:**

- [ ] **Step 4.1: Create `convex/lib/auth.ts`**

```ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not authenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new ConvexError("Forbidden");
  }
  return user;
}
```

Per Convex AI guidelines: never accept a `userId` as a function argument; always derive identity server-side via `getAuthUserId`/`ctx.auth`.

- [ ] **Step 4.2: Commit**

```bash
git add convex/lib/auth.ts
git commit -m "feat(convex): add requireAdmin helper"
```

---

## Phase 2 — Date logic (TDD with Vitest)

### Task 5: Vitest setup for pure-TS unit tests

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script and dev deps)

**Steps:**

- [ ] **Step 5.1: Install Vitest**

```bash
npm install --save-dev vitest @types/node
```

(`@types/node` is already present per the existing `package.json`; this is a no-op if so.)

- [ ] **Step 5.2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/lib/**/*.test.ts"],
    environment: "node",
  },
});
```

We use the `node` environment because the only tests are pure-TS date math. The Convex AI guidelines mention `convex-test` with `edge-runtime` for testing Convex functions; we are not using that here — for this small project, Convex query/mutation correctness is verified manually via `npx convex run`.

- [ ] **Step 5.3: Add `test` script**

Modify `package.json`'s `"scripts"` block to add a `test` entry:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```

- [ ] **Step 5.4: Verify the test runner works (and finds nothing yet)**

```bash
npm test
```

Expected output: Vitest exits with `No test files found` or `0 tests` — that is fine; we will add tests in Task 6.

- [ ] **Step 5.5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-TS unit tests"
```

---

### Task 6: Date helpers — `upcomingGameDay` and `mostRecentPastGameDay`

**Files:**
- Create: `convex/lib/dates.ts`
- Test: `convex/lib/dates.test.ts`

These two functions are pure given (`now: Date`, `dayOfWeek: number`, `startTime: string`). They translate from a UTC `now` to a `YYYY-MM-DD` America/New_York date string.

- [ ] **Step 6.1: Write the failing test file**

Create `convex/lib/dates.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { mostRecentPastGameDay, upcomingGameDay } from "./dates";

// dayOfWeek: 0 = Sunday … 1 = Monday … 6 = Saturday.
// startTime: "HH:mm" in America/New_York.

describe("upcomingGameDay", () => {
  test("Saturday afternoon → next Monday", () => {
    // 2026-05-02 is a Saturday. America/New_York is UTC-4 in May (EDT).
    const now = new Date("2026-05-02T18:00:00Z"); // 2pm EDT Sat
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday before start time → today", () => {
    // 2026-05-04 is a Monday. 5pm EDT = 21:00 UTC. Game is 6pm.
    const now = new Date("2026-05-04T21:00:00Z");
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday after start time → next Monday", () => {
    // 2026-05-04 is a Monday. 7pm EDT = 23:00 UTC. Game was 6pm.
    const now = new Date("2026-05-04T23:00:00Z");
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-11");
  });

  test("dayOfWeek configurable — Wednesday game, Tuesday now → Wednesday", () => {
    const now = new Date("2026-05-05T18:00:00Z"); // Tuesday afternoon
    expect(upcomingGameDay(now, 3, "18:00")).toBe("2026-05-06");
  });

  test("DST boundary — November fall-back week", () => {
    // 2026-11-01 is a Sunday and DST ends at 2am local. 2026-11-02 is a Monday.
    // Now: Sunday 11pm EDT (already EST after fall-back) = 04:00 UTC Monday.
    const now = new Date("2026-11-02T04:00:00Z");
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-11-02");
  });
});

describe("mostRecentPastGameDay", () => {
  test("Wednesday → previous Monday", () => {
    const now = new Date("2026-05-06T18:00:00Z"); // Wednesday afternoon
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday before start time → previous Monday (today does not count)", () => {
    const now = new Date("2026-05-04T21:00:00Z"); // 5pm EDT Mon, game at 6
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-04-27");
  });

  test("Monday after start time → today (game has begun)", () => {
    const now = new Date("2026-05-04T23:00:00Z"); // 7pm EDT Mon
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });
});
```

- [ ] **Step 6.2: Run the tests, see them fail**

```bash
npm test
```

Expected: failures with `Cannot find module './dates'` or similar.

- [ ] **Step 6.3: Implement `convex/lib/dates.ts`**

```ts
const TIMEZONE = "America/New_York";

// Returns the calendar date in `TIMEZONE` for the given UTC instant, formatted "YYYY-MM-DD".
function toLocalDateString(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

// Returns 0..6 (Sunday..Saturday) for the local weekday in TIMEZONE.
function localDayOfWeek(d: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

// Returns minutes-since-midnight for the local time in TIMEZONE.
function localMinutesSinceMidnight(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return hour * 60 + minute;
}

function parseStartTime(startTime: string): number {
  const [h, m] = startTime.split(":").map((s) => parseInt(s, 10));
  return h * 60 + m;
}

// Adds `days` calendar days to the local date `dateStr` ("YYYY-MM-DD") and
// returns the result as "YYYY-MM-DD". Pure string arithmetic — no Date math —
// to avoid DST drift.
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  // Use UTC math purely as a calendar arithmetic primitive, then re-stringify.
  const t = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const out = new Date(t);
  const yy = out.getUTCFullYear();
  const mm = String(out.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(out.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function upcomingGameDay(
  now: Date,
  dayOfWeek: number,
  startTime: string,
): string {
  const today = toLocalDateString(now);
  const todayDow = localDayOfWeek(now);
  const startMinutes = parseStartTime(startTime);
  const nowMinutes = localMinutesSinceMidnight(now);

  if (todayDow === dayOfWeek && nowMinutes < startMinutes) {
    return today;
  }

  // Days forward to the next occurrence of dayOfWeek.
  let delta = (dayOfWeek - todayDow + 7) % 7;
  if (delta === 0) delta = 7; // today is dayOfWeek but past start → next week
  return addDays(today, delta);
}

export function mostRecentPastGameDay(
  now: Date,
  dayOfWeek: number,
  startTime: string,
): string {
  const today = toLocalDateString(now);
  const todayDow = localDayOfWeek(now);
  const startMinutes = parseStartTime(startTime);
  const nowMinutes = localMinutesSinceMidnight(now);

  if (todayDow === dayOfWeek && nowMinutes >= startMinutes) {
    return today;
  }

  // Days backward to the previous occurrence of dayOfWeek.
  let delta = (todayDow - dayOfWeek + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(today, -delta);
}
```

Notes on correctness:
- All "what date is it locally" decisions go through `Intl.DateTimeFormat` with `timeZone: "America/New_York"`. This handles DST automatically.
- Day arithmetic happens on `YYYY-MM-DD` strings, not on `Date` objects, to avoid DST drift (a `Date + 24h` near a DST boundary lands on the wrong calendar day).

- [ ] **Step 6.4: Run the tests, see them pass**

```bash
npm test
```

Expected: all tests pass. If a DST test fails, double-check that the test's UTC `now` actually corresponds to the intended local time for that date — the November fall-back is the trickiest case.

- [ ] **Step 6.5: Commit**

```bash
git add convex/lib/dates.ts convex/lib/dates.test.ts
git commit -m "feat(convex): add timezone-aware upcoming/most-recent game-day helpers"
```

---

## Phase 3 — Convex queries and mutations

### Task 7: Public read queries — `getUpcomingWeek` and `getLatestRecap`

**Files:**
- Create: `convex/public.ts`

We put both public queries in one file so the `api.public.*` namespace is short and the homepage only imports from one place.

- [ ] **Step 7.1: Create `convex/public.ts`**

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { upcomingGameDay } from "./lib/dates";

export const getUpcomingWeek = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").take(1);
    const settingsRow = settings[0];
    if (!settingsRow) {
      throw new ConvexError(
        "Settings have not been seeded yet. Run `npx convex run seedSettings:run`.",
      );
    }

    const date = upcomingGameDay(
      new Date(),
      settingsRow.dayOfWeek,
      settingsRow.startTime,
    );

    const row = await ctx.db
      .query("gameDays")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();

    const isOn = row?.isOn ?? true;

    return {
      date,
      isOn,
      reason: isOn ? undefined : row?.reason,
      settings: {
        dayOfWeek: settingsRow.dayOfWeek,
        startTime: settingsRow.startTime,
        location: settingsRow.location,
        details: settingsRow.details,
      },
    };
  },
});

export const getLatestRecap = query({
  args: {},
  handler: async (ctx) => {
    // Read the 50 most recent gameDays rows by date (descending).
    // We bound the read because Convex AI guidelines forbid unbounded `.collect()`.
    // 50 covers ~a year of weekly sessions, which is more than enough to find
    // the most recent row with any recap field set.
    const rows = await ctx.db
      .query("gameDays")
      .withIndex("by_date")
      .order("desc")
      .take(50);

    const today = todayLocalDateString();
    const hasRecap = (r: (typeof rows)[number]) =>
      r.turnout !== undefined ||
      r.weatherCondition !== undefined ||
      r.weather !== undefined ||
      r.recapNotes !== undefined;

    const match = rows.find((r) => r.date < today && hasRecap(r));
    if (!match) return null;

    return {
      date: match.date,
      turnout: match.turnout,
      weatherCondition: match.weatherCondition,
      weather: match.weather,
      recapNotes: match.recapNotes,
    };
  },
});

function todayLocalDateString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}
```

Why a local helper for `todayLocalDateString` instead of importing from `lib/dates.ts`? It is a 10-line helper used in exactly one query; lifting it is fine but not required. If you prefer, export it from `lib/dates.ts` and import — same semantics either way. (See self-review note in Task 14.)

- [ ] **Step 7.2: Push and smoke-test from the CLI**

```bash
npx convex dev --once
npx convex run public:getUpcomingWeek '{}'
```

Expected on the first run: a `ConvexError` saying settings have not been seeded — that is the correct behavior. We seed in Task 9.

```bash
npx convex run public:getLatestRecap '{}'
```

Expected: returns `null` (no `gameDays` rows exist yet).

- [ ] **Step 7.3: Commit**

```bash
git add convex/public.ts
git commit -m "feat(convex): add getUpcomingWeek and getLatestRecap public queries"
```

---

### Task 8: Admin mutations — `setUpcomingStatus`, `updateSettings`, `saveRecap`

**Files:**
- Create: `convex/admin.ts`

- [ ] **Step 8.1: Create `convex/admin.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { mostRecentPastGameDay, upcomingGameDay } from "./lib/dates";

const weatherCondition = v.union(
  v.literal("sunny"),
  v.literal("cloudy"),
  v.literal("rainy"),
  v.literal("snowy"),
  v.literal("windy"),
  v.literal("cold"),
);

async function getSettingsOrThrow(ctx: QueryCtx | MutationCtx) {
  const rows = await ctx.db.query("settings").take(1);
  if (!rows[0]) throw new Error("Settings not seeded");
  return rows[0];
}

export const setUpcomingStatus = mutation({
  args: {
    isOn: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const settings = await getSettingsOrThrow(ctx);
    const date = upcomingGameDay(
      new Date(),
      settings.dayOfWeek,
      settings.startTime,
    );

    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();

    const patch = {
      isOn: args.isOn,
      reason: args.isOn ? undefined : args.reason,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", { date, ...patch });
    }
    return { date, ...patch };
  },
});

export const updateSettings = mutation({
  args: {
    dayOfWeek: v.optional(v.number()),
    startTime: v.optional(v.string()),
    location: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await getSettingsOrThrow(ctx);
    await ctx.db.patch(existing._id, args);
    return null;
  },
});

export const saveRecap = mutation({
  args: {
    turnout: v.optional(v.union(v.number(), v.null())),
    weatherCondition: v.optional(v.union(weatherCondition, v.null())),
    weather: v.optional(v.union(v.string(), v.null())),
    recapNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const settings = await getSettingsOrThrow(ctx);
    const date = mostRecentPastGameDay(
      new Date(),
      settings.dayOfWeek,
      settings.startTime,
    );

    // Convert nulls (clear) to undefined-on-patch and skip undefined keys.
    // Pattern: explicit null clears a field; an undefined arg leaves it alone.
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
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", { date, ...patch });
    }
    return { date };
  },
});
```

Notes:
- The `getSettingsOrThrow` helper is a local file-private function. Per the spec, the public `getUpcomingWeek` query throws a `ConvexError` if settings are unseeded; in admin mutations we throw a plain `Error` because the admin will never see this error in production after Task 9 (settings get seeded once).
- `setUpcomingStatus` strips `reason` when `isOn === true` per the spec.
- `saveRecap`: `undefined` on a key leaves it untouched; explicit `null` clears the field. We translate `null` → `undefined` in `ctx.db.patch` because Convex's patch semantics treat `undefined` as "remove this field."

- [ ] **Step 8.2: Push**

```bash
npx convex dev --once
```

Expected: no errors. We will smoke-test these end-to-end after the seed scripts and the admin UI exist.

- [ ] **Step 8.3: Commit**

```bash
git add convex/admin.ts
git commit -m "feat(convex): add admin mutations setUpcomingStatus, updateSettings, saveRecap"
```

---

## Phase 4 — Seed scripts

### Task 9: Seed the settings row

**Files:**
- Create: `convex/seedSettings.ts`

- [ ] **Step 9.1: Create `convex/seedSettings.ts`**

```ts
import { internalMutation } from "./_generated/server";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("settings").take(1);
    if (existing[0]) {
      console.log("Settings already exist:", existing[0]._id);
      return existing[0]._id;
    }
    const id = await ctx.db.insert("settings", {
      dayOfWeek: 1, // Monday
      startTime: "18:00", // 6:00pm
      location: "TBD — set me from the admin page",
      details:
        "- Split into teams, no goalies\n- Small goals unless big group\n- Bring a black AND a white shirt\n- Shin guards not required, cleats recommended\n- Recommended $20 for the season",
    });
    console.log("Inserted settings row:", id);
    return id;
  },
});
```

Note: the default `details` markdown captures the exact bullet list from the original requirements. The admin can edit any of this through the admin UI later.

- [ ] **Step 9.2: Push and run the seed**

```bash
npx convex dev --once
npx convex run seedSettings:run '{}'
```

Expected output: `Inserted settings row: <id>` on first run, `Settings already exist: <id>` on subsequent runs.

- [ ] **Step 9.3: Verify via the public query**

```bash
npx convex run public:getUpcomingWeek '{}'
```

Expected: a JSON object with a `date` (next Monday in YYYY-MM-DD), `isOn: true`, and the seeded `settings` fields.

- [ ] **Step 9.4: Commit**

```bash
git add convex/seedSettings.ts
git commit -m "feat(convex): add idempotent settings seed"
```

---

### Task 10: Seed the admin user

**Files:**
- Create: `convex/seedAdminHelpers.ts`
- Create: `convex/seedAdmin.ts`

The seed is split into two files to obey the Convex guideline that `"use node";` files must NOT export queries or mutations. `seedAdmin.ts` runs in Node (it calls `createAccount`, which relies on Node-flavored crypto). The role-patching mutation lives in `seedAdminHelpers.ts` (default V8 runtime) and is invoked via `ctx.runMutation`.

- [ ] **Step 10.1: Set admin credentials as Convex env vars**

```bash
npx convex env set ADMIN_EMAIL admin@example.com
npx convex env set ADMIN_PASSWORD 'a-strong-password-you-pick'
```

(Replace with the user's chosen email and a strong password. These are stored only in the Convex deployment's env, not committed to git.)

- [ ] **Step 10.2: Create `convex/seedAdminHelpers.ts`**

```ts
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const setAdminRole = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, { role: "admin" });
  },
});
```

- [ ] **Step 10.3: Create `convex/seedAdmin.ts`**

```ts
"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD via `npx convex env set`",
      );
    }

    const existing = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: email },
    }).catch(() => null);
    if (existing) {
      console.log("Admin already exists:", existing.user._id);
      return existing.user._id;
    }

    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: { email },
      shouldLinkViaEmail: false,
    });

    await ctx.runMutation(internal.seedAdminHelpers.setAdminRole, {
      userId: user._id as Id<"users">,
    });
    console.log("Seeded admin:", user._id);
    return user._id;
  },
});
```

- [ ] **Step 10.4: Push and run the seed**

```bash
npx convex dev --once
npx convex run seedAdmin:run '{}'
```

Expected: `Seeded admin: <userId>` on first run, `Admin already exists: <userId>` thereafter.

- [ ] **Step 10.5: Verify the admin user exists with role**

In the Convex dashboard's Data tab, open the `users` table. Expected: one row with the configured email and `role: "admin"`.

- [ ] **Step 10.6: Commit**

```bash
git add convex/seedAdminHelpers.ts convex/seedAdmin.ts
git commit -m "feat(convex): add idempotent admin seed via @convex-dev/auth createAccount"
```

---

## Phase 5 — Next.js client integration

### Task 11: Convex client provider and root layout

**Files:**
- Create: `app/ConvexClientProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 11.1: Create `app/ConvexClientProvider.tsx`**

```tsx
"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
```

`ConvexAuthNextjsProvider` internally uses `ConvexProviderWithAuth` and wires the auth-token fetch — this is the only correct provider when using Convex Auth. Per the project's Convex AI guidelines, plain `ConvexProvider` does not send auth tokens and must not be used here.

- [ ] **Step 11.2: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pickup Soccer — Waterbury, VT",
  description: "Weekly pickup soccer in Waterbury, Vermont.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
```

The server provider wraps `<html>` so it can read/write the auth cookie via `next/headers`.

- [ ] **Step 11.3: Verify the app still boots**

Start the dev server in a background terminal:

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Expected: the existing Create-Next-App welcome page (we replace it in Task 14). No console errors related to Convex or auth.

- [ ] **Step 11.4: Commit**

```bash
git add app/ConvexClientProvider.tsx app/layout.tsx
git commit -m "feat(web): wire Convex auth providers into root layout"
```

---

### Task 12: Auth middleware

**Files:**
- Create: `middleware.ts`

Note on Next.js 16: `middleware.ts` is being renamed to `proxy.ts` (the function `middleware` to `proxy`). Both still work in 16.2.4 — `middleware.ts` is deprecated, not removed. We use `middleware.ts` to match Convex Auth's docs verbatim. A future codemod (`npx @next/codemod@canary middleware-to-proxy .`) can rename it later.

- [ ] **Step 12.1: Create `middleware.ts`**

```ts
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/admin");
    }
    if (isAdminRoute(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
  },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

The matcher excludes static files (`.*\\..*`) and Next internals (`_next`) so the middleware only runs on app routes.

- [ ] **Step 12.2: Restart the dev server and check**

If `npm run dev` is already running, stop and restart it (middleware is read at boot).

```bash
npm run dev
```

Open `http://localhost:3000/admin` in a browser. Expected: redirects to `http://localhost:3000/signin`. The signin page itself does not exist yet (Task 14), so you will see a Next.js 404 — that is fine, the middleware is doing its job.

- [ ] **Step 12.3: Commit**

```bash
git add middleware.ts
git commit -m "feat(web): gate /admin and /signin via Convex auth middleware"
```

---

## Phase 6 — Pages

### Task 13: Public homepage

**Files:**
- Replace: `app/page.tsx`
- Create: `app/_components/UpcomingWeek.tsx`
- Create: `app/_components/LastSession.tsx`
- Create: `app/_lib/format.ts`

- [ ] **Step 13.1: Create `app/_lib/format.ts`**

```ts
const DAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_NAMES_PLURAL = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

export function formatDayPlural(dayOfWeek: number): string {
  return DAY_NAMES_PLURAL[dayOfWeek] ?? "Game days";
}

export function formatDayLong(dayOfWeek: number): string {
  return DAY_NAMES_LONG[dayOfWeek] ?? "the game";
}

// "18:00" → "6:00 PM"
export function formatStartTime(startTime: string): string {
  const [hStr, mStr] = startTime.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// "2026-05-04" → "Monday, May 4"
export function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
```

- [ ] **Step 13.2: Create `app/_components/UpcomingWeek.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  formatDateLong,
  formatDayLong,
  formatDayPlural,
  formatStartTime,
} from "../_lib/format";

export function UpcomingWeek() {
  const data = useQuery(api.public.getUpcomingWeek);

  if (data === undefined) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  const { date, isOn, reason, settings } = data;
  const scheduleLine = `${formatDayPlural(settings.dayOfWeek)} at ${formatStartTime(
    settings.startTime,
  )} — ${settings.location}`;

  return (
    <section className="space-y-3">
      {!isOn && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">
          <p className="font-semibold">
            NO SOCCER this {formatDayLong(settings.dayOfWeek)} ({formatDateLong(date)})
          </p>
          {reason ? <p className="mt-1 text-sm">{reason}</p> : null}
        </div>
      )}
      <p className="text-lg font-medium">{scheduleLine}</p>
      <pre className="whitespace-pre-wrap font-sans text-base text-zinc-700 dark:text-zinc-300">
        {settings.details}
      </pre>
    </section>
  );
}
```

We render `settings.details` via `<pre className="whitespace-pre-wrap font-sans">` to honor newlines without pulling in a markdown library. This is a deliberate v1 simplification — bullets render as literal `-` characters, which is acceptable for the bullet-list style the user authored. If richer markdown becomes wanted, swap in `react-markdown` later.

- [ ] **Step 13.3: Create `app/_components/LastSession.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDateLong } from "../_lib/format";

const conditionLabel: Record<string, string> = {
  sunny: "Sunny",
  cloudy: "Cloudy",
  rainy: "Rainy",
  snowy: "Snowy",
  windy: "Windy",
  cold: "Cold",
};

export function LastSession() {
  const recap = useQuery(api.public.getLatestRecap);
  if (recap === undefined) return null; // still loading
  if (recap === null) return null; // no recap yet — render nothing

  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Last session — {formatDateLong(recap.date)}
      </h2>
      <ul className="mt-2 space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
        {recap.turnout !== undefined && <li>{recap.turnout} players</li>}
        {(recap.weatherCondition || recap.weather) && (
          <li>
            {recap.weatherCondition ? conditionLabel[recap.weatherCondition] : null}
            {recap.weatherCondition && recap.weather ? " — " : null}
            {recap.weather}
          </li>
        )}
      </ul>
      {recap.recapNotes ? (
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">
          {recap.recapNotes}
        </pre>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 13.4: Replace `app/page.tsx`**

```tsx
import { UpcomingWeek } from "./_components/UpcomingWeek";
import { LastSession } from "./_components/LastSession";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Pickup Soccer — Waterbury, VT
        </h1>
      </header>
      <UpcomingWeek />
      <LastSession />
    </main>
  );
}
```

- [ ] **Step 13.5: Verify in the browser**

Start the dev server if it is not running:

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
- Page title: "Pickup Soccer — Waterbury, VT".
- A schedule line like "Mondays at 6:00 PM — TBD — set me from the admin page".
- The seeded markdown bullets rendered with line breaks.
- No "Last session" card (no recap yet).
- No console errors.

- [ ] **Step 13.6: Commit**

```bash
git add app/page.tsx app/_components/UpcomingWeek.tsx app/_components/LastSession.tsx app/_lib/format.ts
git commit -m "feat(web): build public homepage with upcoming-week and last-session sections"
```

---

### Task 14: Sign-in page

**Files:**
- Create: `app/signin/page.tsx`
- Create: `app/signin/SignInForm.tsx`

- [ ] **Step 14.1: Create `app/signin/SignInForm.tsx`**

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mx-auto flex w-full max-w-sm flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const fd = new FormData(e.currentTarget);
        try {
          await signIn("password", {
            email: fd.get("email") as string,
            password: fd.get("password") as string,
            flow: "signIn",
          });
          router.push("/admin");
        } catch {
          setError("Invalid email or password.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
```

The form hardcodes `flow: "signIn"` — never `"signUp"`. Combined with `profile()` throwing in `convex/auth.ts`, this prevents any client from creating an account.

- [ ] **Step 14.2: Create `app/signin/page.tsx`**

```tsx
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Admin sign-in</h1>
      <SignInForm />
    </main>
  );
}
```

- [ ] **Step 14.3: Smoke-test in browser**

With dev server running, open `http://localhost:3000/signin`. Expected:
- The sign-in form renders.
- Submitting wrong credentials shows "Invalid email or password."
- Submitting the correct admin credentials (set in Task 10) redirects to `http://localhost:3000/admin`. The admin page does not exist yet (404); that is fine for this task.

- [ ] **Step 14.4: Commit**

```bash
git add app/signin
git commit -m "feat(web): add admin sign-in page"
```

---

### Task 15: Admin page

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/AdminClient.tsx`
- Create: `app/admin/StatusForm.tsx`
- Create: `app/admin/SettingsForm.tsx`
- Create: `app/admin/RecapForm.tsx`
- Create: `app/admin/SignOutButton.tsx`

The admin page is a Server Component that performs the auth/role gate, then renders a Client Component (`AdminClient`) which contains all the forms and live data.

- [ ] **Step 15.1: Create a server-side `me` query**

Modify `convex/public.ts` — add the query at the bottom of the file:

```ts
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { email: user.email, role: user.role };
  },
});
```

Add the import to the top of `convex/public.ts`:

```ts
import { getAuthUserId } from "@convex-dev/auth/server";
```

Push:

```bash
npx convex dev --once
```

- [ ] **Step 15.2: Create `app/admin/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  if (!(await isAuthenticatedNextjs())) {
    redirect("/signin");
  }
  const token = await convexAuthNextjsToken();
  const me = await fetchQuery(api.public.me, {}, { token });
  if (!me || me.role !== "admin") {
    redirect("/");
  }
  return <AdminClient adminEmail={me.email ?? ""} />;
}
```

The middleware (Task 12) already redirects unauthenticated requests, but a Server Component must defend itself too: middleware can be skipped (e.g., for prefetched RSC payloads), so we keep both gates.

- [ ] **Step 15.3: Create `app/admin/SignOutButton.tsx`**

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/");
      }}
      className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 15.4: Create `app/admin/StatusForm.tsx`**

```tsx
"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  formatDateLong,
  formatDayLong,
} from "../_lib/format";

export function StatusForm() {
  const data = useQuery(api.public.getUpcomingWeek);
  const setStatus = useMutation(api.admin.setUpcomingStatus);
  const [pending, setPending] = useState(false);

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;
  const { date, isOn, reason, settings } = data;

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const nextIsOn = fd.get("isOn") === "on";
        const nextReason = fd.get("reason") as string;
        await setStatus({
          isOn: nextIsOn,
          reason: nextIsOn ? undefined : nextReason || undefined,
        });
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">
        {formatDayLong(settings.dayOfWeek)}, {formatDateLong(date)}
      </h2>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="isOn"
          type="checkbox"
          defaultChecked={isOn}
          className="h-4 w-4"
        />
        Soccer is ON
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Reason (only used if OFF)
        <textarea
          name="reason"
          defaultValue={reason ?? ""}
          rows={2}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Save status"}
      </button>
    </form>
  );
}
```

- [ ] **Step 15.5: Create `app/admin/SettingsForm.tsx`**

```tsx
"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function SettingsForm() {
  const data = useQuery(api.public.getUpcomingWeek);
  const update = useMutation(api.admin.updateSettings);
  const [pending, setPending] = useState(false);

  if (!data) return <p className="text-sm text-zinc-500">Loading…</p>;
  const { settings } = data;

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const fd = new FormData(e.currentTarget);
        await update({
          dayOfWeek: parseInt(fd.get("dayOfWeek") as string, 10),
          startTime: fd.get("startTime") as string,
          location: fd.get("location") as string,
          details: fd.get("details") as string,
        });
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">Schedule settings</h2>
      <label className="flex flex-col gap-1 text-sm">
        Day of week
        <select
          name="dayOfWeek"
          defaultValue={settings.dayOfWeek}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start time (24h, HH:mm)
        <input
          name="startTime"
          type="time"
          defaultValue={settings.startTime}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Location
        <input
          name="location"
          type="text"
          defaultValue={settings.location}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Details (markdown)
        <textarea
          name="details"
          defaultValue={settings.details}
          rows={8}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
```

- [ ] **Step 15.6: Create `app/admin/RecapForm.tsx`**

```tsx
"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatDateLong } from "../_lib/format";

const CONDITIONS = ["sunny", "cloudy", "rainy", "snowy", "windy", "cold"] as const;

export function RecapForm() {
  const recap = useQuery(api.public.getLatestRecap);
  const save = useMutation(api.admin.saveRecap);
  const [pending, setPending] = useState(false);

  if (recap === undefined) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const turnoutRaw = fd.get("turnout") as string;
        const conditionRaw = fd.get("weatherCondition") as string;
        await save({
          turnout: turnoutRaw === "" ? null : Number(turnoutRaw),
          weatherCondition:
            conditionRaw === ""
              ? null
              : (conditionRaw as (typeof CONDITIONS)[number]),
          weather: ((fd.get("weather") as string) || null) as string | null,
          recapNotes: ((fd.get("recapNotes") as string) || null) as string | null,
        });
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">
        Last session recap
        {recap?.date ? (
          <span className="ml-2 text-sm font-normal text-zinc-500">
            ({formatDateLong(recap.date)})
          </span>
        ) : null}
      </h2>
      <p className="text-xs text-zinc-500">
        Saves to the most recent past game day, computed server-side from the
        configured day of week.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Turnout
        <input
          name="turnout"
          type="number"
          min="0"
          defaultValue={recap?.turnout ?? ""}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">Weather condition</legend>
        <label className="flex items-center gap-1">
          <input
            name="weatherCondition"
            type="radio"
            value=""
            defaultChecked={!recap?.weatherCondition}
          />
          (none)
        </label>
        {CONDITIONS.map((c) => (
          <label key={c} className="flex items-center gap-1">
            <input
              name="weatherCondition"
              type="radio"
              value={c}
              defaultChecked={recap?.weatherCondition === c}
            />
            {c}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Weather (free text)
        <input
          name="weather"
          type="text"
          defaultValue={recap?.weather ?? ""}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes (markdown)
        <textarea
          name="recapNotes"
          defaultValue={recap?.recapNotes ?? ""}
          rows={4}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Save recap"}
      </button>
    </form>
  );
}
```

Note on form prefill behavior: the recap form prefills from `getLatestRecap`, which only returns past rows that already have at least one recap field set. The very first time the admin writes a recap, `recap` will be `null` and the form fields will be blank. That is the correct UX — there is nothing to prefill.

Also: this form's "what date am I editing?" label only appears once a recap exists. For the first-ever submission it shows just "Last session recap". The mutation's server-side date computation (Task 8) is the source of truth either way.

- [ ] **Step 15.7: Create `app/admin/AdminClient.tsx`**

```tsx
"use client";

import { StatusForm } from "./StatusForm";
import { SettingsForm } from "./SettingsForm";
import { RecapForm } from "./RecapForm";
import { SignOutButton } from "./SignOutButton";

export function AdminClient({ adminEmail }: { adminEmail: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-zinc-500">{adminEmail}</p>
        </div>
        <SignOutButton />
      </header>
      <StatusForm />
      <SettingsForm />
      <RecapForm />
    </main>
  );
}
```

- [ ] **Step 15.8: Smoke-test the full admin flow in the browser**

With dev server running:

1. Open `http://localhost:3000/admin` in a private window. Expected: redirected to `/signin`.
2. Sign in with the seeded credentials. Expected: redirected to `/admin`, three forms render.
3. Edit the Status form: uncheck "Soccer is ON", type a reason like "field maintenance", save. Expected: no error.
4. Open `http://localhost:3000/` in another tab. Expected: red "NO SOCCER" banner with the reason. Then go back, re-check the box, save, refresh public page — banner gone.
5. Edit the Settings form: change `details` to a different markdown bullet list, save. Refresh public page. Expected: new bullets appear.
6. Edit the Recap form: enter `12` for turnout, pick "sunny", type weather "warm and dry", save. Refresh public page. Expected: "Last session" card appears with those values.
7. Click Sign out. Expected: redirected to `/`. Visiting `/admin` again redirects to `/signin`.

If any step fails, fix the underlying code (do not paper over it) and re-run the relevant step.

- [ ] **Step 15.9: Commit**

```bash
git add app/admin convex/public.ts
git commit -m "feat(web): add gated /admin page with status, settings, and recap forms"
```

---

## Phase 7 — Final verification

### Task 16: Lint, build, and final commit

**Files:** none (verification only)

- [ ] **Step 16.1: Run the linter**

```bash
npm run lint
```

Expected: zero warnings. If anything trips, fix at the source rather than disabling the rule.

- [ ] **Step 16.2: Run the unit tests**

```bash
npm test
```

Expected: all date-helper tests pass.

- [ ] **Step 16.3: Run the production build**

```bash
npm run build
```

Expected: build completes. Common gotchas to fix if they appear:
- Type errors from any field name mismatch — read the error message; the schema (Task 2) and the React forms (Task 15) must agree.
- "Cannot find module 'convex/_generated/api'" — run `npx convex dev --once` once more to regenerate.
- Missing `NEXT_PUBLIC_CONVEX_URL` — confirm `.env.local` is present and contains it.

- [ ] **Step 16.4: Final smoke test on the production build**

```bash
npm run start
```

Open `http://localhost:3000` and walk through the same scenarios from Step 15.8 against the production build. Expected: identical behavior.

- [ ] **Step 16.5: Stop here**

No commit needed for Step 16 — all work was committed in earlier tasks. If the build or lint forced any fixes, those are their own commits with messages like `fix: <thing>`.

---

## Self-review checklist (for the planner)

This checklist was run when the plan was written. It is left in the document only as a reference for the implementer.

- [x] Spec coverage: every section of `docs/superpowers/specs/2026-04-28-pickup-soccer-schema-design.md` maps to a task above. Settings table (Task 2). gameDays table (Task 2). Upcoming-game-day logic (Task 6). `getUpcomingWeek` (Task 7). `getLatestRecap` (Task 7). `setUpcomingStatus` (Task 8). `updateSettings` (Task 8). `saveRecap` (Task 8). Auth setup (Tasks 1, 3). `requireAdmin` (Task 4). Settings seed (Task 9). Admin seed (Task 10). Admin UI sign-in/sign-out/forms (Tasks 14, 15). Public UI (Task 13). Middleware gate (Task 12).
- [x] Type consistency: `gameDays` field names (`isOn`, `reason`, `turnout`, `weatherCondition`, `weather`, `recapNotes`) match across schema (Task 2), mutations (Task 8), public queries (Task 7), and forms (Task 15). The `weatherCondition` enum values are spelled identically everywhere.
- [x] No placeholders: every code block is complete. Every command has expected output. No "TBD" or "implement later".
- [x] Two minor duplications acknowledged inline: a small `todayLocalDateString` helper appears in both `convex/public.ts` and conceptually in `convex/lib/dates.ts` — flagged in Task 7 with the option to dedupe. Day-name arrays are local to `app/_lib/format.ts` (frontend) — intentional, the formatting logic is frontend-only and not duplicated server-side.
