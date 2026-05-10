import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { LocationDetail } from "./LocationDetail";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDayPlural, formatStartTime } from "@/app/_lib/format";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vermontpickupsoccer.com";

type RouteParams = { id: string };

async function loadLocation(id: string) {
  try {
    return await fetchQuery(api.public.getLocation, {
      id: id as Id<"locations">,
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const loc = await loadLocation(id);

  if (!loc) {
    return {
      title: "Pickup Soccer Field",
      description:
        "A pickup soccer field on the Vermont Pickup Soccer directory.",
    };
  }

  const day = formatDayPlural(loc.dayOfWeek);
  const time = formatStartTime(loc.startTime);
  const title = `${loc.name} — Pickup Soccer in ${loc.town}, VT`;
  const description = `Free pickup soccer ${day.toLowerCase()} at ${time} in ${loc.town}, Vermont. ${loc.name} — ${loc.address}. ${loc.details ? loc.details.slice(0, 140) : ""}`.trim();
  const path = `/locations/${id}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      images: [{ url: "/soccer-ball.png", width: 540, height: 540 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/soccer-ball.png"],
    },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const loc = await loadLocation(id);

  const jsonLd = loc
    ? {
        "@context": "https://schema.org",
        "@type": "SportsActivityLocation",
        "@id": `${SITE_URL}/locations/${id}`,
        name: loc.name,
        url: `${SITE_URL}/locations/${id}`,
        sport: "Soccer",
        description: loc.details || `Weekly pickup soccer in ${loc.town}, Vermont.`,
        address: {
          "@type": "PostalAddress",
          streetAddress: loc.address,
          addressLocality: loc.town,
          addressRegion: "VT",
          addressCountry: "US",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: loc.lat,
          longitude: loc.lng,
        },
        areaServed: { "@type": "State", name: "Vermont" },
        isAccessibleForFree: true,
        publicAccess: true,
        event: {
          "@type": "SportsEvent",
          name: `Pickup soccer at ${loc.name}`,
          eventSchedule: {
            "@type": "Schedule",
            repeatFrequency: "P1W",
            byDay: [
              [
                "https://schema.org/Sunday",
                "https://schema.org/Monday",
                "https://schema.org/Tuesday",
                "https://schema.org/Wednesday",
                "https://schema.org/Thursday",
                "https://schema.org/Friday",
                "https://schema.org/Saturday",
              ][loc.dayOfWeek],
            ],
            startTime: loc.startTime,
          },
          eventStatus: loc.thisWeek?.isOn
            ? "https://schema.org/EventScheduled"
            : "https://schema.org/EventCancelled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: {
            "@type": "Place",
            name: loc.name,
            address: {
              "@type": "PostalAddress",
              streetAddress: loc.address,
              addressLocality: loc.town,
              addressRegion: "VT",
              addressCountry: "US",
            },
          },
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        },
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <LocationDetail id={id as Id<"locations">} />
    </>
  );
}
