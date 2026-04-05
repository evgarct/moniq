"use client";

import { addMonths, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { Surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getIncomeExpenseSummaryByCurrency } from "@/lib/finance-selectors";
import { getTransactionAnalyticsAmount } from "@/features/transactions/lib/transaction-utils";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { buildCategoryTree } from "@/features/categories/lib/category-tree";
import type { CurrencyCode } from "@/types/currency";
import type { CategoryTreeNode, FinanceSnapshot } from "@/types/finance";

function sortNodesByActivity(nodes: CategoryTreeNode[]) {
  return [...nodes].sort((left, right) => Math.abs(right.total_amount) - Math.abs(left.total_amount));
}

function BudgetSection({
  title,
  description,
  nodes,
  emptyMessage,
}: {
  title: string;
  description: string;
  nodes: CategoryTreeNode[];
  emptyMessage: string;
}) {
  return (
    <Surface tone="panel" padding="lg" className="border border-black/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
          {nodes.length}
        </div>
      </div>

      <div className="mt-5">
        {nodes.length ? (
          <div className="flex flex-col">
            {nodes.map((node, index) => (
              <div key={node.id}>
                {index > 0 ? <Separator /> : null}
                <BudgetCategoryRow node={node} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>
    </Surface>
  );
}

function BudgetCategoryRow({ node }: { node: CategoryTreeNode }) {
  const t = useTranslations("budget.rows");

  return (
    <div className="py-3">
      <div
        className="grid items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-background/80 md:grid-cols-[minmax(0,1fr)_auto]"
        style={{ paddingLeft: `${12 + node.depth * 18}px` }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-base">
              {node.icon ?? "•"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{node.name}</p>
              <p className="text-xs text-muted-foreground">
                {node.children.length
                  ? t("childCount", { count: node.children.length })
                  : t("leaf")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {node.totals_by_currency.length ? (
            node.totals_by_currency.map((total) => (
              <div
                key={`${node.id}-${total.currency}`}
                className="rounded-full border border-border/70 bg-background px-3 py-1.5"
              >
                <MoneyAmount
                  amount={total.amount}
                  currency={total.currency}
                  display="absolute"
                  className="text-sm font-semibold text-foreground"
                />
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">0</span>
          )}
        </div>
      </div>

      {node.children.length ? (
        <div className="mt-1 flex flex-col">
          {sortNodesByActivity(node.children).map((child, index) => (
            <div key={child.id}>
              {index > 0 ? <Separator /> : null}
              <BudgetCategoryRow node={child} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BudgetView({ snapshot }: { snapshot: FinanceSnapshot }) {
  const t = useTranslations("budget");
  const commonT = useTranslations("common.actions");
  const formatDate = useFormatter();
  const today = startOfToday();
  const [month, setMonth] = useState(today);

  const monthTransactions = useMemo(
    () =>
      snapshot.transactions.filter(
        (transaction) =>
          isSettledTransactionStatus(transaction.status) && isSameMonth(parseISO(transaction.occurred_at), month),
      ),
    [month, snapshot.transactions],
  );

  const categoryTree = useMemo(
    () => buildCategoryTree(snapshot.categories, monthTransactions),
    [monthTransactions, snapshot.categories],
  );

  const expenseNodes = useMemo(
    () => sortNodesByActivity(categoryTree.filter((node) => node.type === "expense" && node.total_amount > 0)),
    [categoryTree],
  );
  const incomeNodes = useMemo(
    () => sortNodesByActivity(categoryTree.filter((node) => node.type === "income" && node.total_amount > 0)),
    [categoryTree],
  );
  const summary = useMemo(() => getIncomeExpenseSummaryByCurrency(monthTransactions), [monthTransactions]);
  const netByCurrency = useMemo(
    () =>
      summary.map((item) => ({
        currency: item.currency,
        amount: item.income - item.expenses,
      })),
    [summary],
  );
  const totalTrackedCategories = categoryTree.filter((node) => node.total_amount > 0).length;
  const totalTransactions = monthTransactions.reduce(
    (count, transaction) => count + (getTransactionAnalyticsAmount(transaction) > 0 ? 1 : 0),
    0,
  );

  return (
    <div className="flex h-full flex-col gap-6">
      <Surface tone="panel" padding="lg" className="border border-black/5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-foreground">
              <WalletCards className="size-[18px]" strokeWidth={1.8} />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="type-h3">{t("view.title")}</h1>
              <p className="type-body-14 max-w-[44rem] text-muted-foreground">{t("view.description")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            <Button variant="outline" size="icon-sm" className="rounded-full bg-background" onClick={() => setMonth((value) => addMonths(value, -1))}>
              <ChevronLeft />
            </Button>
            <div className="rounded-full border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground">
              {formatDate.dateTime(month, { month: "long", year: "numeric" })}
            </div>
            <Button variant="outline" size="sm" className="rounded-full bg-background px-4" onClick={() => setMonth(today)}>
              {commonT("today")}
            </Button>
            <Button variant="outline" size="icon-sm" className="rounded-full bg-background" onClick={() => setMonth((value) => addMonths(value, 1))}>
              <ChevronRight />
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BudgetMetric label={t("metrics.trackedCategories")} value={String(totalTrackedCategories)} />
          <BudgetMetric label={t("metrics.transactions")} value={String(totalTransactions)} />
          <BudgetMetricGroup label={t("metrics.income")} values={summary.map((item) => ({ currency: item.currency, amount: item.income }))} />
          <BudgetMetricGroup label={t("metrics.net")} values={netByCurrency} />
        </div>
      </Surface>

      <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-2">
        <BudgetSection
          title={t("sections.expensesTitle")}
          description={t("sections.expensesDescription")}
          nodes={expenseNodes}
          emptyMessage={t("sections.expensesEmpty")}
        />
        <BudgetSection
          title={t("sections.incomeTitle")}
          description={t("sections.incomeDescription")}
          nodes={incomeNodes}
          emptyMessage={t("sections.incomeEmpty")}
        />
      </div>
    </div>
  );
}

function BudgetMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-medium tracking-[-0.03em] text-foreground">{value}</p>
    </div>
  );
}

function BudgetMetricGroup({
  label,
  values,
}: {
  label: string;
  values: Array<{ currency: CurrencyCode; amount: number }>;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => (
            <div key={`${label}-${value.currency}`} className="rounded-full border border-border/70 bg-card px-3 py-1.5">
              <MoneyAmount
                amount={value.amount}
                currency={value.currency}
                display="absolute"
                className="text-sm font-semibold text-foreground"
              />
            </div>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">0</span>
        )}
      </div>
    </div>
  );
}
