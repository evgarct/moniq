import { describe, expect, it } from "vitest";

import { buildCategoryTrends, resolveTrendMonths } from "@/features/finance/lib/category-trends";
import { buildGoalHistory, reconcileGoal } from "@/features/finance/lib/goal-history";
import type { Account, Category, Transaction } from "@/types/finance";

const userId = "user-1";

const czk: Account = {
  id: "czk",
  user_id: userId,
  name: "CZK Cash",
  type: "cash",
  cash_kind: "debit_card",
  debt_kind: null,
  balance: 0,
  credit_limit: null,
  currency: "CZK",
  created_at: "2026-01-01",
};

function category(id: string, name: string, type: Category["type"], parent_id: string | null, description: string | null = null): Category {
  return { id, user_id: userId, name, description, icon: null, type, parent_id, is_system: false, created_at: "2026-01-01" };
}

const categories: Category[] = [
  category("income", "Income", "income", null),
  category("salary", "Salary", "income", "income"),
  category("living", "Living", "expense", null, "[budget: 1000] Everyday"),
  category("food", "Food", "expense", "living"),
  category("pets", "Pets", "expense", "living"),
];

function tx(id: string, kind: Transaction["kind"], amount: number, occurred_at: string, category_id: string): Transaction {
  const cat = categories.find((item) => item.id === category_id) ?? null;
  return {
    id,
    user_id: userId,
    title: id,
    note: null,
    occurred_at,
    created_at: occurred_at,
    status: "paid",
    kind,
    amount,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id,
    source_account_id: kind === "expense" ? "czk" : null,
    destination_account_id: kind === "income" ? "czk" : null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    allocation_id: null,
    category: cat,
    source_account: kind === "expense" ? czk : null,
    destination_account: kind === "income" ? czk : null,
    schedule: null,
    allocation: null,
  };
}

const transactions = [
  tx("salary-may", "income", 1000, "2026-05-05", "salary"),
  tx("salary-jun", "income", 1000, "2026-06-05", "salary"),
  tx("food-may", "expense", 100, "2026-05-06", "food"),
  tx("food-jun", "expense", 300, "2026-06-06", "food"),
  tx("pets-jun", "expense", 50, "2026-06-07", "pets"),
];

