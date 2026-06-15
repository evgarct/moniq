import { describe, expect, it } from "vitest";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { getPositionMarketValue, getPositionUnits } from "@/features/investments/lib/positions";
import type { InvestmentPosition, Transaction } from "@/types/finance";

const instrument = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Example ETF",
  type: "etf" as const,
  ticker: "ETF",
  exchange: "XETRA",
  quote_currency: "EUR" as const,
  isin: null,
  provider: "fmp",
  provider_symbol: "ETF.DE",
};

const position: InvestmentPosition = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "user",
  instrument_id: instrument.id,
  opening_units: 10,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  instrument,
  latest_quote: {
    instrument_id: instrument.id,
    provider: "fmp",
    market_date: "2026-06-12",
    price: 20,
    currency: "EUR",
    fetched_at: "2026-06-12T18:00:00Z",
  },
};

function purchase(status: Transaction["status"], units: number): Transaction {
  return {
    id: `${status}-${units}`,
    user_id: "user",
    title: "Investment",
    note: null,
    occurred_at: "2026-06-10",
    created_at: "2026-06-10T00:00:00Z",
    status,
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
    investment_instrument_id: instrument.id,
    investment_units: units,
    investment_instrument: instrument,
  };
}

describe("investment positions", () => {
  it("adds only paid purchases to opening units", () => {
    expect(getPositionUnits(position, [purchase("paid", 2.5), purchase("planned", 3), purchase("skipped", 4)])).toBe(12.5);
  });

  it("calculates market value without affecting finance totals", () => {
    const snapshot = createEmptyFinanceSnapshot();
    expect(getPositionMarketValue(position, [purchase("paid", 2.5)])).toBe(250);
    expect(snapshot.accounts).toEqual([]);
  });
});
