"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const FIND_LINKS = [
  { label: "Find a field", href: "/" },
  { label: "Submit a field", href: "/submit" },
  { label: "Your account", href: "/account" },
] as const;

const PLAY_LINKS = [
  { label: "Sign in", href: "/signin" },
  { label: "Create an account", href: "/signup" },
] as const;

export function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-zinc-950 text-zinc-200">
      {/* Top emerald edge */}
      <div className="absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-emerald-500/8 to-transparent"
      />

      <AmbientCircles />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-14">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <BrandBlock />
          <LinkColumn label="Find a game" links={FIND_LINKS} />
          <LinkColumn label="Lace up" links={PLAY_LINKS} />
        </div>

        <div className="mt-12 border-t border-zinc-800/70 pt-6">
          <p className="text-xs font-medium text-zinc-500">
            © {new Date().getFullYear()} Vermont Pickup Soccer · Built by
            players, for players.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---- Ambient circles ----

function AmbientCircles() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const breatherRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (breatherRef.current) {
        gsap.fromTo(
          breatherRef.current,
          { scale: 1 },
          {
            scale: 1.06,
            duration: 5.5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            transformOrigin: "center",
          },
        );
      }
      if (driftRef.current) {
        gsap.fromTo(
          driftRef.current,
          { x: 0, y: 0 },
          {
            x: 12,
            y: -8,
            duration: 9,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          },
        );
      }
    },
    { scope: wrapRef },
  );

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full border border-emerald-400/[0.06]" />
      <div
        ref={breatherRef}
        className="absolute left-[36%] top-1/2 h-64 w-64 -translate-y-1/2 rounded-full border border-emerald-400/[0.10]"
      />
      <div
        ref={driftRef}
        className="absolute -right-32 -bottom-28 h-[26rem] w-[26rem] rounded-full border border-emerald-400/[0.07]"
      />
      <div className="absolute right-[18%] top-10 h-28 w-28 rounded-full border border-emerald-400/[0.08]" />
    </div>
  );
}

// ---- Brand ----

function BrandBlock() {
  const ballRef = useRef<HTMLDivElement>(null);

  const onEnter = useCallback(() => {
    if (!ballRef.current) return;
    gsap.killTweensOf(ballRef.current);
    gsap
      .timeline()
      .to(ballRef.current, {
        rotation: "+=360",
        y: -8,
        duration: 0.55,
        ease: "power2.out",
      })
      .to(ballRef.current, {
        y: 0,
        duration: 0.45,
        ease: "bounce.out",
      });
  }, []);

  const onLeave = useCallback(() => {
    if (!ballRef.current) return;
    gsap.to(ballRef.current, { y: 0, duration: 0.3, ease: "power2.out" });
  }, []);

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="flex items-center gap-4"
    >
      <div ref={ballRef} className="relative h-14 w-14 shrink-0">
        <Image
          src="/soccer-ball.png"
          alt=""
          fill
          sizes="56px"
          className="object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
        />
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-400">
          Pitch report
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-[1.65rem]">
          Vermont Pickup Soccer
        </h2>
        <p className="mt-1.5 max-w-xs text-sm text-zinc-400">
          Free, public, updated by the people who play.
        </p>
      </div>
    </div>
  );
}

// ---- Link columns ----

function LinkColumn({
  label,
  links,
}: {
  label: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-400">
        <span className="h-1 w-1 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(110,231,183,0.7)]" />
        {label}
      </p>
      <ul className="mt-4 flex flex-col gap-1">
        {links.map((l) => (
          <li key={l.href}>
            <FooterLink href={l.href} label={l.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const lettersRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);

  const onEnter = useCallback(() => {
    const letters = lettersRef.current?.querySelectorAll<HTMLSpanElement>(
      "[data-letter]",
    );
    if (letters && letters.length) {
      gsap.killTweensOf(letters);
      gsap.fromTo(
        letters,
        { y: 0 },
        {
          y: -4,
          duration: 0.18,
          stagger: 0.025,
          ease: "power2.out",
          yoyo: true,
          repeat: 1,
        },
      );
    }
    if (lineRef.current) {
      gsap.killTweensOf(lineRef.current);
      gsap.fromTo(
        lineRef.current,
        { scaleX: 0, transformOrigin: "left center" },
        { scaleX: 1, duration: 0.4, ease: "power3.out" },
      );
    }
    if (ballRef.current) {
      gsap.killTweensOf(ballRef.current);
      gsap.fromTo(
        ballRef.current,
        { left: "-2%", opacity: 0, rotation: 0 },
        {
          left: "100%",
          opacity: 1,
          rotation: 720,
          duration: 0.5,
          ease: "power2.out",
          onComplete: () => {
            if (ballRef.current) {
              gsap.to(ballRef.current, { opacity: 0, duration: 0.18 });
            }
          },
        },
      );
    }
  }, []);

  const onLeave = useCallback(() => {
    if (lineRef.current) {
      gsap.to(lineRef.current, {
        scaleX: 0,
        transformOrigin: "right center",
        duration: 0.28,
        ease: "power3.in",
      });
    }
    if (ballRef.current) {
      gsap.to(ballRef.current, { opacity: 0, duration: 0.2 });
    }
  }, []);

  return (
    <Link
      ref={rootRef}
      href={href}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group relative inline-flex flex-col py-1.5 pr-3"
    >
      <span
        ref={lettersRef}
        aria-label={label}
        className="relative inline-block text-sm font-semibold text-zinc-200 transition-colors group-hover:text-white"
      >
        {Array.from(label).map((c, i) => (
          <span
            key={i}
            data-letter
            aria-hidden="true"
            className="inline-block will-change-transform"
          >
            {c === " " ? "\u00A0" : c}
          </span>
        ))}
      </span>
      <span className="relative mt-1 block h-[2px] w-full overflow-visible">
        <span
          ref={lineRef}
          className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-emerald-400 via-emerald-200 to-emerald-400"
          style={{ transform: "scaleX(0)" }}
        />
        <span
          ref={ballRef}
          aria-hidden="true"
          className="absolute -top-1 left-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.85),0_0_18px_rgba(110,231,183,0.6)]"
          style={{ opacity: 0 }}
        />
      </span>
    </Link>
  );
}
