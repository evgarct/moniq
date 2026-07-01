import { addMonths, endOfMonth, format, isSameMonth, startOfMonth } from "date-fns";

import { convertTransactionAnalyticsAmount } from "@/features/finance/lib/exchange-rates";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRate, Transaction } from "@/types/finance";

export type ConvertedBudgetMonth = {
  month: string;
  startDate: string;
  endDate: string;
  income: number | null;
  expenses: number | null;
  net: number | null;
  transactionCount: number;
  missingCurrencies: CurrencyCode[];
};

export function buildMissingHistoricalFxRequest(options: {
  transactions: Transaction[];
  currentMonth: Date;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
  monthsShown?: number;
}) {
  const monthsShown = options.monthsShown ?? 13;
  const startDate = format(startOfMonth(addMonths(options.currentMonth, -(monthsShown - 1))), "yyyy-MM-dd");
  const endDate = format(endOfMonth(options.currentMonth), "yyyy-MM-dd");
  const requestedDates = new Set<string>();
  const quoteCurrencies = new Set<CurrencyCode>();

  for (const transaction of options.transactions) {
    if (
      !isSettledTransactionStatus(transaction.status) ||
      transaction.occurred_at < startDate ||
      transaction.occurred_at > endDate
    ) {
      continue;
    }

    const conversion = convertTransactionAnalyticsAmount({
      transaction,
      targetCurrency: options.targetCurrency,
      exchangeRates: options.exchangeRates,
    });
    if (conversion?.status !== "missing_rate") continue;

    requestedDates.add(transaction.occurred_at);
    quoteCurrencies.add(conversion.source_currency);
  }

  return {
    requestedDates: Array.from(requestedDates).sort(),
    quoteCurrencies: Array.from(quoteCurrencies).sort(),
  };
}

export function buildConvertedBudgetMonths(options: {
  transactions: Transaction[];
  currentMonth: Date;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
  monthsShown?: number;
}) {
  const monthsShown = options.monthsShown ?? 13;
  const firstMonth = addMonths(startOfMonth(options.currentMonth), -(monthsShown - 1));

  return Array.from({ length: monthsShown }, (_, index): ConvertedBudgetMonth => {
    const monthDate = addMonths(firstMonth, index);
    const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
    const transactions = options.transactions.filter(
      (transaction) =>
        isSettledTransactionStatus(transaction.status) &&
        transaction.occurred_at >= startDate &&
        transaction.occurred_at <= endDate,
    );
    let income = 0;
    let expenses = 0;
    const missingCurrencies = new Set<CurrencyCode>();

    for (const transaction of transactions) {
      const conversion = convertTransactionAnalyticsAmount({
        transaction,
        targetCurrency: options.targetCurrency,
        exchangeRates: options.exchangeRates,
      });
      if (!conversion) continue;
      if (conversion.status === "missing_rate") {
        missingCurrencies.add(conversion.source_currency);
        continue;
      }
      if (transaction.kind === "income") {
        income += conversion.amount;
      } else {
        expenses += conversion.amount;
      }
    }

    const available = missingCurrencies.size === 0;
    return {
      month: format(monthDate, "yyyy-MM"),
      startDate,
      endDate,
      income: available ? income : null,
      expenses: available ? expenses : null,
      net: available ? income - expenses : null,
      transactionCount: transactions.length,
      missingCurrencies: Array.from(missingCurrencies).sort(),
    };
  });
}

export function getConvertedCategoryTotal(options: {
  transactions: Transaction[];
  month: Date;
  categoryIds: Set<string>;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
}) {
  let amount = 0;
  const missingCurrencies = new Set<CurrencyCode>();

  for (const transaction of options.transactions) {
    if (
      !isSettledTransactionStatus(transaction.status) ||
      !isSameMonth(new Date(`${transaction.occurred_at}T12:00:00`), options.month) ||
      !transaction.category_id ||
      !options.categoryIds.has(transaction.category_id)
    ) {
      continue;
    }
    const conversion = convertTransactionAnalyticsAmount({
      transaction,
      targetCurrency: options.targetCurrency,
      exchangeRates: options.exchangeRates,
    });
    if (!conversion) continue;
    if (conversion.status === "missing_rate") {
      missingCurrencies.add(conversion.source_currency);
    } else {
      amount += conversion.amount;
    }
  }

  return {
    amount: missingCurrencies.size ? null : amount,
    missingCurrencies: Array.from(missingCurrencies).sort(),
  };
}

export function parseCategoryDescriptionAndBudget(description?: string | null) {
  if (!description) return { description: "", plannedBudget: null };
  const match = description.match(/^\[budget:\s*([\d.]+)\]\s*([\s\S]*)$/);
  if (match) {
    const val = parseFloat(match[1]);
    return {
      plannedBudget: isNaN(val) ? null : val,
      description: match[2].trim(),
    };
  }
  return { description: description.trim(), plannedBudget: null };
}

export function serializeCategoryDescriptionAndBudget(description: string, plannedBudget: number | null) {
  const desc = description.trim();
  if (plannedBudget !== null && !isNaN(plannedBudget) && plannedBudget >= 0) {
    return `[budget: ${plannedBudget}] ${desc}`;
  }
  return desc;
}
