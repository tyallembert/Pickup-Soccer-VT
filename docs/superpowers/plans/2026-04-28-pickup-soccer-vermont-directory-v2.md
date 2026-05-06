# Pickup Soccer — Vermont Directory v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A statewide Vermont pickup soccer directory. Anyone can submit a pickup game (must create an account first); the super-admin moderates submissions; approved locations appear on a public map + filterable list, each with its own per-week status and post-session recap maintained by the location's owner.

**Architecture:** Next.js 16 App Router frontend, Convex backend (`locations`, `gameDays`, `users`-with-`role`), `@convex-dev/auth` password-only with sign-up enabled, three-tier auth helper layer (`requireAuth`, `requireOwnerOf`, `requireAdmin`). Public homepage uses Leaflet + OpenStreetMap tiles + marker clustering. Polish layer uses GSAP, lazy-loaded on the client.

**Tech Stack:** Next.js 16.2.4, React 19.2.4, Convex 1.36.1, `@convex-dev/auth` (already installed), `@auth/core@0.37.0` (already installed), Tailwind CSS 4, Vitest (pure-TS unit tests), `leaflet` + `react-leaflet` + `react-leaflet-cluster`, `gsap` + `@gsap/react`.

**Reference spec:** `docs/superpowers/specs/2026-04-28-pickup-soccer-vermont-directory-design.md`.

**Working directory:** All file paths are relative to `/Users/tyallembert/Development/projects/pickup-soccer`. Run all commands from that directory.

**Conventions:**
- Each task lists exact files involved, then bite-sized steps.
- Pure logic (date helpers) is built TDD with Vitest. Convex queries/mutations are verified manually via `npx convex run`. UI is verified by running the dev server and exercising features in a browser.
- Commit at the end of each task with a Conventional-Commits-style message. The user has approved working directly on `main`.

**Pre-existing v1 work that carries forward** (reused without further change unless a task says otherwise):
- T1 (commit `82818ac`) installed `@convex-dev/auth` and `@auth/core@0.37.0` and ran `npx @convex-dev/auth` to set `JWT_PRIVATE_KEY`/`JWKS`/`SITE_URL` on the dev deployment. **Reused.**
- T2 (commits `9d0a5f5`, `7e0147a`) created `convex/schema.ts` with `users` (extending authTables, with `role` and both `email`/`phone` indexes), `settings`, and `gameDays`. **Schema is rewritten in Task 1 below.**
- T3 (commit `088ad72`) created `convex/auth.config.ts`, `convex/auth.ts` (sign-up disabled), `convex/http.ts`. **`auth.ts` is rewritten in Task 2 below; the other two stay as-is.**

The Convex dev deployment is `dev:trustworthy-hare-550` and has no real data, so we can change the schema freely without a migration plan.

---

## Phase 1 — Schema & auth foundation

### Task 1: Rewrite `convex/schema.ts` for the directory data model

**Files:**
- Modify: `convex/schema.ts`

**Steps:**

- [ ] **Step 1.1: Replace the contents of `convex/schema.ts`** with:

```ts
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const weatherCondition = v.union(
  v.literal("sunny"),
  v.literal("cloudy"),
  v.literal("rainy"),
  v.literal("snowy"),
  v.literal("windy"),
  v.literal("cold"),
);

export const locationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export default defineSchema({
  ...authTables,

  // Index names "email" and "phone" must match exactly what @convex-dev/auth
  // expects internally — do not rename to follow the project's by_<field>
  // convention.
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  locations: defineTable({
    name: v.string(),
    town: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    dayOfWeek: v.number(), // 0 = Sunday … 6 = Saturday
    startTime: v.string(), // "HH:mm" 24-hour
    details: v.string(), // markdown
    ownerId: v.id("users"),
    status: locationStatus,
    rejectionReason: v.optional(v.string()),
    submittedAt: v.number(),
    approvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_status_and_town", ["status", "town"]),

  gameDays: defineTable({
    locationId: v.id("locations"),
    date: v.string(), // "YYYY-MM-DD" in America/New_York
    isOn: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    turnout: v.optional(v.number()),
    weatherCondition: v.optional(weatherCondition),
    weather: v.optional(v.string()),
    recapNotes: v.optional(v.string()),
  })
    .index("by_location_and_date", ["locationId", "date"])
    .index("by_location", ["locationId"]),
});
```

Notes:
- `weatherCondition` and `locationStatus` are exported so other Convex files (`convex/admin.ts` etc.) and the frontend can import the same union literals instead of duplicating them.
- The v1 `settings` table is removed entirely. The v1 `gameDays.by_date` single-key index is removed; queries always scope by `locationId` now.
- `users` is unchanged from the latest v1 state (commit `7e0147a`) — both `email` and `phone` indexes remain.

- [ ] **Step 1.2: Push the schema**

```bash
npx convex dev --once
```

Expected: completes without schema errors, reports adding the new `locations`/`gameDays` indexes and removing the old `settings` table and `gameDays.by_date` index.

- [ ] **Step 1.3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(convex): rewrite schema for the Vermont directory (locations + per-location gameDays)"
```

---

### Task 2: Enable sign-up in `convex/auth.ts`

**Files:**
- Modify: `convex/auth.ts`

**Steps:**

- [ ] **Step 2.1: Replace the contents of `convex/auth.ts`** with:

```ts
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        // Public sign-up is enabled. New accounts get role="user" by default.
        // The super-admin role is granted only by the seed script in Task 4.
        return {
          email: params.email as string,
          role: "user",
        };
      },
    }),
  ],
});
```

The v1 `profile()` block that threw `ConvexError("Public sign-up is disabled.")` is removed. We now return a profile so Convex Auth inserts a new `users` row on sign-up.

- [ ] **Step 2.2: Push and verify**

```bash
npx convex dev --once
```

Expected: no errors. The Functions tab in the Convex dashboard still shows `auth:signIn`, `auth:signOut`, `auth:store`, `auth:isAuthenticated`.

- [ ] **Step 2.3: Commit**

```bash
git add convex/auth.ts
git commit -m "feat(convex): enable public sign-up via Password provider profile()"
```

---

### Task 3: Auth helpers (`requireAuth`, `requireOwnerOf`, `requireAdmin`)

**Files:**
- Create or replace: `convex/lib/auth.ts`

**Steps:**

- [ ] **Step 3.1: Replace `convex/lib/auth.ts`** with:

```ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not authenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("Not authenticated");
  }
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new ConvexError("Forbidden");
  }
  return user;
}

export async function requireOwnerOf(
  ctx: QueryCtx | MutationCtx,
  locationId: Id<"locations">,
): Promise<{ user: Doc<"users">; location: Doc<"locations"> }> {
  const user = await requireAuth(ctx);
  const location = await ctx.db.get(locationId);
  if (!location) {
    throw new ConvexError("Location not found");
  }
  const isOwner = location.ownerId === user._id;
  const isAdmin = user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new ConvexError("Forbidden");
  }
  return { user, location };
}
```

`requireOwnerOf` returns both the user and the location so callers don't have to re-fetch the location.

- [ ] **Step 3.2: Push**

```bash
npx convex dev --once
```

Expected: no errors. (No public functions changed; this file just exports helpers.)

- [ ] **Step 3.3: Commit**

```bash
git add convex/lib/auth.ts
git commit -m "feat(convex): add requireAuth, requireOwnerOf, requireAdmin helpers"
```

---

### Task 4: Admin user seed

**Files:**
- Create: `convex/seedAdminHelpers.ts`
- Create: `convex/seedAdmin.ts`

The seed is split across two files because `convex/seedAdmin.ts` uses `"use node";` (required for `@convex-dev/auth`'s `createAccount` Node-flavored crypto) and Convex AI guidelines forbid mixing `"use node";` with mutations in the same file.

**Steps:**

- [ ] **Step 4.1: Set admin credentials as Convex env vars**

```bash
npx convex env set ADMIN_EMAIL admin@example.com
npx convex env set ADMIN_PASSWORD 'a-strong-password-you-pick'
```

(Replace with the user's actual chosen credentials — these stay in Convex env, not in git.)

- [ ] **Step 4.2: Create `convex/seedAdminHelpers.ts`**

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

- [ ] **Step 4.3: Create `convex/seedAdmin.ts`**

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

- [ ] **Step 4.4: Push and run**

```bash
npx convex dev --once
npx convex run seedAdmin:run '{}'
```

Expected output: `Seeded admin: <userId>` on first run, `Admin already exists: <userId>` thereafter. The user row in the Convex dashboard should have `role: "admin"`.

- [ ] **Step 4.5: Commit**

```bash
git add convex/seedAdminHelpers.ts convex/seedAdmin.ts
git commit -m "feat(convex): add idempotent admin seed via @convex-dev/auth createAccount"
```

---

## Phase 2 — Pure helpers (TDD)

### Task 5: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

**Steps:**

- [ ] **Step 5.1: Install Vitest**

```bash
npm install --save-dev vitest
```

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

- [ ] **Step 5.3: Add `test` script to `package.json`**

In `package.json`'s `"scripts"` block, add `"test": "vitest run"`. The block becomes:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```

- [ ] **Step 5.4: Verify the runner works (and finds nothing yet)**

```bash
npm test
```

Expected: Vitest exits cleanly with 0 tests (no test files yet).

- [ ] **Step 5.5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-TS unit tests"
```

---

### Task 6: Date helpers (TDD) — `upcomingGameDay` and `mostRecentPastGameDay`

**Files:**
- Create: `convex/lib/dates.ts`
- Test: `convex/lib/dates.test.ts`

These are timezone-aware helpers. They take `(now: Date, dayOfWeek: number, startTime: string)` and return a `YYYY-MM-DD` date string in America/New_York.

- [ ] **Step 6.1: Write the failing tests**

Create `convex/lib/dates.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { mostRecentPastGameDay, upcomingGameDay } from "./dates";