describe("resolveTrendMonths", () => {
  it("defaults to the last six complete months", () => {
    expect(resolveTrendMonths({}, new Date("2026-10-01T12:00:00Z"))).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("accepts explicit ranges and rejects invalid, reversed and too long ones", () => {
    expect(resolveTrendMonths({ start_month: "2026-05", end_month: "2026-06" })).toEqual(["2026-05", "2026-06"]);
    expect(() => resolveTrendMonths({ start_month: "2026-6", end_month: "2026-06" })).toThrow();
    expect(() => resolveTrendMonths({ start_month: "2026-07", end_month: "2026-06" })).toThrow();
    expect(() => resolveTrendMonths({ start_month: "2025-01", end_month: "2026-06" })).toThrow();
  });
});

describe("buildCategoryTrends", () => {
  const months = ["2026-05", "2026-06"];

  it("builds an envelope matrix aligned with the months", () => {
    const trends = buildCategoryTrends({ categories, transactions, months });
    const living = trends.rows.find((row) => row.name === "Living");

    expect(living).toMatchObject({ type: "expense", budget_amount: 1000 });
    expect(living?.series[0]).toEqual({ currency: "CZK", amounts: [100, 350], total: 450, average: 225, average_months: 2, percent_of_period_income: 22.5 });
    expect(trends.rows[0].type).toBe("income");
  });

  it("excludes an incomplete month from averages and rates", () => {
    const withPartialMonth = [
      tx("interest-apr", "income", 5, "2026-04-20", "salary"),
      tx("food-apr", "expense", 900, "2026-04-21", "food"),
      ...transactions,
    ];
    const trends = buildCategoryTrends({ categories, transactions: withPartialMonth, months: ["2026-04", "2026-05", "2026-06"] });
    const living = trends.rows.find((row) => row.name === "Living");

    expect(trends.partial_months).toEqual([{ currency: "CZK", months: ["2026-04"] }]);
    expect(living?.series[0]).toMatchObject({ amounts: [900, 100, 350], total: 1350, average: 225, average_months: 2 });
    expect(trends.monthly_summary[0]).toMatchObject({ month: "2026-04", income_is_partial: true, savings_rate: null });
  });

  it("can group by leaf category", () => {
    const trends = buildCategoryTrends({ categories, transactions, months, groupBy: "category" });

    expect(trends.rows.map((row) => row.name).sort()).toEqual(["Food", "Pets", "Salary"]);
    expect(trends.rows.find((row) => row.name === "Pets")?.series[0].amounts).toEqual([0, 50]);
  });

  it("returns a per-month, per-currency summary with cash flow and savings rate", () => {
    const trends = buildCategoryTrends({ categories, transactions, months });

    expect(trends.monthly_summary).toEqual([
      expect.objectContaining({ month: "2026-05", currency: "CZK", income_total: 1000, expense_total: 100, pnl_net: 900, cash_flow_net: 900 }),
      expect.objectContaining({ month: "2026-06", currency: "CZK", income_total: 1000, expense_total: 350, pnl_net: 650, cash_flow_net: 650 }),
    ]);
  });
});

describe("buildGoalHistory", () => {
  const months = ["2026-08", "2026-09"];
  const rows = [
    { id: "t1", status: "paid", kind: "transfer", occurred_at: "2026-08-09", title: "Fund", amount: 10000, destination_amount: 10000, destination_allocation_id: "goal", source_allocation_id: null },
    { id: "t2", status: "paid", kind: "transfer", occurred_at: "2026-09-09", title: "Fund", amount: 10000, destination_amount: 10000, destination_allocation_id: "goal", source_allocation_id: null },
    { id: "t3", status: "paid", kind: "transfer", occurred_at: "2026-09-12", title: "Release", amount: 2500, destination_amount: 2500, destination_allocation_id: null, source_allocation_id: "goal" },
    { id: "e1", status: "paid", kind: "expense", occurred_at: "2026-09-15", title: "Rent", amount: 1000, destination_allocation_id: "goal", source_allocation_id: null },
    { id: "x1", status: "paid", kind: "transfer", occurred_at: "2026-09-16", title: "Other goal", amount: 99, destination_amount: 99, destination_allocation_id: "other", source_allocation_id: null },
    { id: "p1", status: "planned", kind: "transfer", occurred_at: "2026-09-20", title: "Planned", amount: 77, destination_amount: 77, destination_allocation_id: "goal", source_allocation_id: null },
  ];

  it("summarises additions, withdrawals and spending per month for one goal", () => {
    const history = buildGoalHistory("goal", months, rows, "CZK");

    expect(history.months).toEqual([
      { month: "2026-08", added: 10000, withdrawn: 0, spent: 0, net: 10000 },
      { month: "2026-09", added: 10000, withdrawn: 2500, spent: 1000, net: 6500 },
    ]);
    expect(history.totals).toEqual({ added: 20000, withdrawn: 2500, spent: 1000, net: 16500 });
    expect(history.entries.map((entry) => entry.id)).toEqual(["e1", "t3", "t2", "t1"]);
    expect(history.entries[0]).toMatchObject({ direction: "out", currency: "CZK" });
    expect(history.entries_truncated).toBe(false);
  });

  it("reconciles the stored balance with every recorded movement", () => {
    const reconciliation = reconcileGoal("goal", 11024.44, rows);

    // 10000 + 10000 added, 2500 withdrawn, 1000 spent; the planned and other-goal rows are ignored
    expect(reconciliation).toEqual({ current_amount: 11024.44, tracked_net: 16500, untracked_difference: -5475.56 });
  });
});
