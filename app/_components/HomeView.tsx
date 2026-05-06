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
        <LocationsList locations={locations ?? []} keyHash={`${filters.search}|${filters.town}|${filters.dayOfWeek}`} />
      </section>
    </>
  );
}
