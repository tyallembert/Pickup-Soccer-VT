"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Eye,
  EyeOff,
  Layers,
  ListChecks,
  LogOut,
  Shield,
  User,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/app/_lib/cn";
import { useViewMode } from "@/app/_lib/view-mode";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const ADMIN_ITEMS: Item[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: Shield,
    match: (p) => p === "/admin",
  },
  {
    href: "/admin/queue",
    label: "Queue",
    icon: ListChecks,
    match: (p) => p.startsWith("/admin/queue"),
  },
  {
    href: "/admin/locations",
    label: "Locations",
    icon: Layers,
    match: (p) => p.startsWith("/admin/locations"),
  },
];

const PROFILE_ITEM: Item = {
  href: "/account",
  label: "Account",
  icon: User,
  match: (p) => p.startsWith("/account"),
};

export function AdminPillNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.public.me, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();
  const { viewAsUser, setViewAsUser } = useViewMode();

  if (isLoading || !isAuthenticated) return null;
  if (!me || me.role !== "admin") return null;

  if (viewAsUser) {
    return (
      <button
        type="button"
        onClick={() => setViewAsUser(false)}
        title="Exit user preview"
        aria-label="Exit user preview"
        className="pointer-events-auto fixed left-4 top-1/2 z-[1100] hidden -translate-y-1/2 items-center gap-2 rounded-full border border-emerald-500/40 bg-black/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300 shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:bg-emerald-500/15 hover:text-emerald-200 sm:inline-flex"
      >
        <EyeOff className="h-3.5 w-3.5" />
        Exit preview
      </button>
    );
  }

  return (
    <nav
      className="pointer-events-none fixed left-4 top-1/2 z-[1100] hidden -translate-y-1/2 sm:block"
      aria-label="Admin"
    >
      <div className="pointer-events-auto flex flex-col items-stretch gap-1 rounded-3xl border border-white/15 bg-black/55 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Admin badge header */}
        <div className="mb-1 flex flex-col items-center gap-1 px-2 pt-1 pb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
            <Shield className="h-4 w-4" />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            Admin
          </span>
        </div>

        {ADMIN_ITEMS.map((item) => (
          <NavTile
            key={item.href}
            item={item}
            active={item.match(pathname)}
          />
        ))}

        <span aria-hidden className="my-1 h-px bg-white/15" />

        <NavTile
          item={PROFILE_ITEM}
          active={PROFILE_ITEM.match(pathname)}
        />

        <button
          type="button"
          onClick={() => {
            setViewAsUser(true);
            if (pathname.startsWith("/admin")) router.push("/account");
          }}
          title="Preview the site as a normal user"
          aria-label="Preview as user"
          className="group inline-flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-semibold text-white/70 transition hover:bg-emerald-500/20 hover:text-emerald-100"
        >
          <Eye className="h-4 w-4" />
          <span>As user</span>
        </button>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          title="Sign out"
          aria-label="Sign out"
          className="group inline-flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-semibold text-white/70 transition hover:bg-rose-500/25 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}

function NavTile({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group inline-flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-semibold transition",
        active
          ? "bg-emerald-500 text-white shadow"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{item.label}</span>
    </Link>
  );
}
