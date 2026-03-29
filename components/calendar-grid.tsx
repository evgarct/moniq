"use client";

import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { useTranslations } from "next-intl";

import { CalendarCell } from "@/components/calendar-cell";
import type { Transaction } from "@/types/finance";

export function CalendarGrid({
  month,
  selectedDate,
  transactions,
  onSelectDate,
}: {
  month: Date;
  selectedDate: Date;
  transactions: Transaction[];
  onSelectDate: (date: Date) => void;
}) {
  const t = useTranslations("calendar.weekdays");
  const weekdayLabels = [t("mon"), t("tue"), t("wed"), t("thu"), t("fri"), t("sat"), t("sun")];
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2">
        {weekdayLabels.map((day) => (
          <div key={day} className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const count = transactions.filter((transaction) => transaction.occurred_at === format(day, "yyyy-MM-dd")).length;
          return (
            <CalendarCell
              key={day.toISOString()}
              date={day}
              currentMonth={month}
              selectedDate={selectedDate}
              onSelect={onSelectDate}
              indicatorCount={count}
            />
          );
        })}
      </div>
    </div>
  );
}
