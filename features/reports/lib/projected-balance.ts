import { addDays, addMonths, format, isAfter, parseISO, startOfDay } from "date-fns";

import { convertMoney } from "@/features/finance/lib/exchange-rates";
import type { CurrencyCode } from "@/types/currency";
import type { Account, ExchangeRate, Transaction } from "@/types/finance";

export const PROJECTED_BALANCE_MAX_MONTHS = 18;
export const PROJECTED_BALANCE_PRESET_MONTHS = [1, 2, 3, 6, 12, 18] as const;

export type ProjectedBalanceSeriesConfig = {
  id: string;
  name: string;
  accountIds: string[];
};

export function createProjectedBalanceSeries(options: {
  accounts: Account[];
  accountIds: string[];
  merged: boolean;
  mergedName: string;
}): ProjectedBalanceSeriesConfig[] {
  const selectedAccountIds = new Set(options.accountIds);
  const selectedAccounts = options.accounts.filter((account) => selectedAccountIds.has(account.id));

  if (options.merged) {
    return selectedAccounts.length
      ? [{
          id: "merged-accounts",
          name: options.mergedName,
          accountIds: selectedAccounts.map((account) => account.id),
        }]
      : [];
  }

  return selectedAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    accountIds: [account.id],
  }));
}

export type ProjectedBalanceAccountPoint = {
  account_id: string;
  account_name: string;
  native_balance: number;
  native_currency: CurrencyCode;
  converted_balance: number;
};

export type ProjectedBalanceOperation = {
  id: string;
  title: string;
  kind: Transaction["kind"];
  source_account_id: string | null;
  destination_account_id: string | null;
  source_amount: number | null;
  destination_amount: number | null;
  source_currency: CurrencyCode | null;
  destination_currency: CurrencyCode | null;
};

export type ProjectedBalancePoint = {
  date: string;
  balance: number;
  accounts: ProjectedBalanceAccountPoint[];
  operations: ProjectedBalanceOperation[];
};

export type ProjectedBalanceSeries = {
  id: string;
  name: string;
  account_ids: string[];
  points: ProjectedBalancePoint[];
};

export type ProjectedBalanceMissingRate = {
  series_id: string;
  series_name: string;
  account_id: string;
  account_name: string;
  source_currency: CurrencyCode;
  target_currency: CurrencyCode;
};

export type ProjectedBalanceReport = {
  start_date: string;
  end_date: string;
  currency: CurrencyCode;
  series: ProjectedBalanceSeries[];
  missing_rates: ProjectedBalanceMissingRate[];
};

function toDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function resolveProjectedBalancePeriod(options: {
  endDate?: string | null;
  now?: Date;
}) {
  const today = startOfDay(options.now ?? new Date());
  const maximumEnd = addMonths(today, PROJECTED_BALANCE_MAX_MONTHS);
  const requestedEnd = options.endDate ? parseISO(options.endDate) : addMonths(today, 6);
  const validRequestedEnd = Number.isNaN(requestedEnd.getTime()) ? addMonths(today, 6) : startOfDay(requestedEnd);
  const end = isAfter(validRequestedEnd, maximumEnd)
    ? maximumEnd
    : isAfter(today, validRequestedEnd)
      ? today
      : validRequestedEnd;

  return {
    startDate: today,
    endDate: end,
    start_date: toDateString(today),
    end_date: toDateString(end),
  };
}

function applyPlannedTransaction(
  balances: Map<string, number>,
  transaction: Transaction,
) {
  if (transaction.status !== "planned") return;

  if (transaction.source_account_id && balances.has(transaction.source_account_id)) {
    balances.set(
      transaction.source_account_id,
      (balances.get(transaction.source_account_id) ?? 0) - transaction.amount,
    );
  }

  if (transaction.destination_account_id && balances.has(transaction.destination_account_id)) {
    balances.set(
      transaction.destination_account_id,
      (balances.get(transaction.destination_account_id) ?? 0) +
        (transaction.destination_amount ?? transaction.amount),
    );
  }
}

function toOperation(
  transaction: Transaction,
  accountsById: Map<string, Account>,
): ProjectedBalanceOperation {
  return {
    id: transaction.id,
    title: transaction.title,
    kind: transaction.kind,
    source_account_id: transaction.source_account_id,
    destination_account_id: transaction.destination_account_id,
    source_amount: transaction.source_account_id ? transaction.amount : null,
    destination_amount: transaction.destination_account_id
      ? transaction.destination_amount ?? transaction.amount
      : null,
    source_currency: transaction.source_account_id
      ? accountsById.get(transaction.source_account_id)?.currency ?? null
      : null,
    destination_currency: transaction.destination_account_id
      ? accountsById.get(transaction.destination_account_id)?.currency ?? null
      : null,
  };
}

