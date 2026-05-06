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
