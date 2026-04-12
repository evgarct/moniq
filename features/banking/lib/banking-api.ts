"use client";

import { createTranslator } from "next-intl";
import { hasLocale } from "next-intl";

import { loadMessages } from "@/i18n/messages";
import { routing, type AppLocale } from "@/i18n/routing";
import type { ImportColumnMapping, ImportFilePreview, TransactionImportSnapshot } from "@/types/imports";

export const bankingSnapshotQueryKey = ["banking-snapshot"] as const;
const REQUEST_TIMEOUT_MS = 15_000;

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

export async function fetchBankingSnapshot(): Promise<TransactionImportSnapshot> {
  const response = await fetchWithTimeout("/api/banking/snapshot", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  return parseJsonResponse<TransactionImportSnapshot>(response);
}

export async function uploadCsvImportRequest(input: { walletId: string; file: File }) {
  const formData = new FormData();
  formData.set("walletId", input.walletId);
  formData.set("file", input.file);

  const response = await fetchWithTimeout("/api/banking/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return parseJsonResponse<TransactionImportSnapshot>(response);
}

export async function fetchImportPreviewRequest(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetchWithTimeout("/api/banking/import-preview", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return parseJsonResponse<ImportFilePreview>(response);
}

export async function uploadMappedImportRequest(input: { walletId: string; file: File; mapping: ImportColumnMapping }) {
  const formData = new FormData();
  formData.set("walletId", input.walletId);
  formData.set("file", input.file);
  formData.set("mapping", JSON.stringify(input.mapping));

  const response = await fetchWithTimeout("/api/banking/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return parseJsonResponse<TransactionImportSnapshot>(response);
}

export async function updateImportedTransactionRequest(
  transactionId: string,
  values: {
    merchant_clean?: string;
    category_id?: string | null;
    kind?: "expense" | "income" | "transfer" | "debt_payment";
    wallet_id?: string;
    counterpart_wallet_id?: string | null;
  },
) {
  const response = await fetchWithTimeout(`/api/banking/transactions/${transactionId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<TransactionImportSnapshot>(response);
}

export async function batchConfirmImportedTransactionsRequest(transactionIds: string[]) {
  const response = await fetchWithTimeout("/api/banking/transactions/batch-confirm", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transactionIds }),
  });

  return parseJsonResponse<TransactionImportSnapshot>(response);
}

export async function deleteImportedTransactionRequest(transactionId: string) {
  const response = await fetchWithTimeout(`/api/banking/transactions/${transactionId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<TransactionImportSnapshot>(response);
}

export async function deleteImportBatchRequest(batchId: string) {
  const response = await fetchWithTimeout(`/api/banking/batches/${batchId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return parseJsonResponse<TransactionImportSnapshot>(response);
}