describe("upcomingGameDay", () => {
  test("Saturday afternoon → next Monday", () => {
    const now = new Date("2026-05-02T18:00:00Z"); // 2pm EDT Sat
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday before start time → today", () => {
    const now = new Date("2026-05-04T21:00:00Z"); // 5pm EDT Mon, game at 6
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday after start time → next Monday", () => {
    const now = new Date("2026-05-04T23:00:00Z"); // 7pm EDT Mon
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-05-11");
  });

  test("dayOfWeek configurable — Wednesday game, Tuesday now → Wednesday", () => {
    const now = new Date("2026-05-05T18:00:00Z");
    expect(upcomingGameDay(now, 3, "18:00")).toBe("2026-05-06");
  });

  test("DST boundary — November fall-back week", () => {
    // 2026-11-02 is a Monday. EST (post fall-back).
    const now = new Date("2026-11-02T04:00:00Z");
    expect(upcomingGameDay(now, 1, "18:00")).toBe("2026-11-02");
  });
});

describe("mostRecentPastGameDay", () => {
  test("Wednesday → previous Monday", () => {
    const now = new Date("2026-05-06T18:00:00Z");
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });

  test("Monday before start time → previous Monday (today does not count)", () => {
    const now = new Date("2026-05-04T21:00:00Z");
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-04-27");
  });

  test("Monday after start time → today (game has begun)", () => {
    const now = new Date("2026-05-04T23:00:00Z");
    expect(mostRecentPastGameDay(now, 1, "18:00")).toBe("2026-05-04");
  });
});
```

- [ ] **Step 6.2: Run tests, confirm they fail**

```bash
npm test
```

Expected: `Cannot find module './dates'` failure.

- [ ] **Step 6.3: Implement `convex/lib/dates.ts`**

```ts
const TIMEZONE = "America/New_York";

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

function localDayOfWeek(d: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

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

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
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

  let delta = (dayOfWeek - todayDow + 7) % 7;
  if (delta === 0) delta = 7;
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

  let delta = (todayDow - dayOfWeek + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(today, -delta);
}

// Returns "YYYY-MM-DD" for *today* in TIMEZONE. Used by queries that filter
// for past dates.
export function todayInTimezone(now: Date): string {
  return toLocalDateString(now);
}
```

- [ ] **Step 6.4: Run tests, confirm they pass**

```bash
npm test
```

Expected: all 8 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add convex/lib/dates.ts convex/lib/dates.test.ts
git commit -m "feat(convex): add timezone-aware game-day date helpers"
```

---

## Phase 3 — Convex queries

### Task 7: Public read queries

**Files:**
- Create: `convex/public.ts`

- [ ] **Step 7.1: Create `convex/public.ts`**

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { mostRecentPastGameDay, todayInTimezone, upcomingGameDay } from "./lib/dates";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

type PublicLocation = {
  _id: Id<"locations">;
  name: string;
  town: string;
  address: string;
  lat: number;
  lng: number;
  dayOfWeek: number;
  startTime: string;
  details: string;
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

async function buildPublicLocation(
  ctx: QueryCtx,
  loc: Doc<"locations">,
  now: Date,
): Promise<PublicLocation> {
  const upcomingDate = upcomingGameDay(now, loc.dayOfWeek, loc.startTime);
  const upcomingRow = await ctx.db
    .query("gameDays")
    .withIndex("by_location_and_date", (q) =>
      q.eq("locationId", loc._id).eq("date", upcomingDate),
    )
    .unique();

  const recapRows = await ctx.db
    .query("gameDays")
    .withIndex("by_location", (q) => q.eq("locationId", loc._id))
    .order("desc")
    .take(50);
  const today = todayInTimezone(now);
  const hasRecap = (r: Doc<"gameDays">) =>
    r.turnout !== undefined ||
    r.weatherCondition !== undefined ||
    r.weather !== undefined ||
    r.recapNotes !== undefined;
  const lastRow = recapRows.find((r) => r.date < today && hasRecap(r));

  const isOn = upcomingRow?.isOn ?? true;

  return {
    _id: loc._id,
    name: loc.name,
    town: loc.town,
    address: loc.address,
    lat: loc.lat,
    lng: loc.lng,
    dayOfWeek: loc.dayOfWeek,
    startTime: loc.startTime,
    details: loc.details,
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

    if (args.dayOfWeek !== undefined) {
      rows = rows.filter((r) => r.dayOfWeek === args.dayOfWeek);
    }

    if (args.search) {
      const needle = args.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          r.town.toLowerCase().includes(needle),
      );
    }

    return Promise.all(rows.map((r) => buildPublicLocation(ctx, r, now)));
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
```

Notes:
- `listLocations` uses `by_status_and_town` when a town is provided, falls back to `by_status` otherwise. Day-of-week and search filtering happen in JS over the bounded result set (≤200), which is acceptable per the Convex AI guidelines (the guideline forbids using `.filter()` *on the database query*; in-memory filtering of a bounded post-fetch array is fine).
- `buildPublicLocation` runs once per row. With 200 locations and two index lookups each, that's 400 reads — well within Convex query limits.
- `getLocation` throws `ConvexError("Location not found")` for non-approved locations rather than leaking moderation state.

- [ ] **Step 7.2: Push and smoke-test**

```bash
npx convex dev --once
npx convex run public:listLocations '{}'
```

Expected: returns `[]` (no approved locations yet).

```bash
npx convex run public:distinctTowns '{}'
```

Expected: returns `[]`.

- [ ] **Step 7.3: Commit**

```bash
git add convex/public.ts
git commit -m "feat(convex): add public listLocations, getLocation, distinctTowns queries"
```

---

### Task 8: User-scoped queries (`me`, `myLocations`, `getMyLocation`)

**Files:**
- Modify: `convex/public.ts` (append the queries to the same file — they read user-scoped public-ish data)

Why same file: keeps the public/user query namespace as `api.public.*` and avoids a tiny `convex/users.ts` with one function.

- [ ] **Step 8.1: Append to `convex/public.ts`**

Add these imports at the top (next to existing imports):

```ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth, requireOwnerOf } from "./lib/auth";
```

Append at the bottom:

```ts
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
    return rows.map((r) => ({
      _id: r._id,
      name: r.name,
      town: r.town,
      status: r.status,
      rejectionReason: r.rejectionReason,
      submittedAt: r.submittedAt,
    }));
  },
});

export const getMyLocation = query({
  args: { id: v.id("locations") },
  handler: async (ctx, { id }) => {
    const { location } = await requireOwnerOf(ctx, id);
    const now = new Date();
    let thisWeek: { date: string; isOn: boolean; reason?: string } | null = null;
    let lastSession: PublicLocation["lastSession"] = null;

    if (location.status === "approved") {
      const upcomingDate = upcomingGameDay(now, location.dayOfWeek, location.startTime);
      const upcomingRow = await ctx.db
        .query("gameDays")
        .withIndex("by_location_and_date", (q) =>
          q.eq("locationId", location._id).eq("date", upcomingDate),
        )
        .unique();
      const isOn = upcomingRow?.isOn ?? true;
      thisWeek = { date: upcomingDate, isOn, reason: isOn ? undefined : upcomingRow?.reason };

      const recapRows = await ctx.db
        .query("gameDays")
        .withIndex("by_location", (q) => q.eq("locationId", location._id))
        .order("desc")
        .take(50);
      const today = todayInTimezone(now);
      const lastRow = recapRows.find(
        (r) =>
          r.date < today &&
          (r.turnout !== undefined ||
            r.weatherCondition !== undefined ||
            r.weather !== undefined ||
            r.recapNotes !== undefined),
      );
      if (lastRow) {
        lastSession = {
          date: lastRow.date,
          turnout: lastRow.turnout,
          weatherCondition: lastRow.weatherCondition,
          weather: lastRow.weather,
          recapNotes: lastRow.recapNotes,
        };
      }
    }

    return {
      ...location,
      thisWeek,
      lastSession,
    };
  },
});
```

- [ ] **Step 8.2: Push**

```bash
npx convex dev --once
```

- [ ] **Step 8.3: Commit**

```bash
git add convex/public.ts
git commit -m "feat(convex): add me, myLocations, getMyLocation queries"
```

---

### Task 9: Admin-scoped queries

**Files:**
- Create: `convex/admin.ts` (queries section first; mutations come in Tasks 11-12)

- [ ] **Step 9.1: Create `convex/admin.ts`**

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { locationStatus } from "./schema";

export const pendingLocations = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("locations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc") // oldest first by _creationTime within the index
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
    return {
      ...loc,
      ownerEmail: owner?.email ?? "",
    };
  },
});
```

`locationStatus` is imported from `./schema` (we exported it in Task 1).

- [ ] **Step 9.2: Push and smoke-test**

```bash
npx convex dev --once
```

We can't easily smoke-test admin queries from the CLI without mocking auth. Verification happens end-to-end in Task 24+ when the admin UI exists.

- [ ] **Step 9.3: Commit**

```bash
git add convex/admin.ts
git commit -m "feat(convex): add admin queries pendingLocations, allLocations, adminGetLocation"
```

---

## Phase 4 — Convex mutations

### Task 10: Submission mutations (`submitLocation`, `resubmitLocation`)

**Files:**
- Create: `convex/submissions.ts`

