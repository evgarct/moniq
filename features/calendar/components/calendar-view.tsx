"use client";

import { addMonths, format, startOfToday } from "date-fns";
import { useState } from "react";

import { CalendarGrid } from "@/components/calendar-grid";
import { MonthNavigator } from "@/components/month-navigator";
import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import { getTransactionsForDate } from "@/lib/finance-selectors";
import type { Transaction } from "@/types/finance";

export function CalendarView({ transactions }: { transactions: Transaction[] }) {
  const [month, setMonth] = useState(startOfToday());
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const selectedTransactions = getTransactionsForDate(transactions, selectedDate);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
      <SectionCard
        title="Monthly view"
        description="Scan your month and jump into a specific day."
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
        title={format(selectedDate, "MMMM d")}
        description="Transactions mapped to the selected date."
      >
        <TransactionList
          transactions={selectedTransactions}
          emptyMessage="No transactions for this date."
        />
      </SectionCard>
    </div>
  );
}
