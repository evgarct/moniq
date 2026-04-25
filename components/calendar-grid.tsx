"use client";

import { eachDayOfInterval, endOfMonth, endOfWeek, format, isBefore, parseISO, startOfDay, startOfMonth, startOfWeek, startOfToday } from "date-fns";
import { useTranslations } from "next-intl";

import { CalendarCell } from "@/components/calendar-cell";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { Transaction } from "@/types/finance";

export function CalendarGrid({
  month,
  selectedDate,
  transactions,
  onSelectDate,
}: {
  month: Date;
  selectedDate: Date | null;
  transactions: Transaction[];
  onSelectDate: (date: Date) => void;
}) {
  const t = useTranslations("calendar.weekdays");
  const weekdayLabels = [t("mon"), t("tue"), t("wed"), t("thu"), t("fri"), t("sat"), t("sun")];
  const today = startOfToday();

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className="space-y-0.5">
      {/* Weekday headers */}
      <div className="grid grid-cols-7">
        {weekdayLabels.map((day) => (
          <div key={day} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayTxs = transactions.filter(
            (tx) => isVisibleTransactionStatus(tx.status) && tx.occurred_at === dateStr,
          );
          const paidCount = dayTxs.filter((tx) => tx.status === "paid").length;
          const plannedNonOverdue = dayTxs.filter(
            (tx) => tx.status === "planned" && !isBefore(startOfDay(parseISO(tx.occurred_at)), today),
          ).length;
          const overdueCount = dayTxs.filter(
            (tx) => tx.status === "planned" && isBefore(startOfDay(parseISO(tx.occurred_at)), today),
          ).length;

          return (
            <CalendarCell
              key={day.toISOString()}
              date={day}
              currentMonth={month}
              selectedDate={selectedDate}
              onSelect={onSelectDate}
              paidCount={paidCount}
              plannedCount={plannedNonOverdue}
              overdueCount={overdueCount}
            />
          );
        })}
      </div>
    </div>
  );
}
