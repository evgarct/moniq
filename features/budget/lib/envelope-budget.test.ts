import { describe, expect, it } from "vitest";

import {
  buildEnvelopeBudgetRows,
  listMonthPlannedTransactions,
  summarizeEnvelopeBudget,
  sumEnvelopeSpend,
  sumUncategorizedSpend,
} from "@/features/budget/lib/envelope-budget";
import { buildCategoryTree } from "@/features/categories/lib/category-tree";
import type { Account, Category, ExchangeRate, Transaction } from "@/types/finance";

const czk = { id: "czk", currency: "CZK" } as Account;
const eur = { id: "eur", currency: "EUR" } as Account;
const month = new Date("2026-09-15T12:00:00");

function category(id: string, name: string, parent_id: string | null, description: string | null = null, type: "expense" | "income" = "expense"): Category {
  return { id, user_id: "u", name, description, icon: null, type, parent_id, is_system: false, created_at: "2026-01-01" } as Category;
}

const categories: Category[] = [
  category("enjoy", "Enjoy Life", null, "[budget: 30000] Fun"),
  category("tech", "Tech & Toys", "enjoy"),
  category("living", "Living Costs", null, "[budget: 10000]"),
  category("bills", "Core Bills", null, "[budget: 40000]"),
  category("misc", "Misc", null),
  category("salary", "Salary", null, null, "income"),
];

function expense(id: string, amount: number, categoryId: string, account: Account = czk, occurredAt = "2026-09-10"): Transaction {
  return {
    id,
    kind: "expense",
    amount,
    status: "paid",
    occurred_at: occurredAt,
    category_id: categoryId,
    source_account: account,
    destination_account: null,
    source_account_id: account.id,
    destination_account_id: null,
  } as Transaction;
}

function income(id: string, amount: number, categoryId: string): Transaction {
  return { ...expense(id, amount, categoryId), kind: "income", source_account: null, source_account_id: null, destination_account: czk, destination_account_id: "czk" } as Transaction;
}

const eurToCzk: ExchangeRate = {
  provider: "frankfurter",
  base_currency: "EUR",
  quote_currency: "CZK",
  requested_date: "2026-09-10",
  rate_date: "2026-09-10",
  rate: 25,
  fetched_at: "2026-09-10T12:00:00Z",
};

function build(transactions: Transaction[], exchangeRates: ExchangeRate[] = []) {
  const tree = buildCategoryTree(categories, transactions);
  return buildEnvelopeBudgetRows({
    nodes: tree.filter((node) => node.type === "expense"),
    categories,
    transactions,
    month,
    targetCurrency: "CZK",
    exchangeRates,
  });
}

describe("buildEnvelopeBudgetRows", () => {
  it("rolls subcategories up and reports left, percent and status", () => {
    const rows = build([
      expense("t1", 20000, "tech"),
      expense("t2", 28456, "enjoy"),
      expense("l1", 9000, "living"),
      expense("b1", 10000, "bills"),
      expense("m1", 500, "misc"),
    ]);

    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName["Enjoy Life"]).toMatchObject({ planned: 30000, spent: 48456, left: -18456, status: "over", description: "Fun" });
    expect(byName["Living Costs"]).toMatchObject({ planned: 10000, spent: 9000, left: 1000, percentUsed: 90, status: "near" });
    expect(byName["Core Bills"]).toMatchObject({ spent: 10000, left: 30000, percentUsed: 25, status: "ok" });
    expect(byName["Misc"]).toMatchObject({ planned: null, spent: 500, left: null, percentUsed: null, status: "unplanned" });
  });

  it("sorts over-budget first, then closest to plan, then unplanned", () => {
    const rows = build([
      expense("t1", 48456, "enjoy"),
      expense("l1", 9000, "living"),
      expense("b1", 10000, "bills"),
      expense("m1", 500, "misc"),
    ]);

    expect(rows.map((row) => row.name)).toEqual(["Enjoy Life", "Living Costs", "Core Bills", "Misc"]);
  });

  it("converts other currencies and never publishes a partial spend when a rate is missing", () => {
    const converted = build([expense("e1", 100, "living", eur)], [eurToCzk]);
    expect(converted.find((row) => row.name === "Living Costs")?.spent).toBe(2500);

    const missing = build([expense("e1", 100, "living", eur)]);
    const row = missing.find((entry) => entry.name === "Living Costs");
    expect(row).toMatchObject({ spent: null, left: null, status: "unavailable", missingCurrencies: ["EUR"] });
    expect(missing[missing.length - 1].status).toBe("unavailable");
  });

  it("ignores other months and keeps planned transactions out of the actual spend", () => {
    const rows = build([
      expense("old", 5000, "living", czk, "2026-08-10"),
      { ...expense("planned", 5000, "living"), status: "planned" } as Transaction,
    ]);

    expect(rows.find((row) => row.name === "Living Costs")).toMatchObject({ spent: 0, upcoming: 5000, forecast: 5000, forecastLeft: 5000 });
  });
});

