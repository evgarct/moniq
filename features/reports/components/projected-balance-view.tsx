"use client";

import { addMonths, format, parseISO } from "date-fns";
import { ChevronDown, Info } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectedBalanceAccountPicker } from "@/features/reports/components/projected-balance-account-picker";
import { ProjectedBalanceChart } from "@/features/reports/components/projected-balance-chart";
import {
  buildProjectedBalanceReport,
  createProjectedBalanceSeries,
} from "@/features/reports/lib/projected-balance";
import {
  buildProjectedBalanceSearchParams,
  parseProjectedBalanceUrlState,
  type ProjectedBalanceSelection,
} from "@/features/reports/lib/projected-balance-url";
import { calDate } from "@/lib/formatters";
import type { FinanceSnapshot } from "@/types/finance";

const PRESET_MONTHS = [1, 3, 6, 12, 18] as const;

function replaceUrlState(endDate: string, selection: ProjectedBalanceSelection) {
  const params = buildProjectedBalanceSearchParams({ endDate, selection });
  window.history.replaceState(null, "", `?${params.toString()}`);
}

export function ProjectedBalanceView({
  snapshot,
  initialAccountPickerOpen = false,
}: {
  snapshot: FinanceSnapshot;
  initialAccountPickerOpen?: boolean;
}) {
  const t = useTranslations("reports.projectedBalance");
  const formatDate = useFormatter();
  const searchParams = useSearchParams();
  const initialState = useMemo(
    () =>
      parseProjectedBalanceUrlState({
        searchParams,
        accounts: snapshot.accounts,
      }),
    [searchParams, snapshot.accounts],
  );
  const [endDate, setEndDate] = useState(initialState.endDate);
  const [selection, setSelection] = useState(initialState.selection);
  const [periodOpen, setPeriodOpen] = useState(false);
  const series = useMemo(
    () =>
      createProjectedBalanceSeries({
        accounts: snapshot.accounts,
        accountIds: selection.accountIds,
        merged: selection.merged,
        mergedName: t("defaultSeriesName"),
      }),
    [selection, snapshot.accounts, t],
  );
  const report = useMemo(
    () =>
      buildProjectedBalanceReport({
        accounts: snapshot.accounts,
        transactions: snapshot.transactions,
        exchangeRates: snapshot.exchange_rates,
        defaultCurrency: snapshot.preferences.default_currency,
        series,
        endDate,
      }),
    [endDate, series, snapshot],
  );
  const [selectedDate, setSelectedDate] = useState(report.start_date);
  const selectedDateInRange =
    selectedDate < report.start_date || selectedDate > report.end_date
      ? report.start_date
      : selectedDate;
  const selectedPreset = PRESET_MONTHS.find((months) => {
    const expected = format(addMonths(parseISO(report.start_date), months), "yyyy-MM-dd");
    return expected === endDate;
  });
  const periodLabel = selectedPreset
    ? t("period.months", { count: selectedPreset })
    : formatDate.dateTime(calDate(endDate), { month: "short", year: "numeric" });

  function updateSelection(nextSelection: ProjectedBalanceSelection) {
    setSelection(nextSelection);
    replaceUrlState(endDate, nextSelection);
  }

  function updatePeriod(months: number) {
    if (!PRESET_MONTHS.includes(months as typeof PRESET_MONTHS[number])) return;
    const nextEndDate = format(addMonths(parseISO(report.start_date), months), "yyyy-MM-dd");
    setEndDate(nextEndDate);
    setPeriodOpen(false);
    replaceUrlState(nextEndDate, selection);
  }

  if (!snapshot.accounts.length) {
    return (
      <div className="h-full overflow-x-hidden overflow-y-auto p-4 sm:p-6">
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      </div>
    );
  }

  return (
    <div className="mobile-nav-scroll-clearance h-full w-full max-w-full overflow-x-hidden overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="border-b border-border/60 bg-card">
        <div className="flex flex-col gap-3 px-4 pt-5 pb-4 sm:px-6 sm:pt-7 sm:pb-5 lg:flex-row lg:items-center lg:justify-between lg:px-7 lg:pt-8 lg:pb-6">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
              {t("title")}
            </h1>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground active:bg-secondary"
                    aria-label={t("description")}
                  />
                }
              >
                <Info className="size-4 translate-y-[2px]" />
              </TooltipTrigger>
              <TooltipContent className="max-w-72 text-balance">{t("description")}</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex min-w-0 items-center gap-1 overflow-x-auto lg:justify-end" role="toolbar" aria-label={t("title")}>
            <ProjectedBalanceAccountPicker
              accounts={snapshot.accounts}
              selection={selection}
              onSelectionChange={updateSelection}
              initialOpen={initialAccountPickerOpen}
            />

            <DropdownMenu open={periodOpen} onOpenChange={setPeriodOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="shrink-0 bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  />
                }
              >
                {periodLabel}
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t("period.label")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={selectedPreset ? String(selectedPreset) : ""}
                    onValueChange={(value) => updatePeriod(Number(value))}
                  >
                    {PRESET_MONTHS.map((months) => (
                      <DropdownMenuRadioItem key={months} value={String(months)}>
                        {t("period.months", { count: months })}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {report.series.length ? (
        <main className="min-w-0 px-2 pt-4 pb-2 sm:px-4 lg:px-5">
          <div className="flex min-w-0 flex-col gap-1 px-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {report.series.map((item) => {
              const finalPoint = item.points.at(-1);
              return (
                <div key={item.id} className="flex min-w-0 items-center justify-between gap-4 py-2 sm:justify-start">
                  <span className="type-body-14 min-w-0 truncate">{item.name}</span>
                  {finalPoint ? (
                    <MoneyAmount
                      amount={finalPoint.balance}
                      currency={report.currency}
                      className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <ProjectedBalanceChart
            report={report}
            selectedDate={selectedDateInRange}
            onSelectedDateChange={setSelectedDate}
            ariaLabel={t("chart.ariaLabel")}
          />
        </main>
      ) : (
        <div className="p-4 sm:p-6">
          <EmptyState title={t("noSeries.title")} description={t("noSeries.description")} />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {t("chart.selectedDate", {
          date: formatDate.dateTime(calDate(selectedDateInRange), {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>
    </div>
  );
}
