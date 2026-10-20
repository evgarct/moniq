"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import { FinanceLoadError } from "@/features/finance/components/finance-load-error";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function CalendarPage() {
  const t = useTranslations("calendar");
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

  return <CalendarView snapshot={data ?? createEmptyFinanceSnapshot()} />;
}
