import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";

export const alt = "Pickup soccer field — Vermont Pickup Soccer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let loc: Awaited<ReturnType<typeof fetchQuery<typeof api.public.getLocation>>> | null = null;
  try {
    loc = await fetchQuery(api.public.getLocation, {
      id: id as Id<"locations">,
    });
  } catch {
    loc = null;
  }

  const title = loc ? loc.name : "Pickup Soccer Field";
  const town = loc ? `${loc.town}, Vermont` : "Vermont";
  const dayLine =
    loc && loc.schedules.length > 0
      ? loc.schedules
          .map((s) => `${formatDayPlural(s.dayOfWeek)} · ${formatStartTime(s.startTime)}`)
          .join("  |  ")
      : "Weekly pickup soccer";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #064e3b 0%, #047857 45%, #10b981 100%)",
          fontFamily: "system-ui, sans-serif",
          color: "white",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.12,
          }}
        >
          <div
            style={{
              width: 380,
              height: 380,
              borderRadius: "50%",
              border: "3px solid white",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 2,
            background: "rgba(255,255,255,0.08)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            ⚽
          </div>
          Vermont Pickup Soccer
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            {town}
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1050,
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 26px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.35)",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {dayLine}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            vermontpickupsoccer.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
