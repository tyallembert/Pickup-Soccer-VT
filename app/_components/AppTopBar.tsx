"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { appRouteFor } from "@/app/_lib/app-routes";
import { Avatar, AvatarFallback, initialsFromEmail } from "./ui/avatar";

// Whether this session has moved between screens. Opened from a notification
// or the home-screen icon, there is nothing to go back to, so the back button
// goes to the screen's list instead of doing nothing.
let lastPath: string | null = null;
let hasInAppHistory = false;

/**
 * The installed app's top bar on phones: back button or app icon, the screen's
 * title, and the account avatar. Rendered for everyone and shown only by the
 * `app:` variant, so it is there from the first paint.
 */
export function AppTopBar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.public.me, isAuthenticated ? {} : "skip");
  const { title, parent } = appRouteFor(pathname);

  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) hasInAppHistory = true;
    lastPath = pathname;
  }, [pathname]);

  const goBack = () => {
    if (hasInAppHistory) router.back();
    else if (parent) router.push(parent);
  };

  return (
    <header
      className="sticky top-0 z-[1090] hidden border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl backdrop-saturate-150 select-none app:block dark:border-zinc-800/80 dark:bg-zinc-950/90"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center gap-1 px-2">
        {parent ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-emerald-700 transition active:scale-90 active:bg-zinc-100 dark:text-emerald-400 dark:active:bg-zinc-900"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
          </button>
        ) : (
          <Link
            href="/"
            aria-label="Home"
            className="flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <Image
              src="/soccer-ball.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7"
              priority
            />
          </Link>
        )}

        <p className="min-w-0 flex-1 truncate px-1 text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </p>

        {isLoading ? (
          <span className="h-9 w-9" aria-hidden />
        ) : isAuthenticated ? (
          <Link
            href="/account"
            aria-label="Your account"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-600 text-[11px] text-white">
                {initialsFromEmail(me?.email)}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Link
            href="/signin"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-700 transition active:bg-zinc-100 dark:text-emerald-400 dark:active:bg-zinc-900"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
