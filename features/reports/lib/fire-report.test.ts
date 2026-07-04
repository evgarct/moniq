import { describe, expect, it } from "vitest";

import type { Account, InvestmentPosition, Transaction } from "@/types/finance";
import { buildFireReport } from "./fire-report";

const now = new Date("2026-06-15T12:00:00Z");

function mockAccount(
  id: string,
  balance: number,
  currency: Account["currency"] = "USD",
): Account {
  return {
    id,
    user_id: "user",
    name: id,
    type: "cash",
    cash_kind: "debit_card",
    debt_kind: null,
    balance,
    credit_limit: null,
    currency,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function mockTransaction(
  id: string,
  values: Partial<Transaction>,
): Transaction {
  return {
    id,
    user_id: "user",
    title: id,
    note: null,
    occurred_at: "2026-06-10",
    created_at: "2026-06-01T00:00:00Z",
    status: "paid",
    kind: "expense",
    amount: 100,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: null,
    source_account_id: null,
    destination_account_id: null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    category: null,
    source_account: null,
    destination_account: null,
    schedule: null,
    allocation_id: null,
    allocation: null,
    ...values,
  };
}

function mockInvestmentPosition(
  id: string,
  instrumentId: string,
  openingUnits: number,
  ticker: string,
  quoteCurrency: Account["currency"] = "USD",
  latestPrice = 100,
): InvestmentPosition {
  return {
    id,
    user_id: "user",
    instrument_id: instrumentId,
    opening_units: openingUnits,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    instrument: {
      id: instrumentId,
      name: ticker,
      type: "stock",
      ticker,
      exchange: "NYSE",
      quote_currency: quoteCurrency,
      isin: null,
      provider: "mock",
      provider_symbol: ticker,
    },
    latest_quote: {
      instrument_id: instrumentId,
      provider: "mock",
      market_date: "2026-06-15",
      price: latestPrice,
      currency: quoteCurrency,
      fetched_at: "2026-06-15T10:00:00Z",
    },
  };
}



describe("fire report calculation", () => {
  it("builds the series matching labels and filters by accountIds", () => {
    const acc1 = mockAccount("acc1", 10_000, "USD");
    const acc2 = mockAccount("acc2", 5_000, "USD");

    const report = buildFireReport({
      accounts: [acc1, acc2],
      transactions: [],
      exchangeRates: [],
      defaultCurrency: "USD",
      investmentPositions: [],
      accountIds: ["acc1"],
      periodMonths: 6,
      now,
      labels: {
        income: "Доходы",
        expenses: "Расходы",
        investmentIncome: "Пассивный доход",
      },
    });

    expect(report.currency).toBe("USD");
    expect(report.series).toHaveLength(3);
    expect(report.series[0].id).toBe("income");
    expect(report.series[0].name).toBe("Доходы");
    expect(report.series[1].id).toBe("expenses");
    expect(report.series[1].name).toBe("Расходы");
    expect(report.series[2].id).toBe("investment-income");
    expect(report.series[2].name).toBe("Пассивный доход");

    // The points should be 6 months of data
    expect(report.series[0].points).toHaveLength(6);

    // The portfolio value should include only acc1 ($10,000)
    // SWR = $10,000 * 0.04 / 12 = $33.333333333333336
    const latestPoint = report.series[2].points[5];
    expect(latestPoint.balance).toBeCloseTo(33.3333, 4);
  });

  it("rolls back transactions in history to calculate past balances", () => {
    const acc = mockAccount("acc", 10_000, "USD");

    // An expense transaction of $2,000 occurred in June 2026 (this month)
    // Going backward, the balance at the end of May 2026 should be $10,000 + $2,000 = $12,000
    const tx = mockTransaction("tx1", {
      occurred_at: "2026-06-10",
      kind: "expense",
      amount: 2000,
      source_account_id: "acc",
    });

    const report = buildFireReport({
      accounts: [acc],
      transactions: [tx],
      exchangeRates: [],
      defaultCurrency: "USD",
      investmentPositions: [],
      accountIds: ["acc"],
      periodMonths: 3,
      now,
      labels: {
        income: "Income",
        expenses: "Expenses",
        investmentIncome: "SWR",
      },
    });

    const juneSWRPoint = report.series[2].points[2]; // June 2026 (current state, includes tx effect: balance $10k)
    const maySWRPoint = report.series[2].points[1];  // May 2026 (rolled back tx: balance $12k)

    // June SWR: 10,000 * 0.04 / 12 = 33.3333
    expect(juneSWRPoint.balance).toBeCloseTo(33.3333, 4);
    // May SWR: 12,000 * 0.04 / 12 = 40
    expect(maySWRPoint.balance).toBeCloseTo(40.0, 4);

    // Verify monthly expenses in June is $2,000
    const juneExpensesPoint = report.series[1].points[2];
    expect(juneExpensesPoint.balance).toBe(2000);
  });

  it("reconstructs and values investment positions correctly", () => {
    const acc = mockAccount("acc", 10_000, "USD");
    // Investment positions: starts with 10 units of AAPL (price $150 = value $1,500)
    // And in June 2026 we bought 5 units for $750
    // So current units = 15
    const pos = mockInvestmentPosition("pos1", "aapl-id", 10, "AAPL", "USD", 150);

    const buyTx = mockTransaction("buy1", {
      occurred_at: "2026-06-12",
      kind: "expense",
      amount: 750,
      source_account_id: "acc",
      investment_instrument_id: "aapl-id",
      investment_units: 5,
    });

    const report = buildFireReport({
      accounts: [acc],
      transactions: [buyTx],
      exchangeRates: [],
      defaultCurrency: "USD",
      investmentPositions: [pos],
      accountIds: ["acc"],
      periodMonths: 3,
      now,
      labels: {
        income: "Income",
        expenses: "Expenses",
        investmentIncome: "SWR",
      },
    });

    // Current State (June 2026):
    // Acc Balance: $10,000
    // Stock AAPL: 15 units * $150 = $2,250
    // Total Portfolio = $12,250
    // June SWR = 12,250 * 0.04 / 12 = 40.8333
    const juneSWR = report.series[2].points[2];
    expect(juneSWR.balance).toBeCloseTo(40.8333, 4);

    // Rolled Back State (May 2026):
    // Acc Balance: $10,000 + $750 (rollback buy) = $10,750
    // Stock AAPL: 15 - 5 (rollback buy) = 10 units * $150 = $1,500
    // Total Portfolio = $12,250 (cash + stock stays constant since it was just a trade!)
    // May SWR = 12,250 * 0.04 / 12 = 40.8333
    const maySWR = report.series[2].points[1];
    expect(maySWR.balance).toBeCloseTo(40.8333, 4);
  });
});
