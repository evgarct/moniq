"use client";

import { format, isSameDay, isSameMonth, isToday } from "date-fns";

import { cn } from "@/lib/utils";

export function CalendarCell({
  date,
  currentMonth,
  selectedDate,
  onSelect,
  indicatorCount,
  paidCount,
  plannedCount,
}: {
  date: Date;
  currentMonth: Date;
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  indicatorCount: number;
  paidCount: number;
  plannedCount: number;
}) {
  const outsideMonth = !isSameMonth(date, currentMonth);
  const selected = selectedDate ? isSameDay(date, selectedDate) : false;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={cn(
        "flex min-h-24 flex-col rounded-xl border border-transparent px-4 py-3 text-left transition-colors",
        selected
          ? "border-border bg-card shadow-[inset_0_0_0_1px_rgba(17,24,39,0.04)]"
          : "bg-transparent hover:border-border/70 hover:bg-card/40",
        outsideMonth && "opacity-55",
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-md text-[21px] font-light leading-none tracking-[-0.05em]",
            isToday(date) && "text-[#f29a28]",
            selected && !isToday(date) && "text-foreground",
            !selected && !isToday(date) && "text-foreground/82",
            outsideMonth && !selected && !isToday(date) && "text-muted-foreground",
          )}
        >
          {format(date, "d")}
        </span>
      </div>
      {indicatorCount > 0 ? (
        <div className="mt-auto flex items-center gap-1.5">
          {plannedCount > 0 ? <span className="size-2 rounded-full bg-[#79dcc8]" /> : null}
          {paidCount > 0 ? <span className="size-2 rounded-full bg-[#f2a53d]" /> : null}
          {indicatorCount > plannedCount + paidCount ? <span className="size-2 rounded-full bg-border" /> : null}
        </div>
      ) : null}
    </button>
  );
}
