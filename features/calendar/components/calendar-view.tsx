"use client";

import { addMonths, startOfToday } from "date-fns";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CalendarGrid } from "@/components/calendar-grid";
import { MonthNavigator } from "@/components/month-navigator";
import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import { getTransactionsForDate } from "@/lib/finance-selectors";
import type { Transaction } from "@/types/finance";

export function CalendarView({ transactions }: { transactions: Transaction[] }) {
  const t = useTranslations("calendar");
  const formatDate = useFormatter();
  const [month, setMonth] = useState(startOfToday());
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const selectedTransactions = getTransactionsForDate(transactions, selectedDate);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
      <SectionCard
        title={t("view.title")}
        description={t("view.description")}
        action={
          <MonthNavigator
            month={month}
            onPrevious={() => setMonth((value) => addMonths(value, -1))}
            onNext={() => setMonth((value) => addMonths(value, 1))}
            onToday={() => {
              const today = startOfToday();
              setMonth(today);
              setSelectedDate(today);
            }}
          />
        }
        contentClassName="pt-0"
      >
        <CalendarGrid
          month={month}
          selectedDate={selectedDate}
          transactions={transactions}
          onSelectDate={setSelectedDate}
        />
      </SectionCard>

      <SectionCard
        title={formatDate.dateTime(selectedDate, { month: "long", day: "numeric" })}
        description={t("view.selectedDescription")}
      >
        <TransactionList
          transactions={selectedTransactions}
          emptyMessage={t("view.empty")}
        />
      </SectionCard>
    </div>
  );
}
