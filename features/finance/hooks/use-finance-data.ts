"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFinanceSnapshot, financeSnapshotQueryKey } from "@/features/finance/lib/finance-api";
import { useLocalFirst } from "@/features/sync/components/local-first-provider";

export function useFinanceData({ enabled = true }: { enabled?: boolean } = {}) {
  const localFirst = useLocalFirst();
  return useQuery({
    queryKey: financeSnapshotQueryKey,
    queryFn: fetchFinanceSnapshot,
    enabled: enabled && localFirst.hydrated && localFirst.status.state !== "expired",
    retry: 1,
    retryDelay: 2_000,
    refetchOnMount: localFirst.enabled ? "always" : true,
  });
}