describe("forecast with planned transactions", () => {
  const planned = (id: string, amount: number, categoryId: string, account: Account = czk, occurredAt = "2026-09-25") =>
    ({ ...expense(id, amount, categoryId, account, occurredAt), status: "planned" }) as Transaction;

  it("adds upcoming spend to the forecast and flags envelopes the plan will not cover", () => {
    const rows = build([expense("l1", 6000, "living"), planned("l2", 5000, "living"), planned("b1", 1000, "bills")]);
    const living = rows.find((row) => row.name === "Living Costs");

    expect(living).toMatchObject({ spent: 6000, upcoming: 5000, forecast: 11000, left: 4000, forecastLeft: -1000, status: "ok", atRisk: true });
    expect(rows[0].name).toBe("Living Costs");
  });

  it("ignores skipped occurrences and other months", () => {
    const rows = build([
      { ...planned("s1", 4000, "living"), status: "skipped" } as Transaction,
      planned("next", 4000, "living", czk, "2026-10-02"),
    ]);

    expect(rows.find((row) => row.name === "Living Costs")).toMatchObject({ upcoming: 0, atRisk: false });
  });

  it("converts future planned amounts with the latest known rate and reports missing ones", () => {
    const inMonth = build([planned("e1", 100, "living", eur)], [eurToCzk]);
    expect(inMonth.find((row) => row.name === "Living Costs")?.upcoming).toBe(2500);

    const missing = build([planned("e1", 100, "living", eur)]);
    expect(missing.find((row) => row.name === "Living Costs")).toMatchObject({ spent: 0, upcoming: null, forecast: null, missingCurrencies: ["EUR"] });
  });

  it("summarizes upcoming spend and the month-end forecast", () => {
    const rows = build([expense("l1", 6000, "living"), planned("l2", 2000, "living"), planned("m1", 700, "misc")]);
    const summary = summarizeEnvelopeBudget(rows, 0, 300);

    expect(summary).toMatchObject({ planned: 80000, spentPlanned: 6000, upcomingPlanned: 2000, upcoming: 3000, forecastLeft: 72000 });
  });

  it("sums uncategorized planned spend separately from paid spend", () => {
    const transactions = [
      { ...planned("u1", 300, "misc"), category_id: null } as Transaction,
      { ...expense("u2", 200, "misc"), category_id: null } as Transaction,
    ];

    expect(sumUncategorizedSpend({ transactions, month, kind: "expense", targetCurrency: "CZK", exchangeRates: [], status: "planned" })).toBe(300);
    expect(sumUncategorizedSpend({ transactions, month, kind: "expense", targetCurrency: "CZK", exchangeRates: [] })).toBe(200);
  });
});