export function buildProjectedBalanceReport(options: {
  accounts: Account[];
  transactions: Transaction[];
  exchangeRates: ExchangeRate[];
  defaultCurrency: CurrencyCode;
  series: ProjectedBalanceSeriesConfig[];
  endDate?: string | null;
  now?: Date;
}): ProjectedBalanceReport {
  const period = resolveProjectedBalancePeriod({
    endDate: options.endDate,
    now: options.now,
  });
  const accountsById = new Map(options.accounts.map((account) => [account.id, account]));
  const selectedAccountIds = new Set(options.series.flatMap((item) => item.accountIds));
  const balances = new Map(
    options.accounts
      .filter((account) => selectedAccountIds.has(account.id))
      .map((account) => [account.id, account.balance]),
  );
  const plannedByDate = new Map<string, Transaction[]>();

  for (const transaction of options.transactions) {
    if (
      transaction.status !== "planned" ||
      transaction.occurred_at < period.start_date ||
      transaction.occurred_at > period.end_date
    ) {
      continue;
    }

    const transactions = plannedByDate.get(transaction.occurred_at) ?? [];
    transactions.push(transaction);
    plannedByDate.set(transaction.occurred_at, transactions);
  }

  const pointsBySeries = new Map<string, ProjectedBalancePoint[]>();
  const invalidSeriesIds = new Set<string>();
  const missingRateKeys = new Set<string>();
  const missingRates: ProjectedBalanceMissingRate[] = [];

  for (
    let date = period.startDate;
    !isAfter(date, period.endDate);
    date = addDays(date, 1)
  ) {
    const dateString = toDateString(date);
    const operations = plannedByDate.get(dateString) ?? [];

    for (const transaction of operations) {
      applyPlannedTransaction(balances, transaction);
    }

    for (const series of options.series) {
      if (invalidSeriesIds.has(series.id)) continue;

      const accountPoints: ProjectedBalanceAccountPoint[] = [];
      let seriesBalance = 0;

      for (const accountId of series.accountIds) {
        const account = accountsById.get(accountId);
        if (!account) continue;

        const nativeBalance = balances.get(account.id) ?? account.balance;
        const conversion = convertMoney({
          amount: nativeBalance,
          sourceCurrency: account.currency,
          targetCurrency: options.defaultCurrency,
          requestedDate: dateString,
          exchangeRates: options.exchangeRates,
        });

        if (conversion.status === "missing_rate") {
          invalidSeriesIds.add(series.id);
          pointsBySeries.delete(series.id);
          const key = `${series.id}:${account.id}:${account.currency}:${options.defaultCurrency}`;

          if (!missingRateKeys.has(key)) {
            missingRateKeys.add(key);
            missingRates.push({
              series_id: series.id,
              series_name: series.name,
              account_id: account.id,
              account_name: account.name,
              source_currency: account.currency,
              target_currency: options.defaultCurrency,
            });
          }
          break;
        }

        seriesBalance += conversion.amount;
        accountPoints.push({
          account_id: account.id,
          account_name: account.name,
          native_balance: nativeBalance,
          native_currency: account.currency,
          converted_balance: conversion.amount,
        });
      }

      if (invalidSeriesIds.has(series.id)) continue;

      const seriesAccountIds = new Set(series.accountIds);
      const relevantOperations = operations
        .filter(
          (transaction) =>
            (transaction.source_account_id &&
              seriesAccountIds.has(transaction.source_account_id)) ||
            (transaction.destination_account_id &&
              seriesAccountIds.has(transaction.destination_account_id)),
        )
        .map((t) => toOperation(t, accountsById));
      const points = pointsBySeries.get(series.id) ?? [];

      points.push({
        date: dateString,
        balance: seriesBalance,
        accounts: accountPoints,
        operations: relevantOperations,
      });
      pointsBySeries.set(series.id, points);
    }
  }

  return {
    start_date: period.start_date,
    end_date: period.end_date,
    currency: options.defaultCurrency,
    series: options.series.flatMap((series) => {
      const points = pointsBySeries.get(series.id);
      return points
        ? [{
            id: series.id,
            name: series.name,
            account_ids: series.accountIds.filter((accountId) => accountsById.has(accountId)),
            points,
          }]
        : [];
    }),
    missing_rates: missingRates,
  };
}
