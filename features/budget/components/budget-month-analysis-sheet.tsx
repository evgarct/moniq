"use client";

import { parseISO } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { MoneyAmount } from "@/components/money-amount";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { calDate } from "@/lib/formatters";
import { isSupportedCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import type {
  CategorySpendingCurrencyAmount,
  CategorySpendingNode,
  CategorySpendingReport,
  CategorySpendingTransaction,
  UncategorizedSpendingGroup,
} from "@/features/finance/lib/category-spending-report";
import type { CurrencyCode } from "@/types/currency";

function PercentValue({ value }: { value: number | null }) {
  const t = useTranslations("budget.monthAnalysis");

  return (
    <span className="tabular-nums text-muted-foreground">
      {value === null ? t("notApplicable") : t("percent", { value })}
    </span>
  );
}

function MoneyValue({
  amount,
  currency,
  className,
  tone,
}: {
  amount: number;
  currency: string;
  className?: string;
  tone?: "default" | "muted" | "positive" | "negative";
}) {
  if (!isSupportedCurrency(currency)) {
    return (
      <span className={cn("tabular-nums", className)}>
        {amount.toLocaleString()} {currency}
      </span>
    );
  }

  return (
    <MoneyAmount
      amount={amount}
      currency={currency as CurrencyCode}
      display="absolute"
      tone={tone}
      className={className}
    />
  );
}

function TotalsLine({ totals }: { totals: CategorySpendingCurrencyAmount[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
      {totals.map((total) => (
        <MoneyValue
          key={total.currency}
          amount={total.amount}
          currency={total.currency}
          className="type-body-12 font-medium tabular-nums text-foreground"
        />
      ))}
    </div>
  );
}

function PercentageLine({ total }: { total: CategorySpendingCurrencyAmount }) {
  const t = useTranslations("budget.monthAnalysis");

  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 type-body-12">
      <span>{t("ofIncome", { currency: total.currency })}</span>
      <PercentValue value={total.percent_of_income} />
      <span>{t("ofExpenses", { currency: total.currency })}</span>
      <PercentValue value={total.percent_of_total_expenses} />
    </div>
  );
}

function TransactionRows({ transactions }: { transactions: CategorySpendingTransaction[] }) {
  const t = useTranslations("budget.monthAnalysis");
  const format = useFormatter();

  if (!transactions.length) {
    return <p className="type-body-12 px-2 py-2">{t("emptyTransactions")}</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {transactions.slice(0, 12).map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center gap-3 radius-control px-2 py-2 transition-[background-color] hover:bg-secondary/50"
        >
          <div className="min-w-0 flex-1">
            <p className="type-body-14 truncate font-medium">{transaction.title}</p>
            <p className="type-body-12 truncate">
              {format.dateTime(calDate(transaction.occurred_at), { month: "short", day: "numeric" })}
            </p>
          </div>
          <MoneyValue
            amount={transaction.analytics_amount}
            currency={transaction.currency}
            className="shrink-0 text-sm font-medium tabular-nums"
          />
        </div>
      ))}
      {transactions.length > 12 ? (
        <p className="type-body-12 px-2 py-1">{t("moreTransactions", { count: transactions.length - 12 })}</p>
      ) : null}
    </div>
  );
}

function CategoryNodeRow({ node, depth = 0 }: { node: CategorySpendingNode; depth?: number }) {
  const t = useTranslations("budget.monthAnalysis");
  const hasDetail = node.categories.length > 0 || node.transactions.length > 0;
  const rowClassName = cn(
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 radius-control py-2 pr-2 transition-[background-color] hover:bg-secondary/50",
    depth === 0 ? "pl-2" : "pl-5",
  );
  const rowContent = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <CategoryIcon icon={node.icon} glyphClassName="size-[18px] shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate type-body-14 font-medium">{node.name}</span>
          <span className="block truncate type-body-12">
            {t("transactionCount", { count: node.transaction_count })}
          </span>
        </span>
      </span>
      <TotalsLine totals={node.totals} />
    </>
  );

  if (!hasDetail) {
    return <div className={rowClassName}>{rowContent}</div>;
  }

  return (
    <details className="group">
      <summary className={cn("cursor-pointer", rowClassName)}>{rowContent}</summary>
      <div className="ml-4 border-l border-border/40 pl-3">
        {node.totals.length ? (
          <div className="grid gap-2 px-2 py-2">
            {node.totals.map((total) => (
              <PercentageLine key={total.currency} total={total} />
            ))}
          </div>
        ) : null}
        {node.categories.map((child) => (
          <CategoryNodeRow key={child.category_id} node={child} depth={depth + 1} />
        ))}
        {node.transactions.length ? (
          <div className="py-2">
            <TransactionRows transactions={node.transactions} />
          </div>
      ) : null}
      </div>
    </details>
  );
}

