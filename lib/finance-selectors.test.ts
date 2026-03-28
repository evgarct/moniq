import { describe, expect, it } from "vitest";

import { getIncomeExpenseSummaryByCurrency, getTotalBalanceByCurrency } from "@/lib/finance-selectors";
import { mockAccounts, mockTransactions } from "@/lib/mock-finance";

describe("finance-selectors", () => {
  it("groups wallet balances by currency instead of mixing them", () => {
    expect(getTotalBalanceByCurrency(mockAccounts)).toEqual([
      { currency: "EUR", amount: 16400 },
      { currency: "CZK", amount: -5375649.55 },
      { currency: "RUB", amount: -184320 },
    ]);
  });

  it("groups income and expenses by transaction currency", () => {
    expect(getIncomeExpenseSummaryByCurrency(mockTransactions)).toEqual([
      { currency: "EUR", income: 0, expenses: 900 },
      { currency: "CZK", income: 96500, expenses: 65835.4 },
      { currency: "RUB", income: 0, expenses: 12000 },
    ]);
  });
});
