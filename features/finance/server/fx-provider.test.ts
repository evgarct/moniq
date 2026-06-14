import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  fetchCurrencyApiRates,
  fetchFrankfurterRates,
} from "@/features/finance/server/fx-provider";

describe("Frankfurter FX provider", () => {
  it("maps v2 rows and keeps requested date separate from source rate date", async () => {
    const fetcher = vi.fn(async () =>
      Response.json([
        {
          date: "2026-05-29",
          base: "EUR",
          quote: "CZK",
          rate: 24.5,
        },
      ]),
    );

    await expect(
      fetchFrankfurterRates({
        baseCurrency: "EUR",
        quoteCurrencies: ["CZK"],
        requestedDate: "2026-05-31",
        fetcher,
      }),
    ).resolves.toEqual([
      {
        provider: "frankfurter",
        base_currency: "EUR",
        quote_currency: "CZK",
        requested_date: "2026-05-31",
        rate_date: "2026-05-29",
        rate: 24.5,
        source_metadata: {
          endpoint: "https://api.frankfurter.dev/v2/rates",
        },
      },
    ]);
  });

  it("rejects unsupported returned currencies", async () => {
    const fetcher = vi.fn(async () =>
      Response.json([
        {
          date: "2026-06-01",
          base: "EUR",
          quote: "BTC",
          rate: 0.00001,
        },
      ]),
    );

    await expect(
      fetchFrankfurterRates({
        baseCurrency: "EUR",
        quoteCurrencies: ["CZK"],
        requestedDate: "2026-06-01",
        fetcher,
      }),
    ).rejects.toThrow("Quote currency is not supported.");
  });
});

describe("Currency API fallback provider", () => {
  it("maps supported fallback rates", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        date: "2026-06-14",
        czk: {
          rub: 3.67,
        },
      }),
    );

    await expect(
      fetchCurrencyApiRates({
        baseCurrency: "CZK",
        quoteCurrencies: ["RUB"],
        requestedDate: "2026-06-14",
        fetcher,
      }),
    ).resolves.toEqual([{
      provider: "currency-api",
      base_currency: "CZK",
      quote_currency: "RUB",
      requested_date: "2026-06-14",
      rate_date: "2026-06-14",
      rate: 3.67,
      source_metadata: {
        endpoint: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
      },
    }]);
  });
});
