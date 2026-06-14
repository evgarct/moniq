"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ProjectedBalanceView } from "@/features/reports/components/projected-balance-view";
import { getCurrenciesMissingExchangeRates } from "@/features/finance/lib/exchange-rates";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import type { ExchangeRate } from "@/types/finance";

function ProjectedBalancePageContent() {
  const t = useTranslations("reports.projectedBalance");
  const { data, error, isLoading } = useFinanceData();
  const [refreshedRates, setRefreshedRates] = useState<ExchangeRate[]>([]);
  const refreshAttemptedRef = useRef(false);
  const effectiveData = useMemo(
    () =>
      data
        ? {
            ...data,
            exchange_rates: [...data.exchange_rates, ...refreshedRates],
          }
        : null,
    [data, refreshedRates],
  );

  useEffect(() => {
    if (!effectiveData || refreshAttemptedRef.current) return;

    const missingCurrencies = getCurrenciesMissingExchangeRates({
      currencies: effectiveData.accounts.map((account) => account.currency),
      targetCurrency: effectiveData.preferences.default_currency,
      requestedDate: format(new Date(), "yyyy-MM-dd"),
      exchangeRates: effectiveData.exchange_rates,
    });
    if (!missingCurrencies.length) return;

    refreshAttemptedRef.current = true;
    void fetch("/api/fx/rates/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        base_currency: effectiveData.preferences.default_currency,
        quote_currencies: missingCurrencies,
      }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { rates?: ExchangeRate[] } | null) => {
        if (payload?.rates?.length) setRefreshedRates(payload.rates);
      })
      .catch(() => undefined);
  }, [effectiveData]);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <EmptyState title={t("loading.title")} description={t("loading.description")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <EmptyState
          title={t("error.title")}
          description={error instanceof Error ? error.message : t("error.description")}
        />
      </div>
    );
  }

  return <ProjectedBalanceView snapshot={effectiveData ?? createEmptyFinanceSnapshot()} />;
}

export default function ProjectedBalancePage() {
  const t = useTranslations("reports.projectedBalance");

  return (
    <Suspense
      fallback={
        <div className="h-full overflow-y-auto p-4 sm:p-6">
          <EmptyState title={t("loading.title")} description={t("loading.description")} />
        </div>
      }
    >
      <ProjectedBalancePageContent />
    </Suspense>
  );
}
