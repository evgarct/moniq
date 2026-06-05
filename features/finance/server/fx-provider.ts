import "server-only";

import { isSupportedCurrency } from "@/lib/currencies";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRateProvider } from "@/types/finance";

export const FRANKFURTER_PROVIDER: ExchangeRateProvider = "frankfurter";
const FRANKFURTER_API_URL = "https://api.frankfurter.dev/v2/rates";

export type FxProviderRate = {
  provider: ExchangeRateProvider;
  base_currency: CurrencyCode;
  quote_currency: CurrencyCode;
  requested_date: string;
  rate_date: string;
  rate: number;
  source_metadata: Record<string, string | number | boolean | null>;
};

type FrankfurterRateItem = {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
};

type Fetcher = typeof fetch;

function assertIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("FX rate date must use YYYY-MM-DD.");
  }
}

function normalizeCurrency(value: unknown, label: string): CurrencyCode {
  if (typeof value !== "string" || !isSupportedCurrency(value)) {
    throw new Error(`${label} currency is not supported.`);
  }

  return value;
}

function normalizeRate(value: unknown) {
  const rate = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("FX provider returned an invalid rate.");
  }

  return rate;
}

function normalizeFrankfurterRows(payload: unknown): FrankfurterRateItem[] {
  if (Array.isArray(payload)) {
    return payload as FrankfurterRateItem[];
  }

  if (payload && typeof payload === "object") {
    const objectPayload = payload as {
      date?: unknown;
      base?: unknown;
      rates?: Record<string, unknown>;
    };

    if (objectPayload.rates && typeof objectPayload.rates === "object") {
      return Object.entries(objectPayload.rates).map(([quote, rate]) => ({
        date: objectPayload.date,
        base: objectPayload.base,
        quote,
        rate,
      }));
    }
  }

  throw new Error("FX provider returned an unexpected response.");
}

export async function fetchFrankfurterRates(options: {
  baseCurrency: CurrencyCode;
  quoteCurrencies: CurrencyCode[];
  requestedDate: string;
  fetcher?: Fetcher;
}): Promise<FxProviderRate[]> {
  assertIsoDate(options.requestedDate);

  const quoteCurrencies = Array.from(new Set(options.quoteCurrencies)).filter(
    (currency) => currency !== options.baseCurrency,
  );

  if (!quoteCurrencies.length) {
    return [];
  }

  const url = new URL(FRANKFURTER_API_URL);
  url.searchParams.set("base", options.baseCurrency);
  url.searchParams.set("quotes", quoteCurrencies.join(","));
  url.searchParams.set("date", options.requestedDate);

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`FX provider request failed with ${response.status}.`);
  }

  const rows = normalizeFrankfurterRows(await response.json());

  return rows.map((row) => {
    const baseCurrency = normalizeCurrency(row.base, "Base");
    const quoteCurrency = normalizeCurrency(row.quote, "Quote");

    if (baseCurrency !== options.baseCurrency || !quoteCurrencies.includes(quoteCurrency)) {
      throw new Error("FX provider returned an unexpected currency pair.");
    }

    if (typeof row.date !== "string") {
      throw new Error("FX provider returned an invalid rate date.");
    }

    assertIsoDate(row.date);

    return {
      provider: FRANKFURTER_PROVIDER,
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      requested_date: options.requestedDate,
      rate_date: row.date,
      rate: normalizeRate(row.rate),
      source_metadata: {
        endpoint: FRANKFURTER_API_URL,
      },
    };
  });
}
