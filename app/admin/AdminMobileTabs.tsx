"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/app/_lib/cn";
import { useViewMode } from "@/app/_lib/view-mode";

const TABS = [
  { href: "/admin", label: "Overview", match: (p: string) => p === "/admin" },
  { href: "/admin/queue", label: "Approvals", match: (p: string) => p.startsWith("/admin/queue") },
  { href: "/admin/locations", label: "Fields", match: (p: string) => p.startsWith("/admin/locations") },
  { href: "/admin/users", label: "Users", match: (p: string) => p.startsWith("/admin/users") },
];

/**
 * Admin sections on a phone browser. Desktop has the side AdminPillNav and the
 * installed app has its tab bar; a phone browser had neither, so moving
 * between admin screens meant going back through Account.
 */
export function AdminMobileTabs() {
  const pathname = usePathname() ?? "";
  const { viewAsUser } = useViewMode();
  const pendingCount = useQuery(api.admin.pendingCount, viewAsUser ? "skip" : {});
  if (viewAsUser) return null;

  return (
    <nav
      aria-label="Admin sections"
      className="sm:hidden app:hidden"
    >
      <ul className="flex w-full gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const badge = t.href === "/admin/queue" ? pendingCount : undefined;
          return (
            <li key={t.href} className="min-w-0 flex-auto">
              <Link
                href={t.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-1 rounded-full px-2 text-[13px] font-semibold transition",
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-600 active:bg-zinc-200 dark:text-zinc-300 dark:active:bg-zinc-800",
                )}
              >
                {t.label}
                {badge ? (
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold",
                      active ? "bg-white/25 text-white" : "bg-rose-500 text-white",
                    )}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
