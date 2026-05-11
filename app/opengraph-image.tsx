import { ImageResponse } from "next/og";

export const alt =
  "Vermont Pickup Soccer — find weekly games and fields across Vermont";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
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
            right: -120,
            bottom: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.12)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
            }}
          >
            ⚽
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Vermont Pickup Soccer
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            Find weekly pickup soccer across Vermont.
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "rgba(255,255,255,0.9)",
              maxWidth: 960,
              lineHeight: 1.3,
            }}
          >
            Free, public, and updated by the people who play.
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
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            vermontpickupsoccer.com
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.35)",
            }}
          >
            Statewide directory
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
