"use client";

import { addMonths, isAfter, isBefore, isSameMonth, startOfMonth, startOfToday } from "date-fns";
import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildConvertedBudgetMonths } from "@/features/budget/lib/budget-analytics";
import { calDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRate, Transaction } from "@/types/finance";

const MONTHS_SHOWN = 13;
/** Months after today kept in view so their planned operations are visible. */
const FUTURE_MONTHS = 2;
const BAR_AREA_HEIGHT = 92;
const COMPACT_BAR_AREA_HEIGHT = 40;

/**
 * Last month of the window: today plus a couple of future months, extended or moved back so the selected month
 * is always in view.
 */
export function getBudgetChartWindowEnd(selectedMonth: Date, today = startOfToday()) {
  const defaultEnd = startOfMonth(addMonths(today, FUTURE_MONTHS));
  const selected = startOfMonth(selectedMonth);
  if (isAfter(selected, defaultEnd)) return selected;
  if (isBefore(selected, addMonths(defaultEnd, -(MONTHS_SHOWN - 1)))) return selected;
  return defaultEnd;
}

/**
 * A 13-month net-cashflow strip that doubles as the month picker: clicking a month selects it in the main view.
 * Solid bars are paid activity; the light bar behind shows where the month lands once its planned operations are
 * paid, so future months show their planned net.
 */
export function BudgetBarChart({
  transactions,
  currentMonth,
  targetCurrency,
  exchangeRates,
  onMonthChange,
  compact = false,
}: {
  transactions: Transaction[];
  /** The selected month. */
  currentMonth: Date;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
  onMonthChange: (month: Date) => void;
  /** Slim strip for the Budget screen: no title block, short bars. */
  compact?: boolean;
}) {
  const barAreaHeight = compact ? COMPACT_BAR_AREA_HEIGHT : BAR_AREA_HEIGHT;
  const t = useTranslations("budget.monthChart");
  const formatDate = useFormatter();
  const windowEnd = getBudgetChartWindowEnd(currentMonth);
  const windowEndKey = windowEnd.getTime();
  const months = useMemo(
    () => buildConvertedBudgetMonths({
      transactions,
      currentMonth: new Date(windowEndKey),
      targetCurrency,
      exchangeRates,
      monthsShown: MONTHS_SHOWN,
    }),
    [windowEndKey, exchangeRates, targetCurrency, transactions],
  );
  const projectedOf = (month: (typeof months)[number]) => (month.net ?? 0) + (month.plannedNet ?? 0);
  const maxMagnitude = Math.max(...months.flatMap((month) => [Math.abs(month.net ?? 0), Math.abs(projectedOf(month))]), 1);
  const heightOf = (value: number) =>
    value === 0 ? 2 : Math.max(compact ? 3 : 6, (Math.abs(value) / maxMagnitude) * (barAreaHeight / 2 - (compact ? 4 : 8)));
  const today = startOfToday();

  return (
    <TooltipProvider>
      <div className={cn("flex w-full flex-col", compact ? "gap-2" : "gap-4")} aria-label={t("ariaLabel")}>
        {compact ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="type-body-12 font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("netByMonth")}</p>
            <p className="type-body-12 text-right text-muted-foreground">{t("convertedTo", { currency: targetCurrency })}</p>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="type-body-12 uppercase tracking-[0.18em]">{t("eyebrow")}</p>
              <p className="type-h5">{t("title")}</p>
            </div>
            <p className="type-body-12 text-right text-muted-foreground">
              {t("convertedTo", { currency: targetCurrency })}
            </p>
          </div>
        )}

        <div
          className="grid min-w-0 gap-1"
          style={{ gridTemplateColumns: `repeat(${MONTHS_SHOWN}, minmax(0, 1fr))` }}
        >
          {months.map((month) => {
            const monthDate = calDate(month.startDate);
            const monthLabel = formatDate.dateTime(monthDate, { month: "long", year: "numeric" });
            const isSelected = isSameMonth(monthDate, currentMonth);
            const isFuture = isAfter(monthDate, today);
            const projected = projectedOf(month);
            const showProjection = month.plannedNet !== null && month.plannedNet !== 0;
            const solidHeight = month.net === null ? 0 : heightOf(month.net);
            const ghostHeight = heightOf(projected);

            return (
              <Tooltip key={month.month}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onMonthChange(monthDate)}
                      aria-label={t("selectMonth", { month: monthLabel })}
                      aria-pressed={isSelected}
                      className={cn(
                        "group flex min-w-0 flex-col items-center gap-1 rounded-[var(--radius-control)] px-0.5 py-1 transition-[background-color] hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected && "bg-secondary",
                      )}
                    />
                  }
                >
                  <span className="relative w-full" style={{ height: barAreaHeight }}>
                    <span className="absolute inset-x-0 top-1/2 h-px bg-foreground/10" />
                    {showProjection ? (
                      <span
                        className={cn(
                          "absolute left-1/2 w-[min(68%,1.6rem)] -translate-x-1/2 rounded-[var(--radius-tight)]",
                          projected >= 0 ? "bg-foreground/12" : "bg-destructive/20",
                        )}
                        style={{ height: ghostHeight, top: projected >= 0 ? `calc(50% - ${ghostHeight}px)` : "50%" }}
                      />
                    ) : null}
                    {month.net === null ? (
                      <span className="absolute inset-x-1 top-1/2 border-t border-dashed border-muted-foreground/45" />
                    ) : isFuture && month.net === 0 ? null : (
                      <span
                        className={cn(
                          "absolute left-1/2 w-[min(68%,1.6rem)] -translate-x-1/2 rounded-[var(--radius-tight)]",
                          month.net >= 0
                            ? isSelected ? "bg-foreground" : "bg-chart-5/55"
                            : isSelected ? "bg-destructive" : "bg-destructive/45",
                        )}
                        style={{
                          height: solidHeight,
                          top: month.net >= 0 ? `calc(50% - ${solidHeight}px)` : "50%",
                        }}
                      />
                    )}
                  </span>
                  <span className={cn("type-body-12 leading-none", isSelected ? "font-medium text-foreground" : isFuture && "text-muted-foreground/70")}>
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
                      {showProjection ? (
                        <>
                          <span className="type-body-12 text-muted-foreground">{t("plannedLabel")}</span>
                          <MoneyAmount amount={month.plannedNet!} currency={targetCurrency} display="signed" className="type-body-12" />
                        </>
                      ) : null}
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
