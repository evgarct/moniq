"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { TodayView } from "@/features/today/components/today-view";

export default function TodayPage() {
  const t = useTranslations("today");
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
    <PageContainer>
      <TodayView transactions={data?.transactions ?? []} />
    </PageContainer>
  );
}
