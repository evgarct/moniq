import { describe, expect, it } from "vitest";

import type { Account, Transaction } from "@/types/finance";
import { buildConvertedBudgetMonths } from "./budget-analytics";

const czkAccount = { id: "czk", currency: "CZK" } as Account;
const eurAccount = { id: "eur", currency: "EUR" } as Account;

function transaction(options: {
  id: string;
  kind: "income" | "expense";
  amount: number;
  account: Account;
}): Transaction {
  return {
    id: options.id,
    kind: options.kind,
    amount: options.amount,
    status: "paid",
    occurred_at: "2026-06-10",
    source_account: options.kind === "expense" ? options.account : null,
    destination_account: options.kind === "income" ? options.account : null,
    source_account_id: options.kind === "expense" ? options.account.id : null,
    destination_account_id: options.kind === "income" ? options.account.id : null,
  } as Transaction;
}

describe("converted budget analytics", () => {
  it("converts monthly totals into the default currency", () => {
    const result = buildConvertedBudgetMonths({
      transactions: [
        transaction({ id: "income", kind: "income", amount: 100, account: eurAccount }),
        transaction({ id: "expense", kind: "expense", amount: 500, account: czkAccount }),
      ],
      currentMonth: new Date("2026-06-15T12:00:00"),
      targetCurrency: "CZK",
      exchangeRates: [{
        provider: "frankfurter",
        base_currency: "EUR",
        quote_currency: "CZK",
        requested_date: "2026-06-10",
        rate_date: "2026-06-10",
        rate: 25,
        fetched_at: "2026-06-10T12:00:00Z",
      }],
      monthsShown: 1,
    })[0];

    expect(result.income).toBe(2500);
    expect(result.expenses).toBe(500);
    expect(result.net).toBe(2000);
  });

  it("does not publish a partial total when an FX rate is missing", () => {
    const result = buildConvertedBudgetMonths({
      transactions: [transaction({ id: "income", kind: "income", amount: 100, account: eurAccount })],
      currentMonth: new Date("2026-06-15T12:00:00"),
      targetCurrency: "CZK",
      exchangeRates: [],
      monthsShown: 1,
    })[0];

    expect(result.net).toBeNull();
    expect(result.missingCurrencies).toEqual(["EUR"]);
  });
});