- [ ] **Step 10.1: Create `convex/submissions.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { requireAuth, requireOwnerOf } from "./lib/auth";

const MAX_NOT_YET_APPROVED = 3;

export const submitLocation = mutation({
  args: {
    name: v.string(),
    town: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    dayOfWeek: v.number(),
    startTime: v.string(),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Rate-limit: count pending + rejected submissions for this user.
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

    const id = await ctx.db.insert("locations", {
      ...args,
      ownerId: user._id,
      status: "pending",
      submittedAt: Date.now(),
    });
    return id;
  },
});

export const resubmitLocation = mutation({
  args: { id: v.id("locations") },
  handler: async (ctx, { id }) => {
    const { location } = await requireOwnerOf(ctx, id);
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

- [ ] **Step 10.2: Push**

```bash
npx convex dev --once
```

- [ ] **Step 10.3: Commit**

```bash
git add convex/submissions.ts
git commit -m "feat(convex): add submitLocation and resubmitLocation mutations"
```

---

### Task 11: Owner mutations (`updateLocation`, `setLocationStatus`, `saveRecap`)

**Files:**
- Create: `convex/owner.ts`

- [ ] **Step 11.1: Create `convex/owner.ts`**

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
    dayOfWeek: v.optional(v.number()),
    startTime: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const { location } = await requireOwnerOf(ctx, id);
    await ctx.db.patch(location._id, patch);
    return null;
  },
});

export const setLocationStatus = mutation({
  args: {
    id: v.id("locations"),
    isOn: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { id, isOn, reason }) => {
    const { location } = await requireOwnerOf(ctx, id);
    if (location.status !== "approved") {
      throw new ConvexError("Location must be approved before setting weekly status.");
    }
    const date = upcomingGameDay(new Date(), location.dayOfWeek, location.startTime);
    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_location_and_date", (q) =>
        q.eq("locationId", location._id).eq("date", date),
      )
      .unique();

    const patch = { isOn, reason: isOn ? undefined : reason };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", {
        locationId: location._id,
        date,
        ...patch,
      });
    }
    return { date, isOn };
  },
});

export const saveRecap = mutation({
  args: {
    id: v.id("locations"),
    turnout: v.optional(v.union(v.number(), v.null())),
    weatherCondition: v.optional(v.union(weatherCondition, v.null())),
    weather: v.optional(v.union(v.string(), v.null())),
    recapNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...args }) => {
    const { location } = await requireOwnerOf(ctx, id);
    if (location.status !== "approved") {
      throw new ConvexError("Location must be approved before writing a recap.");
    }
    const date = mostRecentPastGameDay(
      new Date(),
      location.dayOfWeek,
      location.startTime,
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
      .withIndex("by_location_and_date", (q) =>
        q.eq("locationId", location._id).eq("date", date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", {
        locationId: location._id,
        date,
        ...patch,
      });
    }
    return { date };
  },
});
```

- [ ] **Step 11.2: Push**

```bash
npx convex dev --once
```

- [ ] **Step 11.3: Commit**

```bash
git add convex/owner.ts
git commit -m "feat(convex): add owner mutations updateLocation, setLocationStatus, saveRecap"
```

---

### Task 12: Admin mutations (moderation + admin overrides)

**Files:**
- Modify: `convex/admin.ts` (append mutations to the existing file)

- [ ] **Step 12.1: Append to `convex/admin.ts`**

Add at the top (next to existing imports):

```ts
import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { mostRecentPastGameDay, upcomingGameDay } from "./lib/dates";
import { weatherCondition } from "./schema";
```

Append at the bottom of the file:

```ts
// Moderation

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
    // Delete all gameDays rows for this location, then the location itself.
    // Convex mutation transaction limits handle 100s of rows easily; if a
    // single location ever has thousands of gameDays rows this can be made
    // batched + scheduled, but v2 doesn't need that.
    const days = await ctx.db
      .query("gameDays")
      .withIndex("by_location", (q) => q.eq("locationId", id))
      .take(1000);
    for (const d of days) {
      await ctx.db.delete(d._id);
    }
    await ctx.db.delete(id);
    return null;
  },
});

// Admin overrides — same shape as owner mutations, gated by requireAdmin.

export const adminUpdateLocation = mutation({
  args: {
    id: v.id("locations"),
    name: v.optional(v.string()),
    town: v.optional(v.string()),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    dayOfWeek: v.optional(v.number()),
    startTime: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const adminSetLocationStatus = mutation({
  args: {
    id: v.id("locations"),
    isOn: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { id, isOn, reason }) => {
    await requireAdmin(ctx);
    const loc = await ctx.db.get(id);
    if (!loc) throw new ConvexError("Location not found");
    const date = upcomingGameDay(new Date(), loc.dayOfWeek, loc.startTime);
    const existing = await ctx.db
      .query("gameDays")
      .withIndex("by_location_and_date", (q) =>
        q.eq("locationId", id).eq("date", date),
      )
      .unique();
    const patch = { isOn, reason: isOn ? undefined : reason };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", { locationId: id, date, ...patch });
    }
    return { date };
  },
});

export const adminSaveRecap = mutation({
  args: {
    id: v.id("locations"),
    turnout: v.optional(v.union(v.number(), v.null())),
    weatherCondition: v.optional(v.union(weatherCondition, v.null())),
    weather: v.optional(v.union(v.string(), v.null())),
    recapNotes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...args }) => {
    await requireAdmin(ctx);
    const loc = await ctx.db.get(id);
    if (!loc) throw new ConvexError("Location not found");
    const date = mostRecentPastGameDay(new Date(), loc.dayOfWeek, loc.startTime);

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
      .withIndex("by_location_and_date", (q) =>
        q.eq("locationId", id).eq("date", date),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gameDays", { locationId: id, date, ...patch });
    }
    return { date };
  },
});
```

- [ ] **Step 12.2: Push**

```bash
npx convex dev --once
```

- [ ] **Step 12.3: Commit**

```bash
git add convex/admin.ts
git commit -m "feat(convex): add admin moderation and override mutations"
```

---

## Phase 5 — Next.js shell

### Task 13: Convex client provider + root layout

**Files:**
- Create: `app/ConvexClientProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 13.1: Create `app/ConvexClientProvider.tsx`**

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

- [ ] **Step 13.2: Replace `app/layout.tsx`**

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
  title: "Vermont Pickup Soccer",
  description: "A directory of pickup soccer games across Vermont.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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

- [ ] **Step 13.3: Verify the dev server boots**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: existing welcome page (we replace it in Task 19), no Convex/auth console errors.

- [ ] **Step 13.4: Commit**

```bash
git add app/ConvexClientProvider.tsx app/layout.tsx
git commit -m "feat(web): wire Convex auth providers into root layout"
```

---

### Task 14: Auth middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 14.1: Create `middleware.ts`**

```ts
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isAuthPage = createRouteMatcher(["/signin", "/signup"]);
const isAccountRoute = createRouteMatcher(["/account(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const authed = await convexAuth.isAuthenticated();
    if (isAuthPage(request) && authed) {
      return nextjsMiddlewareRedirect(request, "/account");
    }
    if ((isAccountRoute(request) || isAdminRoute(request)) && !authed) {
      const url = new URL(request.url);
      const redirect = url.pathname + url.search;
      return nextjsMiddlewareRedirect(
        request,
        `/signin?redirect=${encodeURIComponent(redirect)}`,
      );
    }
  },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

The middleware only enforces "is the user authenticated?" — the role check (admin vs regular user) happens in Server Components for `/admin/*` so the Server Component can issue a `redirect("/")` for non-admins.

`/submit` is *not* gated by the middleware. The page itself handles the unauthenticated case (form re-hydration via `sessionStorage`, redirect to `/signup`) per the spec.

- [ ] **Step 14.2: Verify**

Open `http://localhost:3000/account` (no auth yet). Expected: redirected to `/signin?redirect=%2Faccount`. The signin page itself doesn't exist yet (404); that's fine.

- [ ] **Step 14.3: Commit**

```bash
git add middleware.ts
git commit -m "feat(web): gate /account and /admin via Convex auth middleware"
```

---

### Task 15: Sign-in and sign-up pages

**Files:**
- Create: `app/signin/page.tsx`
- Create: `app/signin/SignInForm.tsx`
- Create: `app/signup/page.tsx`
- Create: `app/signup/SignUpForm.tsx`

- [ ] **Step 15.1: Create `app/signin/SignInForm.tsx`**

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
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
          router.push(params.get("redirect") ?? "/account");
        } catch {
          setError("Invalid email or password.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required autoComplete="current-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button type="submit" disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-zinc-600">
        New here?{" "}
        <Link
          href={`/signup${params.get("redirect") ? `?redirect=${encodeURIComponent(params.get("redirect")!)}` : ""}`}
          className="underline"
        >
          Create an account
        </Link>
        .
      </p>
    </form>
  );
}
```

- [ ] **Step 15.2: Create `app/signin/page.tsx`**

```tsx
import { Suspense } from "react";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
```

`Suspense` is needed because `useSearchParams` opts the page out of static rendering otherwise.

- [ ] **Step 15.3: Create `app/signup/SignUpForm.tsx`**

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function SignUpForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
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
        const password = fd.get("password") as string;
        const confirm = fd.get("confirm") as string;
        if (password !== confirm) {
          setError("Passwords don't match.");
          setPending(false);
          return;
        }
        try {
          await signIn("password", {
            email: fd.get("email") as string,
            password,
            flow: "signUp",
          });
          router.push(params.get("redirect") ?? "/account");
        } catch (e) {
          const message = e instanceof Error ? e.message : "";
          if (message.toLowerCase().includes("already")) {
            setError("An account already exists for that email. Sign in instead.");
          } else {
            setError("Couldn't create an account. Check your email and try again.");
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required autoComplete="new-password" minLength={8}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm password
        <input name="confirm" type="password" required autoComplete="new-password" minLength={8}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button type="submit" disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Creating account…" : "Create account"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          href={`/signin${params.get("redirect") ? `?redirect=${encodeURIComponent(params.get("redirect")!)}` : ""}`}
          className="underline"
        >
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}
```

- [ ] **Step 15.4: Create `app/signup/page.tsx`**

