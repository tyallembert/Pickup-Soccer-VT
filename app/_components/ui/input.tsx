"use client";

import * as React from "react";
import { cn } from "@/app/_lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors",
        "placeholder:text-zinc-500 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:ring-emerald-700",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
