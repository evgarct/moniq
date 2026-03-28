"use client";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function CalendarPage() {
  const { data, error, isLoading } = useFinanceData();

  if (isLoading) {
    return (
      <PageContainer>
        <EmptyState title="Loading calendar" description="Fetching transaction dates from Supabase." />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <EmptyState
          title="Unable to load calendar"
          description={error instanceof Error ? error.message : "Finance data could not be loaded."}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <CalendarView transactions={data?.transactions ?? []} />
    </PageContainer>
  );
}
