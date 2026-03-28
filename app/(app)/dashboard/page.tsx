"use client";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { BalanceCard } from "@/features/dashboard/components/balance-card";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
import { SummaryCard } from "@/features/dashboard/components/summary-card";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import {
  getIncomeExpenseSummaryByCurrency,
  getRecentTransactions,
  getTotalBalanceByCurrency,
} from "@/lib/finance-selectors";

function DashboardContent() {
  const { data, error, isLoading } = useFinanceData();

  if (isLoading) {
    return (
      <PageContainer>
        <EmptyState title="Loading dashboard" description="Fetching wallet balances and transaction activity from Supabase." />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <EmptyState
          title="Unable to load dashboard"
          description={error instanceof Error ? error.message : "Finance data could not be loaded."}
        />
      </PageContainer>
    );
  }

  const snapshot = data ?? { accounts: [], allocations: [], categories: [], transactions: [] };
  const summary = getIncomeExpenseSummaryByCurrency(snapshot.transactions);

  return (
    <PageContainer className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BalanceCard totals={getTotalBalanceByCurrency(snapshot.accounts)} />
        <SummaryCard summary={summary} />
      </div>
      <RecentTransactions transactions={getRecentTransactions(snapshot)} />
    </PageContainer>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
