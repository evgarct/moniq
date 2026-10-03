import { describe, expect, it } from "vitest";

import { budgetMonthRange, buildBudgetStatus, parseBudgetMonth } from "@/features/budget/lib/budget-status";
import type { Account, Category, ExchangeRate, Transaction } from "@/types/finance";

const czk = { id: "czk", currency: "CZK" } as Account;
const eur = { id: "eur", currency: "EUR" } as Account;
const month = new Date("2026-09-01T00:00:00");
const today = new Date("2026-09-15T00:00:00");

function category(id: string, name: string, parent_id: string | null, description: string | null = null, type: "expense" | "income" = "expense"): Category {
  return { id, user_id: "u", name, description, icon: null, type, parent_id, is_system: false, created_at: "2026-01-01" } as Category;
}

const categories = [
  category("living", "Living Costs", null, "[budget: 10000] Food and home"),
  category("groceries", "Groceries", "living"),
  category("bills", "Core Bills", null, "[budget: 5000]"),
  category("misc", "Misc", null),
  category("salary", "Salary", null, null, "income"),
];

function tx(id: string, amount: number, categoryId: string | null, options: Partial<Transaction> & { account?: Account } = {}): Transaction {
  const account = options.account ?? czk;
  return {
    id,
    title: id,
    kind: "expense",
    amount,
    status: "paid",
    occurred_at: "2026-09-10",
    category_id: categoryId,
    source_account: account,
    destination_account: null,
    source_account_id: account.id,
    destination_account_id: null,
    schedule_id: null,
    ...options,
  } as Transaction;
}

const eurToCzk: ExchangeRate = {
  provider: "frankfurter",
  base_currency: "EUR",
  quote_currency: "CZK",
  requested_date: "2026-09-01",
  rate_date: "2026-09-01",
  rate: 25,
  fetched_at: "2026-09-01T12:00:00Z",
};

describe("parseBudgetMonth", () => {
  it("defaults to the current month and rejects malformed input", () => {
    expect(parseBudgetMonth(undefined, today)).toEqual(new Date("2026-09-01T00:00:00"));
    expect(parseBudgetMonth("2026-02")).toEqual(new Date("2026-02-01T00:00:00"));
    expect(parseBudgetMonth("2026-13")).toBeNull();
    expect(parseBudgetMonth("2026-2")).toBeNull();
    expect(budgetMonthRange(new Date("2026-02-01T00:00:00"))).toEqual({ start_date: "2026-02-01", end_date: "2026-02-28" });
  });
});

describe("buildBudgetStatus", () => {
  it("matches the Budget screen: spent, upcoming, month-end forecast and planned operations", () => {
    const status = buildBudgetStatus({
      categories,
      transactions: [
        tx("food", 6000, "groceries"),
        tx("rent", 5000, "living", { status: "planned", occurred_at: "2026-09-20" }),
        tx("internet", 20, "bills", { status: "planned", occurred_at: "2026-09-05", account: eur }),
        tx("skipped", 999, "bills", { status: "skipped", occurred_at: "2026-09-25" }),
        tx("pay", 50000, "salary", { kind: "income", source_account: null, source_account_id: null, destination_account: czk, destination_account_id: "czk" }),
        tx("bonus", 3000, null, { kind: "income", status: "planned", occurred_at: "2026-09-28", source_account: null, source_account_id: null, destination_account: czk, destination_account_id: "czk" }),
      ],
      month,
      targetCurrency: "CZK",
      exchangeRates: [eurToCzk],
      today,
    });

    expect(status.month).toBe("2026-09");
    expect(status.envelopes[0]).toMatchObject({
      name: "Living Costs",
      planned: 10000,
      spent: 6000,
      upcoming: 5000,
      left: 4000,
      left_at_month_end: -1000,
      status: "ok",
      will_be_over: true,
    });
    expect(status.envelopes.find((row) => row.name === "Core Bills")).toMatchObject({ spent: 0, upcoming: 500, left_at_month_end: 4500 });
    expect(status.summary).toMatchObject({
      planned: 15000,
      spent_planned: 6000,
      upcoming_planned: 5500,
      left_at_month_end: 3500,
      income_received: 50000,
      income_expected: 3000,
    });
    expect(status.income).toEqual([{ category_id: "salary", name: "Salary", received: 50000, expected: 0 }]);
    expect(status.upcoming_operations.map((operation) => [operation.id, operation.overdue, operation.converted_amount])).toEqual([
      ["internet", true, 500],
      ["rent", false, 5000],
      ["bonus", false, 3000],
    ]);
    expect(status.upcoming_operations[0]).toMatchObject({ currency: "EUR", amount: 20, category_name: "Core Bills" });
  });

  it("publishes null instead of a partial total when a rate is missing", () => {
    const status = buildBudgetStatus({
      categories,
      transactions: [tx("trip", 100, "living", { account: eur })],
      month,
      targetCurrency: "CZK",
      exchangeRates: [],
      today,
    });

    expect(status.envelopes.find((row) => row.name === "Living Costs")).toMatchObject({ spent: null, status: "unavailable", missing_currencies: ["EUR"] });
    expect(status.summary).toMatchObject({ available: false, spent: null, left_at_month_end: null });
  });
});
