import type { Metadata } from "next";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { HomeView } from "./_components/HomeView";
import { DirectoryByTown } from "./_components/DirectoryByTown";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vermontpickupsoccer.com";

export const metadata: Metadata = {
  title: "Vermont Pickup Soccer — Find Weekly Games & Fields",
  description:
    "Browse a statewide directory of free pickup soccer games in Vermont. Filter by town and day, see who's playing this week, and add your own field.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Vermont Pickup Soccer — Find Weekly Games & Fields",
    description:
      "Browse a statewide directory of free pickup soccer games in Vermont. Filter by town and day, see who's playing this week, and add your own field.",
    url: "/",
    type: "website",
  },
};

export default async function Home() {
  const preloadedLocations = await preloadQuery(api.public.listLocations, {});
  const locations = preloadedQueryResult(preloadedLocations);

  const homeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Vermont Pickup Soccer",
        description:
          "Statewide directory of weekly pickup soccer games and fields across Vermont.",
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/?search={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Vermont Pickup Soccer",
        url: SITE_URL,
        logo: `${SITE_URL}/soccer-ball.png`,
        sameAs: [],
        areaServed: {
          "@type": "State",
          name: "Vermont",
        },
      },
      {
        "@type": "SportsActivityLocation",
        name: "Vermont Pickup Soccer Directory",
        sport: "Soccer",
        url: SITE_URL,
        areaServed: {
          "@type": "State",
          name: "Vermont",
          containedInPlace: { "@type": "Country", name: "United States" },
        },
        description:
          "Open, weekly pickup soccer games hosted across Vermont — free to join, organized by locals.",
      },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Vermont Pickup Soccer Fields",
    description:
      "Every approved pickup soccer field in the Vermont Pickup Soccer directory.",
    numberOfItems: locations.length,
    itemListOrder: "https://schema.org/ItemListUnordered",
    itemListElement: locations.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/locations/${l._id}`,
      name: `${l.name} — ${l.town}, VT`,
    })),
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <HomeView preloadedLocations={preloadedLocations} />
      <DirectoryByTown locations={locations} />
    </main>
  );
}
