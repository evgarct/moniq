import { isBefore, isSameMonth, parseISO, startOfToday } from "date-fns";

import { getConvertedCategoryTotal, parseCategoryDescriptionAndBudget } from "@/features/budget/lib/budget-analytics";
import { convertTransactionAnalyticsAmount } from "@/features/finance/lib/exchange-rates";
import { getCategoryDescendantIds } from "@/features/categories/lib/category-tree";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { CurrencyCode } from "@/types/currency";
import type { Category, CategoryTreeNode, ExchangeRate, Transaction } from "@/types/finance";

/** Share of the plan at which an envelope is flagged as "near". */
export const NEAR_BUDGET_RATIO = 0.85;

export type EnvelopeBudgetStatus = "ok" | "near" | "over" | "unplanned" | "unavailable";

export type EnvelopeBudgetRow = {
  id: string;
  name: string;
  icon: string | null;
  description: string;
  node: CategoryTreeNode;
  /** Monthly plan in the default currency; null when no budget is set. */
  planned: number | null;
  /** Converted spend of the envelope and all its subcategories; null when an FX rate is missing. */
  spent: number | null;
  /** Converted planned (not yet paid) transactions of the month; null when an FX rate is missing. */
  upcoming: number | null;
  /** spent + upcoming: where the envelope ends the month; null when either part is unavailable. */
  forecast: number | null;
  /** planned - spent; negative when over budget. Null without a plan or when spend is unavailable. */
  left: number | null;
  /** planned - forecast: what is left once the upcoming transactions are paid. */
  forecastLeft: number | null;
  /** spent / planned in percent, uncapped; null without a plan. */
  percentUsed: number | null;
  /** Status of the actual spend. */
  status: EnvelopeBudgetStatus;
  /** Not over yet, but the upcoming transactions will take the envelope over its plan. */
  atRisk: boolean;
  missingCurrencies: CurrencyCode[];
};

