import { afterEach, describe, expect, it } from "vitest";

import { fetchFmpQuotes, searchFmpInstruments } from "@/features/investments/server/fmp-provider";

afterEach(() => {
  delete process.env.FMP_API_KEY;
});

describe("FMP investment provider", () => {
  it("normalizes distinct exchange listings", async () => {
    process.env.FMP_API_KEY = "test";
    const fetcher = async () => new Response(JSON.stringify([
      { symbol: "VUAA.DE", name: "Vanguard S&P 500 UCITS ETF", exchange: "XETRA", currency: "EUR", type: "ETF" },
      { symbol: "VUAA.L", name: "Vanguard S&P 500 UCITS ETF", exchange: "LSE", currency: "USD", type: "ETF" },
    ]));
    const results = await searchFmpInstruments("VUAA", fetcher as typeof fetch);
    expect(results.map((result) => result.provider_symbol)).toEqual(["VUAA.DE", "VUAA.L"]);
  });

  it("normalizes batch quotes", async () => {
    process.env.FMP_API_KEY = "test";
    const fetcher = async () => new Response(JSON.stringify([
      { symbol: "SPYL.DE", price: 14.25, currency: "EUR", timestamp: 1781568000 },
    ]));
    await expect(fetchFmpQuotes(
      [{ provider_symbol: "SPYL.DE", quote_currency: "EUR" }],
      fetcher as typeof fetch,
    )).resolves.toEqual({
      requested_symbols: ["SPYL.DE"],
      quotes: [
        { provider_symbol: "SPYL.DE", price: 14.25, currency: "EUR", market_date: "2026-06-16" },
      ],
      missing_symbols: [],
    });
  });

  it("uses the instrument currency and current UTC date for short quotes without metadata", async () => {
    process.env.FMP_API_KEY = "test";
    const fetcher = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/batch-quote")) {
        return new Response(JSON.stringify([
          { symbol: "VUAA.DE", price: 107.32, currency: "EUR", timestamp: 1781568000 },
        ]));
      }
      return new Response(JSON.stringify([
        { symbol: "SPYL.DE", price: 14.25, change: 0.12, volume: 1234 },
      ]));
    };

    await expect(fetchFmpQuotes(
      [
        { provider_symbol: "VUAA.DE", quote_currency: "EUR" },
        { provider_symbol: "SPYL.DE", quote_currency: "EUR" },
      ],
      fetcher as typeof fetch,
      new Date("2026-06-18T12:00:00Z"),
    )).resolves.toEqual({
      requested_symbols: ["VUAA.DE", "SPYL.DE"],
      quotes: [
        { provider_symbol: "VUAA.DE", price: 107.32, currency: "EUR", market_date: "2026-06-16" },
        { provider_symbol: "SPYL.DE", price: 14.25, currency: "EUR", market_date: "2026-06-18" },
      ],
      missing_symbols: [],
    });
  });

  it("reports symbols missing from both full and short quote responses", async () => {
    process.env.FMP_API_KEY = "test";
    const fetcher = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/batch-quote")) {
        return new Response(JSON.stringify([
          { symbol: "VUAA.DE", price: 107.32, currency: "EUR", timestamp: 1781568000 },
        ]));
      }
      return new Response(JSON.stringify([]));
    };

    await expect(fetchFmpQuotes(
      [
        { provider_symbol: "VUAA.DE", quote_currency: "EUR" },
        { provider_symbol: "SPYL.DE", quote_currency: "EUR" },
      ],
      fetcher as typeof fetch,
    )).resolves.toEqual({
      requested_symbols: ["VUAA.DE", "SPYL.DE"],
      quotes: [
        { provider_symbol: "VUAA.DE", price: 107.32, currency: "EUR", market_date: "2026-06-16" },
      ],
      missing_symbols: ["SPYL.DE"],
    });
  });

  it("reports a missing API key", async () => {
    await expect(searchFmpInstruments("VUAA")).rejects.toThrow("FMP_API_KEY");
  });
});
