import type { QueryClient } from "@tanstack/react-query";

import { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";
import { FinanceMutationCoordinator } from "@/features/finance/lib/optimistic-coordinator";
import type { FinanceSnapshot } from "@/types/finance";

const coordinators = new WeakMap<QueryClient, FinanceMutationCoordinator>();

export function getFinanceMutationCoordinator(queryClient: QueryClient) {
  const existing = coordinators.get(queryClient);
  if (existing) return existing;
  const coordinator = new FinanceMutationCoordinator({
    read: () => queryClient.getQueryData<FinanceSnapshot>(financeSnapshotQueryKey),
    write: (snapshot) => queryClient.setQueryData(financeSnapshotQueryKey, snapshot),
  });
  coordinators.set(queryClient, coordinator);
  return coordinator;
}
