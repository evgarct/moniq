import { endOfMonth, format, isValid, parseISO, startOfMonth, subMonths } from "date-fns";

import { getTransactionAnalyticsAmount, getTransactionPrimaryAccount } from "@/features/transactions/lib/transaction-utils";
import type { Category, Transaction } from "@/types/finance";

export type CategorySpendingPeriodInput = {
  period_preset?: "last_complete_month";
  month?: string;
  start_date?: string;
  end_date?: string;
};

export type CategorySpendingPeriod = {
  start_date: string;
  end_date: string;
  label: string;
};

export type CategorySpendingTransaction = {
  id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  kind: Transaction["kind"];
  status: Transaction["status"];
  amount: number;
  analytics_amount: number;
  currency: string;
  category_id: string | null;
  category_path: string[];
  category_descriptions: (string | null)[];
  source_account_id: string | null;
  source_account_name: string | null;
  destination_account_id: string | null;
  destination_account_name: string | null;
};

export type CategorySpendingCurrencyTotal = {
  currency: string;
  income_total: number;
  expense_total: number;
  net: number;
};

export type CategorySpendingCurrencyAmount = {
  currency: string;
  amount: number;
  percent_of_income: number | null;
  percent_of_total_expenses: number | null;
};

export type CategorySpendingNode = {
  category_id: string;
  name: string;
  description: string | null;
  path: string[];
  totals: CategorySpendingCurrencyAmount[];
  transaction_count: number;
  transactions: CategorySpendingTransaction[];
  categories: CategorySpendingNode[];
};

export type UncategorizedSpendingGroup = {
  kind: "income" | "expense";
  totals: CategorySpendingCurrencyAmount[];
  transaction_count: number;
  transactions: CategorySpendingTransaction[];
};

export type CategorySpendingReport = {
  period: CategorySpendingPeriod;
  currencies: CategorySpendingCurrencyTotal[];
  envelopes: CategorySpendingNode[];
  income_categories: CategorySpendingNode[];
  uncategorized: UncategorizedSpendingGroup[];
};

type ReportTransaction = CategorySpendingTransaction;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value;
}

function isIsoMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const date = parseISO(`${value}-01`);
  return isValid(date) && format(date, "yyyy-MM") === value;
}

function formatDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function resolveCategorySpendingPeriod(
  input: CategorySpendingPeriodInput = {},
  now: Date = new Date(),
): CategorySpendingPeriod {
  const hasMonth = Boolean(input.month);
  const hasStart = Boolean(input.start_date);
  const hasEnd = Boolean(input.end_date);

  if (input.period_preset && input.period_preset !== "last_complete_month") {
    throw new Error('period_preset must be "last_complete_month" when provided.');
  }

  if (hasMonth && (hasStart || hasEnd)) {
    throw new Error("Use either month or start_date/end_date, not both.");
  }

  if (hasStart !== hasEnd) {
    throw new Error("Provide both start_date and end_date for a custom period.");
  }

  if (input.month) {
    if (!isIsoMonth(input.month)) {
      throw new Error("month must use YYYY-MM format.");
    }

    const start = startOfMonth(parseISO(`${input.month}-01`));
    const end = endOfMonth(start);
    return {
      start_date: formatDate(start),
      end_date: formatDate(end),
      label: format(start, "MMMM yyyy"),
    };
  }

  if (input.start_date && input.end_date) {
    if (!isIsoDate(input.start_date) || !isIsoDate(input.end_date)) {
      throw new Error("start_date and end_date must use YYYY-MM-DD format.");
    }

    if (input.start_date > input.end_date) {
      throw new Error("start_date must be before or equal to end_date.");
    }

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      label: `${input.start_date} to ${input.end_date}`,
    };
  }

  const lastCompleteMonth = startOfMonth(subMonths(now, 1));
  return {
    start_date: formatDate(lastCompleteMonth),
    end_date: formatDate(endOfMonth(lastCompleteMonth)),
    label: format(lastCompleteMonth, "MMMM yyyy"),
  };
}

function addCurrencyAmount(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

function sortCurrencyTotals<T extends { currency: string }>(items: T[]) {
  return [...items].sort((left, right) => left.currency.localeCompare(right.currency));
}

function percent(part: number, whole: number) {
  if (whole === 0) return null;
  return Number(((part / whole) * 100).toFixed(2));
}

function getCategoryPath(category: Category, categoriesById: Map<string, Category>) {
  const path: Category[] = [];
  let current: Category | undefined = category;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = current.parent_id ? categoriesById.get(current.parent_id) : undefined;
  }

  return path;
}

function getRootCategory(category: Category, categoriesById: Map<string, Category>) {
  const path = getCategoryPath(category, categoriesById);
  return path[0] ?? category;
}

function getTransactionCurrency(transaction: Transaction) {
  return getTransactionPrimaryAccount(transaction)?.currency ?? "unknown";
}

function toReportTransaction(transaction: Transaction, categoriesById: Map<string, Category>): ReportTransaction {
  const category = transaction.category_id ? categoriesById.get(transaction.category_id) ?? null : null;
  const path = category ? getCategoryPath(category, categoriesById) : [];
  const currency = getTransactionCurrency(transaction);
  const analyticsAmount = getTransactionAnalyticsAmount(transaction);

  return {
    id: transaction.id,
    title: transaction.title,
    note: transaction.note,
    occurred_at: transaction.occurred_at,
    kind: transaction.kind,
    status: transaction.status,
    amount: transaction.amount,
    analytics_amount: analyticsAmount,
    currency,
    category_id: transaction.category_id,
    category_path: path.map((item) => item.name),
    category_descriptions: path.map((item) => item.description ?? null),
    source_account_id: transaction.source_account_id,
    source_account_name: transaction.source_account?.name ?? null,
    destination_account_id: transaction.destination_account_id,
    destination_account_name: transaction.destination_account?.name ?? null,
  };
}

