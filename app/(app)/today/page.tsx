"use client";

import { PageContainer } from "@/components/page-container";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { TodayView } from "@/features/today/components/today-view";

export default function TodayPage() {
  const { data } = useFinanceData();

  return (
    <PageContainer>
      <TodayView transactions={data?.transactions ?? []} />
    </PageContainer>
  );
}
