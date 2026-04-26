import { describe, expect, it } from "vitest";

import { getIncomeExpenseSummaryByCurrency, getTotalBalanceByCurrency } from "@/lib/finance-selectors";
import { mockAccounts, mockTransactions } from "@/lib/mock-finance";

describe("finance-selectors", () => {
  it("groups wallet balances by currency instead of mixing them", () => {
    expect(getTotalBalanceByCurrency(mockAccounts)).toEqual([
      { currency: "EUR", amount: 16400 },
      { currency: "CZK", amount: -174402.88 },
      { currency: "RUB", amount: 64800 },
    ]);
  });

  it("groups income and expenses by transaction currency", () => {
    expect(getIncomeExpenseSummaryByCurrency(mockTransactions)).toEqual([
      { currency: "CZK", income: 678700, expenses: 366838.73 },
    ]);
  });
});
