import { isAfter, parseISO, startOfToday } from "date-fns";

import { getTransactionAnalyticsAmount, getTransactionPrimaryAccount } from "@/features/transactions/lib/transaction-utils";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRate, Transaction } from "@/types/finance";

export type MoneyConversionResult =
  | {
      status: "converted";
      amount: number;
      source_currency: CurrencyCode;
      target_currency: CurrencyCode;
      rate: number;
      rate_date: string;
      requested_date: string;
      provider: ExchangeRate["provider"];
    }
  | {
      status: "same_currency";
      amount: number;
      source_currency: CurrencyCode;
      target_currency: CurrencyCode;
    }
  | {
      status: "missing_rate";
      amount: number;
      source_currency: CurrencyCode;
      target_currency: CurrencyCode;
      requested_date: string;
    };

function normalizeRequestedDate(requestedDate: string, today = startOfToday()) {
  const parsed = parseISO(requestedDate);
  if (isAfter(parsed, today)) {
    return null;
  }

  return requestedDate;
}

function findBestRate(
  exchangeRates: ExchangeRate[],
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  requestedDate: string,
) {
  const effectiveRequestedDate = normalizeRequestedDate(requestedDate);
  const candidates = exchangeRates
    .filter((rate) => {
      const isDirect = rate.base_currency === sourceCurrency && rate.quote_currency === targetCurrency;
      const isInverse = rate.base_currency === targetCurrency && rate.quote_currency === sourceCurrency;

      if (!isDirect && !isInverse) {
        return false;
      }

      return effectiveRequestedDate ? rate.requested_date <= effectiveRequestedDate : true;
    })
    .sort(
      (left, right) =>
        right.requested_date.localeCompare(left.requested_date) ||
        right.rate_date.localeCompare(left.rate_date) ||
        right.fetched_at.localeCompare(left.fetched_at),
    );

  return candidates[0] ?? null;
}

export function convertMoney(options: {
  amount: number;
  sourceCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  requestedDate: string;
  exchangeRates: ExchangeRate[];
}): MoneyConversionResult {
  if (options.sourceCurrency === options.targetCurrency) {
    return {
      status: "same_currency",
      amount: options.amount,
      source_currency: options.sourceCurrency,
      target_currency: options.targetCurrency,
    };
  }

  const rate = findBestRate(
    options.exchangeRates,
    options.sourceCurrency,
    options.targetCurrency,
    options.requestedDate,
  );

  if (!rate) {
    return {
      status: "missing_rate",
      amount: options.amount,
      source_currency: options.sourceCurrency,
      target_currency: options.targetCurrency,
      requested_date: options.requestedDate,
    };
  }

  const multiplier = rate.base_currency === options.sourceCurrency ? rate.rate : 1 / rate.rate;

  return {
    status: "converted",
    amount: options.amount * multiplier,
    source_currency: options.sourceCurrency,
    target_currency: options.targetCurrency,
    rate: multiplier,
    rate_date: rate.rate_date,
    requested_date: rate.requested_date,
    provider: rate.provider,
  };
}

export function convertTransactionAnalyticsAmount(options: {
  transaction: Transaction;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
}) {
  const account = getTransactionPrimaryAccount(options.transaction);

  if (!account) {
    return null;
  }

  return convertMoney({
    amount: getTransactionAnalyticsAmount(options.transaction),
    sourceCurrency: account.currency,
    targetCurrency: options.targetCurrency,
    requestedDate: options.transaction.occurred_at,
    exchangeRates: options.exchangeRates,
  });
}
