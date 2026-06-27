"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { BudgetView } from "@/features/budget/components/budget-view";
import { buildMissingHistoricalFxRequest } from "@/features/budget/lib/budget-analytics";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import type { ExchangeRate } from "@/types/finance";

export default function BudgetPage() {
  const t = useTranslations("budget");
  const { data, error, isLoading } = useFinanceData();
  const [refreshedRates, setRefreshedRates] = useState<ExchangeRate[]>([]);
  const [displayedMonth, setDisplayedMonth] = useState(() => new Date());
  const refreshSignatureRef = useRef<string | null>(null);
  const effectiveData = useMemo(
    () => data ? { ...data, exchange_rates: [...data.exchange_rates, ...refreshedRates] } : null,
    [data, refreshedRates],
  );

  useEffect(() => {
    if (!effectiveData) return;
    const request = buildMissingHistoricalFxRequest({
      transactions: effectiveData.transactions,
      currentMonth: displayedMonth,
      targetCurrency: effectiveData.preferences.default_currency,
      exchangeRates: effectiveData.exchange_rates,
    });
    if (!request.requestedDates.length || !request.quoteCurrencies.length) return;

    const signature = JSON.stringify(request);
    if (refreshSignatureRef.current === signature) return;
    refreshSignatureRef.current = signature;

    void fetch("/api/fx/rates/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        base_currency: effectiveData.preferences.default_currency,
        quote_currencies: request.quoteCurrencies,
        requested_dates: request.requestedDates,
      }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { rates?: ExchangeRate[] } | null) => {
        if (payload?.rates?.length) setRefreshedRates(payload.rates);
      })
      .catch(() => undefined);
  }, [displayedMonth, effectiveData]);

  if (isLoading) {
    return (
      <PageContainer>
        <EmptyState title={t("loading.title")} description={t("loading.description")} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <EmptyState
          title={t("error.title")}
          description={error instanceof Error ? error.message : t("error.description")}
        />
      </PageContainer>
    );
  }

  return (
    <BudgetView
      snapshot={effectiveData ?? createEmptyFinanceSnapshot()}
      onDisplayedMonthChange={setDisplayedMonth}
    />
  );
}
