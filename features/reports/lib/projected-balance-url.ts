import type { Account } from "@/types/finance";

import { resolveProjectedBalancePeriod } from "./projected-balance";

export type ProjectedBalanceSelection = {
  accountIds: string[];
  merged: boolean;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const binary = atob(normalized + (padding ? "=".repeat(4 - padding) : ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseLegacySeriesAccountIds(values: string[]) {
  const accountIds: string[] = [];

  for (const value of values) {
    try {
      const parsed = JSON.parse(decodeBase64Url(value)) as Record<string, unknown>;
      if (!Array.isArray(parsed.accountIds)) continue;

      for (const accountId of parsed.accountIds) {
        if (typeof accountId === "string") accountIds.push(accountId);
      }
    } catch {
      // Ignore obsolete or malformed report state.
    }
  }

  return accountIds;
}

export function createDefaultProjectedBalanceSelection(
  accounts: Pick<Account, "id">[],
): ProjectedBalanceSelection {
  return {
    accountIds: accounts.map((account) => account.id),
    merged: true,
  };
}

export function parseProjectedBalanceUrlState(options: {
  searchParams: Pick<URLSearchParams, "get" | "getAll">;
  accounts: Pick<Account, "id">[];
  now?: Date;
}) {
  const validAccountIds = new Set(options.accounts.map((account) => account.id));
  const requestedAccountIds = [
    ...options.searchParams.getAll("account"),
    ...parseLegacySeriesAccountIds(options.searchParams.getAll("series")),
  ];
  const accountIds = Array.from(
    new Set(requestedAccountIds.filter((accountId) => validAccountIds.has(accountId))),
  );
  const selection = accountIds.length
    ? {
        accountIds,
        merged: options.searchParams.get("merged") !== "false",
      }
    : createDefaultProjectedBalanceSelection(options.accounts);
  const period = resolveProjectedBalancePeriod({
    endDate: options.searchParams.get("end"),
    now: options.now,
  });

  return {
    endDate: period.end_date,
    selection,
  };
}

export function buildProjectedBalanceSearchParams(options: {
  endDate: string;
  selection: ProjectedBalanceSelection;
}) {
  const params = new URLSearchParams();
  params.set("end", options.endDate);
  params.set("merged", String(options.selection.merged));

  for (const accountId of options.selection.accountIds) {
    params.append("account", accountId);
  }

  return params;
}
