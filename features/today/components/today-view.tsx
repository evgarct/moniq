"use client";

import { isSameDay, parseISO, startOfToday } from "date-fns";
import { CheckCircle2, Pencil } from "lucide-react";

import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/types/finance";

export function TodayView({ transactions }: { transactions: Transaction[] }) {
  const today = startOfToday();
  const todayTransactions = transactions.filter((transaction) =>
    isSameDay(parseISO(transaction.date), today),
  );
  const planned = todayTransactions.filter((transaction) => transaction.status === "planned");
  const paid = todayTransactions.filter((transaction) => transaction.status === "paid");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Planned transactions" description="Items expected today.">
        <TransactionList
          transactions={planned}
          emptyMessage="Nothing planned for today."
          compact
          renderAction={() => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <CheckCircle2 className="h-4 w-4" />
                Mark paid
              </Button>
              <Button variant="ghost" size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title="Paid transactions" description="Completed items for quick scanning.">
        <TransactionList
          transactions={paid}
          emptyMessage="No paid transactions today."
          compact
          renderAction={() => (
            <Button variant="ghost" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        />
      </SectionCard>
    </div>
  );
}
