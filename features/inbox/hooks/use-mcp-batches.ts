"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface McpBatchItem {
  id: string;
  title: string;
  amount: number;
  occurred_at: string;
  kind: "income" | "expense";
  currency: string | null;
  note: string | null;
  suggested_category_name: string | null;
  status: "pending" | "approved" | "rejected";
  resolved_category_id: string | null;
  resolved_account_id: string | null;
  finance_transaction_id: string | null;
}

export interface McpBatch {
  id: string;
  status: "pending" | "approved" | "rejected";
  source_description: string | null;
  submitted_by: string | null;
  created_at: string;
  mcp_batch_items: McpBatchItem[];
}

export const mcpBatchesQueryKey = ["mcp-batches-pending"] as const;

async function fetchMcpBatches(): Promise<McpBatch[]> {
  const res = await fetch("/api/mcp/batches?status=pending", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load Claude batches");
  return res.json();
}

export function useMcpBatches() {
  return useQuery({
    queryKey: mcpBatchesQueryKey,
    queryFn: fetchMcpBatches,
    retry: false,
  });
}

export function useRemoveMcpBatch() {
  const qc = useQueryClient();
  return (batchId: string) => {
    qc.setQueryData<McpBatch[]>(mcpBatchesQueryKey, (prev) =>
      prev ? prev.filter((b) => b.id !== batchId) : prev,
    );
  };
}
