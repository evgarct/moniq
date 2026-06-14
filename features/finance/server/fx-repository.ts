import "server-only";

import { format, startOfToday } from "date-fns";

import {
  CURRENCY_API_PROVIDER,
  fetchCurrencyApiRates,
  fetchFrankfurterRates,
  FRANKFURTER_PROVIDER,
  type FxProviderRate,
} from "@/features/finance/server/fx-provider";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRate } from "@/types/finance";

type FxRateRow = {
  provider: string;
  base_currency: CurrencyCode;
  quote_currency: CurrencyCode;
  requested_date: string;
  rate_date: string;
  rate: number | string;
  fetched_at: string;
};

function mapExchangeRate(row: FxRateRow): ExchangeRate {
  const provider = row.provider === CURRENCY_API_PROVIDER
    ? CURRENCY_API_PROVIDER
    : FRANKFURTER_PROVIDER;

  return {
    provider,
    base_currency: row.base_currency,
    quote_currency: row.quote_currency,
    requested_date: row.requested_date,
    rate_date: row.rate_date,
    rate: Number(row.rate),
    fetched_at: row.fetched_at,
  };
}

function getTodayIsoDate() {
  return format(startOfToday(), "yyyy-MM-dd");
}

export function buildRelevantCurrencyPairs(defaultCurrency: CurrencyCode, currencies: CurrencyCode[]) {
  return Array.from(new Set(currencies)).filter((currency) => currency !== defaultCurrency);
}

export async function getCachedExchangeRates(options: {
  defaultCurrency: CurrencyCode;
  currencies: CurrencyCode[];
  sinceDate?: string;
}): Promise<ExchangeRate[]> {
  const quoteCurrencies = buildRelevantCurrencyPairs(options.defaultCurrency, options.currencies);
  const bridgeCurrencies = quoteCurrencies.length
    ? Array.from(new Set([options.defaultCurrency, ...quoteCurrencies])).filter((currency) => currency !== "EUR")
    : [];

  if (!quoteCurrencies.length) {
    return [];
  }

  const supabase = await createClient();
  const direct = supabase
    .from("fx_rates")
    .select("provider, base_currency, quote_currency, requested_date, rate_date, rate, fetched_at")
    .in("provider", [FRANKFURTER_PROVIDER, CURRENCY_API_PROVIDER])
    .eq("base_currency", options.defaultCurrency)
    .in("quote_currency", quoteCurrencies);
  const inverse = supabase
    .from("fx_rates")
    .select("provider, base_currency, quote_currency, requested_date, rate_date, rate, fetched_at")
    .in("base_currency", quoteCurrencies)
    .eq("quote_currency", options.defaultCurrency)
    .in("provider", [FRANKFURTER_PROVIDER, CURRENCY_API_PROVIDER]);
  const bridge = supabase
    .from("fx_rates")
    .select("provider, base_currency, quote_currency, requested_date, rate_date, rate, fetched_at")
    .in("provider", [FRANKFURTER_PROVIDER, CURRENCY_API_PROVIDER])
    .eq("base_currency", "EUR")
    .in("quote_currency", bridgeCurrencies);

  if (options.sinceDate) {
    direct.gte("requested_date", options.sinceDate);
    inverse.gte("requested_date", options.sinceDate);
    bridge.gte("requested_date", options.sinceDate);
  }

  const [
    { data: directRows, error: directError },
    { data: inverseRows, error: inverseError },
    { data: bridgeRows, error: bridgeError },
  ] = await Promise.all([
    direct.order("requested_date", { ascending: false }),
    inverse.order("requested_date", { ascending: false }),
    bridge.order("requested_date", { ascending: false }),
  ]);

  if (directError || inverseError || bridgeError) {
    throw new Error("Unable to load exchange rates.");
  }

  return [
    ...((directRows ?? []) as FxRateRow[]),
    ...((inverseRows ?? []) as FxRateRow[]),
    ...((bridgeRows ?? []) as FxRateRow[]),
  ].map(mapExchangeRate);
}

async function upsertProviderRates(rates: FxProviderRate[]) {
  if (!rates.length) {
    return [];
  }

  const now = new Date().toISOString();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return rates.map((rate) => ({
      provider: rate.provider,
      base_currency: rate.base_currency,
      quote_currency: rate.quote_currency,
      requested_date: rate.requested_date,
      rate_date: rate.rate_date,
      rate: rate.rate,
      fetched_at: now,
    }));
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("fx_rates")
    .upsert(
      rates.map((rate) => ({
        provider: rate.provider,
        base_currency: rate.base_currency,
        quote_currency: rate.quote_currency,
        requested_date: rate.requested_date,
        rate_date: rate.rate_date,
        rate: rate.rate,
        source_metadata: rate.source_metadata,
        fetched_at: now,
      })),
      {
        onConflict: "provider,base_currency,quote_currency,requested_date",
      },
    )
    .select("provider, base_currency, quote_currency, requested_date, rate_date, rate, fetched_at");

  if (error) {
    throw new Error("Unable to save exchange rates.");
  }

  return ((data ?? []) as FxRateRow[]).map(mapExchangeRate);
}

export async function refreshExchangeRates(options: {
  baseCurrency: CurrencyCode;
  quoteCurrencies: CurrencyCode[];
  requestedDate?: string;
}) {
  const requestedDate = options.requestedDate ?? getTodayIsoDate();
  const primaryRates = await fetchFrankfurterRates({
    baseCurrency: options.baseCurrency,
    quoteCurrencies: options.quoteCurrencies,
    requestedDate,
  });
  const primaryQuotes = new Set(primaryRates.map((rate) => rate.quote_currency));
  const fallbackQuotes = options.quoteCurrencies.filter((currency) => !primaryQuotes.has(currency));
  const fallbackRates = fallbackQuotes.length
    ? await fetchCurrencyApiRates({
        baseCurrency: options.baseCurrency,
        quoteCurrencies: fallbackQuotes,
        requestedDate,
      })
    : [];

  return upsertProviderRates([...primaryRates, ...fallbackRates]);
}

export async function refreshSupportedCurrencyRates(requestedDate = getTodayIsoDate()) {
  return refreshExchangeRates({
    baseCurrency: "EUR",
    quoteCurrencies: SUPPORTED_CURRENCY_CODES.filter((currency) => currency !== "EUR"),
    requestedDate,
  });
}
