import { describe, expect, it } from "vitest";

import type { CurrencyCode } from "@/types/currency";
import type { Account, Category, InvestmentPosition } from "@/types/finance";
import type { TransactionInput } from "@/types/finance-schemas";

import { validateTransactionRelationships } from "./transaction-utils";

const EUR = "EUR" as CurrencyCode;

function account(id: string, type: Account["type"]): Account {
  return {
    id,
    user_id: "user",
    name: id,
    type,
    cash_kind: type === "cash" ? "debit_card" : null,
    debt_kind: type === "debt" ? "personal" : null,
    balance: type === "cash" || type === "saving" ? 1000 : -1000,
    credit_limit: type === "credit_card" ? 5000 : null,
    currency: EUR,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const categories: Category[] = [{
  id: "cat-expense",
  user_id: "user",
  name: "Interest",
  description: null,
  icon: null,
  type: "expense",
  parent_id: null,
  is_system: false,
  created_at: "2026-01-01T00:00:00Z",
}];

const investmentCategories: Category[] = [
  ...categories,
  { ...categories[0], id: "investments", name: "Investments", purpose: "investment" },
  { ...categories[0], id: "etf-child", name: "ETFs", parent_id: "investments" },
];
const positions = [{
  instrument_id: "etf-position",
  instrument: { id: "etf-position", type: "etf" },
}] as InvestmentPosition[];

function debtPayment(destinationAccountId: string): TransactionInput {
  return {
    title: "Debt payment",
    note: null,
    occurred_at: "2026-06-17",
    status: "paid",
    kind: "debt_payment",
    amount: 100,
    destination_amount: null,
    fx_rate: null,
    principal_amount: 100,
    interest_amount: 0,
    extra_principal_amount: 0,
    category_id: null,
    source_account_id: "cash",
    destination_account_id: destinationAccountId,
    allocation_id: null,
    investment_instrument_id: null,
    investment_units: null,
  };
}

describe("validateTransactionRelationships", () => {
  const accounts = [
    account("cash", "cash"),
    account("loan", "debt"),
    account("card", "credit_card"),
    account("savings", "saving"),
  ];

  it("accepts debt payments to debts and credit cards", () => {
    expect(() =>
      validateTransactionRelationships(debtPayment("loan"), { accounts, categories }),
    ).not.toThrow();
    expect(() =>
      validateTransactionRelationships(debtPayment("card"), { accounts, categories }),
    ).not.toThrow();
  });

  it("rejects debt payments to ordinary destination accounts", () => {
    expect(() =>
      validateTransactionRelationships(debtPayment("savings"), { accounts, categories }),
    ).toThrow("Debt payment must target a debt or credit card account.");
  });

  it("accepts an ETF purchase in a descendant of the investment category", () => {
    expect(() => validateTransactionRelationships({
      ...debtPayment("loan"),
      kind: "expense",
      amount: 100,
      principal_amount: null,
      interest_amount: null,
      extra_principal_amount: null,
      destination_account_id: null,
      category_id: "etf-child",
      investment_instrument_id: "etf-position",
      investment_units: 1.5,
    }, { accounts, categories: investmentCategories, investment_positions: positions })).not.toThrow();
  });

  it("rejects linked purchases outside the investment branch", () => {
    expect(() => validateTransactionRelationships({
      ...debtPayment("loan"),
      kind: "expense",
      principal_amount: null,
      interest_amount: null,
      extra_principal_amount: null,
      destination_account_id: null,
      category_id: "cat-expense",
      investment_instrument_id: "etf-position",
      investment_units: 1,
    }, { accounts, categories: investmentCategories, investment_positions: positions })).toThrow(
      "Investment purchases must use the investment category.",
    );
  });

  it("validates allocation relationship for expenses and transfers", () => {
    const allocations = [
      {
        id: "alloc-savings",
        user_id: "user-1",
        wallet_id: "savings",
        name: "Savings Goal",
        kind: "goal_open" as const,
        amount: 100,
        target_amount: null,
        created_at: "",
        updated_at: "",
        sync_version: 1,
      },
    ];

    // Valid expense with goal belonging to source account
    expect(() =>
      validateTransactionRelationships(
        {
          ...debtPayment("savings"),
          title: "Expense Goal",
          kind: "expense",
          amount: 50,
          category_id: "cat-expense",
          source_account_id: "savings",
          destination_account_id: null,
          allocation_id: "alloc-savings",
        },
        { accounts, categories, allocations },
      ),
    ).not.toThrow();

    // Valid transfer with goal belonging to destination account
    expect(() =>
      validateTransactionRelationships(
        {
          ...debtPayment("savings"),
          title: "Transfer Goal",
          kind: "transfer",
          amount: 50,
          category_id: null,
          source_account_id: "cash",
          destination_account_id: "savings",
          allocation_id: "alloc-savings",
        },
        { accounts, categories, allocations },
      ),
    ).not.toThrow();

    // Invalid: expense goal doesn't belong to source account
    expect(() =>
      validateTransactionRelationships(
        {
          ...debtPayment("savings"),
          title: "Expense Goal Mismatch",
          kind: "expense",
          amount: 50,
          category_id: "cat-expense",
          source_account_id: "cash",
          destination_account_id: null,
          allocation_id: "alloc-savings",
        },
        { accounts, categories, allocations },
      ),
    ).toThrow("Expense goal allocation must belong to the source account.");

    // Invalid: transfer goal doesn't belong to destination account
    expect(() =>
      validateTransactionRelationships(
        {
          ...debtPayment("cash"),
          title: "Transfer Goal Mismatch",
          kind: "transfer",
          amount: 50,
          category_id: null,
          source_account_id: "savings",
          destination_account_id: "cash",
          allocation_id: "alloc-savings",
        },
        { accounts, categories, allocations },
      ),
    ).toThrow("Transfer goal allocation must belong to the destination account.");
  });
});
