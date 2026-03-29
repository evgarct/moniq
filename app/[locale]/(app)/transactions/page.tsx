"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { TransactionsView } from "@/features/transactions/components/transactions-view";

export default function TransactionsPage() {
  const t = useTranslations("transactions");
  const { error, isLoading } = useFinanceData();

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
    <PageContainer>
      <TransactionsView />
    </PageContainer>
  );
}
