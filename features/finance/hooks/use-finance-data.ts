"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFinanceSnapshot, financeSnapshotQueryKey } from "@/features/finance/lib/finance-api";
import { useLocalFirst } from "@/features/sync/components/local-first-provider";
import { backoffDelay } from "@/features/sync/lib/backoff";
import { readCachedFinanceSnapshot, readSyncedFinanceSnapshot } from "@/features/sync/lib/local-finance-store";

export function useFinanceData({ enabled = true }: { enabled?: boolean } = {}) {
  const localFirst = useLocalFirst();
  return useQuery({
    queryKey: financeSnapshotQueryKey,
    queryFn: async () => {
      if (localFirst.enabled && localFirst.database && localFirst.userId) {
        const synced = await readSyncedFinanceSnapshot(localFirst.database);
        if (synced) return synced;
        const cached = await readCachedFinanceSnapshot(localFirst.database, localFirst.userId);
        if (cached) return cached;
      }
      return fetchFinanceSnapshot();
    },
    enabled: enabled && (!localFirst.enabled || (localFirst.hydrated && localFirst.status.state !== "expired")),
    // Ride out cold starts and brief network drops before showing the error state.
    // Few retries: each one is a full snapshot read, and stacking them on a slow backend makes it slower.
    retry: 2,
    retryDelay: (attempt) => backoffDelay(attempt, { baseMs: 1_000, maxMs: 10_000 }),
    refetchOnMount: localFirst.enabled ? false : true,
    refetchOnReconnect: true,
    // Normally off (see query-client), but a failed load should recover as soon as the user returns.
    refetchOnWindowFocus: (query) => query.state.status === "error",
  });
}
