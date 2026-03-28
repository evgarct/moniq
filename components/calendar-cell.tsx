"use client";

import { format, isSameDay, isSameMonth, isToday } from "date-fns";

import { cn } from "@/lib/utils";

export function CalendarCell({
  date,
  currentMonth,
  selectedDate,
  onSelect,
  indicatorCount,
}: {
  date: Date;
  currentMonth: Date;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  indicatorCount: number;
}) {
  const outsideMonth = !isSameMonth(date, currentMonth);
  const selected = isSameDay(date, selectedDate);

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={cn(
        "flex min-h-24 flex-col rounded-lg border p-2 text-left transition-colors",
        selected ? "border-primary bg-accent" : "border-border bg-background hover:bg-muted/60",
        outsideMonth && "text-muted-foreground",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-sm",
            isToday(date) && "bg-primary text-primary-foreground",
            selected && !isToday(date) && "bg-secondary text-secondary-foreground",
          )}
        >
          {format(date, "d")}
        </span>
        {indicatorCount > 0 ? <span className="text-xs text-muted-foreground">{indicatorCount}</span> : null}
      </div>
    </button>
  );
}
