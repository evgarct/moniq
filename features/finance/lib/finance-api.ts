"use client";

import { createTranslator } from "next-intl";
import { hasLocale } from "next-intl";

import type {
  CategoryInput,
  TransactionEntryBatchInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
  WalletAllocationInput,
  WalletInput,
} from "@/types/finance-schemas";
import type { FinanceSnapshot } from "@/types/finance";
import { loadMessages } from "@/i18n/messages";
import { routing, type AppLocale } from "@/i18n/routing";

export { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";
const REQUEST_TIMEOUT_MS = 10_000;

function getDocumentLocale(): AppLocale {
  if (typeof document === "undefined") {
    return routing.defaultLocale;
  }

  const lang = document.documentElement.lang;
  const normalized = lang.toLowerCase();
  const base = normalized.split("-")[0];

  if (hasLocale(routing.locales, normalized)) {
    return normalized as AppLocale;
  }

  if (hasLocale(routing.locales, base)) {
    return base as AppLocale;
  }

  return routing.defaultLocale;
}

async function getCommonErrorTranslator() {
  const locale = getDocumentLocale();
  const messages = await loadMessages(locale);

  return createTranslator({
    locale,
    messages,
  }) as (key: string) => string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const t = await getCommonErrorTranslator();
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (response.redirected) {
      throw new Error(t("common.errors.unauthorized"));
    }

    throw new Error(t("common.errors.unexpectedResponse"));
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : t("common.errors.requestFailed");

    throw new Error(message);
  }

  return payload as T;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const t = await getCommonErrorTranslator();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(t("common.errors.requestTimedOut"));
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchFinanceSnapshot(): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout("/api/finance/snapshot", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function createWalletRequest(values: WalletInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout("/api/wallets", {
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
  const response = await fetchWithTimeout(`/api/wallets/${walletId}`, {
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
  const response = await fetchWithTimeout(`/api/wallets/${walletId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function adjustWalletBalanceRequest(walletId: string, newBalance: number, note: string | null): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/wallets/${walletId}/adjust`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newBalance, note }),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function createCategoryRequest(values: CategoryInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout("/api/categories", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function updateCategoryRequest(categoryId: string, values: CategoryInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/categories/${categoryId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function deleteCategoryRequest(categoryId: string, replacementCategoryId: string | null): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/categories/${categoryId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replacementCategoryId }),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function createTransactionRequest(values: TransactionEntryInput | TransactionEntryBatchInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout("/api/transactions", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function updateTransactionRequest(transactionId: string, values: TransactionInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transactions/${transactionId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function deleteTransactionRequest(transactionId: string): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transactions/${transactionId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function markTransactionPaidRequest(transactionId: string): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transactions/${transactionId}/mark-paid`, {
    method: "POST",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function skipTransactionOccurrenceRequest(transactionId: string): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transactions/${transactionId}/skip`, {
    method: "POST",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function updateTransactionScheduleRequest(scheduleId: string, values: TransactionScheduleInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transaction-schedules/${scheduleId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "update",
      values,
    }),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function setTransactionScheduleStateRequest(
  scheduleId: string,
  state: "active" | "paused",
): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transaction-schedules/${scheduleId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "state",
      state,
    }),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function rescheduleTransactionSeriesRequest(
  scheduleId: string,
  fromOccurrenceDate: string,
  newOccurrenceDate: string,
): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transaction-schedules/${scheduleId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "reschedule", fromOccurrenceDate, newOccurrenceDate }),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function deleteTransactionScheduleRequest(scheduleId: string): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transaction-schedules/${scheduleId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function createWalletAllocationRequest(walletId: string, values: WalletAllocationInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/wallets/${walletId}/allocations`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function updateWalletAllocationRequest(allocationId: string, values: WalletAllocationInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/allocations/${allocationId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function deleteWalletAllocationRequest(allocationId: string): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/allocations/${allocationId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}
