import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth, subMonths } from "date-fns";

import { parseCategoryDescriptionAndBudget } from "@/features/budget/lib/budget-analytics";
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
  /** Transfers only: amount received in the destination wallet and its currency. */
  destination_amount: number | null;
  destination_currency: string | null;
  fx_rate: number | null;
  /** Debt payments only: principal + extra principal, the part that is not P&L. */
  principal_paid: number | null;
  category_id: string | null;
  category_path: string[];
  category_descriptions: (string | null)[];
  source_account_id: string | null;
  source_account_name: string | null;
  destination_account_id: string | null;
  destination_account_name: string | null;
  source_allocation_id: string | null;
  source_allocation_name: string | null;
  linked_transaction_id: string | null;
  system_generated: boolean;
};

export type CategorySpendingCurrencyTotal = {
  currency: string;
  income_total: number;
  expense_total: number;
  net: number;
};

export type BudgetMonthCurrencySummary = CategorySpendingCurrencyTotal & {
  transaction_count: number;
};

export type BudgetMonthSummary = {
  month: string;
  start_date: string;
  end_date: string;
  label: string;
  transaction_count: number;
  currencies: BudgetMonthCurrencySummary[];
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
  icon: string | null;
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

export type CategorySpendingCashFlow = {
  currency: string;
  income_total: number;
  /** Income minus P&L expenses (debt payments count only their interest). Same as the currency net. */
  pnl_net: number;
  /** Principal and extra principal of loan/mortgage payments, which pnl_net does not include. */
  debt_principal_paid: number;
  /**
   * Credit card repayments. Informational only: the purchases are already expenses, so repaying the card is not
   * subtracted again in cash_flow_net.
   */
  credit_card_payments: number;
  /** pnl_net minus debt_principal_paid: what really left or entered the wallets. */
  cash_flow_net: number;
  /**
   * Change of the savings wallets caused by this period's movements, in the source currency: transfers in minus
   * withdrawals, minus expenses and debt payments paid from them, plus income received there. Money that went into
   * a goal and was spent from it in the same period nets to zero.
   */
  net_savings: number;
  /** Spending in the investment envelope (the top-level category that contains the investment-purpose category). */
  invested: number;
  /** net_savings + invested. */
  total_saved: number;
  /**
   * True when the period's income is below 10% of its expenses (for example a month where only a few
   * transactions were recorded), so rates against it would be meaningless.
   */
  income_is_partial: boolean;
  /** total_saved as a percent of income in the same currency; null without meaningful income. */
  savings_rate: number | null;
};

export type CategorySpendingTransferFlow = {
  source_account_name: string | null;
  destination_account_name: string | null;
  source_currency: string;
  destination_currency: string | null;
  transaction_count: number;
  amount: number;
  destination_amount: number;
  /** destination_amount / amount, only when the currencies differ. */
  effective_rate: number | null;
};

export type CategorySpendingReport = {
  period: CategorySpendingPeriod;
  summary: BudgetMonthSummary;
  currencies: CategorySpendingCurrencyTotal[];
  envelopes: CategorySpendingNode[];
  income_categories: CategorySpendingNode[];
  uncategorized: UncategorizedSpendingGroup[];
  transfers: CategorySpendingTransaction[];
  cash_flow: CategorySpendingCashFlow[];
  transfer_flows: CategorySpendingTransferFlow[];
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

function getPeriodMonth(period: CategorySpendingPeriod) {
  return period.start_date.slice(0, 7);
}

function toReportTransaction(transaction: Transaction, categoriesById: Map<string, Category>): ReportTransaction {
  const category = transaction.category_id ? categoriesById.get(transaction.category_id) ?? null : null;
  const path = category ? getCategoryPath(category, categoriesById) : [];
  const currency = getTransactionCurrency(transaction);
  const analyticsAmount =
    transaction.kind === "transfer"
      ? (transaction.category_id ? Math.abs(transaction.amount) : 0)
      : getTransactionAnalyticsAmount(transaction);

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
    destination_amount: transaction.kind === "transfer" ? transaction.destination_amount ?? transaction.amount : null,
    destination_currency: transaction.kind === "transfer" ? transaction.destination_account?.currency ?? null : null,
    fx_rate: transaction.kind === "transfer" ? transaction.fx_rate ?? null : null,
    principal_paid:
      transaction.kind === "debt_payment"
        ? Math.abs(transaction.principal_amount ?? 0) + Math.abs(transaction.extra_principal_amount ?? 0)
        : null,
    category_id: transaction.category_id,
    category_path: path.map((item) => item.name),
    category_descriptions: path.map((item) => item.description ?? null),
    source_account_id: transaction.source_account_id,
    source_account_name: transaction.source_account?.name ?? null,
    destination_account_id: transaction.destination_account_id,
    destination_account_name: transaction.destination_account?.name ?? null,
    source_allocation_id: transaction.source_allocation_id ?? null,
    source_allocation_name: transaction.source_allocation?.name ?? null,
    linked_transaction_id: transaction.linked_transaction_id ?? null,
    system_generated: transaction.system_generated ?? false,
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
    icon: category.icon,
    path,
    totals: toCurrencyAmounts(amounts, options.currencyTotals, category.type),
    transaction_count: allTransactions.length,
    transactions: allTransactions,
    categories: children,
  };
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function buildCashFlow(
  transactions: Transaction[],
  reportTransactions: ReportTransaction[],
  currencies: CategorySpendingCurrencyTotal[],
  categories: Category[],
): CategorySpendingCashFlow[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const investmentRoots = new Set<string>();
  for (const category of categories) {
    if (category.purpose === "investment") investmentRoots.add(getRootCategory(category, categoriesById).id);
  }

  const principalByCurrency = new Map<string, number>();
  const cardPaymentsByCurrency = new Map<string, number>();
  const savingsByCurrency = new Map<string, number>();
  const investedByCurrency = new Map<string, number>();

  transactions.forEach((transaction, index) => {
    const reportTransaction = reportTransactions[index];
    const currency = reportTransaction.currency;
    const amount = Math.abs(transaction.amount);
    const sourceIsSaving = transaction.source_account?.type === "saving";
    const destinationIsSaving = transaction.destination_account?.type === "saving";

    if (transaction.kind === "debt_payment") {
      if (transaction.destination_account?.type === "credit_card") {
        addCurrencyAmount(cardPaymentsByCurrency, currency, amount);
      } else {
        addCurrencyAmount(principalByCurrency, currency, reportTransaction.principal_paid ?? 0);
      }
      if (sourceIsSaving) addCurrencyAmount(savingsByCurrency, currency, -amount);
      return;
    }

    if (transaction.kind === "expense") {
      if (sourceIsSaving) addCurrencyAmount(savingsByCurrency, currency, -amount);
      const category = transaction.category_id ? categoriesById.get(transaction.category_id) : undefined;
      if (category && investmentRoots.has(getRootCategory(category, categoriesById).id)) {
        addCurrencyAmount(investedByCurrency, currency, reportTransaction.analytics_amount);
      }
      return;
    }

    if (transaction.kind === "income") {
      if (destinationIsSaving) addCurrencyAmount(savingsByCurrency, currency, amount);
      return;
    }

    // Moves between savings wallets (including goal-to-goal) do not change what is saved.
    if (sourceIsSaving === destinationIsSaving) return;
    addCurrencyAmount(savingsByCurrency, currency, destinationIsSaving ? amount : -amount);
  });

  return currencies.map((total) => {
    const principal = principalByCurrency.get(total.currency) ?? 0;
    const netSavings = savingsByCurrency.get(total.currency) ?? 0;
    const invested = investedByCurrency.get(total.currency) ?? 0;
    const incomeIsPartial = total.income_total <= 0 || total.income_total < 0.1 * total.expense_total;

    return {
      currency: total.currency,
      income_total: round2(total.income_total),
      pnl_net: round2(total.net),
      debt_principal_paid: round2(principal),
      credit_card_payments: round2(cardPaymentsByCurrency.get(total.currency) ?? 0),
      cash_flow_net: round2(total.net - principal),
      net_savings: round2(netSavings),
      invested: round2(invested),
      total_saved: round2(netSavings + invested),
      income_is_partial: incomeIsPartial,
      savings_rate: incomeIsPartial ? null : percent(netSavings + invested, total.income_total),
    };
  });
}

function buildTransferFlows(transfers: ReportTransaction[]): CategorySpendingTransferFlow[] {
  const groups = new Map<string, CategorySpendingTransferFlow>();

  for (const transfer of transfers) {
    const key = [transfer.source_account_id, transfer.destination_account_id].join(">");
    const group = groups.get(key) ?? {
      source_account_name: transfer.source_account_name,
      destination_account_name: transfer.destination_account_name,
      source_currency: transfer.currency,
      destination_currency: transfer.destination_currency,
      transaction_count: 0,
      amount: 0,
      destination_amount: 0,
      effective_rate: null,
    };

    group.transaction_count += 1;
    group.amount += transfer.amount;
    group.destination_amount += transfer.destination_amount ?? transfer.amount;
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      amount: round2(group.amount),
      destination_amount: round2(group.destination_amount),
      effective_rate:
        group.destination_currency && group.destination_currency !== group.source_currency && group.amount > 0
          ? Number((group.destination_amount / group.amount).toFixed(6))
          : null,
    }))
    .sort((left, right) => right.amount - left.amount);
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
      transaction.occurred_at >= period.start_date &&
      transaction.occurred_at <= period.end_date,
  );
  const reportTransactions = periodTransactions.map((transaction) => toReportTransaction(transaction, categoriesById));
  const currencyTotals = new Map<string, CategorySpendingCurrencyTotal>();
  const transactionCountsByCurrency = new Map<string, number>();
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
    } else if (transaction.kind !== "transfer") {
      totals.expense_total += transaction.analytics_amount;
      totals.net -= transaction.analytics_amount;
    }

    currencyTotals.set(transaction.currency, totals);
    transactionCountsByCurrency.set(transaction.currency, (transactionCountsByCurrency.get(transaction.currency) ?? 0) + 1);

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

  const currencies = sortCurrencyTotals(Array.from(currencyTotals.values()));
  const transfers = reportTransactions.filter((transaction) => transaction.kind === "transfer");

  return {
    period,
    summary: {
      month: getPeriodMonth(period),
      start_date: period.start_date,
      end_date: period.end_date,
      label: period.label,
      transaction_count: reportTransactions.length,
      currencies: currencies.map((total) => ({
        ...total,
        transaction_count: transactionCountsByCurrency.get(total.currency) ?? 0,
      })),
    },
    currencies,
    envelopes,
    income_categories: incomeCategories,
    uncategorized,
    transfers,
    cash_flow: buildCashFlow(periodTransactions, reportTransactions, currencies, options.categories),
    transfer_flows: buildTransferFlows(transfers),
  };
}