function UncategorizedGroup({ group }: { group: UncategorizedSpendingGroup }) {
  const t = useTranslations("budget.monthAnalysis");

  return (
    <details className="group">
      <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 radius-control px-2 py-2 transition-[background-color] hover:bg-secondary/50">
        <span>
          <span className="block type-body-14 font-medium">
            {group.kind === "income" ? t("uncategorizedIncome") : t("uncategorizedExpense")}
          </span>
          <span className="block type-body-12">{t("transactionCount", { count: group.transaction_count })}</span>
        </span>
        <TotalsLine totals={group.totals} />
      </summary>
      <div className="ml-4 border-l border-border/40 py-2 pl-3">
        <TransactionRows transactions={group.transactions} />
      </div>
    </details>
  );
}

export function BudgetMonthAnalysisSheet({
  report,
  open,
  onOpenChange,
}: {
  report: CategorySpendingReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("budget.monthAnalysis");
  const format = useFormatter();
  const title = report
    ? format.dateTime(parseISO(`${report.summary.month}-01`), { month: "long", year: "numeric" })
    : t("fallbackTitle");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden sm:max-w-xl" showCloseButton>
        <SheetHeader className="border-b border-border/40 pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        {report ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <section className="border-b border-border/40 px-4 py-4">
              <p className="type-body-12 mb-2 uppercase tracking-[0.18em]">{t("overview")}</p>
              <div className="flex flex-col gap-2">
                {report.summary.currencies.length ? (
                  report.summary.currencies.map((currency) => (
                    <div key={currency.currency} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-2 py-1.5">
                      <p className="type-h6">{currency.currency}</p>
                      <p className={cn("text-sm font-medium tabular-nums", currency.net < 0 ? "text-destructive" : "text-foreground")}>
                        <MoneyValue amount={currency.net} currency={currency.currency} tone={currency.net >= 0 ? "positive" : "negative"} />
                      </p>
                      <p className="type-body-12">{t("incomeLabel")}</p>
                      <MoneyValue amount={currency.income_total} currency={currency.currency} className="type-body-12 tabular-nums" />
                      <p className="type-body-12">{t("expensesLabel")}</p>
                      <MoneyValue amount={currency.expense_total} currency={currency.currency} className="type-body-12 tabular-nums" />
                    </div>
                  ))
                ) : (
                  <p className="type-body-12 px-2 py-2">{t("emptyMonth")}</p>
                )}
              </div>
            </section>

            <section className="border-b border-border/40 px-4 py-4">
              <p className="type-body-12 mb-2 uppercase tracking-[0.18em]">{t("envelopes")}</p>
              {report.envelopes.length ? (
                <div className="flex flex-col gap-0.5">
                  {report.envelopes.map((node) => (
                    <CategoryNodeRow key={node.category_id} node={node} />
                  ))}
                </div>
              ) : (
                <p className="type-body-12 px-2 py-2">{t("emptyEnvelopes")}</p>
              )}
            </section>

            <section className="border-b border-border/40 px-4 py-4">
              <p className="type-body-12 mb-2 uppercase tracking-[0.18em]">{t("incomeCategories")}</p>
              {report.income_categories.length ? (
                <div className="flex flex-col gap-0.5">
                  {report.income_categories.map((node) => (
                    <CategoryNodeRow key={node.category_id} node={node} />
                  ))}
                </div>
              ) : (
                <p className="type-body-12 px-2 py-2">{t("emptyIncome")}</p>
              )}
            </section>

            {report.uncategorized.length ? (
              <section className="px-4 py-4">
                <p className="type-body-12 mb-2 uppercase tracking-[0.18em]">{t("uncategorized")}</p>
                <div className="flex flex-col gap-0.5">
                  {report.uncategorized.map((group) => (
                    <UncategorizedGroup key={group.kind} group={group} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
