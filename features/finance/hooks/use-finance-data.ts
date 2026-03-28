"use client";

import { useQuery } from "@tanstack/react-query";

import { mockFinanceSnapshot } from "@/lib/mock-finance";

export function useFinanceData() {
  return useQuery({
    queryKey: ["finance-snapshot"],
    queryFn: async () => mockFinanceSnapshot,
    staleTime: Infinity,
  });
}
