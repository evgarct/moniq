"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { TransactionList } from "@/components/transaction-list";
import { useBudgetTransactionEditor } from "@/features/budget/hooks/use-budget-transaction-editor";
import { listMonthPlannedTransactions } from "@/features/budget/lib/envelope-budget";
import type { FinanceSnapshot, Transaction } from "@/types/finance";

/**
 * The month's planned, not yet paid operations grouped by date, oldest (overdue) first. Each row keeps the usual actions (mark paid, skip, edit), and paying one moves its amount from
 * "upcoming" to "spent" in the envelopes above.
 */
export function BudgetUpcomingList({ snapshot, transactions, month }: { snapshot: FinanceSnapshot; transactions: Transaction[]; month: Date }) {
  const t = useTranslations("budget.upcoming");
  const { listActions, sheet } = useBudgetTransactionEditor(snapshot);
  const { overdue, upcoming } = useMemo(() => listMonthPlannedTransactions(transactions, month), [transactions, month]);
  const count = overdue.length + upcoming.length;
  const listProps = {
    showMinorUnits: true,
    targetCurrency: snapshot.preferences.default_currency,
    exchangeRates: snapshot.exchange_rates,
    onTransactionClick: listActions.onEditOccurrence,
    ...listActions,
  };

  return (
    <section className="flex flex-col gap-1" aria-label={t("title")}>
      <div className="mb-1 flex items-baseline justify-between gap-3 px-1">
        <h2 className="type-body-12 font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("title")}</h2>
        {count ? <span className="type-body-12 text-muted-foreground">{t("total", { count })}</span> : null}
      </div>

      {count === 0 ? <p className="type-body-14 px-1 py-3 text-muted-foreground">{t("empty")}</p> : null}

      {/* Rows already mark overdue occurrences, so overdue and upcoming share one date-grouped list, oldest first. */}
      {count ? <TransactionList transactions={[...overdue, ...upcoming]} emptyMessage={t("empty")} groupByDate {...listProps} /> : null}

      {sheet}
    </section>
  );
}
