"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { SyncProgressFooter } from "@/features/sync/components/sync-progress-footer";
import { TodayView } from "@/features/today/components/today-view";

export default function TodayPage() {
  const t = useTranslations("today");
  const { data, error, isLoading } = useFinanceData();

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1">
            <EmptyState title={t("loading.title")} description={t("loading.description")} />
          </div>
          <SyncProgressFooter transactionCount={0} dataLoading />
        </div>
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
    <div className="h-full">
      <TodayView snapshot={data ?? createEmptyFinanceSnapshot()} />
    </div>
  );
}
