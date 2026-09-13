/**
 * Device / browser detection for the install page.
 *
 * Pure and input-driven so it can be unit-tested against fixture user-agent
 * strings — the interesting cases (iPadOS reporting itself as a Mac, embedded
 * webviews) are exactly the ones that are painful to reproduce by hand.
 */

export type InstallVerdict =
  | "installed"
  | "can-prompt"
  | "ios-safari"
  | "ios-other-browser"
  | "android-other-browser"
  | "firefox-android"
  | "in-app-browser"
  | "desktop-safari"
  | "unsupported";

export type OS = "ios" | "android" | "macos" | "windows" | "other";

export type Browser =
  | "safari"
  | "chrome"
  | "firefox"
  | "edge"
  | "samsung"
  | "in-app"
  | "other";

export type PlatformInput = {
  userAgent: string;
  /** iPadOS reports a Macintosh UA; touch points are what give it away. */
  maxTouchPoints: number;
  /** display-mode: standalone, or navigator.standalone on iOS. */
  standalone: boolean;
  /** True only once a real beforeinstallprompt event has been captured. */
  canPrompt: boolean;
};

export type Platform = {
  os: OS;
  browser: Browser;
  verdict: InstallVerdict;
};

// Embedded webviews (social apps, Gmail) cannot install a PWA at all, no matter
// which engine they wrap.
const IN_APP_PATTERNS =
  /(FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|TwitterAndroid|LinkedInApp|Pinterest|Snapchat|MicroMessenger|GSA\/|; wv\))/i;

export function detectOS(userAgent: string, maxTouchPoints: number): OS {
  if (/iPhone|iPod/i.test(userAgent)) return "ios";
  if (/iPad/i.test(userAgent)) return "ios";
  // iPadOS 13+ masquerades as desktop Safari; only the touch points betray it.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos";
  if (/Windows/i.test(userAgent)) return "windows";
  return "other";
}

export function detectBrowser(userAgent: string): Browser {
  if (IN_APP_PATTERNS.test(userAgent)) return "in-app";
  // iOS browsers are all WebKit but announce themselves with these suffixes.
  if (/CriOS/i.test(userAgent)) return "chrome";
  if (/FxiOS/i.test(userAgent)) return "firefox";
  if (/EdgiOS/i.test(userAgent)) return "edge";
  if (/SamsungBrowser/i.test(userAgent)) return "samsung";
  if (/Edg\//i.test(userAgent)) return "edge";
  if (/Firefox\//i.test(userAgent)) return "firefox";
  if (/Chrome\/|Chromium\//i.test(userAgent)) return "chrome";
  if (/Safari\//i.test(userAgent)) return "safari";
  return "other";
}

export function detectPlatform(input: PlatformInput): Platform {
  const os = detectOS(input.userAgent, input.maxTouchPoints);
  const browser = detectBrowser(input.userAgent);

  return { os, browser, verdict: verdictFor(os, browser, input) };
}

function verdictFor(
  os: OS,
  browser: Browser,
  input: PlatformInput,
): InstallVerdict {
  if (input.standalone) return "installed";

  // A captured prompt always wins: if the browser says it can install, the
  // button works and no amount of UA sniffing should talk us out of it.
  if (input.canPrompt) return "can-prompt";

  if (browser === "in-app") return "in-app-browser";

  if (os === "ios") {
    // Add to Home Screen is only dependable in Safari on iOS, and a web clip
    // created elsewhere is not a reliable push target.
    return browser === "safari" ? "ios-safari" : "ios-other-browser";
  }

  if (os === "android") {
    // Firefox installs from its menu but never fires beforeinstallprompt.
    if (browser === "firefox") return "firefox-android";
    return "android-other-browser";
  }

  // macOS Ventura and later install web apps via Share → Add to Dock.
  if (os === "macos" && browser === "safari") return "desktop-safari";

  return "unsupported";
}

/** Reads the live browser environment. Safe to call during render on the client. */
export function readPlatformInput(canPrompt: boolean): PlatformInput {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { userAgent: "", maxTouchPoints: 0, standalone: false, canPrompt };
  }
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone:
      iosStandalone ||
      window.matchMedia?.("(display-mode: standalone)").matches === true,
    canPrompt,
  };
}

/**
 * A referentially stable Platform for `useSyncExternalStore`.
 *
 * getSnapshot is called on every render and must return the same object while
 * nothing has changed, so the result is cached against a value key. The server
 * snapshot is a distinct `pending` verdict rather than a guess, which keeps SSR
 * and the first client render identical — the install page shows a neutral
 * state until it genuinely knows the device.
 */
export type PlatformSnapshot = {
  os: OS;
  browser: Browser;
  verdict: InstallVerdict | "pending";
};

let cached: { key: string; value: Platform } | null = null;

export function platformSnapshot(canPrompt: boolean): Platform {
  const next = detectPlatform(readPlatformInput(canPrompt));
  const key = `${next.os}|${next.browser}|${next.verdict}`;
  if (!cached || cached.key !== key) cached = { key, value: next };
  return cached.value;
}

export const PENDING_PLATFORM: PlatformSnapshot = {
  os: "other",
  browser: "other",
  verdict: "pending",
};