describe("listMonthPlannedTransactions", () => {
  it("splits the month's planned transactions into overdue and upcoming, oldest first", () => {
    const planned = (id: string, date: string, status: Transaction["status"] = "planned") =>
      ({ ...expense(id, 10, "living", czk, date), status }) as Transaction;
    // `today` is injected, so the split does not depend on the real clock.
    const today = new Date("2026-09-15T00:00:00");

    const result = listMonthPlannedTransactions(
      [
        planned("late", "2026-09-30"),
        planned("today", "2026-09-15"),
        planned("paid", "2026-09-20", "paid"),
        planned("first", "2026-09-01"),
        planned("skip", "2026-09-18", "skipped"),
        planned("next", "2026-10-01"),
      ],
      month,
      today,
    );

    expect(result.overdue.map((transaction) => transaction.id)).toEqual(["first"]);
    expect(result.upcoming.map((transaction) => transaction.id)).toEqual(["today", "late"]);
  });
});

describe("summarizeEnvelopeBudget", () => {
  it("splits planned and unplanned spend so they add up to the total", () => {
    const rows = build([
      expense("t1", 48456, "enjoy"),
      expense("l1", 9000, "living"),
      expense("m1", 500, "misc"),
    ]);
    const summary = summarizeEnvelopeBudget(rows);

    expect(summary).toEqual({
      available: true,
      planned: 80000,
      spentPlanned: 57456,
      unplanned: 500,
      spent: 57956,
      left: 22544,
      upcomingPlanned: 0,
      upcoming: 0,
      forecastLeft: 22544,
    });
    expect(summary.spentPlanned! + summary.unplanned!).toBe(summary.spent);
  });

  it("is unavailable when any envelope lacks an FX rate", () => {
    const summary = summarizeEnvelopeBudget(build([expense("e1", 100, "living", eur)]));

    expect(summary).toMatchObject({ available: false, spent: null, left: null });
  });
});

describe("sumEnvelopeSpend", () => {
  it("sums converted income and returns null when a rate is missing", () => {
    const transactions = [income("i1", 100000, "salary"), income("i2", 4000, "salary")];
    const tree = buildCategoryTree(categories, transactions).filter((node) => node.type === "income");
    const rows = buildEnvelopeBudgetRows({ nodes: tree, categories, transactions, month, targetCurrency: "CZK", exchangeRates: [] });

    expect(sumEnvelopeSpend(rows)).toBe(104000);
  });
});

describe("uncategorized spend", () => {
  const uncategorized = (id: string, amount: number, account: Account = czk) => ({ ...expense(id, amount, "misc", account), category_id: null }) as Transaction;

  it("sums paid expenses without a category and adds them to the spend without a plan", () => {
    const transactions = [uncategorized("u1", 300), uncategorized("u2", 200), expense("m1", 500, "misc")];
    const total = sumUncategorizedSpend({ transactions, month, kind: "expense", targetCurrency: "CZK", exchangeRates: [] });
    expect(total).toBe(500);

    const rows = build([expense("l1", 9000, "living")]);
    const summary = summarizeEnvelopeBudget(rows, total);
    expect(summary).toMatchObject({ unplanned: 500, spentPlanned: 9000, spent: 9500 });
  });

  it("counts uncategorized income separately and ignores other months and other kinds", () => {
    const transactions = [
      { ...uncategorized("i1", 1000), kind: "income" } as Transaction,
      { ...uncategorized("old", 400, czk), occurred_at: "2026-08-10" } as Transaction,
      { ...uncategorized("tr", 50), kind: "transfer" } as Transaction,
    ];

    expect(sumUncategorizedSpend({ transactions, month, kind: "income", targetCurrency: "CZK", exchangeRates: [] })).toBe(1000);
    expect(sumUncategorizedSpend({ transactions, month, kind: "expense", targetCurrency: "CZK", exchangeRates: [] })).toBe(0);
  });

  it("is unavailable when a rate is missing", () => {
    const total = sumUncategorizedSpend({ transactions: [uncategorized("e1", 10, eur)], month, kind: "expense", targetCurrency: "CZK", exchangeRates: [] });

    expect(total).toBeNull();
    expect(summarizeEnvelopeBudget(build([]), total)).toMatchObject({ available: false, spent: null });
  });
});
