"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFinanceSnapshot, financeSnapshotQueryKey } from "@/features/finance/lib/finance-api";
import { backoffDelay } from "@/lib/backoff";

export function useFinanceData({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeSnapshotQueryKey,
    queryFn: () => fetchFinanceSnapshot(),
    enabled,
    // Ride out cold starts and brief network drops before showing the error state.
    // Few retries: each one is a full snapshot read, and stacking them on a slow backend makes it slower.
    retry: 2,
    retryDelay: (attempt) => backoffDelay(attempt, { baseMs: 1_000, maxMs: 10_000 }),
    refetchOnReconnect: true,
    // Normally off (see query-client), but a failed load should recover as soon as the user returns.
    refetchOnWindowFocus: (query) => query.state.status === "error",
  });
}
