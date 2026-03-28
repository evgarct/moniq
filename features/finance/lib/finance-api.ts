"use client";

import type { AllocationInput, WalletInput } from "@/types/finance-schemas";
import type { FinanceSnapshot } from "@/types/finance";

export const financeSnapshotQueryKey = ["finance-snapshot"] as const;

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Request failed.";

    throw new Error(message);
  }

  return payload as T;
}

export async function fetchFinanceSnapshot(): Promise<FinanceSnapshot> {
  const response = await fetch("/api/finance/snapshot", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function createWalletRequest(values: WalletInput): Promise<FinanceSnapshot> {
  const response = await fetch("/api/wallets", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function updateWalletRequest(walletId: string, values: WalletInput): Promise<FinanceSnapshot> {
  const response = await fetch(`/api/wallets/${walletId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function deleteWalletRequest(walletId: string): Promise<FinanceSnapshot> {
  const response = await fetch(`/api/wallets/${walletId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function createAllocationRequest(walletId: string, values: AllocationInput): Promise<FinanceSnapshot> {
  const response = await fetch("/api/wallet-allocations", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      walletId,
      ...values,
    }),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function updateAllocationRequest(allocationId: string, values: AllocationInput): Promise<FinanceSnapshot> {
  const response = await fetch(`/api/wallet-allocations/${allocationId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function deleteAllocationRequest(allocationId: string): Promise<FinanceSnapshot> {
  const response = await fetch(`/api/wallet-allocations/${allocationId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}
