"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFinanceSnapshot, financeSnapshotQueryKey } from "@/features/finance/lib/finance-api";
import { useLocalFirst } from "@/features/sync/components/local-first-provider";
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
    retry: 1,
    retryDelay: 2_000,
    refetchOnMount: localFirst.enabled ? false : true,
  });
}
