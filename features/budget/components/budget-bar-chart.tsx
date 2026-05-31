"use client";

import { isSameMonth } from "date-fns";
import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";

import {
  buildBudgetMonthlySummaries,
  buildCategorySpendingReport,
  type BudgetMonthSummary,
  type CategorySpendingReport,
} from "@/features/finance/lib/category-spending-report";
import { MoneyAmount } from "@/components/money-amount";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calDate } from "@/lib/formatters";
import { isSupportedCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Category, Transaction } from "@/types/finance";

const MONTHS_SHOWN = 13;
const BAR_AREA_H = 72;

function getMonthNet(summary: BudgetMonthSummary) {
  return summary.currencies.reduce((total, currency) => total + currency.net, 0);
}

function getCurrencyNet(summary: BudgetMonthSummary, currency: string) {
  return summary.currencies.find((item) => item.currency === currency)?.net ?? 0;
}

function MoneyValue({
  amount,
  currency,
  display = "absolute",
  tone,
}: {
  amount: number;
  currency: string;
  display?: "absolute" | "signed";
  tone?: "default" | "muted" | "positive" | "negative";
}) {
  if (!isSupportedCurrency(currency)) {
    return (
      <span className={cn("tabular-nums", tone === "muted" && "text-muted-foreground")}>
        {amount.toLocaleString()} {currency}
      </span>
    );
  }

  return (
    <MoneyAmount
      amount={amount}
      currency={currency as CurrencyCode}
      tone={tone}
      display={display}
      showMinorUnits={false}
      className="text-inherit"
    />
  );
}

