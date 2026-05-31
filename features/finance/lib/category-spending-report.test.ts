import { describe, expect, it } from "vitest";

import {
  buildBudgetMonthlySummaries,
  buildCategorySpendingReport,
  resolveCategorySpendingPeriod,
} from "@/features/finance/lib/category-spending-report";
import type { Account, Category, Transaction } from "@/types/finance";

const userId = "user-1";

const accounts: Account[] = [
  {
    id: "czk-cash",
    user_id: userId,
    name: "CZK Cash",
    type: "cash",
    cash_kind: "debit_card",
    debt_kind: null,
    balance: 0,
    credit_limit: null,
    currency: "CZK",
    created_at: "2026-01-01",
  },
  {
    id: "eur-cash",
    user_id: userId,
    name: "EUR Cash",
    type: "cash",
    cash_kind: "debit_card",
    debt_kind: null,
    balance: 0,
    credit_limit: null,
    currency: "EUR",
    created_at: "2026-01-01",
  },
];

const categories: Category[] = [
  {
    id: "income",
    user_id: userId,
    name: "Income",
    description: "All income.",
    icon: null,
    type: "income",
    parent_id: null,
    is_system: false,
    created_at: "2026-01-01",
  },
  {
    id: "salary",
    user_id: userId,
    name: "Salary",
    description: "Regular payroll.",
    icon: null,
    type: "income",
    parent_id: "income",
    is_system: false,
    created_at: "2026-01-01",
  },
  {
    id: "living",
    user_id: userId,
    name: "Living Costs",
    description: "Everyday baseline spending.",
    icon: null,
    type: "expense",
    parent_id: null,
    is_system: false,
    created_at: "2026-01-01",
  },
  {
    id: "groceries",
    user_id: userId,
    name: "Groceries",
    description: "Food and home basics.",
    icon: null,
    type: "expense",
    parent_id: "living",
    is_system: false,
    created_at: "2026-01-01",
  },
  {
    id: "wealth",
    user_id: userId,
    name: "Wealth",
    description: "Long-term capital.",
    icon: null,
    type: "expense",
    parent_id: null,
    is_system: false,
    created_at: "2026-01-01",
  },
  {
    id: "investments",
    user_id: userId,
    name: "Investments",
    description: "ETF buys.",
    icon: null,
    type: "expense",
    parent_id: "wealth",
    is_system: false,
    created_at: "2026-01-01",
  },
];

function account(id: string) {
  return accounts.find((item) => item.id === id) ?? null;
}

function category(id: string) {
  return categories.find((item) => item.id === id) ?? null;
}

function tx(values: {
  id: string;
  title: string;
  kind: Transaction["kind"];
  amount: number;
  occurred_at: string;
  status?: Transaction["status"];
  category_id?: string | null;
  source_account_id?: string | null;
  destination_account_id?: string | null;
}): Transaction {
  return {
    id: values.id,
    user_id: userId,
    title: values.title,
    note: null,
    occurred_at: values.occurred_at,
    created_at: values.occurred_at,
    status: values.status ?? "paid",
    kind: values.kind,
    amount: values.amount,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: values.kind === "debt_payment" ? values.amount : null,
    extra_principal_amount: null,
    category_id: values.category_id ?? null,
    source_account_id: values.source_account_id ?? null,
    destination_account_id: values.destination_account_id ?? null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    allocation_id: null,
    category: values.category_id ? category(values.category_id) : null,
    source_account: values.source_account_id ? account(values.source_account_id) : null,
    destination_account: values.destination_account_id ? account(values.destination_account_id) : null,
    schedule: null,
    allocation: null,
  };
}

describe("resolveCategorySpendingPeriod", () => {
  it("defaults to the last fully completed calendar month", () => {
    expect(resolveCategorySpendingPeriod({}, new Date("2026-05-20T12:00:00Z"))).toMatchObject({
      start_date: "2026-04-01",
      end_date: "2026-04-30",
    });
  });

  it("accepts explicit calendar months and custom ranges", () => {
    expect(resolveCategorySpendingPeriod({ month: "2026-02" })).toMatchObject({
      start_date: "2026-02-01",
      end_date: "2026-02-28",
    });

    expect(resolveCategorySpendingPeriod({ start_date: "2026-02-10", end_date: "2026-02-12" })).toMatchObject({
      start_date: "2026-02-10",
      end_date: "2026-02-12",
    });
  });

  it("rejects ambiguous or invalid ranges", () => {
    expect(() => resolveCategorySpendingPeriod({ month: "2026-02", start_date: "2026-02-01", end_date: "2026-02-28" })).toThrow(
      /either month/,
    );
    expect(() => resolveCategorySpendingPeriod({ start_date: "2026-02-01" })).toThrow(/both start_date/);
    expect(() => resolveCategorySpendingPeriod({ start_date: "2026-02-12", end_date: "2026-02-10" })).toThrow(/before or equal/);
  });
});

