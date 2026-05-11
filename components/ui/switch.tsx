"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Frame
      "peer relative inline-flex h-[22px] w-[36px] shrink-0 items-center rounded-full",
      "cursor-default select-none outline-none",
      "transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
      // Off
      "data-[state=unchecked]:bg-foreground/[0.10]",
      "data-[state=unchecked]:shadow-[inset_0_1px_2px_0_rgb(0_0_0/0.08)]",
      "dark:data-[state=unchecked]:shadow-[inset_0_1px_2px_0_rgb(0_0_0/0.32)]",
      // On
      "data-[state=checked]:bg-primary",
      "data-[state=checked]:shadow-[inset_0_1px_2px_0_rgb(0_0_0/0.10),0_0_0_0.5px_color-mix(in_oklab,var(--primary)_60%,black_8%)]",
      // Focus
      "focus-visible:[box-shadow:0_0_0_2px_var(--background),0_0_0_5px_var(--ring)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block size-[18px] rounded-full bg-white",
        "shadow-[0_2px_4px_0_rgb(0_0_0/0.18),0_0_0_0.5px_rgb(0_0_0/0.08)]",
        "transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "translate-x-[2px] data-[state=checked]:translate-x-[16px]"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
