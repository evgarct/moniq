"use client";

import { createTranslator } from "next-intl";
import { hasLocale } from "next-intl";

import { loadMessages } from "@/i18n/messages";
import { routing, type AppLocale } from "@/i18n/routing";
import type { BankingSnapshot } from "@/types/banking";

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

export async function fetchBankingSnapshot(): Promise<BankingSnapshot> {
  const response = await fetchWithTimeout("/api/banking/snapshot", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  return parseJsonResponse<BankingSnapshot>(response);
}

export async function connectBankRequest(input?: { redirectUrl?: string; aspspName?: string; aspspCountry?: string }) {
  const response = await fetchWithTimeout("/api/banking/connect-bank", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input ?? {}),
  });

  return parseJsonResponse<{ redirectUrl: string }>(response);
}

export async function syncBankTransactionsRequest() {
  const response = await fetchWithTimeout("/api/banking/sync", {
    method: "POST",
    credentials: "include",
  });

  return parseJsonResponse<BankingSnapshot>(response);
}

export async function updateImportedTransactionRequest(
  transactionId: string,
  values: { merchant_clean?: string; category_id?: string | null },
) {
  const response = await fetchWithTimeout(`/api/banking/transactions/${transactionId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return parseJsonResponse<BankingSnapshot>(response);
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

  return parseJsonResponse<BankingSnapshot>(response);
}
