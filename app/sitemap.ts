import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vermontpickupsoccer.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  let locations: Awaited<
    ReturnType<typeof fetchQuery<typeof api.public.listLocations>>
  > = [];
  try {
    locations = await fetchQuery(api.public.listLocations, {});
  } catch {
    locations = [];
  }

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/submit`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/signin`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const locationEntries: MetadataRoute.Sitemap = locations.map((l) => ({
    url: `${SITE_URL}/locations/${l._id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...locationEntries];
}
