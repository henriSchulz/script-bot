import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "flex h-[30px] w-full min-w-0 rounded-[8px] bg-card px-3 py-1 text-[13px] text-foreground",
        "placeholder:text-muted-foreground/70",
        // Tactile inset look
        "border border-border/80",
        "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04),inset_0_1.5px_3px_-1px_rgba(0,0,0,0.04)]",
        "dark:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.25),inset_0_1.5px_3px_-1px_rgba(0,0,0,0.25)]",
        // File input
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Selection
        "selection:bg-primary/25 selection:text-foreground",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Transitions
        "transition-all duration-150 outline-none",
        // Focus
        "focus-visible:border-primary/60 focus-visible:bg-card",
        "focus-visible:[box-shadow:0_0_0_3.5px_var(--ring),inset_0_1px_0_0_rgba(0,0,0,0.04)]",
        // Invalid
        "aria-invalid:border-destructive/70 aria-invalid:focus-visible:[box-shadow:0_0_0_3.5px_oklch(0.585_0.222_22/0.45)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
