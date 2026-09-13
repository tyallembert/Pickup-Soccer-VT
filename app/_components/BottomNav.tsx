"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Bell,
  Compass,
  Eye,
  Layers,
  ListChecks,
  LogOut,
  type LucideIcon,
  MapPin,
  Menu,
  Plus,
  Shield,
  Smartphone,
  User,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/app/_lib/cn";
import { useViewMode } from "@/app/_lib/view-mode";
import { useBottomNavActive } from "@/app/_lib/use-bottom-nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/app/_components/ui/sheet";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const BROWSE: Tab = {
  href: "/",
  label: "Browse",
  icon: Compass,
  match: (p) => p === "/" || p.startsWith("/locations"),
};
const SUBMIT: Tab = {
  href: "/submit",
  label: "Submit",
  icon: Plus,
  match: (p) => p.startsWith("/submit"),
};
const ACCOUNT: Tab = {
  href: "/account",
  label: "Account",
  icon: User,
  match: (p) => p.startsWith("/account"),
};
const QUEUE: Tab = {
  href: "/admin/queue",
  label: "Queue",
  icon: ListChecks,
  match: (p) => p.startsWith("/admin/queue"),
};
const FIELDS: Tab = {
  href: "/admin/locations",
  label: "Fields",
  icon: Layers,
  match: (p) => p.startsWith("/admin/locations"),
};
const USERS: Tab = {
  href: "/admin/users",
  label: "Users",
  icon: Users,
  match: (p) => p.startsWith("/admin/users"),
};

const USER_TABS = [BROWSE, SUBMIT, ACCOUNT];
const ADMIN_TABS = [QUEUE, FIELDS, USERS, BROWSE];

export function BottomNav() {
  const active = useBottomNavActive();
  const pathname = usePathname() ?? "/";
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.public.me, isAuthenticated ? {} : "skip");
  const { viewAsUser } = useViewMode();
  const [moreOpen, setMoreOpen] = useState(false);

  // An admin previewing the site as a normal user gets the user tabs, matching
  // how the desktop admin nav already behaves.
  const isAdmin = me?.role === "admin" && !viewAsUser;
  const pendingCount = useQuery(api.admin.pendingCount, isAdmin ? {} : "skip");

  if (!active || !me) return null;

  const tabs = isAdmin ? ADMIN_TABS : USER_TABS;

  return (
    <>
      {/* Keeps the last of the page's content clear of the fixed bar. Lives in
          normal flow so the server-rendered layout needs no client state. */}
      <div
        aria-hidden
        className="sm:hidden"
        style={{ height: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[1100] border-t border-zinc-200 bg-white/90 backdrop-blur-xl sm:hidden dark:border-zinc-800 dark:bg-zinc-950/90"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {tabs.map((tab) => (
            <TabButton
              key={tab.href}
              tab={tab}
              active={tab.match(pathname)}
              badge={tab === QUEUE ? pendingCount : undefined}
            />
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-zinc-500 transition active:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-900"
            >
              <Menu className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-semibold tracking-wide">
                More
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <MoreDrawer
        open={moreOpen}
        onOpenChange={setMoreOpen}
        isAdmin={isAdmin}
        email={me.email}
      />
    </>
  );
}

function TabButton({
  tab,
  active,
  badge,
}: {
  tab: Tab;
  active: boolean;
  badge?: number;
}) {
  const Icon = tab.icon;
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        prefetch
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-14 w-full flex-col items-center justify-center gap-0.5 transition",
          active
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-zinc-500 active:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-900",
        )}
      >
        <span className="relative">
          <Icon className="h-5 w-5" aria-hidden />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
        <span className="text-[10px] font-semibold tracking-wide">
          {tab.label}
        </span>
      </Link>
    </li>
  );
}

function MoreDrawer({
  open,
  onOpenChange,
  isAdmin,
  email,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
  email: string;
}) {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { viewAsUser, setViewAsUser } = useViewMode();

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl sm:hidden"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <SheetHeader className="pb-0">
          <SheetTitle className="text-base">More</SheetTitle>
          <p className="truncate text-sm text-zinc-500">{email}</p>
        </SheetHeader>

        <div className="flex flex-col px-4">
          {isAdmin && (
            <DrawerLink
              href="/admin"
              icon={Shield}
              label="Admin overview"
              onClick={close}
            />
          )}
          <DrawerLink
            href="/account/locations"
            icon={MapPin}
            label="My fields"
            onClick={close}
          />
          {isAdmin && (
            <DrawerLink
              href="/submit"
              icon={Plus}
              label="Submit a field"
              onClick={close}
            />
          )}
          {isAdmin && (
            <DrawerLink
              href="/admin/queue"
              icon={Bell}
              label="Alert settings"
              onClick={close}
            />
          )}
          <DrawerLink
            href="/install"
            icon={Smartphone}
            label="Install & alerts"
            onClick={close}
          />

          {isAdmin && (
            <DrawerButton
              icon={Eye}
              label={viewAsUser ? "Exit user preview" : "Preview as user"}
              onClick={() => {
                setViewAsUser(!viewAsUser);
                close();
                router.push(viewAsUser ? "/admin" : "/");
              }}
            />
          )}

          <span aria-hidden className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />

          <DrawerButton
            icon={LogOut}
            label="Sign out"
            destructive
            onClick={async () => {
              close();
              await signOut();
              router.push("/");
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-2 py-3 text-sm font-medium text-zinc-800 transition active:bg-zinc-100 dark:text-zinc-100 dark:active:bg-zinc-900"
    >
      <Icon className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
      {label}
    </Link>
  );
}

function DrawerButton({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={cn(
        "flex items-center gap-3 rounded-xl px-2 py-3 text-left text-sm font-medium transition active:bg-zinc-100 dark:active:bg-zinc-900",
        destructive
          ? "text-red-600 dark:text-red-400"
          : "text-zinc-800 dark:text-zinc-100",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          destructive ? "text-red-500" : "text-zinc-500",
        )}
        aria-hidden
      />
      {label}
    </button>
  );
}
