"use client";

import Link from "next/link";
import { MotionShell } from "./MotionShell";

export function HomeHero() {
  return (
    <section className="px-6 pt-16 pb-12">
      <MotionShell variant="fade-up">
        <p className="text-sm uppercase tracking-widest text-zinc-500">Vermont</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight">Pickup Soccer</h1>
        <p className="mt-3 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          A directory of weekly pickup games across the state. Find one near you, or add your own.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/submit"
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add a pickup game
          </Link>
        </div>
      </MotionShell>
    </section>
  );
}
