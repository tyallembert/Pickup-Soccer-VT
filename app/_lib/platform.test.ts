import { describe, expect, test } from "vitest";
import { detectPlatform, type PlatformInput } from "./platform";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 323.0.0.28.72",
  facebook:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US]",
  androidWebview:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function input(
  userAgent: string,
  over: Partial<PlatformInput> = {},
): PlatformInput {
  return {
    userAgent,
    maxTouchPoints: 0,
    standalone: false,
    canPrompt: false,
    ...over,
  };
}

describe("detectPlatform", () => {
  test("standalone wins over everything else", () => {
    expect(
      detectPlatform(input(UA.iphoneSafari, { standalone: true })).verdict,
    ).toBe("installed");
    expect(
      detectPlatform(
        input(UA.androidChrome, { standalone: true, canPrompt: true }),
      ).verdict,
    ).toBe("installed");
  });

  test("a captured prompt beats UA sniffing", () => {
    const p = detectPlatform(input(UA.androidChrome, { canPrompt: true }));
    expect(p.verdict).toBe("can-prompt");
  });

  test("Android Chrome without a captured prompt falls back to guidance", () => {
    expect(detectPlatform(input(UA.androidChrome)).verdict).toBe(
      "android-other-browser",
    );
  });

  test("iOS Safari gets the Share-sheet path", () => {
    const p = detectPlatform(input(UA.iphoneSafari));
    expect(p.os).toBe("ios");
    expect(p.browser).toBe("safari");
    expect(p.verdict).toBe("ios-safari");
  });

  test("Chrome and Firefox on iOS are routed to Safari", () => {
    expect(detectPlatform(input(UA.iphoneChrome)).verdict).toBe(
      "ios-other-browser",
    );
    expect(detectPlatform(input(UA.iphoneFirefox)).verdict).toBe(
      "ios-other-browser",
    );
  });

  test("iPadOS reports a Mac UA and is caught by touch points", () => {
    // Same UA string, different device: touch points are the only signal.
    expect(detectPlatform(input(UA.ipadOS, { maxTouchPoints: 5 })).os).toBe(
      "ios",
    );
    expect(
      detectPlatform(input(UA.ipadOS, { maxTouchPoints: 5 })).verdict,
    ).toBe("ios-safari");
    expect(detectPlatform(input(UA.macSafari, { maxTouchPoints: 0 })).os).toBe(
      "macos",
    );
  });

  test("desktop Safari gets Add to Dock", () => {
    expect(detectPlatform(input(UA.macSafari)).verdict).toBe("desktop-safari");
  });

  test("Firefox on Android is told to use its menu", () => {
    expect(detectPlatform(input(UA.androidFirefox)).verdict).toBe(
      "firefox-android",
    );
  });

  test("Samsung Internet is treated as an installable Android browser", () => {
    const p = detectPlatform(input(UA.androidSamsung));
    expect(p.browser).toBe("samsung");
    expect(p.verdict).toBe("android-other-browser");
  });

  test("in-app browsers are detected on both platforms", () => {
    for (const ua of [UA.instagram, UA.facebook, UA.androidWebview]) {
      const p = detectPlatform(input(ua));
      expect(p.browser).toBe("in-app");
      expect(p.verdict).toBe("in-app-browser");
    }
  });

  test("an in-app browser that somehow can prompt still gets the button", () => {
    expect(
      detectPlatform(input(UA.facebook, { canPrompt: true })).verdict,
    ).toBe("can-prompt");
  });

  test("desktop Chrome with no prompt event is unsupported, not a false promise", () => {
    expect(detectPlatform(input(UA.desktopChrome)).verdict).toBe("unsupported");
  });
});
