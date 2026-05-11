"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-[6px] w-full overflow-hidden rounded-full",
        "bg-foreground/[0.08]",
        "shadow-[inset_0_1px_1.5px_0_rgb(0_0_0/0.05)]",
        "dark:shadow-[inset_0_1px_1.5px_0_rgb(0_0_0/0.32)]",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 rounded-full",
          "bg-gradient-to-b from-[color-mix(in_oklab,var(--primary)_100%,white_10%)] to-[var(--primary)]",
          "shadow-[var(--inner-highlight-strong),0_0_8px_0_color-mix(in_oklab,var(--primary)_30%,transparent)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
