"use client";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { AccountsView } from "@/features/accounts/components/accounts-view";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function AccountsPage() {
  const { data, error, isLoading } = useFinanceData();

  if (isLoading) {
    return (
      <PageContainer>
        <EmptyState title="Loading wallets" description="Fetching wallets and savings groups from Supabase." />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <EmptyState
          title="Unable to load wallets"
          description={error instanceof Error ? error.message : "Finance data could not be loaded."}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <AccountsView
        accounts={data?.accounts ?? []}
        allocations={data?.allocations ?? []}
        transactions={data?.transactions ?? []}
      />
    </PageContainer>
  );
}
