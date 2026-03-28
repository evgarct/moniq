"use client";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { TodayView } from "@/features/today/components/today-view";

export default function TodayPage() {
  const { data, error, isLoading } = useFinanceData();

  if (isLoading) {
    return (
      <PageContainer>
        <EmptyState title="Loading today" description="Fetching planned and paid transactions from Supabase." />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <EmptyState
          title="Unable to load today"
          description={error instanceof Error ? error.message : "Finance data could not be loaded."}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <TodayView transactions={data?.transactions ?? []} />
    </PageContainer>
  );
}
