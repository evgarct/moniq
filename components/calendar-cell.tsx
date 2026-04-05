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
        "flex min-h-22 flex-col rounded-xl border border-transparent px-3 py-2 text-left transition-colors",
        selected
          ? "border-white/45 bg-white/14 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          : "bg-transparent hover:border-white/16 hover:bg-white/5",
        outsideMonth && "text-[#58767c]",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-[24px] font-light leading-none tracking-[-0.05em]",
            isToday(date) && "text-[#ffb13d]",
            selected && !isToday(date) && "text-[#f4f8f7]",
            !selected && !isToday(date) && "text-[#dceeed]",
          )}
        >
          {format(date, "d")}
        </span>
        {indicatorCount > 0 ? <span className="text-[10px] text-[#6c8a8f]">{indicatorCount}</span> : null}
      </div>
      {indicatorCount > 0 ? (
        <div className="mt-auto flex items-center gap-1.5">
          {plannedCount > 0 ? <span className="size-1.5 rounded-full bg-[#8af1dc]" /> : null}
          {paidCount > 0 ? <span className="size-1.5 rounded-full bg-[#ffb13d]" /> : null}
        </div>
      ) : null}
    </button>
  );
}
