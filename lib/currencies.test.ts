import { describe, expect, it } from "vitest";

import {
  DEFAULT_CURRENCY_CODE,
  PRIMARY_CURRENCIES,
  SECONDARY_CURRENCIES,
  getCurrencyMeta,
  isSupportedCurrency,
  normalizeCurrencyCode,
} from "@/lib/currencies";

describe("currencies", () => {
  it("keeps the primary currency set focused on user defaults", () => {
    expect(PRIMARY_CURRENCIES.map((currency) => currency.code)).toEqual(["EUR", "CZK", "RUB"]);
    expect(SECONDARY_CURRENCIES.length).toBeGreaterThan(0);
    expect(DEFAULT_CURRENCY_CODE).toBe("EUR");
  });

  it("normalizes supported currency codes", () => {
    expect(normalizeCurrencyCode("eur")).toBe("EUR");
    expect(normalizeCurrencyCode(" czk ")).toBe("CZK");
    expect(isSupportedCurrency("RUB")).toBe(true);
    expect(isSupportedCurrency("SEK")).toBe(false);
  });

  it("throws for unsupported currencies", () => {
    expect(() => normalizeCurrencyCode("SEK")).toThrow("Unsupported currency");
  });

  it("returns metadata for a supported currency", () => {
    expect(getCurrencyMeta("CZK")).toMatchObject({
      code: "CZK",
      name: "Czech Koruna",
      locale: "cs-CZ",
    });
  });
});

