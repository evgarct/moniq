"use client";

import { isSameMonth } from "date-fns";
import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildConvertedBudgetMonths } from "@/features/budget/lib/budget-analytics";
import {
  buildCategorySpendingReport,
  type CategorySpendingReport,
} from "@/features/finance/lib/category-spending-report";
import { calDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Category, ExchangeRate, Transaction } from "@/types/finance";

const MONTHS_SHOWN = 13;
const BAR_AREA_HEIGHT = 92;

export function BudgetBarChart({
  transactions,
  categories,
  currentMonth,
  targetCurrency,
  exchangeRates,
  onMonthSelect,
}: {
  transactions: Transaction[];
  categories: Category[];
  currentMonth: Date;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
  onMonthSelect: (report: CategorySpendingReport) => void;
}) {
  const t = useTranslations("budget.monthChart");
  const formatDate = useFormatter();
  const months = useMemo(
    () => buildConvertedBudgetMonths({
      transactions,
      currentMonth,
      targetCurrency,
      exchangeRates,
      monthsShown: MONTHS_SHOWN,
    }),
    [currentMonth, exchangeRates, targetCurrency, transactions],
  );
  const maxMagnitude = Math.max(...months.map((month) => Math.abs(month.net ?? 0)), 1);

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col gap-4" aria-label={t("ariaLabel")}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="type-body-12 uppercase tracking-[0.18em]">{t("eyebrow")}</p>
            <p className="type-h5">{t("title")}</p>
          </div>
          <p className="type-body-12 text-right text-muted-foreground">
            {t("convertedTo", { currency: targetCurrency })}
          </p>
        </div>

        <div
          className="grid min-w-0 gap-1"
          style={{ gridTemplateColumns: `repeat(${MONTHS_SHOWN}, minmax(0, 1fr))` }}
        >
          {months.map((month) => {
            const monthDate = calDate(month.startDate);
            const monthLabel = formatDate.dateTime(monthDate, { month: "long", year: "numeric" });
            const isCurrent = isSameMonth(monthDate, currentMonth);
            const report = buildCategorySpendingReport({
              categories,
              transactions,
              period: { month: month.month },
            });
            const height = month.net === null
              ? 0
              : month.net === 0
                ? 2
                : Math.max(6, (Math.abs(month.net) / maxMagnitude) * (BAR_AREA_HEIGHT / 2 - 8));

            return (
              <Tooltip key={month.month}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onMonthSelect(report)}
                      aria-label={t("openMonth", { month: monthLabel })}
                      className={cn(
                        "group flex min-w-0 flex-col items-center gap-1 rounded-[var(--radius-control)] px-0.5 py-1.5 transition-[background-color] hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isCurrent && "bg-secondary/50",
                      )}
                    />
                  }
                >
                  <span className="relative w-full" style={{ height: BAR_AREA_HEIGHT }}>
                    <span className="absolute inset-x-0 top-1/2 h-px bg-foreground/10" />
                    {month.net === null ? (
                      <span className="absolute inset-x-1 top-1/2 border-t border-dashed border-muted-foreground/45" />
                    ) : (
                      <span
                        className={cn(
                          "absolute left-1/2 w-[min(68%,1.6rem)] -translate-x-1/2 rounded-[var(--radius-tight)]",
                          month.net >= 0
                            ? isCurrent ? "bg-foreground" : "bg-chart-5/55"
                            : isCurrent ? "bg-destructive" : "bg-destructive/45",
                        )}
                        style={{
                          height,
                          top: month.net >= 0 ? `calc(50% - ${height}px)` : "50%",
                        }}
                      />
                    )}
                  </span>
                  <span className={cn("type-body-12 leading-none", isCurrent && "font-medium text-foreground")}>
                    {formatDate.dateTime(monthDate, { month: "short" })}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="min-w-56 items-stretch">
                  <p className="type-h6">{monthLabel}</p>
                  {month.net === null ? (
                    <p className="type-body-12 mt-1 text-muted-foreground">
                      {t("missingRates", { currencies: month.missingCurrencies.join(", ") })}
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                      <span className="type-body-12 text-muted-foreground">{t("incomeLabel")}</span>
                      <MoneyAmount amount={month.income ?? 0} currency={targetCurrency} className="type-body-12" />
                      <span className="type-body-12 text-muted-foreground">{t("expensesLabel")}</span>
                      <MoneyAmount amount={month.expenses ?? 0} currency={targetCurrency} className="type-body-12" />
                      <span className="type-body-12 text-muted-foreground">{t("netLabel")}</span>
                      <MoneyAmount amount={month.net} currency={targetCurrency} display="signed" className="type-body-12 font-medium" />
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
