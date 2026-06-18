import { describe, expect, it } from "vitest";

import { fetchDeutscheBoerseQuotes } from "@/features/investments/server/deutsche-boerse-provider";

describe("Deutsche Börse investment provider", () => {
  it("normalizes an official Xetra quote", async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("isin")).toBe("IE00BFMXXD54");
      expect(url.searchParams.get("mic")).toBe("XETR");
      return new Response(JSON.stringify({
        lastPrice: 125.81,
        currency: { originalValue: "EUR" },
        timestampLastPrice: "2026-06-18T17:35:51+02:00",
      }));
    };

    await expect(fetchDeutscheBoerseQuotes([{
      provider_symbol: "VUAA.DE",
      isin: "IE00BFMXXD54",
      exchange: "XETRA",
      quote_currency: "EUR",
    }], fetcher as typeof fetch)).resolves.toEqual([{
      provider_symbol: "VUAA.DE",
      provider: "deutsche-boerse",
      price: 125.81,
      market_date: "2026-06-18",
      currency: "EUR",
    }]);
  });

  it("skips instruments outside supported exchanges or without an ISIN", async () => {
    const fetcher = async () => {
      throw new Error("fetch should not be called");
    };

    await expect(fetchDeutscheBoerseQuotes([
      {
        provider_symbol: "AAPL",
        isin: "US0378331005",
        exchange: "NASDAQ",
        quote_currency: "USD",
      },
      {
        provider_symbol: "UNKNOWN.DE",
        isin: null,
        exchange: "XETRA",
        quote_currency: "EUR",
      },
    ], fetcher as typeof fetch)).resolves.toEqual([]);
  });
});