function MonthTooltip({
  report,
  summary,
}: {
  report: CategorySpendingReport;
  summary: BudgetMonthSummary;
}) {
  const t = useTranslations("budget.monthChart");
  const formatDate = useFormatter();
  const monthLabel = formatDate.dateTime(calDate(summary.start_date), { month: "long", year: "numeric" });
  const topEnvelopes = report.envelopes
    .flatMap((envelope) => envelope.totals.map((total) => ({ envelope, total })))
    .sort((left, right) => right.total.amount - left.total.amount)
    .slice(0, 3);

  return (
    <div className="flex min-w-64 flex-col gap-3">
      <div>
        <p className="type-h6 text-background">{monthLabel}</p>
        <p className="type-body-12 text-background/70">{t("paidTransactions", { count: summary.transaction_count })}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {summary.currencies.length ? (
          summary.currencies.map((currency) => (
            <div key={currency.currency} className="grid grid-cols-[1fr_auto] gap-3 text-xs text-background">
              <span className="text-background/70">{currency.currency}</span>
              <span className={cn("tabular-nums", currency.net < 0 && "text-background")}>
                {t("netLabel")}: <MoneyValue amount={currency.net} currency={currency.currency} display="signed" tone={currency.net >= 0 ? "positive" : "negative"} />
              </span>
              <span className="text-background/70">{t("incomeLabel")}</span>
              <MoneyValue amount={currency.income_total} currency={currency.currency} />
              <span className="text-background/70">{t("expensesLabel")}</span>
              <MoneyValue amount={currency.expense_total} currency={currency.currency} />
            </div>
          ))
        ) : (
          <p className="type-body-12 text-background/70">{t("emptyTooltip")}</p>
        )}
      </div>
      {topEnvelopes.length ? (
        <div className="flex flex-col gap-1 border-t border-background/15 pt-2">
          <p className="type-body-12 text-background/70">{t("topEnvelopes")}</p>
          {topEnvelopes.map(({ envelope, total }) => (
            <div key={`${envelope.category_id}-${total.currency}`} className="flex items-center justify-between gap-3 text-xs text-background">
              <span className="min-w-0 truncate">{envelope.name}</span>
              <span className="shrink-0 tabular-nums">
                {total.percent_of_income === null ? t("noPercent") : t("percentOfIncome", { value: total.percent_of_income })}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BudgetBarChart({
  transactions,
  categories,
  currentMonth,
  onMonthSelect,
}: {
  transactions: Transaction[];
  categories: Category[];
  currentMonth: Date;
  onMonthSelect: (report: CategorySpendingReport) => void;
}) {
  const t = useTranslations("budget.monthChart");
  const formatDate = useFormatter();
  const summaries = useMemo(
    () => buildBudgetMonthlySummaries({ transactions, currentMonth, monthsShown: MONTHS_SHOWN }),
    [transactions, currentMonth],
  );
  const reports = useMemo(
    () =>
      summaries.map((summary) =>
        buildCategorySpendingReport({
          categories,
          transactions,
          period: { month: summary.month },
        }),
      ),
    [categories, summaries, transactions],
  );
  const currencies = useMemo(
    () => Array.from(new Set(summaries.flatMap((summary) => summary.currencies.map((currency) => currency.currency)))).sort(),
    [summaries],
  );
  const maxAbsByCurrency = useMemo(() => {
    const max = new Map<string, number>();
    for (const currency of currencies) {
      max.set(currency, Math.max(...summaries.map((summary) => Math.abs(getCurrencyNet(summary, currency))), 1));
    }
    return max;
  }, [currencies, summaries]);

  const lanes = currencies.length ? currencies : ["none"];

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col gap-3" aria-label={t("ariaLabel")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="type-body-12 uppercase tracking-[0.18em]">{t("eyebrow")}</p>
            <p className="type-h5">{t("title")}</p>
          </div>
          <p className="type-body-12 hidden text-right sm:block">{t("hint")}</p>
        </div>

        <div className="flex flex-col gap-2">
          {lanes.map((currency) => (
            <div key={currency} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3">
              <div className="type-body-12 text-right font-medium text-muted-foreground">
                {currency === "none" ? t("emptyCurrency") : currency}
              </div>
              <div className="grid min-w-0 gap-1" style={{ gridTemplateColumns: `repeat(${MONTHS_SHOWN}, minmax(0, 1fr))` }}>
                {summaries.map((summary, index) => {
                  const report = reports[index];
                  const monthLabel = formatDate.dateTime(calDate(summary.start_date), { month: "long", year: "numeric" });
                  const net = currency === "none" ? getMonthNet(summary) : getCurrencyNet(summary, currency);
                  const maxAbs = currency === "none" ? Math.max(...summaries.map((item) => Math.abs(getMonthNet(item))), 1) : maxAbsByCurrency.get(currency) ?? 1;
                  const height = net === 0 ? 2 : Math.max(6, (Math.abs(net) / maxAbs) * (BAR_AREA_H / 2 - 6));
                  const isPositive = net >= 0;
                  const isCurrent = isSameMonth(calDate(summary.start_date), currentMonth);

                  return (
                    <Tooltip key={`${currency}-${summary.month}`}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => onMonthSelect(report)}
                            aria-label={t("openMonth", { month: monthLabel })}
                            className={cn(
                              "group flex min-w-0 flex-col items-center gap-1 radius-control px-1 py-1.5 transition-[background-color,color] hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isCurrent && "bg-secondary/50",
                            )}
                          />
                        }
                      >
                        <span className="relative w-full" style={{ height: BAR_AREA_H }}>
                          <span className="absolute left-0 right-0 top-1/2 h-px bg-foreground/10" />
                          <span
                            className={cn(
                              "absolute left-1/2 w-[min(70%,1.75rem)] -translate-x-1/2 radius-tight transition-[height,background-color]",
                              net === 0
                                ? "bg-foreground/15"
                                : isPositive
                                  ? isCurrent
                                    ? "bg-foreground"
                                    : "bg-chart-5/55"
                                  : isCurrent
                                    ? "bg-destructive"
                                    : "bg-destructive/45",
                            )}
                            style={{
                              height,
                              top: isPositive ? `calc(50% - ${height}px)` : "50%",
                            }}
                          />
                        </span>
                        <span className={cn("type-body-12 leading-none", isCurrent && "font-medium text-foreground")}>
                          {formatDate.dateTime(calDate(summary.start_date), { month: "short" })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="center" className="max-w-sm items-stretch bg-foreground px-3 py-3">
                        <MonthTooltip report={report} summary={summary} />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
