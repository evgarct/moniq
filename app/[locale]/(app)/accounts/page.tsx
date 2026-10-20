"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { AccountsView } from "@/features/accounts/components/accounts-view";
import { FinanceLoadError } from "@/features/finance/components/finance-load-error";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const { data, error, isLoading, refetch } = useFinanceData();

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
        <FinanceLoadError
          title={t("error.title")}
          fallbackDescription={t("error.description")}
          error={error}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <AccountsView
      accounts={data?.accounts ?? []}
      categories={data?.categories ?? []}
      transactions={data?.transactions ?? []}
      allocations={data?.allocations ?? []}
      investmentPositions={data?.investment_positions ?? []}
      defaultCurrency={data?.preferences.default_currency}
      exchangeRates={data?.exchange_rates ?? []}
    />
  );
}
