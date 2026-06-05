import "server-only";

import { format, startOfToday } from "date-fns";

import { fetchFrankfurterRates, FRANKFURTER_PROVIDER, type FxProviderRate } from "@/features/finance/server/fx-provider";
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
  return {
    provider: FRANKFURTER_PROVIDER,
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

  if (!quoteCurrencies.length) {
    return [];
  }

  const supabase = await createClient();
  const direct = supabase
    .from("fx_rates")
    .select("provider, base_currency, quote_currency, requested_date, rate_date, rate, fetched_at")
    .eq("provider", FRANKFURTER_PROVIDER)
    .eq("base_currency", options.defaultCurrency)
    .in("quote_currency", quoteCurrencies);
  const inverse = supabase
    .from("fx_rates")
    .select("provider, base_currency, quote_currency, requested_date, rate_date, rate, fetched_at")
    .in("base_currency", quoteCurrencies)
    .eq("quote_currency", options.defaultCurrency)
    .eq("provider", FRANKFURTER_PROVIDER);

  if (options.sinceDate) {
    direct.gte("requested_date", options.sinceDate);
    inverse.gte("requested_date", options.sinceDate);
  }

  const [{ data: directRows, error: directError }, { data: inverseRows, error: inverseError }] = await Promise.all([
    direct.order("requested_date", { ascending: false }),
    inverse.order("requested_date", { ascending: false }),
  ]);

  if (directError || inverseError) {
    throw new Error("Unable to load exchange rates.");
  }

  return [...((directRows ?? []) as FxRateRow[]), ...((inverseRows ?? []) as FxRateRow[])].map(mapExchangeRate);
}

async function upsertProviderRates(rates: FxProviderRate[]) {
  if (!rates.length) {
    return [];
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
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
  const providerRates = await fetchFrankfurterRates({
    baseCurrency: options.baseCurrency,
    quoteCurrencies: options.quoteCurrencies,
    requestedDate,
  });

  return upsertProviderRates(providerRates);
}

export async function refreshSupportedCurrencyRates(requestedDate = getTodayIsoDate()) {
  return refreshExchangeRates({
    baseCurrency: "EUR",
    quoteCurrencies: SUPPORTED_CURRENCY_CODES.filter((currency) => currency !== "EUR"),
    requestedDate,
  });
}
