import { isAfter, parseISO, startOfToday } from "date-fns";

import { getTransactionAnalyticsAmount, getTransactionPrimaryAccount } from "@/features/transactions/lib/transaction-utils";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRate, Transaction } from "@/types/finance";

const BRIDGE_CURRENCY: CurrencyCode = "EUR";

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

function getCurrencyToBridgeMultiplier(
  exchangeRates: ExchangeRate[],
  currency: CurrencyCode,
  requestedDate: string,
) {
  if (currency === BRIDGE_CURRENCY) {
    return {
      multiplier: 1,
      rate: null,
    };
  }

  const rate = findBestRate(exchangeRates, currency, BRIDGE_CURRENCY, requestedDate);

  if (!rate) {
    return null;
  }

  return {
    multiplier: rate.base_currency === currency ? rate.rate : 1 / rate.rate,
    rate,
  };
}

function findBridgeConversion(
  exchangeRates: ExchangeRate[],
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  requestedDate: string,
) {
  const sourceToBridge = getCurrencyToBridgeMultiplier(exchangeRates, sourceCurrency, requestedDate);
  const targetToBridge = getCurrencyToBridgeMultiplier(exchangeRates, targetCurrency, requestedDate);

  if (!sourceToBridge || !targetToBridge) {
    return null;
  }

  const rateReferences = [sourceToBridge.rate, targetToBridge.rate].filter((rate): rate is ExchangeRate => Boolean(rate));
  const requestedDates = rateReferences.map((rate) => rate.requested_date).sort();
  const rateDates = rateReferences.map((rate) => rate.rate_date).sort();
  const fetchedDates = rateReferences.map((rate) => rate.fetched_at).sort();

  return {
    rate: sourceToBridge.multiplier / targetToBridge.multiplier,
    requested_date: requestedDates[0] ?? requestedDate,
    rate_date: rateDates[0] ?? requestedDate,
    fetched_at: fetchedDates[0] ?? "",
    provider: "frankfurter" as const,
  };
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
    const bridgeConversion = findBridgeConversion(
      options.exchangeRates,
      options.sourceCurrency,
      options.targetCurrency,
      options.requestedDate,
    );

    if (!bridgeConversion) {
      return {
        status: "missing_rate",
        amount: options.amount,
        source_currency: options.sourceCurrency,
        target_currency: options.targetCurrency,
        requested_date: options.requestedDate,
      };
    }

    return {
      status: "converted",
      amount: options.amount * bridgeConversion.rate,
      source_currency: options.sourceCurrency,
      target_currency: options.targetCurrency,
      rate: bridgeConversion.rate,
      rate_date: bridgeConversion.rate_date,
      requested_date: bridgeConversion.requested_date,
      provider: bridgeConversion.provider,
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

export function getCurrenciesMissingExchangeRates(options: {
  currencies: CurrencyCode[];
  targetCurrency: CurrencyCode;
  requestedDate: string;
  exchangeRates: ExchangeRate[];
}) {
  return Array.from(new Set(options.currencies)).filter((currency) => {
    if (currency === options.targetCurrency) return false;

    return convertMoney({
      amount: 1,
      sourceCurrency: currency,
      targetCurrency: options.targetCurrency,
      requestedDate: options.requestedDate,
      exchangeRates: options.exchangeRates,
    }).status === "missing_rate";
  });
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
