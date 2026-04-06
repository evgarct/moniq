"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  buttonVariant = "ghost",
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background p-2 [--cell-radius:var(--radius-sm)] [--cell-size:2rem]",
        className,
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex flex-col gap-4 sm:flex-row sm:gap-6", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        nav: cn("flex items-center gap-1", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "absolute left-0 top-0 size-(--cell-size) p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "absolute right-0 top-0 size-(--cell-size) p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "relative flex h-(--cell-size) items-center justify-center px-8",
          defaultClassNames.month_caption,
        ),
        caption_label: cn("text-sm font-medium tracking-[-0.02em]", defaultClassNames.caption_label),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-(--cell-radius) text-[11px] font-normal text-muted-foreground",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn("relative aspect-square size-(--cell-size) p-0 text-center", defaultClassNames.day),
        day_button: cn(
          "size-(--cell-size) rounded-(--cell-radius) p-0 text-sm font-normal transition-colors hover:bg-[#f3efe9] active:bg-[#ece8e1] aria-selected:opacity-100",
          defaultClassNames.day_button,
        ),
        selected: cn("text-foreground", defaultClassNames.selected),
        today: cn("text-foreground [&>button]:bg-transparent [&>button]:font-medium [&>button]:text-foreground", defaultClassNames.today),
        outside: cn("text-muted-foreground opacity-50 aria-selected:bg-[#f1ede7] aria-selected:text-muted-foreground", defaultClassNames.outside),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        range_middle: cn(
          "rounded-none bg-[#f1ede7] text-foreground [&>button]:rounded-none [&>button]:bg-transparent [&>button]:hover:bg-[#ebe5dc] [&>button]:active:bg-[#e4ddd2]",
          defaultClassNames.range_middle,
        ),
        range_start: cn(
          "rounded-l-[6px] rounded-r-none bg-[#f1ede7] text-foreground [&>button]:rounded-l-[6px] [&>button]:rounded-r-none [&>button]:bg-[#e6e1d9] [&>button]:hover:bg-[#e6e1d9] [&>button]:active:bg-[#e6e1d9]",
          defaultClassNames.range_start,
        ),
        range_end: cn(
          "rounded-r-[6px] rounded-l-none bg-[#f1ede7] text-foreground [&>button]:rounded-r-[6px] [&>button]:rounded-l-none [&>button]:bg-[#e6e1d9] [&>button]:hover:bg-[#e6e1d9] [&>button]:active:bg-[#e6e1d9]",
          defaultClassNames.range_end,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      modifiersClassNames={{
        pending_start:
          "text-foreground [&>button]:rounded-[6px] [&>button]:bg-[#e6e1d9] [&>button]:hover:bg-[#e6e1d9] [&>button]:active:bg-[#e6e1d9]",
      }}
      components={{
        Chevron: ({ orientation, className, ...componentProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", className)} {...componentProps} />
          ) : (
            <ChevronRight className={cn("size-4", className)} {...componentProps} />
          ),
      }}
      {...props}
    />
  );
}
