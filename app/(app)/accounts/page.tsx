"use client";

import { PageContainer } from "@/components/page-container";
import { AccountsView } from "@/features/accounts/components/accounts-view";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function AccountsPage() {
  const { data } = useFinanceData();

  return (
    <PageContainer>
      <AccountsView accounts={data?.accounts ?? []} transactions={data?.transactions ?? []} />
    </PageContainer>
  );
}
