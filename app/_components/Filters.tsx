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
