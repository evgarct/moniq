import { describe, expect, it } from "vitest";

import { resolveCategoryBudget } from "@/features/budget/lib/budget-analytics";
import { buildBudgetStatus } from "@/features/budget/lib/budget-status";
import {
  applyCategoryBudgetChange,
  clearCategoryBudgetOverrideRows,
  validateCategoryBudgetChange,
} from "@/features/budget/lib/category-budget-changes";
import type { Account, Category, CategoryBudgetRow, Transaction } from "@/types/finance";

const czk = { id: "czk", currency: "CZK" } as Account;
const enjoy = { id: "enjoy", description: "[budget: 9000] Fun" };

function category(id: string, name: string, description: string | null): Category {
  return { id, user_id: "u", name, description, icon: null, type: "expense", parent_id: null, is_system: false, created_at: "2026-01-01" } as Category;
}

function spend(id: string, amount: number, occurred_at: string): Transaction {
  return {
    id,
    title: id,
    kind: "expense",
    amount,
    status: "paid",
    occurred_at,
    category_id: "enjoy",
    source_account: czk,
    destination_account: null,
    source_account_id: "czk",
    destination_account_id: null,
    schedule_id: null,
  } as Transaction;
}

const change = (month: string, scope: "month" | "from", amount: number | null) => ({ categoryId: "enjoy", month, scope, amount });

describe("resolveCategoryBudget", () => {
  it("uses the description plan as the base for every month without layers", () => {
    expect(resolveCategoryBudget(enjoy, [], "2026-11")).toEqual({ amount: 9000, source: "base", baseAmount: 9000 });
    expect(resolveCategoryBudget(enjoy, undefined, "2026-11").amount).toBe(9000);
  });

  it("a one-month override changes only that month", () => {
    const rows = applyCategoryBudgetChange([], change("2026-11", "month", 49900));
    expect(resolveCategoryBudget(enjoy, rows, "2026-11")).toEqual({ amount: 49900, source: "override", baseAmount: 9000 });
    expect(resolveCategoryBudget(enjoy, rows, "2026-10").amount).toBe(9000);
    expect(resolveCategoryBudget(enjoy, rows, "2026-12")).toEqual({ amount: 9000, source: "base", baseAmount: 9000 });
  });

  it("'from this month' leaves earlier months untouched and keeps overrides on top", () => {
    let rows = applyCategoryBudgetChange([], change("2026-11", "month", 49900));
    rows = applyCategoryBudgetChange(rows, change("2026-12", "from", 13000));
    expect(resolveCategoryBudget(enjoy, rows, "2026-10").amount).toBe(9000);
    expect(resolveCategoryBudget(enjoy, rows, "2026-11")).toMatchObject({ amount: 49900, source: "override", baseAmount: 9000 });
    expect(resolveCategoryBudget(enjoy, rows, "2026-12")).toEqual({ amount: 13000, source: "base", baseAmount: 13000 });
    expect(resolveCategoryBudget(enjoy, rows, "2027-03").amount).toBe(13000);
  });

  it("the latest 'from' row at or before the month wins, and null means no plan from then on", () => {
    let rows = applyCategoryBudgetChange([], change("2026-12", "from", 13000));
    rows = applyCategoryBudgetChange(rows, change("2027-02", "from", null));
    expect(resolveCategoryBudget(enjoy, rows, "2027-01").amount).toBe(13000);
    expect(resolveCategoryBudget(enjoy, rows, "2027-02").amount).toBeNull();
    expect(resolveCategoryBudget(enjoy, rows, "2027-05").amount).toBeNull();
  });

  it("ignores layers of other categories", () => {
    const rows: CategoryBudgetRow[] = [{ category_id: "other", month: "2026-11-01", scope: "month", amount: 1 }];
    expect(resolveCategoryBudget(enjoy, rows, "2026-11").amount).toBe(9000);
  });
});

