"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

export function HomeHero() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!root.current) return;
      const ctx = gsap.context(() => {
        gsap.from(".hero-line", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 });
        gsap.to(".hero-content", {
          opacity: 0,
          y: -40,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom 30%", scrub: true },
        });
      }, root);
      return () => ctx.revert();
    },
    { scope: root },
  );
  return (
    <section ref={root} className="px-6 pt-16 pb-12">
      <div className="hero-content">
        <p className="hero-line text-sm uppercase tracking-widest text-zinc-500">Vermont</p>
        <h1 className="hero-line mt-2 text-5xl font-semibold tracking-tight">Pickup Soccer</h1>
        <p className="hero-line mt-3 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          A directory of weekly pickup games across the state. Find one near you, or add your own.
        </p>
        <div className="hero-line mt-6 flex flex-wrap gap-3">
          <Link href="/submit" className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Add a pickup game
          </Link>
        </div>
      </div>
    </section>
  );
}
