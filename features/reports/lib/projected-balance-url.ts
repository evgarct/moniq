import type { Account } from "@/types/finance";

import {
  resolveProjectedBalancePeriod,
  type ProjectedBalanceSeriesConfig,
} from "./projected-balance";

const MAX_SERIES = 5;
const MAX_NAME_LENGTH = 60;

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const binary = atob(normalized + (padding ? "=".repeat(4 - padding) : ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeProjectedBalanceSeries(series: ProjectedBalanceSeriesConfig) {
  return encodeBase64Url(JSON.stringify({
    id: series.id,
    name: series.name,
    accountIds: series.accountIds,
  }));
}

function parseSeries(value: string): ProjectedBalanceSeriesConfig | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Record<string, unknown>;

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.accountIds)
    ) {
      return null;
    }

    return {
      id: parsed.id.slice(0, 80),
      name: parsed.name.trim().slice(0, MAX_NAME_LENGTH),
      accountIds: parsed.accountIds.filter(
        (accountId): accountId is string => typeof accountId === "string",
      ),
    };
  } catch {
    return null;
  }
}

export function createDefaultProjectedBalanceSeries(
  accounts: Pick<Account, "id">[],
  name: string,
): ProjectedBalanceSeriesConfig[] {
  return [{
    id: "all-accounts",
    name,
    accountIds: accounts.map((account) => account.id),
  }];
}

export function parseProjectedBalanceUrlState(options: {
  searchParams: Pick<URLSearchParams, "get" | "getAll">;
  accounts: Pick<Account, "id">[];
  defaultSeriesName: string;
  now?: Date;
}) {
  const validAccountIds = new Set(options.accounts.map((account) => account.id));
  const seenSeriesIds = new Set<string>();
  const parsedSeries = options.searchParams
    .getAll("series")
    .slice(0, MAX_SERIES)
    .flatMap((value) => {
      const series = parseSeries(value);
      if (!series || !series.id || !series.name || seenSeriesIds.has(series.id)) return [];

      const accountIds = Array.from(
        new Set(series.accountIds.filter((accountId) => validAccountIds.has(accountId))),
      );
      if (!accountIds.length) return [];

      seenSeriesIds.add(series.id);
      return [{ ...series, accountIds }];
    });
  const series = parsedSeries.length
    ? parsedSeries
    : createDefaultProjectedBalanceSeries(options.accounts, options.defaultSeriesName);
  const period = resolveProjectedBalancePeriod({
    endDate: options.searchParams.get("end"),
    now: options.now,
  });

  return {
    endDate: period.end_date,
    series,
  };
}

export function buildProjectedBalanceSearchParams(options: {
  endDate: string;
  series: ProjectedBalanceSeriesConfig[];
}) {
  const params = new URLSearchParams();
  params.set("end", options.endDate);

  for (const series of options.series.slice(0, MAX_SERIES)) {
    params.append("series", encodeProjectedBalanceSeries(series));
  }

  return params;
}
