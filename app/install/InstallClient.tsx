"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Copy, Download, Share, SquarePlus } from "lucide-react";
import { useInstall } from "@/app/_lib/use-install";
import { PushToggle } from "@/app/_components/PushToggle";
import { cn } from "@/app/_lib/cn";

export function InstallClient() {
  const { os, browser, verdict, install } = useInstall();
  const installed = verdict === "installed";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 pt-24 pb-16">
      {/* The hero is the outcome itself: the icon at the size it will sit on a
          home screen, so the page shows rather than describes what you get. */}
      <Image
        src="/icon-192.png"
        alt=""
        width={88}
        height={88}
        className="h-[88px] w-[88px] rounded-[22px] bg-emerald-500 shadow-lg shadow-emerald-600/25"
        priority
      />
      <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        VT Pickup Soccer
      </p>

      <h1 className="mt-8 text-center text-2xl font-bold text-balance text-zinc-900 dark:text-zinc-50">
        {installed
          ? "The app is on your home screen"
          : "Put the queue on your home screen"}
      </h1>
      <p className="mt-2 text-center text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        {installed
          ? "One step left: let it send you notifications."
          : "Open it like any other app, and get a notification the moment a field, signup, or request needs review."}
      </p>

      <ol className="mt-10 w-full space-y-3">
        <Step n={1} title="Install the app" done={installed}>
          {installed ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Done. Open it from your home screen from now on.
            </p>
          ) : (
            <InstallStep verdict={verdict} os={os} browser={browser} install={install} />
          )}
        </Step>

        <Step
          n={2}
          title="Turn on notifications"
          done={false}
          dimmed={!installed && os === "ios"}
        >
          {!installed && os === "ios" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Available once the app is on your Home Screen — iPhone and iPad
              don&apos;t allow it from the browser.
            </p>
          ) : (
            <PushToggle className="border-0 bg-transparent p-0 shadow-none dark:bg-transparent" />
          )}
        </Step>
      </ol>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  dimmed,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-950",
        dimmed && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            done
              ? "bg-emerald-600 text-white"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
        </span>
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      <div className="mt-3 pl-[34px]">{children}</div>
    </li>
  );
}

function InstallStep({
  verdict,
  os,
  browser,
  install,
}: {
  verdict: string;
  os: string;
  browser: string;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}) {
  switch (verdict) {
    case "pending":
      return (
        <p className="text-sm text-zinc-500">
          Checking what device you&apos;re on…
        </p>
      );

    case "can-prompt":
      return (
        <>
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Download className="h-4 w-4" aria-hidden />
            Install app
          </button>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your browser will ask you to confirm.
          </p>
        </>
      );

    case "ios-safari":
      return (
        <Instructions
          steps={[
            <>
              Tap{" "}
              <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" />{" "}
              at the bottom of Safari
            </>,
            <>
              Choose{" "}
              <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden />{" "}
              Add to Home Screen
            </>,
            <>Tap Add, then open the app from your home screen</>,
          ]}
        />
      );

    case "desktop-safari":
      return (
        <Instructions
          steps={[
            <>
              Click{" "}
              <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" />{" "}
              in the Safari toolbar
            </>,
            <>Choose Add to Dock</>,
          ]}
        />
      );

    case "firefox-android":
      return (
        <Instructions
          steps={[<>Open the ⋮ menu</>, <>Choose Install, then confirm</>]}
        />
      );

    case "android-other-browser":
      return (
        <Instructions
          steps={[
            <>Open the ⋮ menu</>,
            <>Choose Install app, or Add to Home screen</>,
          ]}
        />
      );

    case "ios-other-browser":
      return (
        <SwitchBrowser
          to="Safari"
          why={`${labelFor(browser)} on iPhone and iPad can't add apps to the Home Screen.`}
        />
      );

    case "in-app-browser":
      return (
        <SwitchBrowser
          to={os === "ios" ? "Safari" : "Chrome"}
          why="Apps like Instagram and Facebook open links in a mini browser that can't install anything."
          hint={
            os === "ios"
              ? "Tap the ⋯ menu and choose Open in Safari, or paste the link below."
              : "Tap the ⋮ menu and choose Open in browser, or paste the link below."
          }
        />
      );

    default:
      return (
        <SwitchBrowser
          to="Chrome or Safari on your phone"
          why="This browser can't install the app."
        />
      );
  }
}

function Instructions({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className="tabular-nums text-zinc-400">{i + 1}.</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function SwitchBrowser({
  to,
  why,
  hint,
}: {
  to: string;
  why: string;
  hint?: string;
}) {
  return (
    <>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        Open this page in {to}. {why}
      </p>
      {hint && <p className="mt-1.5 text-sm text-zinc-500">{hint}</p>}
      <CopyLinkButton />
    </>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Embedded webviews — exactly where this button matters most — often
      // refuse the async clipboard API.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      document.body.removeChild(field);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

function labelFor(browser: string) {
  if (browser === "chrome") return "Chrome";
  if (browser === "firefox") return "Firefox";
  if (browser === "edge") return "Edge";
  return "This browser";
}
