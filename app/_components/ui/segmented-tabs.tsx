"use client";

import { cn } from "@/app/_lib/cn";

export type SegmentedTab<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
};

/**
 * Segmented tab strip with the same sliding-emerald motif as the top PillNav.
 * Light surface (zinc-100) so it sits cleanly inside cards and page bodies.
 */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  items: SegmentedTab<T>[];
  className?: string;
  ariaLabel?: string;
}) {
  const activeIndex = items.findIndex((i) => i.value === value);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative grid w-full overflow-hidden rounded-full border border-zinc-200/80 bg-zinc-100/90 p-1 shadow-[0_2px_10px_rgba(16,185,129,0.06)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {activeIndex >= 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.45)] transition-transform duration-300 ease-out"
          style={{
            width: `calc((100% - 0.5rem) / ${items.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      ) : null}
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            title={it.hint}
            className={cn(
              "relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold tracking-wide transition-colors",
              active
                ? "text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            {it.icon}
            <span className="truncate">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
