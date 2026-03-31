"use client";

import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
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
          <div key={day} className="px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#85a5a8]">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayTransactions = transactions.filter(
            (transaction) =>
              isVisibleTransactionStatus(transaction.status) && transaction.occurred_at === format(day, "yyyy-MM-dd"),
          );
          const paidCount = dayTransactions.filter((transaction) => transaction.status === "paid").length;
          const plannedCount = dayTransactions.filter((transaction) => transaction.status === "planned").length;
          return (
            <CalendarCell
              key={day.toISOString()}
              date={day}
              currentMonth={month}
              selectedDate={selectedDate}
              onSelect={onSelectDate}
              indicatorCount={dayTransactions.length}
              paidCount={paidCount}
              plannedCount={plannedCount}
            />
          );
        })}
      </div>
    </div>
  );
}
