"use client";

import { PageContainer } from "@/components/page-container";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";

export default function CalendarPage() {
  const { data } = useFinanceData();

  return (
    <PageContainer>
      <CalendarView transactions={data?.transactions ?? []} />
    </PageContainer>
  );
}
