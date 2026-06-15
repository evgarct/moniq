import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchFmpQuotes, searchFmpInstruments, type InvestmentSearchResult } from "@/features/investments/server/fmp-provider";
import type { InvestmentInstrument } from "@/types/finance";

export async function searchInvestmentInstruments(query: string) {
  const supabase = await createClient();
  const normalized = query.trim().replace(/[%_,().]/g, " ");
  const { data: local, error } = await supabase
    .from("investment_instruments")
    .select("id, name, type, ticker, exchange, quote_currency, isin, provider, provider_symbol")
    .or(`ticker.ilike.%${normalized}%,name.ilike.%${normalized}%,isin.ilike.%${normalized}%`)
    .limit(20);
  if (error) throw new Error("Unable to search investments.");

  const localResults = (local ?? []) as InvestmentInstrument[];
  if (normalized.length < 2 || !process.env.FMP_API_KEY) return localResults;
  const remote = await searchFmpInstruments(normalized).catch(() => {
    throw new Error("Unable to search investments.");
  });
  const existingSymbols = new Set(localResults.map((item) => `${item.provider}:${item.provider_symbol}`));
  return [...localResults, ...remote.filter((item) => !existingSymbols.has(`${item.provider}:${item.provider_symbol}`))];
}

export async function ensureInvestmentInstrument(input: InvestmentSearchResult) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("investment_instruments")
    .upsert(input, { onConflict: "provider,provider_symbol" })
    .select("id, name, type, ticker, exchange, quote_currency, isin, provider, provider_symbol")
    .single();
  if (error || !data) throw new Error("Unable to save investment instrument.");
  return data as InvestmentInstrument;
}

export async function refreshInvestmentQuotes() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  const service = createServiceClient();
  const { data: positions, error } = await service
    .from("investment_positions")
    .select("instrument_id, investment_instruments!inner(id, provider, provider_symbol)")
    .eq("investment_instruments.provider", "fmp");
  if (error) throw new Error("Unable to load investment instruments.");
  const instruments = Array.from(
    new Map(
      (positions ?? []).flatMap((position) => {
        const relation = position.investment_instruments;
        const instrument = Array.isArray(relation) ? relation[0] : relation;
        return instrument ? [[instrument.provider_symbol, instrument] as const] : [];
      }),
    ).values(),
  );
  const quotes = await fetchFmpQuotes(instruments.map((item) => item.provider_symbol));
  const instrumentBySymbol = new Map(instruments.map((item) => [item.provider_symbol, item.id]));
  if (!quotes.length) return [];
  const { data, error: upsertError } = await service
    .from("investment_quotes")
    .upsert(
      quotes.flatMap((quote) => {
        const instrumentId = instrumentBySymbol.get(quote.provider_symbol);
        return instrumentId ? [{
        instrument_id: instrumentId,
        provider: "fmp",
        market_date: quote.market_date,
        price: quote.price,
        currency: quote.currency,
        fetched_at: new Date().toISOString(),
        source_metadata: { provider_symbol: quote.provider_symbol },
      }] : [];
      }),
      { onConflict: "instrument_id,provider,market_date" },
    )
    .select("instrument_id, provider, market_date, price, currency, fetched_at");
  if (upsertError) throw new Error("Unable to save investment quotes.");
  return data ?? [];
}
