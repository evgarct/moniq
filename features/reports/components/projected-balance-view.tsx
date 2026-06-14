"use client";

import { addMonths, format, parseISO } from "date-fns";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProjectedBalanceChart } from "@/features/reports/components/projected-balance-chart";
import { ProjectedBalanceSeriesEditor } from "@/features/reports/components/projected-balance-series-editor";
import {
  buildProjectedBalanceReport,
  resolveProjectedBalancePeriod,
  type ProjectedBalanceSeries,
} from "@/features/reports/lib/projected-balance";
import {
  buildProjectedBalanceSearchParams,
  parseProjectedBalanceUrlState,
} from "@/features/reports/lib/projected-balance-url";
import { calDate } from "@/lib/formatters";
import type { FinanceSnapshot } from "@/types/finance";

const PRESET_MONTHS = [1, 3, 6, 12, 18] as const;
const SERIES_COLOR_CLASSES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const;

function replaceUrlState(endDate: string, series: Parameters<typeof buildProjectedBalanceSearchParams>[0]["series"]) {
  const params = buildProjectedBalanceSearchParams({ endDate, series });
  window.history.replaceState(null, "", `?${params.toString()}`);
}

function SeriesDateDetail({
  series,
  selectedDate,
  currency,
}: {
  series: ProjectedBalanceSeries;
  selectedDate: string;
  currency: FinanceSnapshot["preferences"]["default_currency"];
}) {
  const t = useTranslations("reports.projectedBalance");
  const point = series.points.find((item) => item.date === selectedDate);
  if (!point) return null;

  return (
    <section className="flex flex-col gap-3 border-t border-border/60 py-4 first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="type-h6">{series.name}</h3>
        <MoneyAmount
          amount={point.balance}
          currency={currency}
          className="text-sm font-semibold tabular-nums"
        />
      </div>

      <div className="flex flex-col gap-1">
        {point.accounts.map((account) => (
          <div
            key={account.account_id}
            className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] px-2 py-2 hover:bg-secondary/50"
          >
            <div className="min-w-0">
              <p className="type-body-14 truncate">{account.account_name}</p>
              {account.native_currency !== currency ? (
                <MoneyAmount
                  amount={account.native_balance}
                  currency={account.native_currency}
                  tone="muted"
                  className="type-body-12"
                />
              ) : null}
            </div>
            <MoneyAmount
              amount={account.converted_balance}
              currency={currency}
              className="shrink-0 text-sm tabular-nums"
            />
          </div>
        ))}
      </div>

      {point.operations.length ? (
        <div className="flex flex-col gap-1 border-t border-border/40 pt-3">
          <p className="type-body-12 px-2 font-medium text-muted-foreground">{t("details.operations")}</p>
          {point.operations.map((operation) => (
            <div key={operation.id} className="flex items-center justify-between gap-3 px-2 py-1.5">
              <p className="type-body-12 min-w-0 truncate text-foreground">{operation.title}</p>
              <p className="type-body-12 shrink-0 text-muted-foreground">
                {t(`operationKinds.${operation.kind}`)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="type-body-12 px-2 text-muted-foreground">{t("details.noOperations")}</p>
      )}
    </section>
  );
}

export function ProjectedBalanceView({
  snapshot,
  initialEditorOpen = false,
}: {
  snapshot: FinanceSnapshot;
  initialEditorOpen?: boolean;
}) {
  const t = useTranslations("reports.projectedBalance");
  const formatDate = useFormatter();
  const searchParams = useSearchParams();
  const initialState = useMemo(
    () =>
      parseProjectedBalanceUrlState({
        searchParams,
        accounts: snapshot.accounts,
        defaultSeriesName: t("defaultSeriesName"),
      }),
    [searchParams, snapshot.accounts, t],
  );
  const [endDate, setEndDate] = useState(initialState.endDate);
  const [series, setSeries] = useState(initialState.series);
  const [editorOpen, setEditorOpen] = useState(initialEditorOpen);
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

  if (!snapshot.accounts.length) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      </div>
    );
  }

  return (
    <div className="mobile-nav-scroll-clearance h-full overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="border-b border-border/60 px-4 py-5 sm:px-6 lg:px-7">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="type-body-12 uppercase tracking-[0.18em] text-muted-foreground">{t("eyebrow")}</p>
              <h1 className="type-h2 text-balance">{t("title")}</h1>
              <p className="type-body-14 mt-1 max-w-2xl text-pretty text-muted-foreground">
                {t("description")}
              </p>
            </div>
            <Button variant="outline" onClick={() => setEditorOpen(true)}>
              <SlidersHorizontal data-icon="inline-start" />
              {t("actions.manageSeries")}
            </Button>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <label htmlFor="projected-balance-end" className="type-body-12 font-medium text-muted-foreground">
                {t("period.endDate")}
              </label>
              <Input
                id="projected-balance-end"
                type="date"
                min={report.start_date}
                max={resolveProjectedBalancePeriod({ endDate: "2999-01-01" }).end_date}
                value={endDate}
                className="w-full sm:w-48"
                onChange={(event) => {
                  const nextEndDate = resolveProjectedBalancePeriod({ endDate: event.target.value }).end_date;
                  setEndDate(nextEndDate);
                  replaceUrlState(nextEndDate, series);
                }}
              />
            </div>

            <ToggleGroup
              value={selectedPreset ? [String(selectedPreset)] : []}
              onValueChange={(value) => {
                const months = Number(value[0]);
                if (!PRESET_MONTHS.includes(months as typeof PRESET_MONTHS[number])) return;
                const nextEndDate = format(addMonths(parseISO(report.start_date), months), "yyyy-MM-dd");
                setEndDate(nextEndDate);
                replaceUrlState(nextEndDate, series);
              }}
              variant="outline"
              size="sm"
              className="max-w-full overflow-x-auto"
            >
              {PRESET_MONTHS.map((months) => (
                <ToggleGroupItem key={months} value={String(months)}>
                  {t("period.months", { count: months })}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </header>

      <main className="flex flex-col">
        {report.missing_rates.length ? (
          <div className="border-b border-border/60 px-4 py-3 text-destructive sm:px-6 lg:px-7">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="type-body-14 font-medium">{t("missingRate.title")}</p>
                {report.missing_rates.map((missing) => (
                  <p key={`${missing.series_id}-${missing.account_id}`} className="type-body-12">
                    {t("missingRate.description", {
                      series: missing.series_name,
                      account: missing.account_name,
                      source: missing.source_currency,
                      target: missing.target_currency,
                    })}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {report.series.length ? (
          <>
            <section className="border-b border-border/60 px-2 pb-2 pt-4 sm:px-4 lg:px-5">
              <div className="flex flex-col gap-1 px-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {report.series.map((item, index) => {
                  const finalPoint = item.points.at(-1);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-4 py-2 sm:justify-start">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`h-0.5 w-5 shrink-0 ${SERIES_COLOR_CLASSES[index % SERIES_COLOR_CLASSES.length]}`} />
                        <span className="type-body-14 truncate">{item.name}</span>
                      </div>
                      {finalPoint ? (
                        <MoneyAmount
                          amount={finalPoint.balance}
                          currency={report.currency}
                          className="text-sm font-medium tabular-nums"
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
            </section>

            <section className="px-4 py-5 sm:px-6 lg:px-7">
              <div className="mx-auto max-w-4xl">
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <div>
                    <p className="type-body-12 uppercase tracking-[0.18em] text-muted-foreground">{t("details.eyebrow")}</p>
                    <h2 className="type-h4">
                      {formatDate.dateTime(calDate(selectedDateInRange), {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                  </div>
                  <p className="type-body-12 text-muted-foreground">{report.currency}</p>
                </div>
                {report.series.map((item) => (
                  <SeriesDateDetail
                    key={item.id}
                    series={item}
                    selectedDate={selectedDateInRange}
                    currency={report.currency}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="p-4 sm:p-6">
            <EmptyState title={t("noSeries.title")} description={t("noSeries.description")} />
          </div>
        )}
      </main>

      <p className="sr-only" aria-live="polite">
        {t("chart.selectedDate", {
          date: formatDate.dateTime(calDate(selectedDateInRange), {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>

      <ProjectedBalanceSeriesEditor
        key={editorOpen ? `open-${series.map((item) => item.id).join("-")}` : "closed"}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        accounts={snapshot.accounts}
        series={series}
        onSave={(nextSeries) => {
          setSeries(nextSeries);
          replaceUrlState(endDate, nextSeries);
        }}
      />
    </div>
  );
}
