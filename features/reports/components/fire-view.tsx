"use client";

import { Info } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { PageHeader } from "@/components/page-header";
import { PageHeaderIconButton } from "@/components/page-header-icon-button";
import { ProjectedBalanceControls } from "@/features/reports/components/projected-balance-account-picker";
import { FireChart } from "@/features/reports/components/fire-chart";
import { buildFireReport, FIRE_REPORT_PRESET_MONTHS } from "@/features/reports/lib/fire-report";
import type { ProjectedBalanceSelection } from "@/features/reports/lib/projected-balance-url";
import { calDate } from "@/lib/formatters";
import type { FinanceSnapshot } from "@/types/finance";

const SERIES_COLOR_CLASSES: Record<string, string> = {
  "income": "bg-chart-1",
  "expenses": "bg-chart-5",
  "investment-income": "bg-chart-2",
};

const FIRE_REPORT_PREFERENCES_KEY = "Moniq.fireReport.preferences";

function replaceUrlState(type: string, periodMonths: number, selection: ProjectedBalanceSelection) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  params.set("type", type);
  params.set("period", periodMonths.toString());
  params.set("accounts", selection.accountIds.join(","));
  window.history.replaceState(null, "", `?${params.toString()}`);
}

function readRememberedPreferences(allAccountIds: string[]) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(FIRE_REPORT_PREFERENCES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const validIds = Array.isArray(parsed.accountIds)
      ? parsed.accountIds.filter((id: string) => allAccountIds.includes(id))
      : [];
    return {
      accountIds: validIds.length > 0 ? validIds : allAccountIds,
      periodMonths: typeof parsed.periodMonths === "number" ? parsed.periodMonths : 12,
    };
  } catch {
    return null;
  }
}

function rememberPreferences(selection: ProjectedBalanceSelection, periodMonths: number) {
  try {
    window.localStorage.setItem(
      FIRE_REPORT_PREFERENCES_KEY,
      JSON.stringify({ accountIds: selection.accountIds, periodMonths }),
    );
  } catch {
    // ignore
  }
}

export function FireView({
  snapshot,
  initialOpen = false,
}: {
  snapshot: FinanceSnapshot;
  initialOpen?: boolean;
}) {
  const t = useTranslations("reports.fireReport");
  const formatDate = useFormatter();
  const searchParams = useSearchParams();

  const allAccountIds = useMemo(() => snapshot.accounts.map((a) => a.id), [snapshot.accounts]);
  const remembered = useMemo(() => readRememberedPreferences(allAccountIds), [allAccountIds]);

  // Initial State from URL or local storage
  const initialState = useMemo(() => {
    const urlPeriod = searchParams.get("period");
    const parsedPeriod = urlPeriod ? parseInt(urlPeriod, 10) : null;
    const finalPeriod =
      parsedPeriod && FIRE_REPORT_PRESET_MONTHS.includes(parsedPeriod as typeof FIRE_REPORT_PRESET_MONTHS[number])
        ? parsedPeriod
        : remembered?.periodMonths ?? 12;

    const urlAccounts = searchParams.get("accounts");
    const parsedAccountIds = urlAccounts ? urlAccounts.split(",").filter((id) => allAccountIds.includes(id)) : [];
    const finalAccountIds =
      parsedAccountIds.length > 0 ? parsedAccountIds : remembered?.accountIds ?? allAccountIds;

    return {
      periodMonths: finalPeriod,
      selection: {
        accountIds: finalAccountIds,
        merged: true,
      },
    };
  }, [allAccountIds, remembered, searchParams]);

  const [periodMonths, setPeriodMonths] = useState(initialState.periodMonths);
  const [selection, setSelection] = useState<ProjectedBalanceSelection>(initialState.selection);

  const report = useMemo(
    () =>
      buildFireReport({
        accounts: snapshot.accounts,
        transactions: snapshot.transactions,
        exchangeRates: snapshot.exchange_rates,
        defaultCurrency: snapshot.preferences.default_currency,
        investmentPositions: snapshot.investment_positions,
        accountIds: selection.accountIds,
        periodMonths,
        labels: {
          income: t("income" as Parameters<typeof t>[0]) || "Income",
          expenses: t("expenses" as Parameters<typeof t>[0]) || "Expenses",
          investmentIncome: t("investmentIncome" as Parameters<typeof t>[0]) || "Passive Income (SWR)",
        },
      }),
    [periodMonths, selection, snapshot, t],
  );

  const [selectedDate, setSelectedDate] = useState(report.end_date);
  const selectedDateInRange =
    selectedDate < report.start_date || selectedDate > report.end_date ? report.end_date : selectedDate;

  const periodLabel = t("period.months", { count: periodMonths });

  function updateSelection(nextSelection: ProjectedBalanceSelection) {
    setSelection(nextSelection);
    rememberPreferences(nextSelection, periodMonths);
    replaceUrlState("fire", periodMonths, nextSelection);
  }

  function updatePeriod(months: number) {
    if (!FIRE_REPORT_PRESET_MONTHS.includes(months as typeof FIRE_REPORT_PRESET_MONTHS[number])) return;
    setPeriodMonths(months);
    rememberPreferences(selection, months);
    replaceUrlState("fire", months, selection);
  }

  if (!snapshot.accounts.length) {
    return (
      <div className="h-full overflow-x-hidden overflow-y-auto p-4 sm:p-6">
        <EmptyState illustration="wallet" title={t("empty.title")} description={t("empty.description")} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-card lg:bg-background pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
      <PageHeader
        title={t("title")}
        className="shrink-0"
        actions={
          <div
            className="flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2"
            role="toolbar"
            aria-label={t("title")}
          >
            <PageHeaderIconButton icon={Info} label={t("description")} className="hidden shrink-0 lg:inline-flex" />
            <ProjectedBalanceControls
              accounts={snapshot.accounts}
              selection={selection}
              onSelectionChange={updateSelection}
              periodMonths={FIRE_REPORT_PRESET_MONTHS}
              selectedPeriodMonths={periodMonths}
              periodLabel={periodLabel}
              onPeriodChange={updatePeriod}
              initialOpen={initialOpen}
            />
          </div>
        }
      />

      {report.series[0]?.points.length ? (
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-3 sm:px-6 sm:pb-5 lg:px-7 lg:pb-6">
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-6 gap-y-1 px-1.5 pb-2 sm:px-2.5">
            {report.series.map((item) => {
              const activePoint = item.points.find((p) => p.date === selectedDateInRange);
              const val = activePoint?.balance ?? item.points.at(-1)?.balance ?? 0;
              return (
                <div key={item.id} className="flex min-w-0 items-center gap-2 py-1">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${SERIES_COLOR_CLASSES[item.id] || "bg-muted-foreground"}`}
                    aria-hidden
                  />
                  <span className="type-body-14 min-w-0 truncate">{item.name}</span>
                  <MoneyAmount
                    amount={val}
                    currency={report.currency}
                    className="shrink-0 type-body-14 font-medium tabular-nums"
                  />
                </div>
              );
            })}
          </div>
          <FireChart
            report={report}
            selectedDate={selectedDateInRange}
            onSelectedDateChange={setSelectedDate}
            ariaLabel={t("chart.ariaLabel")}
          />
        </main>
      ) : (
        <div className="p-4 sm:p-6">
          <EmptyState illustration="reports" title={t("noSeries.title")} description={t("noSeries.description")} />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {t("chart.selectedDate", {
          date: formatDate.dateTime(calDate(selectedDateInRange), {
            month: "long",
            year: "numeric",
          }),
        })}
      </p>
    </div>
  );
}
