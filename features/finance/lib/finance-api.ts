"use client";

import { createTranslator } from "next-intl";
import { hasLocale } from "next-intl";

import type {
  CategoryInput,
  RecurringOccurrenceChangesInput,
  TransactionEntryBatchInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
  UserPreferencesInput,
  WalletAllocationInput,
  WalletInput,
} from "@/types/finance-schemas";
import type { FinanceSnapshot } from "@/types/finance";
import type { InvestmentInstrumentCandidate } from "@/types/finance";
import { isNetworkFetchError } from "@/lib/backoff";
import { loadMessages } from "@/i18n/messages";
import { reportFetchPerformance } from "@/lib/performance/client";
import { routing, type AppLocale } from "@/i18n/routing";

export { financeSnapshotQueryKey } from "@/features/finance/lib/finance-keys";
const REQUEST_TIMEOUT_MS = 30_000;
const SNAPSHOT_TIMEOUT_MS = 60_000;

export async function savePensionStatementRequest(walletId: string, statement: import("@/features/accounts/lib/pension").PensionStatementInput): Promise<FinanceSnapshot> {
  return parseJsonResponse<FinanceSnapshot>(await fetchWithTimeout(`/api/wallets/${walletId}/pension`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(statement),
  }));
}

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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const t = await getCommonErrorTranslator();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  const method = init.method ?? (input instanceof Request ? input.method : "GET");

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    reportFetchPerformance({
      url: input,
      method,
      status: response.status,
      durationMs: performance.now() - startedAt,
      responseBytes: parseResponseBytes(response),
    });
    return response;
  } catch (error) {
    reportFetchPerformance({
      url: input,
      method,
      durationMs: performance.now() - startedAt,
      error: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network",
    });
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(t("common.errors.requestTimedOut"));
    }
    if (isNetworkFetchError(error)) {
      throw new Error(t("common.errors.networkUnavailable"));
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function parseResponseBytes(response: Response) {
  const value = response.headers.get("content-length");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

let inFlightSnapshot: Promise<FinanceSnapshot> | null = null;

/** Forget the shared request; call when the signed-in user changes so one account never receives another's snapshot. */
export function resetFinanceSnapshotRequests() {
  inFlightSnapshot = null;
}

/**
 * Concurrent callers (query refetch, manual refresh, retries) share one request: stacking
 * snapshot reads on a slow backend made every one of them slower and none of them finish.
 */
export function fetchFinanceSnapshot({ fresh = false }: { fresh?: boolean } = {}): Promise<FinanceSnapshot> {
  // `fresh` (manual refresh after flushing queued commands) must not reuse a read that started earlier.
  if (!fresh && inFlightSnapshot) return inFlightSnapshot;
  const request = (async () => {
    // The server allows 60 s (maxDuration); give it the same budget instead of abandoning the read at 30 s.
    const response = await fetchWithTimeout("/api/finance/snapshot", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }, SNAPSHOT_TIMEOUT_MS);

    return parseJsonResponse<FinanceSnapshot>(response);
  })();
  inFlightSnapshot = request;
  const clear = () => {
    if (inFlightSnapshot === request) inFlightSnapshot = null;
  };
  request.then(clear, clear);
  return request;
}
export async function saveInvestmentPositionRequest(
  instrument: InvestmentInstrumentCandidate,
  openingUnits: number,
): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout("/api/investments/positions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instrument, opening_units: openingUnits }),
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

export async function saveCategoryBudgetRequest(
  categoryId: string,
  values: { month: string; scope: "month" | "from"; amount: number | null },
): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/categories/${categoryId}/budget`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function clearCategoryBudgetOverrideRequest(categoryId: string, month: string): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/categories/${categoryId}/budget`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ month }),
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

export async function applyRecurringOccurrenceChangesRequest(
  scheduleId: string,
  fromOccurrenceDate: string,
  changes: RecurringOccurrenceChangesInput,
): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout(`/api/transaction-schedules/${scheduleId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "update-from-occurrence", fromOccurrenceDate, changes }),
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

export async function deleteWalletAllocationRequest(allocationId: string, replacementAllocationId: string | null = null): Promise<FinanceSnapshot> {
  const query = replacementAllocationId ? `?replacement_allocation_id=${encodeURIComponent(replacementAllocationId)}` : "";
  const response = await fetchWithTimeout(`/api/allocations/${allocationId}${query}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}

export async function updateUserPreferencesRequest(values: UserPreferencesInput): Promise<FinanceSnapshot> {
  const response = await fetchWithTimeout("/api/settings/preferences", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<FinanceSnapshot>(response);
}
