import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-[10px] bg-card px-3.5 py-2.5 text-[13px] text-foreground leading-relaxed",
        "placeholder:text-muted-foreground/70",
        "border border-border/80",
        "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04),inset_0_1.5px_3px_-1px_rgba(0,0,0,0.04)]",
        "dark:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.25),inset_0_1.5px_3px_-1px_rgba(0,0,0,0.25)]",
        "selection:bg-primary/25 selection:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-150 outline-none resize-none",
        "focus-visible:border-primary/60",
        "focus-visible:[box-shadow:0_0_0_3.5px_var(--ring),inset_0_1px_0_0_rgba(0,0,0,0.04)]",
        "aria-invalid:border-destructive/70 aria-invalid:focus-visible:[box-shadow:0_0_0_3.5px_oklch(0.585_0.222_22/0.45)]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
