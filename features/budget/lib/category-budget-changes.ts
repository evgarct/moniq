import { roundMoney } from "@/features/budget/lib/envelope-budget";
import type { CategoryBudgetRow, CategoryBudgetScope } from "@/types/finance";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A budget edit for one category and one month. "month" overrides that month only; "from" is a new base from it on. */
export type CategoryBudgetChange = {
  categoryId: string;
  /** YYYY-MM */
  month: string;
  scope: CategoryBudgetScope;
  /** Non-negative; null is only valid for scope "from" (no plan from that month on). */
  amount: number | null;
};

export function isBudgetMonth(value: string) {
  return MONTH_PATTERN.test(value);
}

export function budgetMonthStart(month: string) {
  return `${month}-01`;
}

/** Returns an error code for an invalid change, or null. Month overrides always need an amount. */
export function validateCategoryBudgetChange(change: CategoryBudgetChange): "month" | "amount" | null {
  if (!isBudgetMonth(change.month)) return "month";
  if (change.amount === null) return change.scope === "from" ? null : "amount";
  if (!Number.isFinite(change.amount) || change.amount < 0) return "amount";
  return null;
}

function sameLayer(row: CategoryBudgetRow, categoryId: string, monthStart: string, scope: CategoryBudgetScope) {
  return row.category_id === categoryId && row.month === monthStart && row.scope === scope;
}

/** Upserts the layer, keyed by (category, month, scope) like the unique constraint, so replays change nothing. */
export function applyCategoryBudgetChange(rows: CategoryBudgetRow[], change: CategoryBudgetChange): CategoryBudgetRow[] {
  if (validateCategoryBudgetChange(change)) return rows;
  const monthStart = budgetMonthStart(change.month);
  const amount = change.amount === null ? null : roundMoney(change.amount);
  const next: CategoryBudgetRow = { category_id: change.categoryId, month: monthStart, scope: change.scope, amount };
  const exists = rows.some((row) => sameLayer(row, change.categoryId, monthStart, change.scope));
  return exists
    ? rows.map((row) => (sameLayer(row, change.categoryId, monthStart, change.scope) ? next : row))
    : [...rows, next];
}

/** Removes only the month override; the base layers (and so every other month) stay untouched. */
export function clearCategoryBudgetOverrideRows(rows: CategoryBudgetRow[], categoryId: string, month: string): CategoryBudgetRow[] {
  const monthStart = budgetMonthStart(month);
  return rows.filter((row) => !sameLayer(row, categoryId, monthStart, "month"));
}