describe("buildCategorySpendingReport", () => {
  it("groups paid transactions by root envelopes with currency-separated percentages", () => {
    const report = buildCategorySpendingReport({
      categories,
      transactions: [
        tx({
          id: "salary-czk",
          title: "Salary",
          kind: "income",
          amount: 1000,
          occurred_at: "2026-04-05",
          category_id: "salary",
          destination_account_id: "czk-cash",
        }),
        tx({
          id: "groceries-czk",
          title: "Groceries",
          kind: "expense",
          amount: 250,
          occurred_at: "2026-04-06",
          category_id: "groceries",
          source_account_id: "czk-cash",
        }),
        tx({
          id: "investment-czk",
          title: "ETF",
          kind: "expense",
          amount: 150,
          occurred_at: "2026-04-07",
          category_id: "investments",
          source_account_id: "czk-cash",
        }),
        tx({
          id: "groceries-eur",
          title: "Groceries EUR",
          kind: "expense",
          amount: 20,
          occurred_at: "2026-04-08",
          category_id: "groceries",
          source_account_id: "eur-cash",
        }),
        tx({
          id: "planned",
          title: "Planned groceries",
          kind: "expense",
          amount: 999,
          occurred_at: "2026-04-09",
          status: "planned",
          category_id: "groceries",
          source_account_id: "czk-cash",
        }),
        tx({
          id: "transfer",
          title: "Internal transfer",
          kind: "transfer",
          amount: 500,
          occurred_at: "2026-04-10",
          source_account_id: "czk-cash",
          destination_account_id: "eur-cash",
        }),
        tx({
          id: "outside",
          title: "Old groceries",
          kind: "expense",
          amount: 999,
          occurred_at: "2026-03-31",
          category_id: "groceries",
          source_account_id: "czk-cash",
        }),
      ],
      period: { month: "2026-04" },
    });

    expect(report.currencies).toEqual([
      { currency: "CZK", income_total: 1000, expense_total: 400, net: 600 },
      { currency: "EUR", income_total: 0, expense_total: 20, net: -20 },
    ]);
    expect(report.summary).toEqual({
      month: "2026-04",
      start_date: "2026-04-01",
      end_date: "2026-04-30",
      label: "April 2026",
      transaction_count: 4,
      currencies: [
        { currency: "CZK", income_total: 1000, expense_total: 400, net: 600, transaction_count: 3 },
        { currency: "EUR", income_total: 0, expense_total: 20, net: -20, transaction_count: 1 },
      ],
    });

    const living = report.envelopes.find((item) => item.category_id === "living");
    expect(living?.totals).toEqual([
      { currency: "CZK", amount: 250, percent_of_income: 25, percent_of_total_expenses: 62.5 },
      { currency: "EUR", amount: 20, percent_of_income: null, percent_of_total_expenses: 100 },
    ]);
    expect(living?.transactions.map((item) => item.id)).toEqual(["groceries-eur", "groceries-czk"]);
    expect(living?.transactions[0].category_path).toEqual(["Living Costs", "Groceries"]);

    const wealth = report.envelopes.find((item) => item.category_id === "wealth");
    expect(wealth?.totals).toEqual([
      { currency: "CZK", amount: 150, percent_of_income: 15, percent_of_total_expenses: 37.5 },
    ]);
  });

  it("returns uncategorized paid income and expenses", () => {
    const report = buildCategorySpendingReport({
      categories,
      transactions: [
        tx({
          id: "cash-income",
          title: "Cash income",
          kind: "income",
          amount: 100,
          occurred_at: "2026-04-01",
          destination_account_id: "czk-cash",
        }),
        tx({
          id: "cash-expense",
          title: "Cash expense",
          kind: "expense",
          amount: 30,
          occurred_at: "2026-04-02",
          source_account_id: "czk-cash",
        }),
      ],
      period: { month: "2026-04" },
    });

    expect(report.uncategorized).toHaveLength(2);
    expect(report.uncategorized.find((item) => item.kind === "income")?.totals).toEqual([
      { currency: "CZK", amount: 100, percent_of_income: 100, percent_of_total_expenses: null },
    ]);
    expect(report.uncategorized.find((item) => item.kind === "expense")?.totals).toEqual([
      { currency: "CZK", amount: 30, percent_of_income: 30, percent_of_total_expenses: 100 },
    ]);
  });
});

describe("buildBudgetMonthlySummaries", () => {
  it("returns currency-separated positive, negative, and zero-net months", () => {
    const summaries = buildBudgetMonthlySummaries({
      currentMonth: new Date("2026-04-15T12:00:00Z"),
      monthsShown: 3,
      transactions: [
        tx({
          id: "feb-income",
          title: "Salary",
          kind: "income",
          amount: 1000,
          occurred_at: "2026-02-01",
          category_id: "salary",
          destination_account_id: "czk-cash",
        }),
        tx({
          id: "feb-expense",
          title: "Rent",
          kind: "expense",
          amount: 400,
          occurred_at: "2026-02-02",
          category_id: "groceries",
          source_account_id: "czk-cash",
        }),
        tx({
          id: "mar-expense",
          title: "Trip",
          kind: "expense",
          amount: 100,
          occurred_at: "2026-03-02",
          category_id: "groceries",
          source_account_id: "eur-cash",
        }),
        tx({
          id: "planned-mar",
          title: "Planned",
          kind: "expense",
          amount: 500,
          occurred_at: "2026-03-03",
          status: "planned",
          category_id: "groceries",
          source_account_id: "eur-cash",
        }),
        tx({
          id: "transfer-apr",
          title: "Transfer",
          kind: "transfer",
          amount: 200,
          occurred_at: "2026-04-01",
          source_account_id: "czk-cash",
          destination_account_id: "eur-cash",
        }),
      ],
    });

    expect(summaries.map((summary) => summary.month)).toEqual(["2026-02", "2026-03", "2026-04"]);
    expect(summaries[0].currencies).toEqual([
      { currency: "CZK", income_total: 1000, expense_total: 400, net: 600, transaction_count: 2 },
    ]);
    expect(summaries[1].currencies).toEqual([
      { currency: "EUR", income_total: 0, expense_total: 100, net: -100, transaction_count: 1 },
    ]);
    expect(summaries[2]).toMatchObject({
      month: "2026-04",
      transaction_count: 0,
      currencies: [],
    });
  });
});
