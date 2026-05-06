"use client";

import { useGSAP } from "@gsap/react";
import { ReactNode, useRef } from "react";
import gsap from "gsap";

type Variant = "fade-up" | "fade-in";

export function MotionShell({
  children,
  variant = "fade-up",
  delay = 0,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const targets = ref.current.children;
      const from =
        variant === "fade-up"
          ? { y: 24, opacity: 0 }
          : { opacity: 0 };
      gsap.from(targets, {
        ...from,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.08,
        delay,
      });
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
