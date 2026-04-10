"use client";

import { useQuery } from "@tanstack/react-query";

import { bankingSnapshotQueryKey, fetchBankingSnapshot } from "@/features/banking/lib/banking-api";

export function useBankingData() {
  return useQuery({
    queryKey: bankingSnapshotQueryKey,
    queryFn: fetchBankingSnapshot,
    retry: false,
  });
}
