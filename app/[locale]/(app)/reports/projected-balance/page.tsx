"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { ProjectedBalanceView } from "@/features/reports/components/projected-balance-view";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

function ProjectedBalancePageContent() {
  const t = useTranslations("reports.projectedBalance");
  const { data, error, isLoading } = useFinanceData();

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

  return <ProjectedBalanceView snapshot={data ?? createEmptyFinanceSnapshot()} />;
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
