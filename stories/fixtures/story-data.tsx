import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PageContainer } from "@/components/page-container";
import { BalanceCard } from "@/features/dashboard/components/balance-card";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
import { SummaryCard } from "@/features/dashboard/components/summary-card";
import { mockFinanceSnapshot } from "@/lib/mock-finance";
import { getIncomeExpenseSummary, getRecentTransactions, getTotalBalance } from "@/lib/finance-selectors";
import type { AuthUser } from "@/types/auth";
import type { FinanceSnapshot } from "@/types/finance";

export function makeFinanceSnapshot(): FinanceSnapshot {
  return JSON.parse(JSON.stringify(mockFinanceSnapshot)) as FinanceSnapshot;
}

export const storyUser: AuthUser = {
  id: "storybook-user",
  aud: "authenticated",
  email: "demo@moniq.app",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};

export const noopAsyncAction = async () => {};

export function StoryWorkspace({
  pathname,
  children,
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#ece8e4]">
      <div className="grid h-full w-full lg:grid-cols-[76px_minmax(0,1fr)]">
        <AppSidebar user={storyUser} onSignOut={noopAsyncAction} />
        <div className="min-w-0 overflow-hidden bg-[#fbf8f4]">
          <AppHeader user={storyUser} onSignOut={noopAsyncAction} />
          <main className="h-[calc(100vh-57px)] overflow-hidden">
            <div data-pathname={pathname} className="h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function DashboardStoryPage() {
  const snapshot = makeFinanceSnapshot();
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

export function withPathname(pathname: string) {
  return {
    nextjs: {
      navigation: {
        pathname,
      },
    },
  };
}

export async function expectHeading(canvasElement: HTMLElement, text: string) {
  const canvas = within(canvasElement);
  await expect(canvas.getByText(text)).toBeInTheDocument();
}

export type Story<T extends Meta> = StoryObj<T>;
