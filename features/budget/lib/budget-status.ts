import { endOfMonth, format, startOfMonth, startOfToday } from "date-fns";

import {
  buildEnvelopeBudgetRows,
  listMonthPlannedTransactions,
  summarizeEnvelopeBudget,
  sumEnvelopeSpend,
  sumEnvelopeUpcoming,
  sumUncategorizedSpend,
  type EnvelopeBudgetRow,
} from "@/features/budget/lib/envelope-budget";
import { buildCategoryTree, getManageableCategories } from "@/features/categories/lib/category-tree";
import { convertTransactionAnalyticsAmount } from "@/features/finance/lib/exchange-rates";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { CurrencyCode } from "@/types/currency";
import type { Category, ExchangeRate, Transaction } from "@/types/finance";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Parses "YYYY-MM" into the first day of that month; null when the value is not a valid month. */
export function parseBudgetMonth(value: string | undefined, today = startOfToday()): Date | null {
  if (value === undefined) return startOfMonth(today);
  if (!MONTH_PATTERN.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/** First and last day of the month as ISO dates, for range queries. */
export function budgetMonthRange(month: Date) {
  return { start_date: format(startOfMonth(month), "yyyy-MM-dd"), end_date: format(endOfMonth(month), "yyyy-MM-dd") };
}

type BudgetStatusEnvelope = {
  category_id: string;
  name: string;
  /** Monthly plan; null when the envelope has no budget. */
  planned: number | null;
  spent: number | null;
  upcoming: number | null;
  forecast: number | null;
  left: number | null;
  left_at_month_end: number | null;
  percent_used: number | null;
  status: EnvelopeBudgetRow["status"];
  will_be_over: boolean;
  missing_currencies: CurrencyCode[];
};

type BudgetStatusOperation = {
  id: string;
  date: string;
  title: string;
  kind: Transaction["kind"];
  amount: number;
  currency: CurrencyCode | null;
  /** Amount in the default currency; null when the rate is missing. */
  converted_amount: number | null;
  category_id: string | null;
  category_name: string | null;
  schedule_id: string | null;
  overdue: boolean;
};

export type BudgetStatus = ReturnType<typeof buildBudgetStatus>;

const toEnvelope = (row: EnvelopeBudgetRow): BudgetStatusEnvelope => ({
  category_id: row.id,
  name: row.name,
  planned: row.planned,
  spent: row.spent,
  upcoming: row.upcoming,
  forecast: row.forecast,
  left: row.left,
  left_at_month_end: row.forecastLeft,
  percent_used: row.percentUsed,
  status: row.status,
  will_be_over: row.atRisk,
  missing_currencies: row.missingCurrencies,
});

/**
 * The Budget screen for one month as data: per top-level envelope the plan, the paid spend, the planned
 * (not yet paid) spend and what is left at month end, the month summary, income received and expected, and the
 * month's planned operations. Uses the same helpers as the screen, so the numbers match it exactly. All amounts
 * are in `targetCurrency`; anything that needs a missing FX rate is null instead of a partial total.
 */
export function buildBudgetStatus(options: {
  categories: Category[];
  /** Transactions of the month (any status); skipped ones and other months are ignored. */
  transactions: Transaction[];
  month: Date;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
  today?: Date;
}) {
  const month = startOfMonth(options.month);
  const transactions = options.transactions.filter((transaction) => isVisibleTransactionStatus(transaction.status));
  const manageable = getManageableCategories(options.categories);
  const tree = buildCategoryTree(manageable, transactions);
  const rowOptions = {
    categories: options.categories,
    transactions,
    month,
    targetCurrency: options.targetCurrency,
    exchangeRates: options.exchangeRates,
  };
  const expenseRows = buildEnvelopeBudgetRows({ ...rowOptions, nodes: tree.filter((node) => node.type === "expense") });
  const incomeRows = buildEnvelopeBudgetRows({ ...rowOptions, nodes: tree.filter((node) => node.type === "income") });
  const summary = summarizeEnvelopeBudget(
    expenseRows,
    sumUncategorizedSpend({ ...rowOptions, kind: "expense" }),
    sumUncategorizedSpend({ ...rowOptions, kind: "expense", status: "planned" }),
  );
  const add = (left: number | null, right: number | null) => (left === null || right === null ? null : Number((left + right).toFixed(2)));
  const incomeReceived = add(sumEnvelopeSpend(incomeRows), sumUncategorizedSpend({ ...rowOptions, kind: "income" }));
  const incomeExpected = add(sumEnvelopeUpcoming(incomeRows), sumUncategorizedSpend({ ...rowOptions, kind: "income", status: "planned" }));

  const categoryNames = new Map(options.categories.map((category) => [category.id, category.name]));
  const planned = listMonthPlannedTransactions(transactions, month, options.today ?? startOfToday());
  const toOperation = (transaction: Transaction, overdue: boolean): BudgetStatusOperation => {
    const conversion = convertTransactionAnalyticsAmount({
      transaction,
      targetCurrency: options.targetCurrency,
      exchangeRates: options.exchangeRates,
      includePlanned: true,
    });
    return {
      id: transaction.id,
      date: transaction.occurred_at,
      title: transaction.title,
      kind: transaction.kind,
      amount: transaction.amount,
      currency: (transaction.source_account ?? transaction.destination_account)?.currency ?? null,
      converted_amount: conversion && conversion.status !== "missing_rate" ? Number(conversion.amount.toFixed(2)) : null,
      category_id: transaction.category_id,
      category_name: transaction.category_id ? categoryNames.get(transaction.category_id) ?? null : null,
      schedule_id: transaction.schedule_id,
      overdue,
    };
  };

  return {
    month: format(month, "yyyy-MM"),
    currency: options.targetCurrency,
    summary: {
      available: summary.available,
      planned: summary.planned,
      spent_planned: summary.spentPlanned,
      spent_unplanned: summary.unplanned,
      spent: summary.spent,
      left: summary.left,
      upcoming_planned: summary.upcomingPlanned,
      upcoming: summary.upcoming,
      left_at_month_end: summary.forecastLeft,
      income_received: incomeReceived,
      income_expected: incomeExpected,
    },
    envelopes: expenseRows.map(toEnvelope),
    income: incomeRows.map((row) => ({ category_id: row.id, name: row.name, received: row.spent, expected: row.upcoming })),
    upcoming_operations: [
      ...planned.overdue.map((transaction) => toOperation(transaction, true)),
      ...planned.upcoming.map((transaction) => toOperation(transaction, false)),
    ],
  };
}
