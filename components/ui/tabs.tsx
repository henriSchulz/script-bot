"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "mac-segmented text-muted-foreground inline-flex h-[30px] w-fit items-center justify-center",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 items-center justify-center gap-1.5",
        "rounded-[7px] px-3 py-1 text-[12.5px] font-medium whitespace-nowrap",
        "text-foreground/70 hover:text-foreground",
        "cursor-default select-none outline-none",
        "transition-[color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "data-[state=active]:bg-card data-[state=active]:text-foreground",
        "data-[state=active]:shadow-[var(--inner-highlight),0_1px_2px_0_rgb(0_0_0/0.06),0_0_0_0.5px_rgb(0_0_0/0.08)]",
        "dark:data-[state=active]:shadow-[var(--inner-highlight),0_1px_2px_0_rgb(0_0_0/0.3),0_0_0_0.5px_rgb(255_255_255/0.08)]",
        "focus-visible:[box-shadow:0_0_0_2px_var(--muted),0_0_0_5px_var(--ring)]",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none animate-mac-fade-in", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
