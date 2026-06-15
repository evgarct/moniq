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
    await expect(fetchFmpQuotes(["SPYL.DE"], fetcher as typeof fetch)).resolves.toEqual([
      { provider_symbol: "SPYL.DE", price: 14.25, currency: "EUR", market_date: "2026-06-16" },
    ]);
  });

  it("reports a missing API key", async () => {
    await expect(searchFmpInstruments("VUAA")).rejects.toThrow("FMP_API_KEY");
  });
});
