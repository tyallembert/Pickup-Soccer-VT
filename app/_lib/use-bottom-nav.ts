"use client";

import { useConvexAuth } from "convex/react";
import { useInstall } from "./use-install";

/**
 * The bottom tab bar replaces the floating top pill on phones, so both
 * components have to agree on when it is showing. One hook, one answer.
 *
 * Only in an installed PWA and only when signed in — in a browser tab the
 * top pill is the right nav, and a signed-out visitor has nothing to tab
 * between.
 */
export function useBottomNavActive(): boolean {
  const { verdict } = useInstall();
  const { isAuthenticated, isLoading } = useConvexAuth();
  return verdict === "installed" && !isLoading && isAuthenticated;
}
