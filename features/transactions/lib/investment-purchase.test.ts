import { describe, expect, it } from "vitest";

import { transactionInputSchema } from "@/types/finance-schemas";

const base = {
  title: "ETF purchase",
  note: null,
  occurred_at: "2026-06-15",
  status: "paid" as const,
  kind: "expense" as const,
  amount: 100,
  destination_amount: null,
  fx_rate: null,
  principal_amount: null,
  interest_amount: null,
  extra_principal_amount: null,
  category_id: "11111111-1111-4111-8111-111111111111",
  source_account_id: "22222222-2222-4222-8222-222222222222",
  destination_account_id: null,
  allocation_id: null,
};

describe("investment purchase validation", () => {
  it("accepts an expense with instrument and positive units", () => {
    expect(transactionInputSchema.safeParse({
      ...base,
      investment_instrument_id: "33333333-3333-4333-8333-333333333333",
      investment_units: 2.5,
    }).success).toBe(true);
  });

  it("rejects partial and non-expense investment data", () => {
    expect(transactionInputSchema.safeParse({
      ...base,
      investment_instrument_id: "33333333-3333-4333-8333-333333333333",
      investment_units: null,
    }).success).toBe(false);
    expect(transactionInputSchema.safeParse({
      ...base,
      kind: "income",
      destination_account_id: base.source_account_id,
      source_account_id: null,
      investment_instrument_id: "33333333-3333-4333-8333-333333333333",
      investment_units: 1,
    }).success).toBe(false);
  });
});