```tsx
import { Suspense } from "react";
import { SignUpForm } from "./SignUpForm";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 15.5: Smoke test**

With dev server running:
1. Open `/signup`. Submit a fresh email + password. Expected: redirected to `/account` (which 404s for now — fine, the form did its job).
2. Sign out (use the Convex dashboard's user record to verify the user was created with `role: "user"`, OR write the sign-out flow as part of Task 22).
3. Open `/signin`. Sign in with that same email/password. Expected: redirected to `/account` again.

If sign-up fails with "Public sign-up is disabled," recheck Task 2 — the `profile()` block must return a profile, not throw.

- [ ] **Step 15.6: Commit**

```bash
git add app/signin app/signup
git commit -m "feat(web): add sign-in and sign-up pages with redirect support"
```

---

## Phase 6 — Public UI (map + list)

### Task 16: Install map and animation dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 16.1: Install dependencies**

```bash
npm install leaflet react-leaflet react-leaflet-cluster
npm install --save-dev @types/leaflet
npm install gsap @gsap/react
```

- [ ] **Step 16.2: Add Leaflet CSS to `app/globals.css`**

Open `app/globals.css` and add at the very top:

```css
@import "leaflet/dist/leaflet.css";
@import "react-leaflet-cluster/styles.css";
```

(If `react-leaflet-cluster`'s styles path differs in the installed version, use the path the package's README documents. Check the README at `node_modules/react-leaflet-cluster/README.md` if needed.)

- [ ] **Step 16.3: Verify the build still compiles**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: existing page still renders, no console errors.

- [ ] **Step 16.4: Commit**

```bash
git add package.json package-lock.json app/globals.css
git commit -m "chore: install leaflet, react-leaflet, react-leaflet-cluster, gsap"
```

---

### Task 17: Shared `LocationPin` component (draggable map + geocoding)

**Files:**
- Create: `app/_components/LocationPin.tsx`
- Create: `app/_lib/geocode.ts`

- [ ] **Step 17.1: Create `app/_lib/geocode.ts`**

```ts
const VT_VIEWBOX = "-73.5,42.7,-71.4,45.05"; // lng_min, lat_min, lng_max, lat_max
const VT_CENTER: [number, number] = [44.0, -72.7];

