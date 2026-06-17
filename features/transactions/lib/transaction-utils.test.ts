import { describe, expect, it } from "vitest";

import type { CurrencyCode } from "@/types/currency";
import type { Account, Category } from "@/types/finance";
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
});
