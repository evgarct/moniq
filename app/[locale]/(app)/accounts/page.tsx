"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { AccountsView } from "@/features/accounts/components/accounts-view";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function AccountsPage() {
  const t = useTranslations("accounts");
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
    <PageContainer className="h-full overflow-hidden px-0 py-0 sm:px-0">
      <AccountsView
        accounts={data?.accounts ?? []}
        categories={data?.categories ?? []}
        transactions={data?.transactions ?? []}
        allocations={data?.allocations ?? []}
      />
    </PageContainer>
  );
}
