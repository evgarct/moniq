"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { BudgetView } from "@/features/budget/components/budget-view";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function BudgetPage() {
  const t = useTranslations("budget");
  const { data, error, isLoading } = useFinanceData();

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
    <BudgetView snapshot={data ?? { accounts: [], categories: [], schedules: [], transactions: [], allocations: [] }} />
  );
}
