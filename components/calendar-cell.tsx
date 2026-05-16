"use client";

import { format, isSameDay, isSameMonth, isToday } from "date-fns";

import { cn } from "@/lib/utils";

export function CalendarCell({
  date,
  currentMonth,
  selectedDate,
  onSelect,
  paidCount,
  plannedCount,
  overdueCount,
}: {
  date: Date;
  currentMonth: Date;
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  paidCount: number;
  plannedCount: number;
  overdueCount: number;
}) {
  const outsideMonth = !isSameMonth(date, currentMonth);
  const selected = selectedDate ? isSameDay(date, selectedDate) : false;
  const today = isToday(date);
  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={cn(
        "group flex flex-col items-start gap-1.5 rounded-lg px-2 py-2 text-left transition-colors outline-none",
        selected && !today
          ? "bg-foreground/6 outline outline-1 outline-foreground/10"
          : selected && today
            ? "bg-[#f29a28]/10 outline outline-1 outline-[#f29a28]/30"
            : "hover:bg-secondary/50",
        outsideMonth && "opacity-35",
      )}
    >
      {/* Day number + dots — centered together */}
      <div className="flex flex-col items-center gap-1">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-medium leading-none transition-colors",
            today
              ? "bg-[#f29a28] text-white"
              : selected
                ? "text-foreground"
                : outsideMonth
                  ? "text-muted-foreground/60"
                  : "text-foreground/80 group-hover:text-foreground",
          )}
        >
          {format(date, "d")}
        </span>

        <div className="flex h-[5px] items-center gap-[3px]">
          {overdueCount > 0 ? <span className="size-[5px] rounded-full bg-destructive" /> : null}
          {plannedCount > 0 ? <span className="size-[5px] rounded-full bg-[#79dcc8]" /> : null}
          {paidCount > 0 ? <span className="size-[5px] rounded-full bg-foreground/25" /> : null}
        </div>
      </div>
    </button>
  );
}
