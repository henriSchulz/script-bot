"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative inline-flex shrink-0 items-center justify-center",
      "size-[16px] rounded-[5px]",
      "cursor-default select-none outline-none",
      "transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
      // Unchecked
      "bg-card border border-border/80",
      "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.03)]",
      "dark:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.2)]",
      // Checked
      "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
      "data-[state=checked]:text-primary-foreground",
      "data-[state=checked]:shadow-[var(--inner-highlight-strong),0_1px_2px_0_color-mix(in_oklab,var(--primary)_30%,transparent)]",
      // Indeterminate
      "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground",
      // Focus
      "focus-visible:[box-shadow:0_0_0_2px_var(--background),0_0_0_5px_var(--ring)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="size-3 stroke-[3.5]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
