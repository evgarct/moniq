"use client";

import { PageContainer } from "@/components/page-container";
import { BalanceCard } from "@/features/dashboard/components/balance-card";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
import { SummaryCard } from "@/features/dashboard/components/summary-card";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { getIncomeExpenseSummary, getRecentTransactions, getTotalBalance } from "@/lib/finance-selectors";
import { mockFinanceSnapshot } from "@/lib/mock-finance";

function DashboardContent() {
  const { data } = useFinanceData();
  const snapshot = data ?? mockFinanceSnapshot;
  const summary = getIncomeExpenseSummary(snapshot.transactions);

  return (
    <PageContainer className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BalanceCard totalBalance={getTotalBalance(snapshot.accounts)} />
        <SummaryCard income={summary.income} expenses={summary.expenses} />
      </div>
      <RecentTransactions transactions={getRecentTransactions(snapshot)} />
    </PageContainer>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