export type GeocodeResult = { lat: number; lng: number } | null;

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!address.trim()) return null;
  const params = new URLSearchParams({
    q: address,
    format: "json",
    countrycodes: "us",
    viewbox: VT_VIEWBOX,
    bounded: "1",
    limit: "1",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { "Accept-Language": "en-US,en;q=0.5" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export const VERMONT_CENTER = VT_CENTER;
```

- [ ] **Step 17.2: Create `app/_components/LocationPin.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { LatLngExpression } from "leaflet";
import { VERMONT_CENTER } from "../_lib/geocode";

// React-Leaflet must be loaded client-only (Leaflet touches `window`).
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);

export type LocationPinProps = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  draggable?: boolean;
};

export function LocationPin({
  lat,
  lng,
  onChange,
  height = 280,
  draggable = true,
}: LocationPinProps) {
  const markerRef = useRef<L.Marker | null>(null);

  // Once on mount, fix the default Leaflet icon paths (Next bundles them as URLs)
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const icon = L.icon({
        iconUrl: (await import("leaflet/dist/images/marker-icon.png")).default.src,
        iconRetinaUrl: (await import("leaflet/dist/images/marker-icon-2x.png")).default.src,
        shadowUrl: (await import("leaflet/dist/images/marker-shadow.png")).default.src,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      L.Marker.prototype.options.icon = icon;
    })();
  }, []);

  const center: LatLngExpression =
    lat !== null && lng !== null ? [lat, lng] : VERMONT_CENTER;

  return (
    <div style={{ height }} className="overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
      <MapContainer
        center={center}
        zoom={lat !== null && lng !== null ? 15 : 8}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {lat !== null && lng !== null ? (
          <Marker
            position={[lat, lng]}
            draggable={draggable}
            eventHandlers={{
              dragend: (e) => {
                const m = e.target as L.Marker;
                const pos = m.getLatLng();
                onChange(pos.lat, pos.lng);
              },
            }}
            ref={(m) => {
              markerRef.current = m as L.Marker | null;
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
```

If the `leaflet/dist/images/marker-*.png` imports complain about types, add `declare module "leaflet/dist/images/*.png";` to a new `app/global.d.ts` or use Next's built-in image handling.

- [ ] **Step 17.3: Smoke test**

We don't have a page using `LocationPin` yet. Verify it compiles:

```bash
npm run build
```

Expected: build succeeds. (Yes — bundling pulls Leaflet's PNGs through Next's asset pipeline.)

- [ ] **Step 17.4: Commit**

```bash
git add app/_components/LocationPin.tsx app/_lib/geocode.ts
git commit -m "feat(web): add reusable draggable LocationPin component and Nominatim geocoder"
```

---

### Task 18: GSAP MotionShell

**Files:**
- Create: `app/_components/MotionShell.tsx`

- [ ] **Step 18.1: Create `app/_components/MotionShell.tsx`**

```tsx
"use client";

import { useGSAP } from "@gsap/react";
import { ReactNode, useRef } from "react";
import gsap from "gsap";

type Variant = "fade-up" | "fade-in";

export function MotionShell({
  children,
  variant = "fade-up",
  delay = 0,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const targets = ref.current.children;
      const from =
        variant === "fade-up"
          ? { y: 24, opacity: 0 }
          : { opacity: 0 };
      gsap.from(targets, {
        ...from,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.08,
        delay,
      });
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
```

This is the v2 baseline animation primitive. More elaborate animations get layered in during Task 28.

- [ ] **Step 18.2: Commit**

```bash
git add app/_components/MotionShell.tsx
git commit -m "feat(web): add MotionShell GSAP animation wrapper"
```

---

### Task 19: Public homepage (hero, map, filter, list)

**Files:**
- Create: `app/_lib/format.ts`
- Create: `app/_components/HomeHero.tsx`
- Create: `app/_components/LocationsMap.tsx`
- Create: `app/_components/LocationsList.tsx`
- Create: `app/_components/Filters.tsx`
- Create: `app/_components/HomeView.tsx`
- Replace: `app/page.tsx`

The homepage is a Client Component that owns filter state and feeds it to the map and list. The Server Component shell is `app/page.tsx`.

- [ ] **Step 19.1: Create `app/_lib/format.ts`**

```ts
const DAY_NAMES_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_NAMES_PLURAL = ["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"];

export function formatDayPlural(d: number) { return DAY_NAMES_PLURAL[d] ?? "Game days"; }
export function formatDayLong(d: number) { return DAY_NAMES_LONG[d] ?? "the game"; }

export function formatStartTime(t: string) {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDateLong(s: string) {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
}
```

- [ ] **Step 19.2: Create `app/_components/HomeHero.tsx`**

```tsx
"use client";

import Link from "next/link";
import { MotionShell } from "./MotionShell";

export function HomeHero() {
  return (
    <section className="px-6 pt-16 pb-12">
      <MotionShell variant="fade-up">
        <p className="text-sm uppercase tracking-widest text-zinc-500">Vermont</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight">Pickup Soccer</h1>
        <p className="mt-3 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          A directory of weekly pickup games across the state. Find one near you, or add your own.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/submit"
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add a pickup game
          </Link>
        </div>
      </MotionShell>
    </section>
  );
}
```

- [ ] **Step 19.3: Create `app/_components/LocationsMap.tsx`**

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { VERMONT_CENTER } from "../_lib/geocode";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const MarkerClusterGroup = dynamic(() => import("react-leaflet-cluster"), { ssr: false });

import { formatDayPlural, formatStartTime } from "../_lib/format";

export type MapLocation = {
  _id: string;
  name: string;
  town: string;
  lat: number;
  lng: number;
  dayOfWeek: number;
  startTime: string;
};

export function LocationsMap({ locations }: { locations: MapLocation[] }) {
  // Defer the icon-fix to client mount (same pattern as LocationPin).
  const [iconReady, setIconReady] = useState(false);
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const icon = L.icon({
        iconUrl: (await import("leaflet/dist/images/marker-icon.png")).default.src,
        iconRetinaUrl: (await import("leaflet/dist/images/marker-icon-2x.png")).default.src,
        shadowUrl: (await import("leaflet/dist/images/marker-shadow.png")).default.src,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      L.Marker.prototype.options.icon = icon;
      setIconReady(true);
    })();
  }, []);

  if (!iconReady) {
    return <div style={{ height: 480 }} className="rounded-md bg-zinc-100 dark:bg-zinc-900" />;
  }

  return (
    <div style={{ height: 480 }} className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
      <MapContainer
        center={VERMONT_CENTER}
        zoom={8}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup>
          {locations.map((l) => (
            <Marker key={l._id} position={[l.lat, l.lng]}>
              <Popup>
                <strong>{l.name}</strong>
                <div>{l.town}</div>
                <div>
                  {formatDayPlural(l.dayOfWeek)} at {formatStartTime(l.startTime)}
                </div>
                <a href={`/locations/${l._id}`} className="underline">View details</a>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 19.4: Create `app/_components/Filters.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const DAY_OPTIONS = [
  { value: "", label: "Any day" },
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function Filters({
  search,
  town,
  dayOfWeek,
  onChange,
}: {
  search: string;
  town: string;
  dayOfWeek: string;
  onChange: (next: { search: string; town: string; dayOfWeek: string }) => void;
}) {
  const towns = useQuery(api.public.distinctTowns) ?? [];

  return (
    <div className="flex flex-wrap gap-3 px-6">
      <input
        value={search}
        onChange={(e) => onChange({ search: e.target.value, town, dayOfWeek })}
        placeholder="Search name or town"
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        value={town}
        onChange={(e) => onChange({ search, town: e.target.value, dayOfWeek })}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">Any town</option>
        {towns.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select
        value={dayOfWeek}
        onChange={(e) => onChange({ search, town, dayOfWeek: e.target.value })}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {DAY_OPTIONS.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 19.5: Create `app/_components/LocationsList.tsx`**

```tsx
"use client";

import Link from "next/link";
import { MotionShell } from "./MotionShell";
import { formatDayPlural, formatStartTime } from "../_lib/format";

export type ListLocation = {
  _id: string;
  name: string;
  town: string;
  dayOfWeek: number;
  startTime: string;
  thisWeek: { date: string; isOn: boolean; reason?: string };
  lastSession: { date: string; turnout?: number } | null;
};

export function LocationsList({ locations }: { locations: ListLocation[] }) {
  if (!locations.length) {
    return <p className="px-6 text-sm text-zinc-500">No matches. Try clearing filters.</p>;
  }
  return (
    <MotionShell variant="fade-up">
      <ul className="grid grid-cols-1 gap-3 px-6 sm:grid-cols-2">
        {locations.map((l) => (
          <li key={l._id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <Link href={`/locations/${l._id}`} className="block">
              <p className="text-base font-semibold">{l.name}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{l.town}</p>
              <p className="mt-1 text-sm">
                {formatDayPlural(l.dayOfWeek)} at {formatStartTime(l.startTime)}
              </p>
              {l.thisWeek.isOn ? (
                <p className="mt-2 text-xs uppercase tracking-wide text-green-700 dark:text-green-400">
                  ON this {l.thisWeek.date}
                </p>
              ) : (
                <p className="mt-2 text-xs uppercase tracking-wide text-red-700 dark:text-red-400">
                  OFF — {l.thisWeek.reason ?? "cancelled"}
                </p>
              )}
              {l.lastSession?.turnout !== undefined ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Last: {l.lastSession.turnout} players
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </MotionShell>
  );
}
```

- [ ] **Step 19.6: Create `app/_components/HomeView.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Filters } from "./Filters";
import { LocationsMap } from "./LocationsMap";
import { LocationsList } from "./LocationsList";
import { HomeHero } from "./HomeHero";

export function HomeView() {
  const [filters, setFilters] = useState({ search: "", town: "", dayOfWeek: "" });

  const locations = useQuery(api.public.listLocations, {
    search: filters.search || undefined,
    town: filters.town || undefined,
    dayOfWeek: filters.dayOfWeek === "" ? undefined : parseInt(filters.dayOfWeek, 10),
  });

  return (
    <>
      <HomeHero />
      <section className="px-6 pb-6">
        <LocationsMap locations={locations ?? []} />
      </section>
      <Filters {...filters} onChange={setFilters} />
      <section className="py-6">
        <LocationsList locations={locations ?? []} />
      </section>
    </>
  );
}
```

- [ ] **Step 19.7: Replace `app/page.tsx`**

```tsx
import { HomeView } from "./_components/HomeView";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <HomeView />
    </main>
  );
}
```

- [ ] **Step 19.8: Smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
- Hero with title and "Add a pickup game" button.
- Empty Vermont map (no pins, until Task 24+ tests approve a real submission).
- Filter row with empty town dropdown.
- "No matches" list message.
- No console errors.

If the map fails to render or icons are broken, double-check Step 16.2 (Leaflet CSS imported) and Step 17.2 (icon URL fix-up).

- [ ] **Step 19.9: Commit**

```bash
git add app/_lib/format.ts app/_components/HomeHero.tsx app/_components/LocationsMap.tsx app/_components/LocationsList.tsx app/_components/Filters.tsx app/_components/HomeView.tsx app/page.tsx
git commit -m "feat(web): build public homepage with map + filterable list"
```

---

### Task 20: Location detail page

**Files:**
- Create: `app/locations/[id]/page.tsx`
- Create: `app/locations/[id]/LocationDetail.tsx`

- [ ] **Step 20.1: Create `app/locations/[id]/LocationDetail.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LocationPin } from "@/app/_components/LocationPin";
import { formatDateLong, formatDayPlural, formatStartTime } from "@/app/_lib/format";

export function LocationDetail({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.public.getLocation, { id });

  if (data === undefined) return <p className="px-6 py-12 text-sm text-zinc-500">Loading…</p>;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <p className="text-sm uppercase tracking-widest text-zinc-500">{data.town}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
        <p className="mt-2 text-base text-zinc-700 dark:text-zinc-300">{data.address}</p>
      </header>

      <p className="text-lg">
        {formatDayPlural(data.dayOfWeek)} at {formatStartTime(data.startTime)}
      </p>

      <LocationPin lat={data.lat} lng={data.lng} onChange={() => {}} draggable={false} height={240} />

      <pre className="whitespace-pre-wrap font-sans text-base text-zinc-700 dark:text-zinc-300">
        {data.details}
      </pre>

      {data.thisWeek.isOn ? (
        <section className="rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950">
          <p className="font-semibold">ON this {formatDateLong(data.thisWeek.date)}.</p>
        </section>
      ) : (
        <section className="rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
          <p className="font-semibold">
            NO SOCCER this {formatDateLong(data.thisWeek.date)}
          </p>
          {data.thisWeek.reason ? <p className="mt-1 text-sm">{data.thisWeek.reason}</p> : null}
        </section>
      )}

      {data.lastSession ? (
        <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Last session — {formatDateLong(data.lastSession.date)}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.lastSession.turnout !== undefined ? <li>{data.lastSession.turnout} players</li> : null}
            {data.lastSession.weatherCondition || data.lastSession.weather ? (
              <li>
                {data.lastSession.weatherCondition ?? null}
                {data.lastSession.weatherCondition && data.lastSession.weather ? " — " : null}
                {data.lastSession.weather ?? null}
              </li>
            ) : null}
          </ul>
          {data.lastSession.recapNotes ? (
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">
              {data.lastSession.recapNotes}
            </pre>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 20.2: Create `app/locations/[id]/page.tsx`**

```tsx
import { LocationDetail } from "./LocationDetail";
import type { Id } from "@/convex/_generated/dataModel";

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LocationDetail id={id as Id<"locations">} />;
}
```

(In Next.js 16 App Router, `params` is a Promise and must be `await`ed.)

- [ ] **Step 20.3: Smoke test**

Open `http://localhost:3000/locations/<some-fake-id>`. Expected: "Loading…" then a Convex error in the console (no such location). That's correct behavior — we'll see real data once a submission is approved in later tasks.

- [ ] **Step 20.4: Commit**

```bash
git add app/locations
git commit -m "feat(web): add public location detail page"
```

---

## Phase 7 — Owner UI

### Task 21: `/submit` page

**Files:**
- Create: `app/submit/page.tsx`
- Create: `app/submit/SubmitForm.tsx`

- [ ] **Step 21.1: Create `app/submit/SubmitForm.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { LocationPin } from "@/app/_components/LocationPin";
import { geocodeAddress } from "@/app/_lib/geocode";

const STORAGE_KEY = "pickup-soccer-submit-draft";

type Draft = {
  name: string;
  town: string;
  address: string;
  lat: number | null;
  lng: number | null;
  dayOfWeek: number;
  startTime: string;
  details: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  town: "",
  address: "",
  lat: null,
  lng: null,
  dayOfWeek: 1,
  startTime: "18:00",
  details: "",
};

export function SubmitForm() {
  const router = useRouter();
  const me = useQuery(api.public.me);
  const submit = useMutation(api.submissions.submitLocation);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore from sessionStorage if present.
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setDraft(JSON.parse(raw)); } catch {}
    }
  }, []);

  // Persist on every change.
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onAddressBlur = async () => {
    if (!draft.address.trim()) return;
    const geo = await geocodeAddress(draft.address);
    if (geo) update({ lat: geo.lat, lng: geo.lng });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (draft.lat === null || draft.lng === null) {
      setError("Drop the pin on the map before submitting.");
      return;
    }
    if (me === null) {
      router.push(`/signup?redirect=${encodeURIComponent("/submit")}`);
      return;
    }
    setPending(true);
    try {
      const id = await submit({
        name: draft.name,
        town: draft.town,
        address: draft.address,
        lat: draft.lat,
        lng: draft.lng,
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        details: draft.details,
      });
      sessionStorage.removeItem(STORAGE_KEY);
      router.push(`/account/locations/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Add a pickup game</h1>
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
        You'll need a free account to submit. We'll prompt you when you save.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          required value={draft.name} onChange={(e) => update({ name: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Town
        <input
          required value={draft.town} onChange={(e) => update({ town: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input
          required value={draft.address}
          onChange={(e) => update({ address: e.target.value })}
          onBlur={onAddressBlur}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div>
        <p className="mb-1 text-sm">Map pin (drag to fine-tune)</p>
        <LocationPin
          lat={draft.lat}
          lng={draft.lng}
          onChange={(lat, lng) => update({ lat, lng })}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Day of week
        <select value={draft.dayOfWeek} onChange={(e) => update({ dayOfWeek: parseInt(e.target.value, 10) })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label, i) => (
            <option key={i} value={i}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start time
        <input type="time" required value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Details (markdown)
        <textarea rows={6} value={draft.details} onChange={(e) => update({ details: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900" />
      </label>

      <button type="submit" disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Submitting…" : me === null ? "Continue to sign up" : "Submit for review"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 21.2: Create `app/submit/page.tsx`**

```tsx
import { SubmitForm } from "./SubmitForm";

export default function SubmitPage() {
  return <SubmitForm />;
}
```

- [ ] **Step 21.3: Smoke test**

1. Sign out (clear cookies in dev tools or use the Convex Auth `signOut` later).
2. Open `/submit`. Fill in fields. Address blur should drop a pin on the map. Drag the pin around — coords update.
3. Click submit. Expected: redirected to `/signup?redirect=%2Fsubmit`. After signup, you land back on `/submit` with the form re-hydrated. Submit again — actually saves and redirects to `/account/locations/<id>` (which 404s until Task 23).

- [ ] **Step 21.4: Commit**

```bash
git add app/submit
git commit -m "feat(web): add /submit page with sessionStorage draft, geocoding, draggable pin"
```

---

### Task 22: `/account` overview page

**Files:**
- Create: `app/account/page.tsx`
- Create: `app/account/AccountClient.tsx`
- Create: `app/account/SignOutButton.tsx`

- [ ] **Step 22.1: Create `app/account/SignOutButton.tsx`**

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      onClick={async () => { await signOut(); router.push("/"); }}
      className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 22.2: Create `app/account/AccountClient.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignOutButton } from "./SignOutButton";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  approved: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};

export function AccountClient({ email, role }: { email: string; role: string }) {
  const locations = useQuery(api.public.myLocations);
  const isAdmin = role === "admin";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your account</h1>
          <p className="text-sm text-zinc-500">{email}</p>
        </div>
        <SignOutButton />
      </header>

      {isAdmin ? (
        <p className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          You are signed in as the super-admin.{" "}
          <Link href="/admin" className="underline">Open the admin dashboard →</Link>
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your locations
        </h2>
        {locations === undefined ? (
          <p className="mt-2 text-sm text-zinc-500">Loading…</p>
        ) : locations.length === 0 ? (
          <p className="mt-2 text-sm">You haven't submitted any pickup games yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {locations.map((l) => (
              <li key={l._id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <Link href={`/account/locations/${l._id}`} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{l.name}</span>
                    <span className="ml-2 text-sm text-zinc-500">{l.town}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${STATUS_BADGE[l.status]}`}>
                    {l.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/submit" className="mt-3 inline-block text-sm underline">
          + Add another pickup game
        </Link>
      </section>
    </main>
  );
}
```

- [ ] **Step 22.3: Create `app/account/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  if (!(await isAuthenticatedNextjs())) redirect("/signin?redirect=%2Faccount");
  const token = await convexAuthNextjsToken();
  const me = await fetchQuery(api.public.me, {}, { token });
  if (!me) redirect("/signin?redirect=%2Faccount");
  return <AccountClient email={me.email} role={me.role} />;
}
```

- [ ] **Step 22.4: Smoke test**

Sign in, open `/account`. Expected: header with your email, "Your locations" section listing whatever you submitted in Task 21, plus the "Add another pickup game" link. If you're the seeded admin, the green admin link is visible.

- [ ] **Step 22.5: Commit**

```bash
git add app/account/page.tsx app/account/AccountClient.tsx app/account/SignOutButton.tsx
git commit -m "feat(web): add /account overview page"
```

---

### Task 23: `/account/locations/[id]` owner edit page

**Files:**
- Create: `app/account/locations/[id]/page.tsx`
- Create: `app/account/locations/[id]/OwnerLocationClient.tsx`
- Create: `app/_components/StatusForm.tsx`
- Create: `app/_components/SettingsForm.tsx`
- Create: `app/_components/RecapForm.tsx`

The three forms are reused on the admin override page (Task 27), so they live in `app/_components/`.

- [ ] **Step 23.1: Create `app/_components/SettingsForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { LocationPin } from "./LocationPin";
import { geocodeAddress } from "../_lib/geocode";

export type SettingsFormValues = {
  name: string;
  town: string;
  address: string;
  lat: number;
  lng: number;
  dayOfWeek: number;
  startTime: string;
  details: string;
};

export function SettingsForm({
  initial,
  onSave,
}: {
  initial: SettingsFormValues;
  onSave: (values: SettingsFormValues) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await onSave(v);
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">Schedule settings</h2>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Town
        <input value={v.town} onChange={(e) => setV({ ...v, town: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input value={v.address}
          onChange={(e) => setV({ ...v, address: e.target.value })}
          onBlur={async () => {
            const geo = await geocodeAddress(v.address);
            if (geo) setV({ ...v, lat: geo.lat, lng: geo.lng });
          }}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <LocationPin lat={v.lat} lng={v.lng} onChange={(lat, lng) => setV({ ...v, lat, lng })} />
      <label className="flex flex-col gap-1 text-sm">
        Day of week
        <select value={v.dayOfWeek} onChange={(e) => setV({ ...v, dayOfWeek: parseInt(e.target.value, 10) })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label, i) => (
            <option key={i} value={i}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start time
        <input type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Details (markdown)
        <textarea rows={6} value={v.details} onChange={(e) => setV({ ...v, details: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
```

- [ ] **Step 23.2: Create `app/_components/StatusForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { formatDateLong, formatDayLong } from "../_lib/format";

export function StatusForm({
  date,
  isOn,
  reason,
  dayOfWeek,
  onSave,
}: {
  date: string;
  isOn: boolean;
  reason: string | undefined;
  dayOfWeek: number;
  onSave: (next: { isOn: boolean; reason?: string }) => Promise<void>;
}) {
  const [next, setNext] = useState({ isOn, reason: reason ?? "" });
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await onSave({
          isOn: next.isOn,
          reason: next.isOn ? undefined : next.reason || undefined,
        });
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">
        {formatDayLong(dayOfWeek)}, {formatDateLong(date)}
      </h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={next.isOn} onChange={(e) => setNext({ ...next, isOn: e.target.checked })} className="h-4 w-4" />
        Soccer is ON
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Reason (only used if OFF)
        <textarea rows={2} value={next.reason} onChange={(e) => setNext({ ...next, reason: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Saving…" : "Save status"}
      </button>
    </form>
  );
}
```

- [ ] **Step 23.3: Create `app/_components/RecapForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { formatDateLong } from "../_lib/format";

const CONDITIONS = ["sunny","cloudy","rainy","snowy","windy","cold"] as const;
type Condition = (typeof CONDITIONS)[number];

export function RecapForm({
  date,
  initial,
  onSave,
}: {
  date: string | null;
  initial: {
    turnout?: number;
    weatherCondition?: Condition;
    weather?: string;
    recapNotes?: string;
  };
  onSave: (values: {
    turnout: number | null;
    weatherCondition: Condition | null;
    weather: string | null;
    recapNotes: string | null;
  }) => Promise<void>;
}) {
  const [v, setV] = useState({
    turnout: initial.turnout ?? "",
    weatherCondition: initial.weatherCondition ?? ("" as Condition | ""),
    weather: initial.weather ?? "",
    recapNotes: initial.recapNotes ?? "",
  });
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await onSave({
          turnout: v.turnout === "" ? null : Number(v.turnout),
          weatherCondition: v.weatherCondition === "" ? null : v.weatherCondition,
          weather: v.weather || null,
          recapNotes: v.recapNotes || null,
        });
        setPending(false);
      }}
    >
      <h2 className="text-lg font-semibold">
        Last session recap
        {date ? <span className="ml-2 text-sm font-normal text-zinc-500">({formatDateLong(date)})</span> : null}
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        Turnout
        <input type="number" min={0} value={v.turnout}
          onChange={(e) => setV({ ...v, turnout: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">Weather condition</legend>
        <label className="flex items-center gap-1">
          <input type="radio" name="cond" value="" checked={v.weatherCondition === ""}
            onChange={() => setV({ ...v, weatherCondition: "" })} />
          (none)
        </label>
        {CONDITIONS.map((c) => (
          <label key={c} className="flex items-center gap-1">
            <input type="radio" name="cond" value={c} checked={v.weatherCondition === c}
              onChange={() => setV({ ...v, weatherCondition: c })} />
            {c}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Weather (free text)
        <input value={v.weather} onChange={(e) => setV({ ...v, weather: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes (markdown)
        <textarea rows={4} value={v.recapNotes} onChange={(e) => setV({ ...v, recapNotes: e.target.value })}
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900" />
      </label>
      <button disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Saving…" : "Save recap"}
      </button>
    </form>
  );
}
```

- [ ] **Step 23.4: Create `app/account/locations/[id]/OwnerLocationClient.tsx`**

```tsx
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SettingsForm } from "@/app/_components/SettingsForm";
import { StatusForm } from "@/app/_components/StatusForm";
import { RecapForm } from "@/app/_components/RecapForm";

const BANNERS: Record<string, { tone: string; text: string }> = {
  pending: {
    tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
    text: "Awaiting review. You can keep editing while you wait.",
  },
  approved: {
    tone: "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100",
    text: "Live on the directory.",
  },
  rejected: {
    tone: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
    text: "Edit your submission and resubmit.",
  },
};

export function OwnerLocationClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.public.getMyLocation, { id });
  const update = useMutation(api.owner.updateLocation);
  const setStatus = useMutation(api.owner.setLocationStatus);
  const saveRecap = useMutation(api.owner.saveRecap);
  const resubmit = useMutation(api.submissions.resubmitLocation);

  if (data === undefined) return <p className="px-6 py-12 text-sm text-zinc-500">Loading…</p>;

  const banner = BANNERS[data.status];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-zinc-500">{data.town}</p>
      </header>

      <div className={`rounded-md border p-3 text-sm ${banner.tone}`}>
        <p className="font-semibold uppercase tracking-wide">{data.status}</p>
        <p>{banner.text}</p>
        {data.status === "rejected" && data.rejectionReason ? (
          <p className="mt-1">Reason: {data.rejectionReason}</p>
        ) : null}
        {data.status === "rejected" ? (
          <button
            onClick={() => resubmit({ id: data._id })}
            className="mt-2 rounded border border-current px-3 py-1 text-sm"
          >
            Resubmit for review
          </button>
        ) : null}
      </div>

      <SettingsForm
        initial={{
          name: data.name,
          town: data.town,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          details: data.details,
        }}
        onSave={async (v) => { await update({ id: data._id, ...v }); }}
      />

      {data.status === "approved" && data.thisWeek ? (
        <StatusForm
          date={data.thisWeek.date}
          isOn={data.thisWeek.isOn}
          reason={data.thisWeek.reason}
          dayOfWeek={data.dayOfWeek}
          onSave={async ({ isOn, reason }) => { await setStatus({ id: data._id, isOn, reason }); }}
        />
      ) : null}

      {data.status === "approved" ? (
        <RecapForm
          date={data.lastSession?.date ?? null}
          initial={{
            turnout: data.lastSession?.turnout,
            weatherCondition: data.lastSession?.weatherCondition,
            weather: data.lastSession?.weather,
            recapNotes: data.lastSession?.recapNotes,
          }}
          onSave={async (v) => { await saveRecap({ id: data._id, ...v }); }}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 23.5: Create `app/account/locations/[id]/page.tsx`**

```tsx
import { OwnerLocationClient } from "./OwnerLocationClient";
import type { Id } from "@/convex/_generated/dataModel";

export default async function OwnerLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OwnerLocationClient id={id as Id<"locations">} />;
}
```

The middleware (Task 14) gates the page for unauthenticated users. The Convex query `getMyLocation` enforces ownership/admin via `requireOwnerOf` — non-owners hit a `ConvexError("Forbidden")` which the client surfaces as the standard React Query error boundary (a TODO worth wiring in a real product, but a thrown `useQuery` error is acceptable in v2 — it shows a console error and the page stays on "Loading…").

- [ ] **Step 23.6: Smoke test**

Open `/account/locations/<your-pending-id>`. Expected: yellow "Awaiting review" banner, settings form pre-filled. Edit something, save — no error. The `setLocationStatus` and `saveRecap` forms are NOT shown (still pending).

- [ ] **Step 23.7: Commit**

```bash
git add app/account/locations app/_components/SettingsForm.tsx app/_components/StatusForm.tsx app/_components/RecapForm.tsx
git commit -m "feat(web): add owner location edit page with status banners and three forms"
```

---

## Phase 8 — Admin UI

### Task 24: `/admin` overview + queue list

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/queue/page.tsx`
- Create: `app/admin/queue/QueueClient.tsx`

- [ ] **Step 24.1: Create `app/admin/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticatedNextjs())) redirect("/signin?redirect=%2Fadmin");
  const token = await convexAuthNextjsToken();
  const me = await fetchQuery(api.public.me, {}, { token });
  if (!me || me.role !== "admin") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <nav className="flex items-center gap-4 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
        <Link href="/admin" className="font-semibold">Admin</Link>
        <Link href="/admin/queue" className="text-zinc-600 hover:underline dark:text-zinc-400">Queue</Link>
        <Link href="/admin/locations" className="text-zinc-600 hover:underline dark:text-zinc-400">All locations</Link>
        <span className="ml-auto text-zinc-500">{me.email}</span>
      </nav>
      {children}
    </div>
  );
}
```

The layout enforces admin auth for every nested page so we don't repeat the gate.

- [ ] **Step 24.2: Create `app/admin/page.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

export default function AdminOverview() {
  const all = useQuery(api.admin.allLocations, {});
  if (!all) return <p>Loading…</p>;
  const counts = { pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return (
    <section>
      <h1 className="text-2xl font-semibold">Overview</h1>
      <ul className="mt-4 grid grid-cols-3 gap-3">
        <li className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-3xl font-semibold">{counts.pending ?? 0}</p>
          <p className="text-sm">pending</p>
          <Link href="/admin/queue" className="mt-1 block text-sm underline">Open queue →</Link>
        </li>
        <li className="rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950">
          <p className="text-3xl font-semibold">{counts.approved ?? 0}</p>
          <p className="text-sm">approved</p>
        </li>
        <li className="rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
          <p className="text-3xl font-semibold">{counts.rejected ?? 0}</p>
          <p className="text-sm">rejected</p>
        </li>
      </ul>
    </section>
  );
}
```

- [ ] **Step 24.3: Create `app/admin/queue/QueueClient.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function QueueClient() {
  const rows = useQuery(api.admin.pendingLocations);
  if (!rows) return <p>Loading…</p>;
  if (rows.length === 0) return <p>No pending submissions.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r._id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <Link href={`/admin/queue/${r._id}`} className="flex items-center justify-between">
            <span>
              <span className="font-medium">{r.name}</span>
              <span className="ml-2 text-sm text-zinc-500">{r.town}</span>
            </span>
            <span className="text-xs text-zinc-500">{r.ownerEmail}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 24.4: Create `app/admin/queue/page.tsx`**

```tsx
import { QueueClient } from "./QueueClient";

export default function QueuePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Moderation queue</h1>
      <QueueClient />
    </section>
  );
}
```

- [ ] **Step 24.5: Smoke test**

Sign in as the admin (the seeded account from Task 4). Open `/admin`. Expected: counts of pending/approved/rejected, plus a "Open queue" link. Click queue — see your submission(s) from earlier tasks.

- [ ] **Step 24.6: Commit**

```bash
git add app/admin
git commit -m "feat(web): add admin layout, overview, and queue list"
```

---

### Task 25: `/admin/queue/[id]` review page

**Files:**
- Create: `app/admin/queue/[id]/page.tsx`
- Create: `app/admin/queue/[id]/ReviewClient.tsx`

- [ ] **Step 25.1: Create `app/admin/queue/[id]/ReviewClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LocationPin } from "@/app/_components/LocationPin";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";

export function ReviewClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.admin.adminGetLocation, { id });
  const approve = useMutation(api.admin.approveLocation);
  const reject = useMutation(api.admin.rejectLocation);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data) return <p>Loading…</p>;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Review submission</h1>
      <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">By {data.ownerEmail}</p>
        <p className="text-lg font-semibold">{data.name}</p>
        <p>{data.town}</p>
        <p>{data.address}</p>
        <p>
          {formatDayPlural(data.dayOfWeek)} at {formatStartTime(data.startTime)}
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{data.details}</pre>
      </div>
      <LocationPin lat={data.lat} lng={data.lng} onChange={() => {}} draggable={false} height={240} />

      <div className="flex gap-3">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await approve({ id });
            router.push("/admin/queue");
          }}
          className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Approve
        </button>
      </div>

      <details className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-semibold">Reject</summary>
        <textarea
          rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection (will be shown to owner)"
          className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            await reject({ id, reason });
            router.push("/admin/queue");
          }}
          className="mt-2 rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Reject submission
        </button>
      </details>
    </section>
  );
}
```

- [ ] **Step 25.2: Create `app/admin/queue/[id]/page.tsx`**

```tsx
import { ReviewClient } from "./ReviewClient";
import type { Id } from "@/convex/_generated/dataModel";

export default async function QueueItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewClient id={id as Id<"locations">} />;
}
```

- [ ] **Step 25.3: Smoke test**

From the queue list (Task 24), click into a pending item. Expected: read-only view of the submission + a small map. Click Approve → bounced back to queue, item removed. Open the location page (`/locations/<id>`) — now public.

- [ ] **Step 25.4: Commit**

```bash
git add app/admin/queue/\[id\]
git commit -m "feat(web): add admin queue review page with approve/reject"
```

---

### Task 26: `/admin/locations` list

**Files:**
- Create: `app/admin/locations/page.tsx`
- Create: `app/admin/locations/AllLocationsClient.tsx`

- [ ] **Step 26.1: Create `app/admin/locations/AllLocationsClient.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};

export function AllLocationsClient() {
  const [status, setStatus] = useState<"" | "pending" | "approved" | "rejected">("");
  const rows = useQuery(api.admin.allLocations, status ? { status } : {});

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All locations</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | "pending" | "approved" | "rejected")}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {!rows ? <p>Loading…</p> : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r._id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <Link href={`/admin/locations/${r._id}`} className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-sm text-zinc-500">{r.town}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${STATUS_BADGE[r.status]}`}>{r.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 26.2: Create `app/admin/locations/page.tsx`**

```tsx
import { AllLocationsClient } from "./AllLocationsClient";

export default function AdminLocationsPage() {
  return <AllLocationsClient />;
}
```

- [ ] **Step 26.3: Commit**

```bash
git add app/admin/locations
git commit -m "feat(web): add admin all-locations list with status filter"
```

---

### Task 27: `/admin/locations/[id]` admin override edit page

**Files:**
- Create: `app/admin/locations/[id]/page.tsx`
- Create: `app/admin/locations/[id]/AdminLocationClient.tsx`

- [ ] **Step 27.1: Create `app/admin/locations/[id]/AdminLocationClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SettingsForm } from "@/app/_components/SettingsForm";
import { StatusForm } from "@/app/_components/StatusForm";
import { RecapForm } from "@/app/_components/RecapForm";
import { upcomingGameDay, mostRecentPastGameDay } from "@/convex/lib/dates";

export function AdminLocationClient({ id }: { id: Id<"locations"> }) {
  const data = useQuery(api.admin.adminGetLocation, { id });
  const update = useMutation(api.admin.adminUpdateLocation);
  const setStatus = useMutation(api.admin.adminSetLocationStatus);
  const saveRecap = useMutation(api.admin.adminSaveRecap);
  const remoderate = useMutation(api.admin.remoderateLocation);
  const del = useMutation(api.admin.deleteLocation);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!data) return <p>Loading…</p>;

  // Compute upcoming and most-recent dates client-side for the StatusForm/RecapForm props.
  const now = new Date();
  const upcoming = upcomingGameDay(now, data.dayOfWeek, data.startTime);
  const mostRecent = mostRecentPastGameDay(now, data.dayOfWeek, data.startTime);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-zinc-500">
          Owner: {data.ownerEmail} — status: <strong>{data.status}</strong>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {data.status !== "pending" ? (
          <button
            onClick={() => remoderate({ id })}
            className="rounded border border-zinc-400 px-3 py-1 text-sm"
          >
            Re-moderate (set to pending)
          </button>
        ) : null}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded border border-red-500 px-3 py-1 text-sm text-red-700"
          >
            Delete location
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-700">Are you sure?</span>
            <button
              onClick={async () => { await del({ id }); router.push("/admin/locations"); }}
              className="rounded bg-red-700 px-3 py-1 text-sm text-white"
            >
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded border border-zinc-400 px-3 py-1 text-sm">
              Cancel
            </button>
          </div>
        )}
      </div>

      <SettingsForm
        initial={{
          name: data.name, town: data.town, address: data.address,
          lat: data.lat, lng: data.lng,
          dayOfWeek: data.dayOfWeek, startTime: data.startTime, details: data.details,
        }}
        onSave={async (v) => { await update({ id, ...v }); }}
      />

      {data.status === "approved" ? (
        <>
          <StatusForm
            date={upcoming}
            isOn={true /* admin form starts neutral; user toggles */}
            reason={undefined}
            dayOfWeek={data.dayOfWeek}
            onSave={async ({ isOn, reason }) => { await setStatus({ id, isOn, reason }); }}
          />
          <RecapForm
            date={mostRecent}
            initial={{}}
            onSave={async (v) => { await saveRecap({ id, ...v }); }}
          />
        </>
      ) : null}
    </section>
  );
}
```

Note on the StatusForm/RecapForm initial values: the admin override path doesn't pre-fetch the existing gameDays row on this page (to keep this Client Component simple). Saving still upserts correctly because the mutations re-key by date server-side. If pre-population becomes important, refactor `adminGetLocation` to inline `thisWeek`/`lastSession` like `getMyLocation` does.

- [ ] **Step 27.2: Create `app/admin/locations/[id]/page.tsx`**

```tsx
import { AdminLocationClient } from "./AdminLocationClient";
import type { Id } from "@/convex/_generated/dataModel";

export default async function AdminLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminLocationClient id={id as Id<"locations">} />;
}
```

- [ ] **Step 27.3: Smoke test**

Open `/admin/locations`. Click into an approved location. Expected: header with owner email + status, the three forms, plus "Re-moderate" and "Delete location" buttons. Test re-moderate: status flips to pending; the location disappears from the public list. Approve again from the queue.

Test delete on a throwaway location: confirm dialog, location row disappears, and `gameDays` rows for it are also gone (verify via the Convex dashboard).

- [ ] **Step 27.4: Commit**

```bash
git add app/admin/locations/\[id\]
git commit -m "feat(web): add admin location override edit page with re-moderate and delete"
```

---

## Phase 9 — Polish + verification

### Task 28: GSAP polish layer

**Files:**
- Modify: `app/_components/HomeHero.tsx`
- Modify: `app/_components/LocationsList.tsx`
- Modify: `app/_components/LocationsMap.tsx`

The polish phase intentionally has loose targets — the goal is "feels alive without being annoying." Three concrete enhancements:

- [ ] **Step 28.1: Hero entrance**

In `HomeHero.tsx`, leave the existing `MotionShell variant="fade-up"` wrapper. Add a parallel scroll-driven fade as the user scrolls down the page. Use `useGSAP` directly:

```tsx
// Add inside HomeHero, replacing the bare MotionShell wrapper:
"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

export function HomeHero() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!root.current) return;
      const ctx = gsap.context(() => {
        gsap.from(".hero-line", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 });
        gsap.to(".hero-content", {
          opacity: 0,
          y: -40,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom 30%", scrub: true },
        });
      }, root);
      return () => ctx.revert();
    },
    { scope: root },
  );
  return (
    <section ref={root} className="px-6 pt-16 pb-12">
      <div className="hero-content">
        <p className="hero-line text-sm uppercase tracking-widest text-zinc-500">Vermont</p>
        <h1 className="hero-line mt-2 text-5xl font-semibold tracking-tight">Pickup Soccer</h1>
        <p className="hero-line mt-3 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          A directory of weekly pickup games across the state. Find one near you, or add your own.
        </p>
        <div className="hero-line mt-6 flex flex-wrap gap-3">
          <Link href="/submit" className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Add a pickup game
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 28.2: List item stagger on filter change**

The existing `MotionShell variant="fade-up"` already staggers list items on first paint. To re-trigger on filter change, wrap the list children in a `key` that changes when filters change. In `LocationsList.tsx`, accept a `keyHash` prop and use it as `<MotionShell key={keyHash}>`. Pass a serialized filter string from `HomeView.tsx`.

```tsx
// In HomeView.tsx, when rendering LocationsList:
<LocationsList locations={locations ?? []} keyHash={`${filters.search}|${filters.town}|${filters.dayOfWeek}`} />

// In LocationsList.tsx:
export function LocationsList({ locations, keyHash }: { locations: ListLocation[]; keyHash?: string }) {
  // …
  return (
    <MotionShell key={keyHash} variant="fade-up">
      {/* … */}
    </MotionShell>
  );
}
```

- [ ] **Step 28.3: Pin drop on map mount**

In `LocationsMap.tsx`, after `MarkerClusterGroup` mounts, animate the markers' opacity/scale in. Implementation hint: render markers with a `data-pin` attribute and run a GSAP `from(".leaflet-marker-icon", { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(2)", stagger: 0.02 })` inside a `useEffect` after the icon-fix completes. (Leaflet's marker DOM nodes appear as descendants of the map container.)

- [ ] **Step 28.4: Browser smoke test**

Open the homepage. Expected: title and CTA fade in on load; scroll down — hero content fades and lifts as it scrolls out; change a filter — list re-staggers; map pins drop in. None of these should jank or block clicks.

- [ ] **Step 28.5: Commit**

```bash
git add app/_components/HomeHero.tsx app/_components/LocationsList.tsx app/_components/HomeView.tsx app/_components/LocationsMap.tsx
git commit -m "feat(web): GSAP polish — hero parallax, list stagger on filter, pin drop"
```

---

### Task 29: Final verification

**Files:** none (verification only).

- [ ] **Step 29.1: Lint, test, build**

```bash
npm run lint
npm test
npm run build
```

Expected: all three succeed cleanly. Common gotchas:
- TypeScript errors on field name mismatches between schema/queries/forms — fix at the source.
- Dynamic-import errors for Leaflet — verify the `dynamic(() => import("react-leaflet")…, { ssr: false })` pattern is on every map component.
- Build-time complaints about `useSearchParams` outside of `Suspense` — wrap the relevant tree in `<Suspense>`.

- [ ] **Step 29.2: Production-build smoke test**

```bash
npm run start
```

Walk every flow:
1. Anonymous: open `/`, search/filter, view a location detail page.
2. Anonymous: start `/submit`, fill in fields, click submit → redirected to signup → signup → form re-hydrates → submission lands → redirected to `/account/locations/<id>` with "pending" banner.
3. Owner: edit the schedule (location, day, time, details) — saves succeed.
4. Owner: while still pending, the status/recap forms are NOT rendered.
5. Admin (sign in as the seeded admin): `/admin` overview shows correct counts. `/admin/queue` lists the pending submission. Click into it, approve. Owner page now shows green banner; status/recap forms appear.
6. Owner: toggle status OFF for the upcoming game day with a reason. Open `/locations/<id>` in another tab — red banner with reason appears.
7. Owner: write a recap. Open `/locations/<id>` — last session card appears with the right values.
8. Admin: `/admin/locations`, status filter changes the list. Open one approved location and use the override forms.
9. Admin: re-moderate a location. Owner banner flips back to yellow. Public detail page returns "Location not found" (Convex error, page enters error state — acceptable).
10. Admin: delete a throwaway location. Verify the row and its `gameDays` are gone in the Convex dashboard.

If anything breaks, fix it (own commit, message `fix: …`) and re-run the affected steps.

- [ ] **Step 29.3: No commit**

All work was committed in earlier tasks. Stop here unless step 29.1 forced fixes — those have their own commits.

---

## Self-review checklist (planner)

This section was completed before publishing the plan. Left in for the implementer's reference.

- **Spec coverage:**
  - Schema (`locations`, `gameDays`, `users` w/ role) → Task 1.
  - Auth signup enabled → Task 2.
  - `requireAuth`/`requireOwnerOf`/`requireAdmin` → Task 3.
  - Admin seed → Task 4.
  - Date helpers (TDD) → Tasks 5-6.
  - Public queries (`listLocations`, `getLocation`, `distinctTowns`) → Task 7.
  - User queries (`me`, `myLocations`, `getMyLocation`) → Task 8.
  - Admin queries → Task 9.
  - Submission mutations → Task 10.
  - Owner mutations → Task 11.
  - Admin moderation + overrides → Task 12.
  - Convex client provider + middleware → Tasks 13-14.
  - Sign-in / sign-up → Task 15.
  - Map deps + Leaflet pin component + GSAP shell → Tasks 16-18.
  - Public homepage + location detail → Tasks 19-20.
  - `/submit`, `/account`, `/account/locations/<id>` → Tasks 21-23.
  - Admin pages (overview, queue, review, all locations, override edit) → Tasks 24-27.
  - GSAP polish → Task 28.
  - Final verification → Task 29.

- **Type consistency:**
  - `weatherCondition` enum values are spelled identically across schema, owner mutations, admin mutations, and the forms (`sunny`/`cloudy`/`rainy`/`snowy`/`windy`/`cold`).
  - `status` enum values are `pending`/`approved`/`rejected` everywhere.
  - All field names on `locations` (`name`, `town`, `address`, `lat`, `lng`, `dayOfWeek`, `startTime`, `details`, `ownerId`, `status`, `rejectionReason`, `submittedAt`, `approvedAt`) match across schema, queries, mutations, and form props.

- **Acknowledged duplications / loose ends:**
  - The recap-display formatting logic is replicated lightly between `LocationsList` (compact) and `LocationDetail` (full). Acceptable: different audiences, different shapes.
  - `app/admin/locations/[id]` does NOT pre-fetch the existing gameDays row to pre-populate the StatusForm/RecapForm — explicit shortcut documented in Task 27. Refactor target if admin overrides become heavily used.
  - The recap form on the OwnerLocationClient uses `getMyLocation`'s `lastSession` for prefill; the admin override does not because the admin query doesn't inline that data. Future polish.
