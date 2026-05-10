"use client";

export function AdminSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-32 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
        <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
        <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
      </div>
      <div className="h-64 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900" />
    </div>
  );
}
