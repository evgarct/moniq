"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFinanceSnapshot, financeSnapshotQueryKey } from "@/features/finance/lib/finance-api";

export function useFinanceData() {
  return useQuery({
    queryKey: financeSnapshotQueryKey,
    queryFn: fetchFinanceSnapshot,
    retry: 1,
    retryDelay: 2_000,
  });
}