describe("category budget changes", () => {
  it("upserts by (category, month, scope), so a replay changes nothing", () => {
    const once = applyCategoryBudgetChange([], change("2026-11", "month", 49900));
    expect(applyCategoryBudgetChange(once, change("2026-11", "month", 49900))).toEqual(once);
    expect(applyCategoryBudgetChange(once, change("2026-11", "month", 50000))).toHaveLength(1);
  });

  it("rounds to cents and rejects invalid input", () => {
    expect(applyCategoryBudgetChange([], change("2026-11", "month", 10.126))[0].amount).toBe(10.13);
    expect(validateCategoryBudgetChange(change("2026-13", "month", 1))).toBe("month");
    expect(validateCategoryBudgetChange(change("2026-11", "month", -1))).toBe("amount");
    expect(validateCategoryBudgetChange(change("2026-11", "month", null))).toBe("amount");
    expect(validateCategoryBudgetChange(change("2026-11", "from", null))).toBeNull();
    expect(applyCategoryBudgetChange([], change("2026-11", "month", Number.NaN))).toEqual([]);
  });

  it("clearing removes only the month override and restores the base", () => {
    let rows = applyCategoryBudgetChange([], change("2026-12", "from", 13000));
    rows = applyCategoryBudgetChange(rows, change("2026-11", "month", 49900));
    rows = applyCategoryBudgetChange(rows, change("2026-12", "month", 20000));
    const cleared = clearCategoryBudgetOverrideRows(rows, "enjoy", "2026-12");
    expect(cleared).toHaveLength(2);
    expect(resolveCategoryBudget(enjoy, cleared, "2026-12").amount).toBe(13000);
    expect(resolveCategoryBudget(enjoy, cleared, "2026-11").amount).toBe(49900);
  });
});

describe("buildBudgetStatus with monthly budgets", () => {
  const categories = [category("enjoy", "Enjoy Life", "[budget: 9000]")];
  const transactions = [spend("oct", 4000, "2026-10-10"), spend("nov", 20000, "2026-11-10"), spend("dec", 5000, "2026-12-10")];

  const statusFor = (month: string, categoryBudgets: CategoryBudgetRow[]) =>
    buildBudgetStatus({
      categories,
      transactions: transactions.filter((transaction) => transaction.occurred_at.startsWith(month)),
      month: new Date(`${month}-01T00:00:00`),
      targetCurrency: "CZK",
      exchangeRates: [],
      categoryBudgets,
      today: new Date("2026-12-31T00:00:00"),
    }).envelopes[0];

  it("reports the override, its source and the base amount", () => {
    const rows = applyCategoryBudgetChange([], change("2026-11", "month", 49900));
    expect(statusFor("2026-11", rows)).toMatchObject({ planned: 49900, budget_source: "override", base_amount: 9000, status: "ok", left: 29900 });
    expect(statusFor("2026-12", rows)).toMatchObject({ planned: 9000, budget_source: "base", base_amount: 9000 });
  });

  it("'from December' 13 000 does not change October or November", () => {
    let rows = applyCategoryBudgetChange([], change("2026-11", "month", 49900));
    rows = applyCategoryBudgetChange(rows, change("2026-12", "from", 13000));
    expect(statusFor("2026-10", rows)).toMatchObject({ planned: 9000, budget_source: "base" });
    expect(statusFor("2026-11", rows)).toMatchObject({ planned: 49900, budget_source: "override" });
    expect(statusFor("2026-12", rows)).toMatchObject({ planned: 13000, budget_source: "base", base_amount: 13000 });
  });

  it("clearing the override returns the base while the spending history stays", () => {
    const rows = applyCategoryBudgetChange([], change("2026-11", "month", 49900));
    const cleared = clearCategoryBudgetOverrideRows(rows, "enjoy", "2026-11");
    const november = statusFor("2026-11", cleared);
    expect(november).toMatchObject({ planned: 9000, budget_source: "base", spent: 20000, status: "over" });
    expect(statusFor("2026-11", rows)).toMatchObject({ spent: 20000 });
  });
});
