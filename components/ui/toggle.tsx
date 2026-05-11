"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-1.5",
    "rounded-[8px] text-[13px] font-medium",
    "transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
    "text-foreground/70 hover:text-foreground",
    "hover:bg-foreground/[0.06]",
    "data-[state=on]:bg-foreground/[0.10] data-[state=on]:text-foreground",
    "cursor-default select-none outline-none",
    "focus-visible:[box-shadow:0_0_0_2px_var(--background),0_0_0_5px_var(--ring)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"
  ),
  {
    variants: {
      variant: {
        default: "",
        outline:
          "mac-control data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-[var(--inner-highlight-strong)]",
      },
      size: {
        default: "h-[30px] px-2.5",
        sm: "h-[26px] px-2",
        lg: "h-9 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
