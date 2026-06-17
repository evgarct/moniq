import type { CurrencyCode } from "@/types/currency";
import type { InvestmentInstrumentType } from "@/types/finance";

const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

export type InvestmentSearchResult = {
  name: string;
  type: InvestmentInstrumentType;
  ticker: string;
  exchange: string;
  quote_currency: CurrencyCode;
  isin: string | null;
  provider: "fmp";
  provider_symbol: string;
};

export type InvestmentQuoteResult = {
  provider_symbol: string;
  price: number;
  market_date: string;
  currency: CurrencyCode;
};

type Fetcher = typeof fetch;

function getApiKey() {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not configured.");
  return key;
}

function normalizeCurrency(value: unknown): CurrencyCode | null {
  const code = typeof value === "string" ? value.toUpperCase() : "";
  return ["EUR", "CZK", "RUB", "USD", "GBP", "CHF", "PLN", "UAH", "AED", "TRY", "JPY", "CAD"].includes(code)
    ? code as CurrencyCode
    : null;
}

function normalizeQuoteRows(payload: unknown): InvestmentQuoteResult[] {
  if (!Array.isArray(payload)) throw new Error("FMP quotes returned an unexpected response.");
  return payload.flatMap((item): InvestmentQuoteResult[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const price = Number(row.price);
    const symbol = typeof row.symbol === "string" ? row.symbol : null;
    const currency = normalizeCurrency(row.currency);
    const timestamp = Number(row.timestamp);
    if (!symbol || !currency || !Number.isFinite(price) || price <= 0) return [];
    const marketDate = typeof row.date === "string"
      ? row.date.slice(0, 10)
      : new Date(Number.isFinite(timestamp) ? timestamp * 1000 : Date.now()).toISOString().slice(0, 10);
    return [{ provider_symbol: symbol, price, currency, market_date: marketDate }];
  });
}

function normalizeType(value: unknown): InvestmentInstrumentType | null {
  const type = typeof value === "string" ? value.toLowerCase() : "";
  if (type.includes("etf") || type.includes("fund")) return "etf";
  if (type.includes("stock") || type.includes("equity")) return "stock";
  return null;
}

async function fetchFmp(path: string, search: Record<string, string>, fetcher: Fetcher) {
  const url = new URL(`${FMP_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
  url.searchParams.set("apikey", getApiKey());
  const response = await fetcher(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`FMP request failed with ${response.status}.`);
  const payload = await response.json();
  if (payload && typeof payload === "object" && "Error Message" in payload) {
    throw new Error("FMP request limit reached.");
  }
  return payload;
}

export async function searchFmpInstruments(query: string, fetcher: Fetcher = fetch): Promise<InvestmentSearchResult[]> {
  const payload = await fetchFmp("search-name", { query, limit: "20" }, fetcher);
  if (!Array.isArray(payload)) throw new Error("FMP search returned an unexpected response.");
  return payload.flatMap((item): InvestmentSearchResult[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const providerSymbol = typeof row.symbol === "string" ? row.symbol : null;
    const name = typeof row.name === "string" ? row.name : null;
    const exchange = typeof row.exchange === "string"
      ? row.exchange
      : typeof row.exchangeShortName === "string" ? row.exchangeShortName : null;
    const currency = normalizeCurrency(row.currency);
    const type = normalizeType(row.type ?? row.stockExchange);
    if (!providerSymbol || !name || !exchange || !currency || !type) return [];
    return [{
      name,
      type,
      ticker: providerSymbol.split(".")[0],
      exchange,
      quote_currency: currency,
      isin: typeof row.isin === "string" ? row.isin : null,
      provider: "fmp",
      provider_symbol: providerSymbol,
    }];
  });
}

export async function fetchFmpQuotes(
  symbols: string[],
  fetcher: Fetcher = fetch,
): Promise<InvestmentQuoteResult[]> {
  if (!symbols.length) return [];
  const uniqueSymbols = Array.from(new Set(symbols));
  const primary = normalizeQuoteRows(
    await fetchFmp("batch-quote", { symbols: uniqueSymbols.join(",") }, fetcher),
  );
  const quotesBySymbol = new Map(primary.map((quote) => [quote.provider_symbol, quote]));
  const missingSymbols = uniqueSymbols.filter((symbol) => !quotesBySymbol.has(symbol));

  if (missingSymbols.length) {
    const fallback = normalizeQuoteRows(
      await fetchFmp("batch-quote-short", { symbols: missingSymbols.join(",") }, fetcher),
    );
    for (const quote of fallback) {
      if (!quotesBySymbol.has(quote.provider_symbol)) {
        quotesBySymbol.set(quote.provider_symbol, quote);
      }
    }
  }

  return uniqueSymbols.flatMap((symbol) => {
    const quote = quotesBySymbol.get(symbol);
    return quote ? [quote] : [];
  });
}
