import type { CurrencyCode } from "@/types/currency";

const DEUTSCHE_BOERSE_BASE_URL = "https://api.live.deutsche-boerse.com/v1/data/price_information/single";

export type DeutscheBoerseQuoteRequest = {
  provider_symbol: string;
  isin: string | null;
  exchange: string;
  quote_currency: CurrencyCode;
};

export type DeutscheBoerseQuoteResult = {
  provider_symbol: string;
  provider: "deutsche-boerse";
  price: number;
  market_date: string;
  currency: CurrencyCode;
};

type Fetcher = typeof fetch;

function getMic(exchange: string) {
  const normalized = exchange.trim().toUpperCase();
  if (normalized === "XETRA" || normalized === "XETR") {
    return "XETR";
  }
  return null;
}

function normalizeCurrency(value: unknown, fallback: CurrencyCode) {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const originalValue = (value as Record<string, unknown>).originalValue;
  return typeof originalValue === "string" && originalValue.toUpperCase() === fallback
    ? fallback
    : fallback;
}

export async function fetchDeutscheBoerseQuotes(
  requests: DeutscheBoerseQuoteRequest[],
  fetcher: Fetcher = fetch,
): Promise<DeutscheBoerseQuoteResult[]> {
  return (await Promise.all(requests.map(async (request) => {
    const mic = getMic(request.exchange);
    if (!request.isin || !mic) {
      return null;
    }

    const url = new URL(DEUTSCHE_BOERSE_BASE_URL);
    url.searchParams.set("isin", request.isin);
    url.searchParams.set("mic", mic);
    const response = await fetcher(url, {
      cache: "no-store",
      headers: {
        origin: "https://live.deutsche-boerse.com",
        referer: "https://live.deutsche-boerse.com/",
        "user-agent": "Moniq investment quote refresh",
      },
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const row = payload as Record<string, unknown>;
    const price = Number(row.lastPrice ?? row.closingPricePrevTradingDay);
    const timestamp = typeof row.timestampLastPrice === "string" ? row.timestampLastPrice : null;
    if (!Number.isFinite(price) || price <= 0 || !timestamp) {
      return null;
    }

    return {
      provider_symbol: request.provider_symbol,
      provider: "deutsche-boerse" as const,
      price,
      market_date: timestamp.slice(0, 10),
      currency: normalizeCurrency(row.currency, request.quote_currency),
    };
  }))).filter((quote): quote is DeutscheBoerseQuoteResult => quote !== null);
}
