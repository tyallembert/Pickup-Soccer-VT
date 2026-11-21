"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Inbox,
  Layers,
  LogIn,
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
const SIGN_IN: Tab = {
  href: "/signin",
  label: "Sign in",
  icon: LogIn,
  match: (p) => p.startsWith("/signin") || p.startsWith("/signup"),
};
const APPROVALS: Tab = {
  href: "/admin/queue",
  label: "Approvals",
  icon: Inbox,
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

const GUEST_TABS = [BROWSE, SUBMIT, SIGN_IN];
const USER_TABS = [BROWSE, SUBMIT, ACCOUNT];
const ADMIN_TABS = [APPROVALS, FIELDS, USERS, BROWSE];

// Screens reached from the More sheet, so its tab lights up on them.
const ADMIN_MORE = (p: string) =>
  p === "/admin" ||
  p.startsWith("/account") ||
  p.startsWith("/submit") ||
  p.startsWith("/install");
const USER_MORE = (p: string) => p.startsWith("/install");

// Icons dip under your finger and a long press doesn't open the link preview,
// as in a native tab bar.
const TAB_CLASS =
  "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 select-none [-webkit-touch-callout:none] [&_svg]:transition-transform [&_svg]:duration-150 active:[&_svg]:scale-[0.86]";

/**
 * The installed app's tab bar on phones. Always rendered and shown only by the
 * `app:` variant, so it is in place from the first paint; the tabs fill in
 * once auth has settled.
 */
export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.public.me, isAuthenticated ? {} : "skip");
  const { viewAsUser, setViewAsUser } = useViewMode();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  // Two different questions: what the account IS, and what the UI SHOWS. The
  // exit-preview control must hang off the former, or preview mode hides its
  // own way out.
  const isSiteAdmin = me?.role === "admin";
  const showAdminUi = isSiteAdmin && !viewAsUser;
  const pendingCount = useQuery(
    api.admin.pendingCount,
    showAdminUi ? {} : "skip",
  );

  const settled = !isLoading && (!isAuthenticated || me !== undefined);
  const signedIn = isAuthenticated && !!me;
  const tabs = !settled
    ? []
    : showAdminUi
      ? ADMIN_TABS
      : signedIn
        ? USER_TABS
        : GUEST_TABS;
  const hasMore = settled && signedIn;
  const slots = tabs.length + (hasMore ? 1 : 0);
  const inMore = hasMore && (showAdminUi ? ADMIN_MORE : USER_MORE)(pathname);
  const activeIndex = moreOpen || inMore
    ? tabs.length
    : tabs.findIndex((t) => t.match(pathname));

  const previewing = isSiteAdmin && viewAsUser;
  const exitPreview = () => {
    setViewAsUser(false);
    router.push("/admin");
  };

  return (
    <>
      {/* Keeps the last of the page's content clear of the fixed bar. Lives in
          normal flow so the server-rendered layout needs no client state. */}
      <div
        aria-hidden
        className="hidden app:block"
        style={{
          height: previewing
            ? "calc(6rem + env(safe-area-inset-bottom))"
            : "calc(3.5rem + env(safe-area-inset-bottom))",
        }}
      />

      {previewing && (
        <button
          type="button"
          onClick={exitPreview}
          className="fixed inset-x-0 z-[1100] hidden items-center justify-center gap-2 bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_-4px_12px_rgba(0,0,0,0.12)] app:flex"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
          Viewing as a regular user. Tap to exit.
        </button>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[1100] hidden border-t border-zinc-200/80 bg-white/90 backdrop-blur-xl backdrop-saturate-150 app:block dark:border-zinc-800/80 dark:bg-zinc-950/90"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="relative mx-auto flex h-14 max-w-lg items-stretch">
          {/* One indicator that glides between tabs. */}
          {activeIndex >= 0 && slots > 0 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 flex justify-center transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
              style={{
                width: `${100 / slots}%`,
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            >
              <span className="h-0.5 w-10 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            </span>
          ) : null}

          {tabs.map((tab, i) => (
            <TabButton
              key={tab.href}
              tab={tab}
              active={activeIndex === i}
              badge={tab === APPROVALS ? pendingCount : undefined}
            />
          ))}
          {hasMore ? (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
                className={cn(
                  TAB_CLASS,
                  activeIndex === tabs.length
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400",
                )}
              >
                <Menu className="h-[22px] w-[22px]" aria-hidden />
                <span className="text-[10px] font-semibold tracking-wide">
                  More
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {hasMore ? (
        <MoreSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          pathname={pathname}
          isSiteAdmin={isSiteAdmin}
          showAdminUi={showAdminUi}
          email={me.email}
        />
      ) : null}
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
          TAB_CLASS,
          active
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-zinc-500 dark:text-zinc-400",
        )}
      >
        <span className="relative">
          <Icon className="h-[22px] w-[22px]" aria-hidden />
          {badge !== undefined && badge > 0 && (
            <span
              aria-label={`${badge} waiting`}
              className="absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-950"
            >
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

/** Screens that don't fit in the tab bar, as grouped rows like iOS Settings. */
function MoreSheet({
  open,
  onOpenChange,
  pathname,
  isSiteAdmin,
  showAdminUi,
  email,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pathname: string;
  /** True whenever the account is an admin, preview mode or not. */
  isSiteAdmin: boolean;
  /** True only when admin UI is actually being shown. */
  showAdminUi: boolean;
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
        showCloseButton={false}
        overlayClassName="z-[1200]"
        // An action sheet shouldn't land focus (and a focus ring) on a row.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="z-[1200] max-h-[85svh] gap-3 overflow-y-auto rounded-t-3xl border-none bg-zinc-100 sm:hidden dark:bg-zinc-900"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <SheetHeader className="px-5 pt-1 pb-0">
          <SheetTitle className="text-lg">More</SheetTitle>
          <p className="truncate text-sm text-zinc-500">{email}</p>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {showAdminUi ? (
            <Group>
              <Row href="/admin" icon={Shield} label="Admin overview" current={pathname === "/admin"} onClick={close} />
              <Row href="/account" icon={MapPin} label="Your account & fields" current={pathname.startsWith("/account")} onClick={close} />
              <Row href="/submit" icon={Plus} label="Submit a field" current={pathname.startsWith("/submit")} onClick={close} />
            </Group>
          ) : null}

          <Group>
            <Row href="/install" icon={Smartphone} label="Install & alerts" current={pathname.startsWith("/install")} onClick={close} />
            {isSiteAdmin ? (
              <Row
                icon={Eye}
                label={viewAsUser ? "Exit user preview" : "Preview as a regular user"}
                onClick={() => {
                  setViewAsUser(!viewAsUser);
                  close();
                  router.push(viewAsUser ? "/admin" : "/");
                }}
              />
            ) : null}
          </Group>

          <Group>
            <Row
              icon={LogOut}
              label="Sign out"
              destructive
              onClick={async () => {
                close();
                await signOut();
                router.push("/");
              }}
            />
          </Group>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white dark:divide-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

function Row({
  href,
  icon: Icon,
  label,
  onClick,
  current,
  destructive,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void | Promise<void>;
  current?: boolean;
  destructive?: boolean;
}) {
  const className = cn(
    "flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[15px] font-medium outline-none transition focus-visible:bg-zinc-100 active:bg-zinc-100 dark:focus-visible:bg-zinc-900 dark:active:bg-zinc-900",
    destructive
      ? "text-rose-600 dark:text-rose-400"
      : current
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-zinc-900 dark:text-zinc-100",
  );
  const inner = (
    <>
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          destructive ? "text-rose-500" : current ? "text-emerald-600" : "text-zinc-500",
        )}
        aria-hidden
      />
      <span className="flex-1">{label}</span>
      {href ? <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden /> : null}
    </>
  );
  return href ? (
    <Link href={href} prefetch onClick={() => void onClick()} className={className} aria-current={current ? "page" : undefined}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={() => void onClick()} className={className}>
      {inner}
    </button>
  );
}