function toCurrencyAmounts(
  amounts: Map<string, number>,
  currencyTotals: Map<string, CategorySpendingCurrencyTotal>,
  kind: "income" | "expense",
) {
  return sortCurrencyTotals(
    Array.from(amounts.entries(), ([currency, amount]) => {
      const totals = currencyTotals.get(currency) ?? { income_total: 0, expense_total: 0 };
      return {
        currency,
        amount,
        percent_of_income: percent(amount, totals.income_total),
        percent_of_total_expenses: kind === "expense" ? percent(amount, totals.expense_total) : null,
      };
    }),
  );
}

function buildNode(
  category: Category,
  options: {
    categoriesByParent: Map<string | null, Category[]>;
    transactionsByCategory: Map<string, ReportTransaction[]>;
    currencyTotals: Map<string, CategorySpendingCurrencyTotal>;
    categoriesById: Map<string, Category>;
  },
): CategorySpendingNode {
  const children = (options.categoriesByParent.get(category.id) ?? [])
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((child) => buildNode(child, options));
  const directTransactions = options.transactionsByCategory.get(category.id) ?? [];
  const allTransactions = [
    ...directTransactions,
    ...children.flatMap((child) => child.transactions),
  ].sort((left, right) => right.occurred_at.localeCompare(left.occurred_at) || right.id.localeCompare(left.id));
  const amounts = new Map<string, number>();

  for (const transaction of allTransactions) {
    addCurrencyAmount(amounts, transaction.currency, transaction.analytics_amount);
  }

  const path = getCategoryPath(category, options.categoriesById).map((item) => item.name);

  return {
    category_id: category.id,
    name: category.name,
    description: category.description ?? null,
    path,
    totals: toCurrencyAmounts(amounts, options.currencyTotals, category.type),
    transaction_count: allTransactions.length,
    transactions: allTransactions,
    categories: children,
  };
}

export function buildCategorySpendingReport(options: {
  categories: Category[];
  transactions: Transaction[];
  period?: CategorySpendingPeriodInput;
  now?: Date;
}): CategorySpendingReport {
  const period = resolveCategorySpendingPeriod(options.period, options.now);
  const categoriesById = new Map(options.categories.map((category) => [category.id, category]));
  const categoriesByParent = new Map<string | null, Category[]>();

  for (const category of options.categories) {
    const siblings = categoriesByParent.get(category.parent_id) ?? [];
    siblings.push(category);
    categoriesByParent.set(category.parent_id, siblings);
  }

  const periodTransactions = options.transactions.filter(
    (transaction) =>
      transaction.status === "paid" &&
      transaction.kind !== "transfer" &&
      transaction.occurred_at >= period.start_date &&
      transaction.occurred_at <= period.end_date,
  );
  const reportTransactions = periodTransactions.map((transaction) => toReportTransaction(transaction, categoriesById));
  const currencyTotals = new Map<string, CategorySpendingCurrencyTotal>();
  const transactionsByCategory = new Map<string, ReportTransaction[]>();
  const uncategorizedByKind = new Map<"income" | "expense", ReportTransaction[]>();

  for (const transaction of reportTransactions) {
    const totals = currencyTotals.get(transaction.currency) ?? {
      currency: transaction.currency,
      income_total: 0,
      expense_total: 0,
      net: 0,
    };

    if (transaction.kind === "income") {
      totals.income_total += transaction.analytics_amount;
      totals.net += transaction.analytics_amount;
    } else {
      totals.expense_total += transaction.analytics_amount;
      totals.net -= transaction.analytics_amount;
    }

    currencyTotals.set(transaction.currency, totals);

    if (transaction.category_id) {
      const list = transactionsByCategory.get(transaction.category_id) ?? [];
      list.push(transaction);
      transactionsByCategory.set(transaction.category_id, list);
    } else if (transaction.kind === "income" || transaction.kind === "expense") {
      const list = uncategorizedByKind.get(transaction.kind) ?? [];
      list.push(transaction);
      uncategorizedByKind.set(transaction.kind, list);
    }
  }

  const roots = (categoriesByParent.get(null) ?? []).sort((left, right) => left.name.localeCompare(right.name));
  const envelopes = roots
    .filter((category) => category.type === "expense")
    .map((category) => buildNode(category, { categoriesByParent, transactionsByCategory, currencyTotals, categoriesById }));
  const incomeCategories = roots
    .filter((category) => category.type === "income")
    .map((category) => buildNode(category, { categoriesByParent, transactionsByCategory, currencyTotals, categoriesById }));
  const uncategorized: UncategorizedSpendingGroup[] = Array.from(uncategorizedByKind.entries(), ([kind, transactions]) => {
    const amounts = new Map<string, number>();
    for (const transaction of transactions) {
      addCurrencyAmount(amounts, transaction.currency, transaction.analytics_amount);
    }

    return {
      kind,
      totals: toCurrencyAmounts(amounts, currencyTotals, kind),
      transaction_count: transactions.length,
      transactions,
    };
  });

  return {
    period,
    currencies: sortCurrencyTotals(Array.from(currencyTotals.values())),
    envelopes,
    income_categories: incomeCategories,
    uncategorized,
  };
}

export function getCategoryRootId(categoryId: string, categories: Category[]) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const category = categoriesById.get(categoryId);
  return category ? getRootCategory(category, categoriesById).id : null;
}
