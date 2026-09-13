"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  canPromptSnapshot,
  subscribeToInstallPrompt,
  triggerInstall,
  type InstallOutcome,
} from "./install-prompt";
import {
  PENDING_PLATFORM,
  platformSnapshot,
  type PlatformSnapshot,
} from "./platform";

/** `verdict` is "pending" until the client has actually looked at the environment. */
export type UseInstall = PlatformSnapshot & {
  install: () => Promise<InstallOutcome>;
};

export function useInstall(): UseInstall {
  const platform = useSyncExternalStore<PlatformSnapshot>(
    subscribeToInstallPrompt,
    () => platformSnapshot(canPromptSnapshot()),
    () => PENDING_PLATFORM,
  );

  const install = useCallback(() => triggerInstall(), []);

  return { ...platform, install };
}