export function buildBudgetMonthlySummaries(options: {
  transactions: Transaction[];
  currentMonth: Date;
  monthsShown?: number;
}): BudgetMonthSummary[] {
  const monthsShown = options.monthsShown ?? 13;

  return Array.from({ length: monthsShown }, (_, index) => {
    const month = addMonths(options.currentMonth, index - (monthsShown - 1));
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const period = {
      start_date: formatDate(start),
      end_date: formatDate(end),
      label: format(start, "MMMM yyyy"),
    };
    const periodTransactions = options.transactions.filter(
      (transaction) =>
        transaction.status === "paid" &&
        transaction.kind !== "transfer" &&
        transaction.occurred_at >= period.start_date &&
        transaction.occurred_at <= period.end_date,
    );
    const currencyTotals = new Map<string, BudgetMonthCurrencySummary>();

    for (const transaction of periodTransactions) {
      const currency = getTransactionCurrency(transaction);
      const amount = getTransactionAnalyticsAmount(transaction);
      const total = currencyTotals.get(currency) ?? {
        currency,
        income_total: 0,
        expense_total: 0,
        net: 0,
        transaction_count: 0,
      };

      if (transaction.kind === "income") {
        total.income_total += amount;
        total.net += amount;
      } else {
        total.expense_total += amount;
        total.net -= amount;
      }

      total.transaction_count += 1;
      currencyTotals.set(currency, total);
    }

    return {
      month: format(start, "yyyy-MM"),
      ...period,
      transaction_count: periodTransactions.length,
      currencies: sortCurrencyTotals(Array.from(currencyTotals.values())),
    };
  });
}

