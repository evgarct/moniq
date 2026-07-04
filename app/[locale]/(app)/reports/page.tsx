"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ProjectedBalanceView } from "@/features/reports/components/projected-balance-view";
import { FireView } from "@/features/reports/components/fire-view";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getCurrenciesMissingExchangeRates } from "@/features/finance/lib/exchange-rates";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import type { ExchangeRate } from "@/types/finance";

function ReportsPageContent() {
  const t = useTranslations("reports.projectedBalance");
  const tFire = useTranslations("reports.fireReport");
  const tCommon = useTranslations("reports");
  
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type");
  const activeType = rawType === "fire" ? "fire" : "projected";

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

  // Keep URL updated on tab switch while retaining other query parameters
  function handleTypeChange(nextType: string) {
    if (nextType !== "projected" && nextType !== "fire") return;
    const params = new URLSearchParams(window.location.search);
    params.set("type", nextType);
    // Remove period/accounts parameters when switching to avoid mismatching values between reports
    params.delete("period");
    params.delete("accounts");
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  if (isLoading) {
    const loadingT = activeType === "fire" ? tFire : t;
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 bg-card lg:bg-background">
        <EmptyState title={loadingT("loading.title")} description={loadingT("loading.description")} />
      </div>
    );
  }

  if (error) {
    const errorT = activeType === "fire" ? tFire : t;
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 bg-card lg:bg-background">
        <EmptyState
          title={errorT("error.title")}
          description={error instanceof Error ? error.message : errorT("error.description")}
        />
      </div>
    );
  }

  const snapshot = effectiveData ?? createEmptyFinanceSnapshot();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card lg:bg-background">
      {/* Switcher Tab bar */}
      <div className="flex justify-center border-b border-border/40 bg-card px-4 py-2 lg:bg-background shrink-0">
        <ToggleGroup
          value={activeType}
          onValueChange={(val) => handleTypeChange(val as string)}
          aria-label="Report selector"
        >
          <ToggleGroupItem value="projected">
            {tCommon("typeSelector.projected" as any) || "Forecast"}
          </ToggleGroupItem>
          <ToggleGroupItem value="fire">
            {tCommon("typeSelector.fire" as any) || "Cash Flow & FIRE"}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {activeType === "fire" ? (
          <FireView snapshot={snapshot} />
        ) : (
          <ProjectedBalanceView snapshot={snapshot} />
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const t = useTranslations("reports.projectedBalance");

  return (
    <Suspense
      fallback={
        <div className="h-full overflow-y-auto p-4 sm:p-6 bg-card lg:bg-background">
          <EmptyState title={t("loading.title")} description={t("loading.description")} />
        </div>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
