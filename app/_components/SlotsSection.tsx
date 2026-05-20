"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CalendarRange, Plus } from "lucide-react";
import { TooltipProvider } from "@/app/_components/ui/tooltip";
import {
  SlotCard,
  type ScheduleRow,
} from "@/app/_components/SlotCard";

function rowKey(r: ScheduleRow, fallback: number): string {
  return r._id ?? `new-${fallback}`;
}

// The "Weekly game times" section. Shared between the submit wizard and the
// owner/admin SchedulesEditor so both surfaces frame the slot concept the
// same way. Callers own the rows array and the patch/remove/add callbacks;
// this component is pure presentation.
export function SlotsSection({
  rows,
  onPatch,
  onRemove,
  onAdd,
  description,
  headerSlot,
}: {
  rows: ScheduleRow[];
  onPatch: (i: number, patch: Partial<ScheduleRow>) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  description?: string;
  headerSlot?: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll(".slot-card");
      if (items.length === 0) return;
      gsap.from(items, {
        y: 14,
        opacity: 0,
        duration: 0.42,
        ease: "power3.out",
        stagger: 0.07,
        clearProps: "all",
      });
    },
    { scope: listRef, dependencies: [rows.length] },
  );

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex flex-col gap-3.5">
        <header className="flex flex-col gap-1.5 border-b border-dashed border-emerald-200/70 pb-2.5 dark:border-emerald-900/50">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
              <CalendarRange className="h-3 w-3" />
              Weekly game times
            </p>
            {rows.length > 1 ? (
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                {rows.length} times a week
              </span>
            ) : null}
            {headerSlot}
          </div>
          {description ? (
            <p className="max-w-prose text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </header>

        <div ref={listRef} className="flex flex-col gap-2.5">
          {rows.map((row, i) => (
            <SlotCard
              key={rowKey(row, i)}
              row={row}
              index={i}
              canRemove={rows.length > 1}
              onPatch={(p) => onPatch(i, p)}
              onRemove={() => onRemove(i)}
            />
          ))}

          <button
            type="button"
            onClick={onAdd}
            className="group relative flex h-10 items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed border-emerald-300/80 bg-emerald-50/40 text-xs font-bold uppercase tracking-wider text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/50"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0 22px, #064e3b 22px 23px)",
              }}
            />
            <Plus className="relative h-3.5 w-3.5" strokeWidth={3} />
            <span className="relative">
              {rows.length === 0 ? "Add a game time" : "Add another time"}
            </span>
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
