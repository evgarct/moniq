import { isSameMonth } from "date-fns";

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
  /** planned - spent; negative when over budget. Null without a plan or when spend is unavailable. */
  left: number | null;
  /** spent / planned in percent, uncapped; null without a plan. */
  percentUsed: number | null;
  status: EnvelopeBudgetStatus;
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
};

function statusFor(planned: number | null, spent: number | null): EnvelopeBudgetStatus {
  if (spent === null) return "unavailable";
  if (planned === null) return "unplanned";
  if (spent > planned) return "over";
  if (planned > 0 && spent / planned >= NEAR_BUDGET_RATIO) return "near";
  return "ok";
}

const STATUS_RANK: Record<EnvelopeBudgetStatus, number> = { over: 0, near: 1, ok: 2, unplanned: 3, unavailable: 4 };

/**
 * Over-budget envelopes first (most over first), then the ones closest to their plan, then the rest;
 * envelopes without a plan follow by spend, and envelopes with missing rates come last.
 */
export function compareEnvelopeBudgetRows(left: EnvelopeBudgetRow, right: EnvelopeBudgetRow) {
  const rank = STATUS_RANK[left.status] - STATUS_RANK[right.status];
  if (rank !== 0) return rank;

  if (left.status === "over") return (left.left ?? 0) - (right.left ?? 0);
  if (left.status === "near" || left.status === "ok") return (right.percentUsed ?? 0) - (left.percentUsed ?? 0);
  if (left.status === "unplanned") return (right.spent ?? 0) - (left.spent ?? 0);
  return left.name.localeCompare(right.name);
}

export function buildEnvelopeBudgetRows(options: {
  nodes: CategoryTreeNode[];
  categories: Category[];
  transactions: Transaction[];
  month: Date;
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
}): EnvelopeBudgetRow[] {
  return options.nodes
    .map((node): EnvelopeBudgetRow => {
      const parsed = parseCategoryDescriptionAndBudget(node.description);
      const total = getConvertedCategoryTotal({
        transactions: options.transactions,
        month: options.month,
        categoryIds: new Set([node.id, ...getCategoryDescendantIds(options.categories, node.id)]),
        targetCurrency: options.targetCurrency,
        exchangeRates: options.exchangeRates,
      });
      const planned = parsed.plannedBudget;
      const spent = total.amount;

      return {
        id: node.id,
        name: node.name,
        icon: node.icon,
        description: parsed.description,
        node,
        planned,
        spent,
        left: planned !== null && spent !== null ? Number((planned - spent).toFixed(2)) : null,
        percentUsed: planned !== null && planned > 0 && spent !== null ? Number(((spent / planned) * 100).toFixed(2)) : null,
        status: statusFor(planned, spent),
        missingCurrencies: total.missingCurrencies,
      };
    })
    .sort(compareEnvelopeBudgetRows);
}

/**
 * `uncategorizedExpense` is the converted spend of paid transactions that have no category; it belongs to no
 * envelope row, so it is added to the spend without a plan (null when a rate is missing).
 */
export function summarizeEnvelopeBudget(rows: EnvelopeBudgetRow[], uncategorizedExpense: number | null = 0): EnvelopeBudgetSummary {
  const planned = rows.reduce((sum, row) => sum + (row.planned ?? 0), 0);
  const available = uncategorizedExpense !== null && rows.every((row) => row.spent !== null);
  if (!available) {
    return { available, planned, spentPlanned: null, unplanned: null, spent: null, left: null };
  }

  const spentPlanned = rows.filter((row) => row.planned !== null).reduce((sum, row) => sum + (row.spent ?? 0), 0);
  const unplanned = rows.filter((row) => row.planned === null).reduce((sum, row) => sum + (row.spent ?? 0), 0) + (uncategorizedExpense ?? 0);

  return {
    available,
    planned,
    spentPlanned,
    unplanned,
    spent: spentPlanned + unplanned,
    left: Number((planned - spentPlanned).toFixed(2)),
  };
}

/** Sum of converted income across income envelopes; null when any rate is missing. */
export function sumEnvelopeSpend(rows: EnvelopeBudgetRow[]): number | null {
  if (rows.some((row) => row.spent === null)) return null;
  return rows.reduce((sum, row) => sum + (row.spent ?? 0), 0);
}

/**
 * Converted total of settled transactions in the month that have no category (imported or legacy rows).
 * Expenses include the interest of debt payments, matching the finance analytics rule. Null when a rate is missing.
 */
export function sumUncategorizedSpend(options: {
  transactions: Transaction[];
  month: Date;
  kind: "income" | "expense";
  targetCurrency: CurrencyCode;
  exchangeRates: ExchangeRate[];
}): number | null {
  let total = 0;

  for (const transaction of options.transactions) {
    if (
      transaction.category_id ||
      !isSettledTransactionStatus(transaction.status) ||
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
    });
    if (!conversion) continue;
    if (conversion.status === "missing_rate") return null;
    total += conversion.amount;
  }

  return total;
}