export type EnvelopeBudgetSummary = {
  /** False when at least one envelope has no usable FX rate, so spend totals are not published. */
  available: boolean;
  planned: number;
  /** Spend of the envelopes that have a plan. */
  spentPlanned: number | null;
  /** Spend of the envelopes without a plan. */
  unplanned: number | null;
  /** spentPlanned + unplanned. */
  spent: number | null;
  /** planned - spentPlanned; negative when the planned envelopes are over budget in total. */
  left: number | null;
  /** Upcoming (planned, not yet paid) expenses in the envelopes that have a plan. */
  upcomingPlanned: number | null;
  /** All upcoming expenses of the month, with or without a plan. */
  upcoming: number | null;
  /** planned - spentPlanned - upcomingPlanned: what the planned envelopes keep at month end. */
  forecastLeft: number | null;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

function statusFor(planned: number | null, spent: number | null): EnvelopeBudgetStatus {
  if (spent === null) return "unavailable";
  if (planned === null) return "unplanned";
  if (spent > planned) return "over";
  if (planned > 0 && spent / planned >= NEAR_BUDGET_RATIO) return "near";
  return "ok";
}

const STATUS_RANK: Record<EnvelopeBudgetStatus, number> = { over: 0, near: 2, ok: 3, unplanned: 4, unavailable: 5 };

function rankOf(row: EnvelopeBudgetRow) {
  // Envelopes the upcoming transactions will push over the plan sort right after the ones already over.
  return row.atRisk ? 1 : STATUS_RANK[row.status];
}

/**
 * Over-budget envelopes first (most over first), then the ones the upcoming transactions will take over,
 * then the ones closest to their plan; envelopes without a plan follow by spend, and envelopes with missing
 * rates come last.
 */
export function compareEnvelopeBudgetRows(left: EnvelopeBudgetRow, right: EnvelopeBudgetRow) {
  const rank = rankOf(left) - rankOf(right);
  if (rank !== 0) return rank;

  if (left.status === "over") return (left.left ?? 0) - (right.left ?? 0);
  if (left.atRisk) return (left.forecastLeft ?? 0) - (right.forecastLeft ?? 0);
  if (left.status === "near" || left.status === "ok") return (right.percentUsed ?? 0) - (left.percentUsed ?? 0);
  if (left.status === "unplanned") return (right.forecast ?? right.spent ?? 0) - (left.forecast ?? left.spent ?? 0);
  return left.name.localeCompare(right.name);
}

export function buildEnvelopeBudgetRows(options: {
  nodes: CategoryTreeNode[];
  categories: Category[];
  /** Paid and planned transactions; skipped ones and other months are ignored. */
  transactions: Transaction[];
  month: Date;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
}): EnvelopeBudgetRow[] {
  return options.nodes
    .map((node): EnvelopeBudgetRow => {
      const parsed = parseCategoryDescriptionAndBudget(node.description);
      const totalOptions = {
        transactions: options.transactions,
        month: options.month,
        categoryIds: new Set([node.id, ...getCategoryDescendantIds(options.categories, node.id)]),
        targetCurrency: options.targetCurrency,
        exchangeRates: options.exchangeRates,
      };
      const paid = getConvertedCategoryTotal(totalOptions);
      const pending = getConvertedCategoryTotal({ ...totalOptions, status: "planned" });
      const planned = parsed.plannedBudget;
      const spent = paid.amount;
      const upcoming = pending.amount;
      const forecast = spent !== null && upcoming !== null ? roundMoney(spent + upcoming) : null;
      const forecastLeft = planned !== null && forecast !== null ? roundMoney(planned - forecast) : null;
      const status = statusFor(planned, spent);

      return {
        id: node.id,
        name: node.name,
        icon: node.icon,
        description: parsed.description,
        node,
        planned,
        spent,
        upcoming,
        forecast,
        left: planned !== null && spent !== null ? roundMoney(planned - spent) : null,
        forecastLeft,
        percentUsed: planned !== null && planned > 0 && spent !== null ? roundMoney((spent / planned) * 100) : null,
        status,
        atRisk: status !== "over" && status !== "unavailable" && forecastLeft !== null && forecastLeft < 0,
        missingCurrencies: Array.from(new Set([...paid.missingCurrencies, ...pending.missingCurrencies])).sort(),
      };
    })
    .sort(compareEnvelopeBudgetRows);
}

/**
 * `uncategorized` is the converted spend of transactions that have no category; it belongs to no envelope
 * row, so it is added to the spend (and upcoming spend) without a plan (null when a rate is missing).
 */
export function summarizeEnvelopeBudget(
  rows: EnvelopeBudgetRow[],
  uncategorizedExpense: number | null = 0,
  uncategorizedUpcoming: number | null = 0,
): EnvelopeBudgetSummary {
  const planned = rows.reduce((sum, row) => sum + (row.planned ?? 0), 0);
  const available = uncategorizedExpense !== null && rows.every((row) => row.spent !== null);
  const upcomingAvailable = available && uncategorizedUpcoming !== null && rows.every((row) => row.upcoming !== null);

  if (!available) {
    return { available, planned, spentPlanned: null, unplanned: null, spent: null, left: null, upcomingPlanned: null, upcoming: null, forecastLeft: null };
  }

  const withPlan = rows.filter((row) => row.planned !== null);
  const withoutPlan = rows.filter((row) => row.planned === null);
  const spentPlanned = withPlan.reduce((sum, row) => sum + (row.spent ?? 0), 0);
  const unplanned = withoutPlan.reduce((sum, row) => sum + (row.spent ?? 0), 0) + (uncategorizedExpense ?? 0);
  const upcomingPlanned = upcomingAvailable ? roundMoney(withPlan.reduce((sum, row) => sum + (row.upcoming ?? 0), 0)) : null;
  const upcoming = upcomingAvailable
    ? roundMoney(rows.reduce((sum, row) => sum + (row.upcoming ?? 0), 0) + (uncategorizedUpcoming ?? 0))
    : null;

  return {
    available,
    planned,
    spentPlanned,
    unplanned,
    spent: spentPlanned + unplanned,
    left: roundMoney(planned - spentPlanned),
    upcomingPlanned,
    upcoming,
    forecastLeft: upcomingPlanned === null ? null : roundMoney(planned - spentPlanned - upcomingPlanned),
  };
}

/** Sum of converted income across income envelopes; null when any rate is missing. */
export function sumEnvelopeSpend(rows: EnvelopeBudgetRow[]): number | null {
  if (rows.some((row) => row.spent === null)) return null;
  return rows.reduce((sum, row) => sum + (row.spent ?? 0), 0);
}

/** Sum of upcoming (planned) amounts across envelopes; null when any rate is missing. */
export function sumEnvelopeUpcoming(rows: EnvelopeBudgetRow[]): number | null {
  if (rows.some((row) => row.upcoming === null)) return null;
  return roundMoney(rows.reduce((sum, row) => sum + (row.upcoming ?? 0), 0));
}

/**
 * Converted total of transactions in the month that have no category (imported or legacy rows): paid ones by
 * default, planned ones with `status: "planned"`. Expenses include the interest of debt payments, matching the
 * finance analytics rule. Null when a rate is missing.
 */
export function sumUncategorizedSpend(options: {
  transactions: Transaction[];
  month: Date;
  kind: "income" | "expense";
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
  status?: "paid" | "planned";
}): number | null {
  const status = options.status ?? "paid";
  let total = 0;

  for (const transaction of options.transactions) {
    const matchesStatus = status === "paid" ? isSettledTransactionStatus(transaction.status) : transaction.status === "planned";
    if (
      transaction.category_id ||
      !matchesStatus ||
      !isSameMonth(new Date(`${transaction.occurred_at}T12:00:00`), options.month)
    ) {
      continue;
    }

    const matchesKind =
      options.kind === "income" ? transaction.kind === "income" : transaction.kind === "expense" || transaction.kind === "debt_payment";
    if (!matchesKind) continue;

    const conversion = convertTransactionAnalyticsAmount({
      transaction,
      targetCurrency: options.targetCurrency,
      exchangeRates: options.exchangeRates,
      includePlanned: status === "planned",
    });
    if (!conversion) continue;
    if (conversion.status === "missing_rate") return null;
    total += conversion.amount;
  }

  return roundMoney(total);
}

export type MonthPlannedTransactions = {
  /** Planned transactions dated before today that are still unpaid. */
  overdue: Transaction[];
  /** Planned transactions from today to the end of the month. */
  upcoming: Transaction[];
};

/** Planned, not yet paid transactions of the month, oldest first, split into overdue and upcoming. */
export function listMonthPlannedTransactions(transactions: Transaction[], month: Date, today = startOfToday()): MonthPlannedTransactions {
  const planned = transactions
    .filter((transaction) => transaction.status === "planned" && isSameMonth(parseISO(transaction.occurred_at), month))
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));

  return {
    overdue: planned.filter((transaction) => isBefore(parseISO(transaction.occurred_at), today)),
    upcoming: planned.filter((transaction) => !isBefore(parseISO(transaction.occurred_at), today)),
  };
}
