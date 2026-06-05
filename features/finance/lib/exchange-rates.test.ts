import { describe, expect, it } from "vitest";

import { convertMoney } from "@/features/finance/lib/exchange-rates";
import type { ExchangeRate } from "@/types/finance";

const rates: ExchangeRate[] = [
  {
    provider: "frankfurter",
    base_currency: "EUR",
    quote_currency: "CZK",
    requested_date: "2026-06-04",
    rate_date: "2026-06-04",
    rate: 24.5,
    fetched_at: "2026-06-04T15:00:00Z",
  },
  {
    provider: "frankfurter",
    base_currency: "USD",
    quote_currency: "EUR",
    requested_date: "2026-06-01",
    rate_date: "2026-05-31",
    rate: 0.92,
    fetched_at: "2026-06-01T15:00:00Z",
  },
  {
    provider: "frankfurter",
    base_currency: "EUR",
    quote_currency: "USD",
    requested_date: "2026-06-04",
    rate_date: "2026-06-04",
    rate: 1.1,
    fetched_at: "2026-06-04T15:00:00Z",
  },
];

describe("exchange rate conversion", () => {
  it("returns same-currency amounts without a rate", () => {
    expect(
      convertMoney({
        amount: 42,
        sourceCurrency: "EUR",
        targetCurrency: "EUR",
        requestedDate: "2026-06-04",
        exchangeRates: [],
      }),
    ).toEqual({
      status: "same_currency",
      amount: 42,
      source_currency: "EUR",
      target_currency: "EUR",
    });
  });

  it("uses a direct rate", () => {
    const result = convertMoney({
      amount: 10,
      sourceCurrency: "EUR",
      targetCurrency: "CZK",
      requestedDate: "2026-06-04",
      exchangeRates: rates,
    });

    expect(result).toMatchObject({
      status: "converted",
      amount: 245,
      rate: 24.5,
      rate_date: "2026-06-04",
      requested_date: "2026-06-04",
    });
  });

  it("uses an inverse rate", () => {
    const result = convertMoney({
      amount: 92,
      sourceCurrency: "EUR",
      targetCurrency: "USD",
      requestedDate: "2026-06-02",
      exchangeRates: rates,
    });

    expect(result.status).toBe("converted");
    expect(result.amount).toBeCloseTo(100);
  });

  it("uses the latest cached rate for future dates", () => {
    const result = convertMoney({
      amount: 1,
      sourceCurrency: "EUR",
      targetCurrency: "CZK",
      requestedDate: "2999-01-01",
      exchangeRates: rates,
    });

    expect(result).toMatchObject({
      status: "converted",
      amount: 24.5,
      requested_date: "2026-06-04",
    });
  });

  it("triangulates supported non-EUR pairs through EUR bridge rates", () => {
    const result = convertMoney({
      amount: 24.5,
      sourceCurrency: "CZK",
      targetCurrency: "USD",
      requestedDate: "2026-06-04",
      exchangeRates: rates,
    });

    expect(result.status).toBe("converted");
    expect(result.amount).toBeCloseTo(1.1);
    expect(result).toMatchObject({
      rate_date: "2026-06-04",
      requested_date: "2026-06-04",
    });
  });

  it("returns missing_rate when no pair is available", () => {
    expect(
      convertMoney({
        amount: 10,
        sourceCurrency: "RUB",
        targetCurrency: "CZK",
        requestedDate: "2026-06-04",
        exchangeRates: rates,
      }),
    ).toEqual({
      status: "missing_rate",
      amount: 10,
      source_currency: "RUB",
      target_currency: "CZK",
      requested_date: "2026-06-04",
    });
  });
});
