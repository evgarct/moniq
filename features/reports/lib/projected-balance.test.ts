import { describe, expect, it } from "vitest";

import type { Account, ExchangeRate, Transaction } from "@/types/finance";

import { buildProjectedBalanceReport, createProjectedBalanceSeries } from "./projected-balance";

const now = new Date("2026-06-14T12:00:00Z");

function account(
  id: string,
  balance: number,
  currency: Account["currency"] = "CZK",
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

function transaction(
  id: string,
  values: Partial<Transaction>,
): Transaction {
  return {
    id,
    user_id: "user",
    title: id,
    note: null,
    occurred_at: "2026-06-15",
    created_at: "2026-06-01T00:00:00Z",
    status: "planned",
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

const eurCzkRate: ExchangeRate = {
  provider: "frankfurter",
  base_currency: "EUR",
  quote_currency: "CZK",
  requested_date: "2026-06-14",
  rate_date: "2026-06-13",
  rate: 25,
  fetched_at: "2026-06-14T10:00:00Z",
};

function build(options: {
  accounts: Account[];
  transactions?: Transaction[];
  exchangeRates?: ExchangeRate[];
  series?: { id: string; name: string; accountIds: string[] }[];
}) {
  return buildProjectedBalanceReport({
    accounts: options.accounts,
    transactions: options.transactions ?? [],
    exchangeRates: options.exchangeRates ?? [],
    defaultCurrency: "CZK",
    series: options.series ?? [{
      id: "all",
      name: "All",
      accountIds: options.accounts.map((item) => item.id),
    }],
    endDate: "2026-06-16",
    now,
  });
}

describe("projected balance report", () => {
  it("builds either one merged line or one line per selected account", () => {
    const first = account("first", 1_000);
    const second = account("second", 500);

    expect(createProjectedBalanceSeries({
      accounts: [first, second],
      accountIds: [first.id, second.id],
      merged: true,
      mergedName: "Selected accounts",
    })).toEqual([{
      id: "merged-accounts",
      name: "Selected accounts",
      accountIds: [first.id, second.id],
    }]);

    expect(createProjectedBalanceSeries({
      accounts: [first, second],
      accountIds: [second.id],
      merged: false,
      mergedName: "Selected accounts",
    })).toEqual([{
      id: second.id,
      name: second.name,
      accountIds: [second.id],
    }]);
  });

  it("applies planned income and expense at the end of their day", () => {
    const wallet = account("wallet", 1_000);
    const report = build({
      accounts: [wallet],
      transactions: [
        transaction("expense", { source_account_id: wallet.id, amount: 100 }),
        transaction("income", {
          kind: "income",
          destination_account_id: wallet.id,
          amount: 300,
        }),
      ],
    });

    expect(report.series[0]?.points.map((point) => point.balance)).toEqual([
      1_000,
      1_200,
      1_200,
    ]);
  });

  it("applies transfer destination amounts and debt payments to both accounts", () => {
    const source = account("source", 1_000);
    const destination = account("destination", -500);
    const report = build({
      accounts: [source, destination],
      transactions: [
        transaction("transfer", {
          kind: "transfer",
          source_account_id: source.id,
          destination_account_id: destination.id,
          amount: 100,
          destination_amount: 120,
        }),
        transaction("debt", {
          occurred_at: "2026-06-16",
          kind: "debt_payment",
          source_account_id: source.id,
          destination_account_id: destination.id,
          amount: 200,
        }),
      ],
    });

    expect(report.series[0]?.points.map((point) => point.balance)).toEqual([
      500,
      520,
      520,
    ]);
    expect(report.series[0]?.points[2]?.accounts.map((item) => item.native_balance)).toEqual([
      700,
      -180,
    ]);
  });

  it("ignores paid, skipped, past, and out-of-period transactions", () => {
    const wallet = account("wallet", 1_000);
    const report = build({
      accounts: [wallet],
      transactions: [
        transaction("paid", { status: "paid", source_account_id: wallet.id }),
        transaction("skipped", { status: "skipped", source_account_id: wallet.id }),
        transaction("past", { occurred_at: "2026-06-13", source_account_id: wallet.id }),
        transaction("future", { occurred_at: "2026-06-17", source_account_id: wallet.id }),
      ],
    });

    expect(report.series[0]?.points.every((point) => point.balance === 1_000)).toBe(true);
  });

  it("supports overlapping account groups independently", () => {
    const first = account("first", 1_000);
    const second = account("second", 500);
    const report = build({
      accounts: [first, second],
      series: [
        { id: "first-only", name: "First", accountIds: [first.id] },
        { id: "combined", name: "Combined", accountIds: [first.id, second.id] },
      ],
      transactions: [
        transaction("expense", { source_account_id: first.id, amount: 100 }),
      ],
    });

    expect(report.series[0]?.points[1]?.balance).toBe(900);
    expect(report.series[1]?.points[1]?.balance).toBe(1_400);
  });

  it("converts native account balances and FX transfer amounts to the default currency", () => {
    const czk = account("czk", 1_000);
    const eur = account("eur", 100, "EUR");
    const report = build({
      accounts: [czk, eur],
      exchangeRates: [eurCzkRate],
      transactions: [
        transaction("fx-transfer", {
          kind: "transfer",
          source_account_id: czk.id,
          destination_account_id: eur.id,
          amount: 250,
          destination_amount: 10,
        }),
      ],
    });

    expect(report.series[0]?.points.map((point) => point.balance)).toEqual([
      3_500,
      3_500,
      3_500,
    ]);
  });

  it("drops a complete series when one selected account has no exchange rate", () => {
    const czk = account("czk", 1_000);
    const usd = account("usd", 100, "USD");
    const report = build({
      accounts: [czk, usd],
      series: [
        { id: "invalid", name: "Invalid", accountIds: [czk.id, usd.id] },
        { id: "valid", name: "Valid", accountIds: [czk.id] },
      ],
    });

    expect(report.series.map((series) => series.id)).toEqual(["valid"]);
    expect(report.missing_rates).toEqual([{
      series_id: "invalid",
      series_name: "Invalid",
      account_id: "usd",
      account_name: "usd",
      source_currency: "USD",
      target_currency: "CZK",
    }]);
  });
});
