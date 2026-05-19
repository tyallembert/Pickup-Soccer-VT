"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/app/_lib/cn"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:shadow-[0_3px_10px_rgba(16,185,129,0.45)] dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200 dark:focus-visible:ring-emerald-700",
  {
    variants: {
      variant: {
        default: "bg-transparent text-zinc-600 dark:text-zinc-300",
        outline:
          "border border-zinc-300 bg-transparent shadow-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
