import { describe, expect, it } from "vitest";

import { inferDefaultCurrency, resolveUserPreferences } from "@/features/finance/lib/preferences";

describe("default currency preferences", () => {
  it("uses a saved default currency when present", () => {
    expect(resolveUserPreferences("USD", [{ currency: "EUR" }, { currency: "CZK" }])).toEqual({
      default_currency: "USD",
      default_currency_source: "saved",
    });
  });

  it("infers the most common wallet currency", () => {
    expect(inferDefaultCurrency([{ currency: "CZK" }, { currency: "EUR" }, { currency: "CZK" }])).toEqual({
      default_currency: "CZK",
      default_currency_source: "wallet_inferred",
    });
  });

  it("breaks ties by supported currency order", () => {
    expect(inferDefaultCurrency([{ currency: "CZK" }, { currency: "EUR" }])).toEqual({
      default_currency: "EUR",
      default_currency_source: "wallet_inferred",
    });
  });

  it("falls back when no wallets exist", () => {
    expect(inferDefaultCurrency([])).toEqual({
      default_currency: "EUR",
      default_currency_source: "fallback",
    });
  });
});
