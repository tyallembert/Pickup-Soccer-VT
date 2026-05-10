"use client";

import { useGSAP } from "@gsap/react";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

type Props = { height?: number };

// Goal mouth = the inner pitch box from the SVG (x=220–380 / y=220–380 of 600).
// Centered around 0.5, matching the painted goal-box lines on both layouts.
const GOAL_RANGE_LO = 220 / 600;
const GOAL_RANGE_HI = 380 / 600;

const CONFETTI_COLORS = ["#10b981", "#f59e0b", "#ffffff", "#ef4444", "#3b82f6"];

export function SoccerField({ height = 560 }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null); // ball play area
  const ballRef = useRef<HTMLDivElement>(null);
  const celebRef = useRef<HTMLDivElement>(null); // confetti spawn layer
  const scorePillRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(true);
  const [score, setScore] = useState(0);
  const [goalFlash, setGoalFlash] = useState(0);

  // Physics state lives in a ref so the rAF loop never causes React re-renders.
  const phys = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    dragging: false,
    pointerId: -1,
    pointerStartX: 0,
    pointerStartY: 0,
    ballStartX: 0,
    ballStartY: 0,
    history: [] as { t: number; x: number; y: number }[],
    raf: 0,
    lastT: 0,
    bounds: {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      // Goal y-range expressed in transform-y coords (matches phys.y).
      goalYMin: 0,
      goalYMax: 0,
      // Goal x-range expressed in transform-x coords (matches phys.x).
      goalXMin: 0,
      goalXMax: 0,
      // Goal mouth center expressed in play-area pixel coords (for confetti origin).
      goalCenterX: 0,
      goalCenterY: 0,
      // Layout flag: true if the goal is on the bottom edge (mobile), false if on the right (desktop).
      goalOnBottom: false,
    },
  });
  const goalLocked = useRef(false);
  const onGoalRef = useRef<() => void>(() => {});

  // Hero text + pitch line entrance + scroll fade.
  useGSAP(
    () => {
      gsap.from(".pitch-line", {
        scaleX: 0,
        scaleY: 0,
        transformOrigin: "center",
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.04,
      });
      gsap.from(".hero-line", {
        x: -28,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        delay: 0.2,
      });
      gsap.from(ballRef.current, {
        opacity: 0,
        scale: 0.6,
        duration: 0.7,
        ease: "back.out(1.6)",
        delay: 0.5,
      });
      gsap.to(".hero-content", {
        opacity: 0,
        y: -40,
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: "bottom 30%",
          scrub: true,
        },
      });
    },
    { scope: rootRef },
  );

  // Apply the ball's transform from the physics ref. Stable ref so external code
  // (goal reset tween, init effect) can repaint without going through React state.
  const applyRef = useRef<() => void>(() => {});

  const triggerGoal = () => {
    if (goalLocked.current) return;
    goalLocked.current = true;
    setScore((s) => s + 1);
    setGoalFlash((n) => n + 1);
    emitConfetti();
    // Halt motion immediately and tween the ball home.
    phys.current.vx = 0;
    phys.current.vy = 0;
    cancelAnimationFrame(phys.current.raf);
    phys.current.raf = 0;
    phys.current.lastT = 0;
    gsap.killTweensOf(phys.current);
    gsap.to(phys.current, {
      x: 0,
      y: 0,
      rot: 0,
      duration: 0.7,
      ease: "back.out(1.4)",
      delay: 0.45,
      onUpdate: () => applyRef.current(),
      onComplete: () => {
        goalLocked.current = false;
      },
    });
  };

  const emitConfetti = () => {
    const layer = celebRef.current;
    const field = fieldRef.current;
    if (!layer || !field) return;
    const fr = field.getBoundingClientRect();
    const goalOnBottom = window.innerWidth < 640;
    const cx = goalOnBottom ? fr.width * 0.5 : fr.width - 4;
    const cy = goalOnBottom ? fr.height - 4 : fr.height * 0.5;
    // Base direction points back into the pitch.
    const baseAngle = goalOnBottom ? -Math.PI / 2 : Math.PI;

    const N = 36;
    for (let i = 0; i < N; i++) {
      const piece = document.createElement("span");
      const w = 5 + Math.random() * 6;
      const h = 9 + Math.random() * 9;
      const color =
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.cssText = `
        position: absolute;
        left: ${cx - w / 2}px;
        top: ${cy - h / 2}px;
        width: ${w}px;
        height: ${h}px;
        background: ${color};
        border-radius: 2px;
        opacity: 1;
        pointer-events: none;
        z-index: 30;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      `;
      layer.appendChild(piece);
      gsap.set(piece, { rotation: Math.random() * 360 });

      const spread = (Math.random() - 0.5) * (Math.PI * 0.85);
      const angle = baseAngle + spread;
      const speed = 160 + Math.random() * 260;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;
      const fallY = 220 + Math.random() * 140;
      const spin = (Math.random() * 720 - 360) * 1.2;

      const tl = gsap.timeline({ onComplete: () => piece.remove() });
      tl.to(piece, {
        x: dx,
        y: dy,
        rotation: `+=${spin * 0.5}`,
        duration: 0.55,
        ease: "power2.out",
      }).to(
        piece,
        {
          y: `+=${fallY}`,
          x: `+=${dx * 0.15}`,
          rotation: `+=${spin * 0.5}`,
          opacity: 0,
          duration: 0.7,
          ease: "power1.in",
        },
        ">-0.05",
      );
    }
  };

  // Wire the latest goal handler into the rAF tick without re-running the effect.
  useEffect(() => {
    onGoalRef.current = triggerGoal;
  });

  // Score pill flash when a goal is scored.
  useGSAP(
    () => {
      if (goalFlash === 0 || !scorePillRef.current) return;
      const tl = gsap.timeline();
      tl.fromTo(
        scorePillRef.current,
        { scale: 1 },
        {
          scale: 1.25,
          duration: 0.18,
          ease: "back.out(2.4)",
        },
      ).to(scorePillRef.current, {
        scale: 1,
        duration: 0.32,
        ease: "elastic.out(1, 0.5)",
      });
      gsap.fromTo(
        ".score-flash",
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.12,
          yoyo: true,
          repeat: 3,
          ease: "power1.inOut",
        },
      );
    },
    { dependencies: [goalFlash], scope: rootRef },
  );

  // Physics + drag handlers.
  useEffect(() => {
    const ball = ballRef.current;
    const field = fieldRef.current;
    if (!ball || !field) return;

    const apply = () => {
      ball.style.transform = `translate3d(${phys.current.x}px, ${phys.current.y}px, 0) rotate(${phys.current.rot}deg)`;
    };
    applyRef.current = apply;

    const computeBounds = () => {
      const fr = field.getBoundingClientRect();
      const br = ball.getBoundingClientRect();
      // Natural rect (where the ball would sit with no transform applied):
      const naturalLeft = br.left - fr.left - phys.current.x;
      const naturalTop = br.top - fr.top - phys.current.y;
      const pad = 6;
      // Goal layout follows the responsive pitch shape: bottom on mobile, right on desktop.
      const goalOnBottom =
        typeof window !== "undefined" && window.innerWidth < 640;
      const goalCenterY = fr.height * ((GOAL_RANGE_LO + GOAL_RANGE_HI) / 2);
      const goalCenterX = fr.width * ((GOAL_RANGE_LO + GOAL_RANGE_HI) / 2);
      phys.current.bounds = {
        minX: -naturalLeft + pad,
        maxX: fr.width - naturalLeft - br.width - pad,
        minY: -naturalTop + pad,
        maxY: fr.height - naturalTop - br.height - pad,
        // Convert goal range (in play-area px) into transform-space.
        goalYMin: GOAL_RANGE_LO * fr.height - naturalTop - br.height / 2,
        goalYMax: GOAL_RANGE_HI * fr.height - naturalTop - br.height / 2,
        goalXMin: GOAL_RANGE_LO * fr.width - naturalLeft - br.width / 2,
        goalXMax: GOAL_RANGE_HI * fr.width - naturalLeft - br.width / 2,
        goalCenterX: goalOnBottom ? goalCenterX : fr.width,
        goalCenterY: goalOnBottom ? fr.height : goalCenterY,
        goalOnBottom,
      };
    };

    computeBounds();
    apply();

    const stopRaf = () => {
      cancelAnimationFrame(phys.current.raf);
      phys.current.raf = 0;
    };

    const tick = (now: number) => {
      const p = phys.current;
      if (p.dragging) {
        p.raf = 0;
        return;
      }
      const dt = p.lastT ? Math.min((now - p.lastT) / 1000, 1 / 30) : 1 / 60;
      p.lastT = now;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Rolling rotation tied to horizontal velocity (radius ~32px → 360° per ~200px).
      p.rot += (p.vx / 32) * (180 / Math.PI) * dt;

      const b = p.bounds;
      const damp = 0.72;
      const sideFriction = 0.92;
      if (p.x < b.minX) {
        p.x = b.minX;
        p.vx = -p.vx * damp;
        p.vy *= sideFriction;
      } else if (p.x > b.maxX) {
        // Desktop goal: ball reached the right edge inside the goal-y range.
        if (
          !b.goalOnBottom &&
          !goalLocked.current &&
          p.y >= b.goalYMin &&
          p.y <= b.goalYMax
        ) {
          onGoalRef.current();
          return;
        }
        p.x = b.maxX;
        p.vx = -p.vx * damp;
        p.vy *= sideFriction;
      }
      if (p.y < b.minY) {
        p.y = b.minY;
        p.vy = -p.vy * damp;
        p.vx *= sideFriction;
      } else if (p.y > b.maxY) {
        // Mobile goal: ball reached the bottom edge inside the goal-x range.
        if (
          b.goalOnBottom &&
          !goalLocked.current &&
          p.x >= b.goalXMin &&
          p.x <= b.goalXMax
        ) {
          onGoalRef.current();
          return;
        }
        p.y = b.maxY;
        p.vy = -p.vy * damp;
        p.vx *= sideFriction;
      }

      // Air friction (exponential decay).
      const decay = Math.exp(-0.55 * dt);
      p.vx *= decay;
      p.vy *= decay;

      apply();

      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 2) {
        p.raf = requestAnimationFrame(tick);
      } else {
        p.vx = 0;
        p.vy = 0;
        p.raf = 0;
        p.lastT = 0;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      // Ignore grabs while the goal-reset tween is running.
      if (goalLocked.current) return;
      e.preventDefault();
      stopRaf();
      gsap.killTweensOf(ball);
      gsap.killTweensOf(phys.current);
      const p = phys.current;
      p.dragging = true;
      p.pointerId = e.pointerId;
      p.pointerStartX = e.clientX;
      p.pointerStartY = e.clientY;
      p.ballStartX = p.x;
      p.ballStartY = p.y;
      p.history = [{ t: performance.now(), x: p.x, y: p.y }];
      p.vx = 0;
      p.vy = 0;
      try {
        ball.setPointerCapture(e.pointerId);
      } catch {}
      ball.style.cursor = "grabbing";
      setHint(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = phys.current;
      if (!p.dragging || e.pointerId !== p.pointerId) return;
      const dx = e.clientX - p.pointerStartX;
      const dy = e.clientY - p.pointerStartY;
      const b = p.bounds;
      let nx = p.ballStartX + dx;
      let ny = p.ballStartY + dy;
      nx = Math.max(b.minX, Math.min(b.maxX, nx));
      ny = Math.max(b.minY, Math.min(b.maxY, ny));
      const lastRotX = p.x;
      p.x = nx;
      p.y = ny;
      // While dragging, rotate based on horizontal motion delta this frame.
      p.rot += ((p.x - lastRotX) / 32) * (180 / Math.PI);
      apply();

      const t = performance.now();
      p.history.push({ t, x: p.x, y: p.y });
      while (p.history.length > 0 && t - p.history[0].t > 100) {
        p.history.shift();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const p = phys.current;
      if (e.pointerId !== p.pointerId && p.pointerId !== -1) return;
      if (!p.dragging) return;
      p.dragging = false;
      ball.style.cursor = "grab";
      try {
        ball.releasePointerCapture(e.pointerId);
      } catch {}

      // Velocity = displacement / time over the recent history window.
      const h = p.history;
      if (h.length >= 2) {
        const a = h[0];
        const b2 = h[h.length - 1];
        const dt = (b2.t - a.t) / 1000;
        if (dt > 0.005) {
          p.vx = (b2.x - a.x) / dt;
          p.vy = (b2.y - a.y) / dt;
          // Cap unreasonable speeds.
          const speed = Math.hypot(p.vx, p.vy);
          const maxSpeed = 3200;
          if (speed > maxSpeed) {
            p.vx *= maxSpeed / speed;
            p.vy *= maxSpeed / speed;
          }
        }
      }
      p.lastT = 0;
      if (Math.hypot(p.vx, p.vy) > 2) {
        p.raf = requestAnimationFrame(tick);
      }
    };

    ball.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", computeBounds);
    window.addEventListener("scroll", computeBounds, { passive: true });

    return () => {
      ball.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", computeBounds);
      window.removeEventListener("scroll", computeBounds);
      stopRaf();
    };
  }, []);

  // Auto-dismiss hint after 6s.
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative isolate w-full overflow-hidden bg-black"
      style={{ height }}
      aria-label="Soccer field hero"
    >
      {/* Pitch container — bottom half on mobile, right half on desktop */}
      <div className="absolute bottom-0 left-0 right-0 h-[52%] sm:left-auto sm:top-0 sm:h-full sm:w-[58%]">
        <div className="absolute inset-0 pitch-bg" aria-hidden="true" />

        {/* Mobile pitch — halfway line at TOP, penalty area at BOTTOM */}
        <svg
          className="absolute inset-0 h-full w-full sm:hidden"
          viewBox="0 0 600 600"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g stroke="rgba(255,255,255,0.85)" strokeWidth="3" fill="none">
            {/* Outer touchlines (left, right, bottom). Top edge is the halfway line. */}
            <line className="pitch-line" x1="20" y1="0" x2="20" y2="580" />
            <line className="pitch-line" x1="580" y1="0" x2="580" y2="580" />
            <line className="pitch-line" x1="20" y1="580" x2="580" y2="580" />
            {/* Halfway line (top edge) */}
            <line className="pitch-line" x1="20" y1="0" x2="580" y2="0" />
            {/* Center half-circle opening down (other half is up in the darkness) */}
            <path className="pitch-line" d="M220 0 A 80 80 0 0 1 380 0" />
            <circle cx="300" cy="0" r="3" fill="rgba(255,255,255,0.85)" stroke="none" />
            {/* Penalty area on bottom */}
            <rect className="pitch-line" x="160" y="420" width="280" height="160" />
            <rect className="pitch-line" x="220" y="520" width="160" height="60" />
            <circle cx="300" cy="470" r="3" fill="rgba(255,255,255,0.85)" stroke="none" />
            <path className="pitch-line" d="M240 420 A 60 60 0 0 1 360 420" />
            {/* Bottom corner arcs */}
            <path className="pitch-line" d="M30 580 A 10 10 0 0 0 20 570" />
            <path className="pitch-line" d="M580 570 A 10 10 0 0 0 570 580" />
          </g>
        </svg>

        {/* Desktop pitch — halfway line on the LEFT edge, penalty area on the RIGHT */}
        <svg
          className="absolute inset-0 hidden h-full w-full sm:block"
          viewBox="0 0 600 600"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g stroke="rgba(255,255,255,0.85)" strokeWidth="3" fill="none">
            <line className="pitch-line" x1="0" y1="20" x2="580" y2="20" />
            <line className="pitch-line" x1="0" y1="580" x2="580" y2="580" />
            <line className="pitch-line" x1="580" y1="20" x2="580" y2="580" />
            <line className="pitch-line" x1="0" y1="20" x2="0" y2="580" />
            <path className="pitch-line" d="M0 220 A 80 80 0 0 1 0 380" />
            <circle cx="0" cy="300" r="3" fill="rgba(255,255,255,0.85)" stroke="none" />
            <rect className="pitch-line" x="420" y="160" width="160" height="280" />
            <rect className="pitch-line" x="520" y="220" width="60" height="160" />
            <circle cx="470" cy="300" r="3" fill="rgba(255,255,255,0.85)" stroke="none" />
            <path className="pitch-line" d="M420 360 A 60 60 0 0 1 420 240" />
            <path className="pitch-line" d="M580 30 A 10 10 0 0 0 570 20" />
            <path className="pitch-line" d="M580 570 A 10 10 0 0 1 570 580" />
          </g>
        </svg>
      </div>

      {/* Dark fade — vertical (top→pitch) on mobile, horizontal (left→pitch) on desktop */}
      <div
        className="pointer-events-none absolute inset-0 sm:hidden"
        style={{
          background:
            "linear-gradient(180deg, #050505 0%, #050505 36%, rgba(5,5,5,0.92) 42%, rgba(5,5,5,0.55) 46%, rgba(5,5,5,0.0) 52%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 hidden sm:block"
        style={{
          background:
            "linear-gradient(90deg, #050505 0%, #050505 28%, rgba(5,5,5,0.85) 42%, rgba(5,5,5,0.45) 50%, rgba(5,5,5,0.0) 58%)",
        }}
        aria-hidden="true"
      />

      {/* Subtle vignette on the pitch — matches pitch container shape */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-[52%] sm:left-auto sm:top-0 sm:h-full sm:w-[58%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 70%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Text panel — top 48% on mobile, left 48% on desktop.
          pt-20 on mobile clears the fixed top nav (top-4 + ~h-10). */}
      <div className="hero-content relative z-10 flex h-[48%] max-w-full flex-col justify-center px-5 pb-3 pt-20 sm:h-full sm:max-w-[48%] sm:px-12 sm:pb-0 sm:pt-0">
        <p className="hero-line text-[10px] uppercase tracking-[0.35em] text-emerald-300/80 sm:text-[11px] sm:tracking-[0.4em]">
          Vermont · Pickup
        </p>
        <h1 className="hero-line mt-2 text-4xl font-black leading-[0.95] tracking-tight text-white drop-shadow-lg sm:mt-3 sm:text-6xl">
          Find the <span className="italic text-emerald-300">game</span>.
        </h1>
        <p className="hero-line mt-2.5 max-w-md text-sm text-zinc-300 sm:mt-4 sm:text-lg">
          A statewide directory of weekly pickup games. Lace up, find a field near you,
          or add your own.
        </p>
        <div className="hero-line mt-4 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
          <Link
            href="/submit"
            className="group relative overflow-hidden rounded-full bg-white px-4 py-2 text-xs font-semibold text-emerald-900 shadow-lg transition hover:scale-[1.02] sm:px-6 sm:py-2.5 sm:text-sm"
          >
            <span className="relative z-10">+ Add a pickup game</span>
            <span className="absolute inset-0 -z-0 translate-x-[-110%] bg-emerald-300 transition group-hover:translate-x-0" />
          </Link>
          <a
            href="#locations"
            className="rounded-full border border-white/40 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur-sm transition hover:bg-white/10 sm:px-6 sm:py-2.5 sm:text-sm"
          >
            Browse fields ↓
          </a>
        </div>
      </div>

      {/* Goal-line flash overlay — full pitch tint, briefly visible on a goal. Two variants for layout. */}
      <div
        className="score-flash pointer-events-none absolute bottom-0 left-0 right-0 z-[15] h-[52%] opacity-0 sm:hidden"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(16,185,129,0.6) 0%, rgba(16,185,129,0.2) 35%, rgba(16,185,129,0) 65%)",
        }}
        aria-hidden="true"
      />
      <div
        className="score-flash pointer-events-none absolute bottom-0 right-0 top-0 z-[15] hidden w-[58%] opacity-0 sm:block"
        style={{
          background:
            "radial-gradient(ellipse at 100% 50%, rgba(16,185,129,0.6) 0%, rgba(16,185,129,0.2) 35%, rgba(16,185,129,0) 65%)",
        }}
        aria-hidden="true"
      />

      {/* Goal mouth — visual target with a net pattern. Mobile: bottom edge. Desktop: right edge. */}
      <div
        className="pointer-events-none absolute z-[12] sm:hidden"
        style={{
          left: `${GOAL_RANGE_LO * 100}%`,
          right: `${(1 - GOAL_RANGE_HI) * 100}%`,
          bottom: 0,
          height: 14,
        }}
        aria-hidden="true"
      >
        <div
          className="h-full w-full rounded-t-[3px] border-t-2 border-l-2 border-r-2 border-emerald-300/70"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent 0 5px, rgba(255,255,255,0.18) 5px 6px), repeating-linear-gradient(-45deg, transparent 0 5px, rgba(255,255,255,0.18) 5px 6px), linear-gradient(180deg, rgba(16,185,129,0.18), rgba(16,185,129,0.05))",
            boxShadow:
              "0 -4px 14px rgba(16,185,129,0.35), inset 0 0 8px rgba(16,185,129,0.15)",
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute z-[12] hidden sm:block"
        style={{
          top: `${GOAL_RANGE_LO * 100}%`,
          bottom: `${(1 - GOAL_RANGE_HI) * 100}%`,
          right: 0,
          width: 16,
        }}
        aria-hidden="true"
      >
        <div
          className="h-full w-full rounded-l-[3px] border-l-2 border-t-2 border-b-2 border-emerald-300/70"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent 0 5px, rgba(255,255,255,0.18) 5px 6px), repeating-linear-gradient(-45deg, transparent 0 5px, rgba(255,255,255,0.18) 5px 6px), linear-gradient(270deg, rgba(16,185,129,0.18), rgba(16,185,129,0.05))",
            boxShadow:
              "-4px 0 14px rgba(16,185,129,0.35), inset 0 0 8px rgba(16,185,129,0.15)",
          }}
        />
      </div>

      {/* Score pill — stadium scoreboard look. Sits on the pitch on both layouts:
          mobile: just inside the top of the bottom-pitch strip; desktop: top-right corner. */}
      <div
        ref={scorePillRef}
        className="pointer-events-none absolute right-3 top-[calc(48%+10px)] z-[40] inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-black/75 px-3 py-1.5 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] backdrop-blur sm:right-4 sm:top-4 sm:px-4 sm:py-2"
        aria-live="polite"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-200/90 sm:text-[10px]">
          Score
        </span>
        <span className="font-mono text-base font-extrabold tabular-nums sm:text-lg">
          {String(score).padStart(2, "0")}
        </span>
      </div>

      {/* Play area — bounds for the ball. Bottom strip on mobile, right column on desktop. */}
      <div
        ref={fieldRef}
        className="absolute bottom-0 left-0 right-0 z-20 h-[52%] sm:left-auto sm:top-0 sm:h-full sm:w-[58%]"
        aria-hidden="true"
      >
        {/* Confetti spawn layer — pieces are appended/removed imperatively. */}
        <div
          ref={celebRef}
          className="pointer-events-none absolute inset-0 z-[25] overflow-visible"
          aria-hidden="true"
        />
        <div
          ref={ballRef}
          role="button"
          tabIndex={0}
          aria-label="Drag the soccer ball — flick to throw"
          className="absolute left-[42%] top-[40%] h-16 w-16 cursor-grab touch-none select-none active:cursor-grabbing sm:left-[40%] sm:top-[55%] sm:h-20 sm:w-20"
          style={{ willChange: "transform", touchAction: "none" }}
        >
          <Image
            src="/soccer-ball.png"
            alt=""
            fill
            sizes="(min-width: 640px) 80px, 64px"
            priority
            draggable={false}
            className="pointer-events-none select-none object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
          />
        </div>

        {hint ? (
          <div className="pointer-events-none absolute left-1/2 top-[20%] z-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur sm:left-[28%] sm:top-[42%] sm:translate-x-0">
            flick to throw
          </div>
        ) : null}
      </div>
    </section>
  );
}
