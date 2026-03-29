"use client";

import { isSameDay, parseISO, startOfToday } from "date-fns";
import { CheckCircle2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/types/finance";

export function TodayView({ transactions }: { transactions: Transaction[] }) {
  const t = useTranslations("today");
  const today = startOfToday();
  const todayTransactions = transactions.filter((transaction) =>
    isSameDay(parseISO(transaction.occurred_at), today),
  );
  const planned = todayTransactions.filter((transaction) => transaction.status === "planned");
  const paid = todayTransactions.filter((transaction) => transaction.status === "paid");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title={t("planned.title")} description={t("planned.description")}>
        <TransactionList
          transactions={planned}
          emptyMessage={t("planned.empty")}
          compact
          renderAction={() => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <CheckCircle2 className="h-4 w-4" />
                {t("actions.markPaid")}
              </Button>
              <Button variant="ghost" size="sm">
                <Pencil className="h-4 w-4" />
                {t("actions.edit")}
              </Button>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title={t("paid.title")} description={t("paid.description")}>
        <TransactionList
          transactions={paid}
          emptyMessage={t("paid.empty")}
          compact
          renderAction={() => (
            <Button variant="ghost" size="sm">
              <Pencil className="h-4 w-4" />
              {t("actions.edit")}
            </Button>
          )}
        />
      </SectionCard>
    </div>
  );
}