export function getCategoryRootId(categoryId: string, categories: Category[]) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const category = categoriesById.get(categoryId);
  return category ? getRootCategory(category, categoriesById).id : null;
}

export type CategorySpendingDetail = "summary" | "categories" | "full";

export const CATEGORY_SPENDING_DETAILS: CategorySpendingDetail[] = ["summary", "categories", "full"];
export const DEFAULT_REPORT_TRANSACTIONS_LIMIT = 200;
export const MAX_REPORT_TRANSACTIONS_LIMIT = 500;

export type CategoryBudgetStatus = {
  amount: number;
  currency: string;
  spent: number;
  remaining: number;
  percent_used: number | null;
};

export type CompactCategorySpendingNode = Omit<CategorySpendingNode, "transactions" | "categories" | "description"> & {
  description: string | null;
  /** Monthly budget stored in the category description, in the user's default currency. */
  budget_amount: number | null;
  /** Planned vs actual in the budget currency only; other currencies are never converted. */
  budget: CategoryBudgetStatus | null;
  categories: CompactCategorySpendingNode[];
};

export type CompactCategorySpendingTransaction = Omit<CategorySpendingTransaction, "category_descriptions">;

export type CompactCategorySpendingReport = {
  period: CategorySpendingPeriod;
  detail: CategorySpendingDetail;
  summary: BudgetMonthSummary;
  currencies: CategorySpendingCurrencyTotal[];
  envelopes: CompactCategorySpendingNode[];
  income_categories: CompactCategorySpendingNode[];
  uncategorized: Omit<UncategorizedSpendingGroup, "transactions">[];
  transfer_count: number;
  cash_flow: CategorySpendingCashFlow[];
  transfer_flows: CategorySpendingTransferFlow[];
  transactions?: {
    total: number;
    limit: number;
    offset: number;
    items: CompactCategorySpendingTransaction[];
  };
};

