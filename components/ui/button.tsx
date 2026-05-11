import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium select-none cursor-default",
    "rounded-[10px] text-[13px] leading-none",
    "transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[15px] shrink-0 [&_svg]:shrink-0",
    "outline-none focus-visible:[box-shadow:0_0_0_2px_var(--background),0_0_0_5px_var(--ring)]",
    "aria-invalid:[box-shadow:0_0_0_2px_var(--background),0_0_0_5px_oklch(0.585_0.222_22/0.5)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "mac-control-primary",
        destructive: "mac-control-destructive",
        outline: "mac-control text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 shadow-[var(--shadow-mac-xs)]",
        ghost:
          "text-foreground hover:bg-accent/70 active:bg-accent",
        link:
          "text-primary underline-offset-4 hover:underline px-0 h-auto",
        toolbar:
          "text-foreground/80 hover:text-foreground hover:bg-foreground/[0.06] active:bg-foreground/[0.10] rounded-md",
      },
      size: {
        default: "h-[30px] px-3.5 has-[>svg]:px-3",
        sm: "h-[26px] px-3 text-[12px] gap-1.5 has-[>svg]:px-2.5",
        lg: "h-9 px-5 text-[14px] has-[>svg]:px-4",
        xl: "h-11 px-7 text-[15px] rounded-[12px] has-[>svg]:px-6",
        icon: "size-[30px] [&_svg:not([class*='size-'])]:size-[16px]",
        "icon-sm": "size-[26px] [&_svg:not([class*='size-'])]:size-[14px]",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
