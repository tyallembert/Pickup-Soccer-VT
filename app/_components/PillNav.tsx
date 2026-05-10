"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, initialsFromEmail } from "./ui/avatar";
import { cn } from "@/app/_lib/cn";

const ITEMS = [
  {
    href: "/",
    label: "Browse",
    match: (p: string) => p === "/" || p.startsWith("/locations"),
  },
  {
    href: "/submit",
    label: "Submit",
    match: (p: string) => p.startsWith("/submit"),
  },
] as const;

export function PillNav() {
  const pathname = usePathname() ?? "/";
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.public.me, isAuthenticated ? {} : "skip");

  const activeIndex = ITEMS.findIndex((i) => i.match(pathname));
  const isAccountActive = pathname.startsWith("/account") || pathname.startsWith("/admin");

  return (
    <nav
      className="pointer-events-none fixed left-1/2 top-4 z-[1100] -translate-x-1/2"
      aria-label="Primary"
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/55 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Browse + Submit segment */}
        <div className="relative flex items-center">
          {activeIndex >= 0 ? (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-0 top-0 rounded-full bg-emerald-500/95 shadow-[0_4px_12px_rgba(16,185,129,0.45)] transition-transform duration-300 ease-out"
              style={{
                width: `calc(100% / ${ITEMS.length})`,
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            />
          ) : null}

          {ITEMS.map((it, i) => {
            const active = i === activeIndex;
            return (
              <Link
                key={it.href}
                href={it.href}
                prefetch
                className={cn(
                  "relative z-10 inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-semibold tracking-wide transition-colors",
                  active ? "text-white" : "text-white/70 hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                {it.label}
              </Link>
            );
          })}
        </div>

        {/* Auth segment */}
        {isLoading ? null : isAuthenticated ? (
          <>
            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px bg-white/15"
            />
            <Link
              href="/account"
              prefetch
              aria-label="Your account"
              title={me?.email ?? "Your account"}
              className={cn(
                "group relative inline-flex items-center justify-center rounded-full p-0.5 transition",
                isAccountActive
                  ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-black/55"
                  : "hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-black/55",
              )}
            >
              <Avatar className="h-8 w-8 border border-white/20">
                <AvatarFallback>
                  {initialsFromEmail(me?.email)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px bg-white/15"
            />
            <Link
              href="/signin"
              prefetch
              aria-label="Sign in"
              title="Sign in"
              className="group relative inline-flex items-center justify-center rounded-full p-0.5 transition hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-black/55"
            >
              <Avatar className="h-8 w-8 border border-dashed border-white/40 bg-transparent">
                <AvatarFallback className="bg-white/5 text-white/70 transition group-hover:bg-white/10 group-hover:text-white">
                  <User className="h-4 w-4" strokeWidth={1.75} />
                </AvatarFallback>
              </Avatar>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