function compactNode(
  node: CategorySpendingNode,
  includeChildren: boolean,
  budgetCurrency: string | null,
): CompactCategorySpendingNode | null {
  const parsed = parseCategoryDescriptionAndBudget(node.description);
  // A budgeted category stays visible even when nothing was spent, so "remaining" is not lost.
  if (node.transaction_count === 0 && parsed.plannedBudget === null) return null;

  const { transactions: _transactions, categories, description: _description, ...rest } = node;
  void _transactions;
  void _description;

  let budget: CategoryBudgetStatus | null = null;
  if (parsed.plannedBudget !== null && budgetCurrency) {
    const spent = node.totals.find((total) => total.currency === budgetCurrency)?.amount ?? 0;
    budget = {
      amount: parsed.plannedBudget,
      currency: budgetCurrency,
      spent,
      remaining: Number((parsed.plannedBudget - spent).toFixed(2)),
      percent_used: parsed.plannedBudget > 0 ? Number(((spent / parsed.plannedBudget) * 100).toFixed(2)) : null,
    };
  }

  return {
    ...rest,
    description: parsed.description || null,
    budget_amount: parsed.plannedBudget,
    budget,
    categories: includeChildren
      ? categories
          .map((child) => compactNode(child, true, budgetCurrency))
          .filter((child): child is CompactCategorySpendingNode => child !== null)
      : [],
  };
}

function compactTransaction(transaction: CategorySpendingTransaction): CompactCategorySpendingTransaction {
  const { category_descriptions: _descriptions, ...rest } = transaction;
  void _descriptions;
  return rest;
}

/**
 * Shapes the full report into a payload that fits an LLM context:
 * - summary: period + totals + top-level envelopes/income (no subcategories)
 * - categories: pruned category tree with totals, no transaction rows (default)
 * - full: categories plus one flat, paginated, de-duplicated transaction list (transfers included)
 * Categories without activity are always dropped.
 */
function isSingleCalendarMonth(period: CategorySpendingPeriod) {
  const start = parseISO(period.start_date);
  return isValid(start) && period.start_date === formatDate(startOfMonth(start)) && period.end_date === formatDate(endOfMonth(start));
}

export function shapeCategorySpendingReport(
  report: CategorySpendingReport,
  options: {
    detail?: CategorySpendingDetail;
    includeTransactions?: boolean;
    limit?: number;
    offset?: number;
    budgetCurrency?: string | null;
  } = {},
): CompactCategorySpendingReport {
  const detail = options.detail ?? "categories";
  const includeTree = detail !== "summary";
  const includeTransactions = options.includeTransactions ?? detail === "full";
  const limit = Math.min(Math.max(Math.floor(options.limit ?? DEFAULT_REPORT_TRANSACTIONS_LIMIT), 1), MAX_REPORT_TRANSACTIONS_LIMIT);
  const offset = Math.max(Math.floor(options.offset ?? 0), 0);
  // A monthly budget only makes sense against exactly one complete calendar month.
  const budgetCurrency = isSingleCalendarMonth(report.period) ? options.budgetCurrency ?? null : null;

  const shaped: CompactCategorySpendingReport = {
    period: report.period,
    detail,
    summary: report.summary,
    currencies: report.currencies,
    envelopes: report.envelopes
      .map((node) => compactNode(node, includeTree, budgetCurrency))
      .filter((node): node is CompactCategorySpendingNode => node !== null),
    income_categories: report.income_categories
      .map((node) => compactNode(node, includeTree, budgetCurrency))
      .filter((node): node is CompactCategorySpendingNode => node !== null),
    uncategorized: report.uncategorized.map((group) => ({
      kind: group.kind,
      totals: group.totals,
      transaction_count: group.transaction_count,
    })),
    transfer_count: report.transfers.length,
    cash_flow: report.cash_flow,
    transfer_flows: report.transfer_flows,
  };

  if (includeTransactions) {
    const all = new Map<string, CategorySpendingTransaction>();
    for (const node of [...report.envelopes, ...report.income_categories]) {
      for (const transaction of node.transactions) all.set(transaction.id, transaction);
    }
    for (const group of report.uncategorized) {
      for (const transaction of group.transactions) all.set(transaction.id, transaction);
    }
    for (const transaction of report.transfers) all.set(transaction.id, transaction);

    const sorted = Array.from(all.values()).sort(
      (left, right) => right.occurred_at.localeCompare(left.occurred_at) || right.id.localeCompare(left.id),
    );
    shaped.transactions = {
      total: sorted.length,
      limit,
      offset,
      items: sorted.slice(offset, offset + limit).map(compactTransaction),
    };
  }

  return shaped;
}
