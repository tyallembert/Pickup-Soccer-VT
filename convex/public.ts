import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { todayInTimezone, upcomingGameDay } from "./lib/dates";
import { isInSeason, nextInSeasonDate, type Season } from "./lib/season";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth, requireOwnerOf } from "./lib/auth";

type ScheduleView = {
  _id: Id<"locationSchedules">;
  dayOfWeek: number;
  startTime: string;
  endTime?: string;
  /** The slot's next weekly occurrence. `inSeason` is false when that date
   *  falls outside the field's season, so no game happens that week. */
  thisWeek: { date: string; isOn: boolean; reason?: string; inSeason: boolean };
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
} & SeasonView;

type SeasonView = {
  season: Season | null;
  /** Seasonal, and no slot's next occurrence is in season. */
  offSeason: boolean;
  /** When off-season: the first in-season game across slots. */
  resumesOn: string | null;
};

function seasonView(
  season: Season | undefined,
  schedules: ScheduleView[],
): SeasonView {
  const offSeason =
    season !== undefined &&
    schedules.length > 0 &&
    schedules.every((s) => !s.thisWeek.inSeason);
  let resumesOn: string | null = null;
  if (offSeason) {
    for (const s of schedules) {
      const next = nextInSeasonDate(s.thisWeek.date, season);
      if (next && (resumesOn === null || next < resumesOn)) resumesOn = next;
    }
  }
  return { season: season ?? null, offSeason, resumesOn };
}

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
  season: Season | undefined,
  now: Date,
): Promise<ScheduleView[]> {
  const schedules = await ctx.db
    .query("locationSchedules")
    .withIndex("by_location", (q) => q.eq("locationId", locationId))
    .collect();

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
          inSeason: isInSeason(upcomingDate, season),
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
  const schedules = await buildSchedulesForLocation(
    ctx,
    loc._id,
    loc.season,
    now,
  );
  return {
    _id: loc._id,
    name: loc.name,
    town: loc.town,
    address: loc.address,
    lat: loc.lat,
    lng: loc.lng,
    details: loc.details,
    schedules,
    ...seasonView(loc.season, schedules),
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
        // Shown on the owner's field list, so a request doesn't sit unseen
        // behind the field's Maintainers tab.
        const pendingMaintainers = await ctx.db
          .query("locationMaintainers")
          .withIndex("by_location_and_status", (q) =>
            q.eq("locationId", r._id).eq("status", "pending"),
          )
          .take(20);
        return {
          _id: r._id,
          name: r.name,
          town: r.town,
          status: r.status,
          rejectionReason: r.rejectionReason,
          submittedAt: r.submittedAt,
          pendingMaintainerCount: pendingMaintainers.length,
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
        ? await buildSchedulesForLocation(
            ctx,
            location._id,
            location.season,
            now,
          )
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
            thisWeek: { date: "", isOn: true, inSeason: true },
            lastSession: null,
          }));
    return {
      ...location,
      schedules,
      ...seasonView(location.season, schedules),
      viewerRole: role,
      viewerIsPrimaryOwner: role === "owner" || role === "admin",
    };
  },
});
