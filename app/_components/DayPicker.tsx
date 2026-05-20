"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@/app/_lib/cn";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/app/_components/ui/toggle-group";

const DAYS = [
  { v: 0, short: "S", long: "Sun" },
  { v: 1, short: "M", long: "Mon" },
  { v: 2, short: "T", long: "Tue" },
  { v: 3, short: "W", long: "Wed" },
  { v: 4, short: "T", long: "Thu" },
  { v: 5, short: "F", long: "Fri" },
  { v: 6, short: "S", long: "Sat" },
] as const;

// 7-day picker with a single highlight indicator that slides between the
// selected days with a small overshoot/bounce. Shared between SubmitForm and
// SchedulesEditor so the control behaves identically everywhere.
export function DayPicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  // First mount must set the indicator position synchronously (no animate-in
  // from 0-width); only subsequent value changes get the bounce.
  const firstRun = useRef(true);

  useGSAP(
    () => {
      const group = groupRef.current;
      const indicator = indicatorRef.current;
      if (!group || !indicator) return;
      const active = group.querySelector(
        '[data-state="on"]',
      ) as HTMLElement | null;
      if (!active) return;
      const x = active.offsetLeft;
      const width = active.offsetWidth;
      if (firstRun.current) {
        firstRun.current = false;
        gsap.set(indicator, { x, width });
        return;
      }
      gsap.to(indicator, {
        x,
        width,
        duration: 0.55,
        ease: "back.out(1.8)",
      });
    },
    { dependencies: [value] },
  );

  return (
    <ToggleGroup
      ref={groupRef}
      type="single"
      value={String(value)}
      onValueChange={(v) => {
        if (v) onChange(Number(v));
      }}
      spacing={1}
      aria-label={ariaLabel}
      className="relative grid w-full grid-cols-7 gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 left-0 top-1 rounded-full bg-emerald-600 shadow-[0_3px_10px_rgba(16,185,129,0.45)]"
        style={{ width: 0 }}
      />
      {DAYS.map((d) => (
        <ToggleGroupItem
          key={d.v}
          value={String(d.v)}
          title={d.long}
          className={cn(
            "relative z-10 h-9 w-full rounded-full px-0 text-xs font-bold transition-colors",
            "hover:bg-transparent hover:text-emerald-800 dark:hover:text-emerald-200",
            "data-[state=on]:bg-transparent data-[state=on]:text-white data-[state=on]:shadow-none data-[state=on]:hover:bg-transparent data-[state=on]:hover:text-white",
          )}
        >
          <span className="sm:hidden">{d.short}</span>
          <span className="hidden sm:inline">{d.long}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
