import { NextResponse } from "next/server";

import { localizedErrorResponse } from "@/app/api/_lib/error-response";
import { getUserPreferencesWithDefault } from "@/features/finance/server/repository";
import {
  refreshExchangeRates,
  refreshExchangeRatesForDates,
  refreshSupportedCurrencyRates,
} from "@/features/finance/server/fx-repository";
import { withApiPerformance } from "@/lib/performance/api";
import { createClient } from "@/lib/supabase/server";
import { isSupportedCurrency, SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type { CurrencyCode } from "@/types/currency";

type RefreshPayload = {
  requested_date?: unknown;
  requested_dates?: unknown;
  base_currency?: unknown;
  quote_currencies?: unknown;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

function normalizeRequestedDate(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("FX rate date must use YYYY-MM-DD.");
  }

  return value;
}

function normalizeRequestedDates(value: unknown, fallback?: string) {
  if (value == null) return fallback ? [fallback] : [];
  if (!Array.isArray(value)) throw new Error("FX rate dates must be an array.");

  const requestedDates = Array.from(new Set(value.map(normalizeRequestedDate).filter(Boolean) as string[])).sort();
  if (requestedDates.length > 366) throw new Error("Too many FX rate dates requested.");
  return requestedDates;
}

function normalizeCurrency(value: unknown) {
  if (typeof value !== "string" || !isSupportedCurrency(value)) {
    throw new Error("Unsupported currency.");
  }

  return value;
}

function normalizeQuoteCurrencies(value: unknown) {
  if (value == null) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new Error("Quote currencies must be an array.");
  }

  return value.map(normalizeCurrency);
}

async function readPayload(request: Request): Promise<RefreshPayload> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  return (await request.json().catch(() => ({}))) as RefreshPayload;
}

async function refreshForAuthenticatedUser(request: Request, payload: RefreshPayload) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return localizedErrorResponse(request, "common.errors.unauthorized", 401);
  }

  const { data: wallets, error: walletsError } = await supabase
    .from("wallets")
    .select("currency")
    .eq("user_id", user.id);

  if (walletsError) {
    throw new Error("Unable to load finance data.");
  }

  const walletCurrencies = ((wallets ?? []) as { currency: CurrencyCode }[]).map((wallet) => ({
    currency: wallet.currency,
  }));
  const preferences = await getUserPreferencesWithDefault(user.id, walletCurrencies);
  const baseCurrency = payload.base_currency ? normalizeCurrency(payload.base_currency) : preferences.default_currency;
  const requestedDate = normalizeRequestedDate(payload.requested_date);
  const requestedDates = normalizeRequestedDates(payload.requested_dates, requestedDate);
  const quoteCurrencies =
    normalizeQuoteCurrencies(payload.quote_currencies) ??
    Array.from(new Set(walletCurrencies.map((wallet) => wallet.currency))).filter(
      (currency) => currency !== baseCurrency,
    );

  const rates = requestedDates.length
    ? await refreshExchangeRatesForDates({ baseCurrency, quoteCurrencies, requestedDates })
    : await refreshExchangeRates({ baseCurrency, quoteCurrencies, requestedDate });

  return NextResponse.json({ rates });
}

export async function POST(request: Request) {
  return withApiPerformance(request, "fx_rates_refresh", async () => {
    try {
      const payload = await readPayload(request);
      const cronSecret = process.env.CRON_SECRET;
      const bearer = getBearerToken(request);

      if (cronSecret && bearer === cronSecret) {
        const requestedDate = normalizeRequestedDate(payload.requested_date);
        const requestedDates = normalizeRequestedDates(payload.requested_dates, requestedDate);
        const rates = requestedDates.length
          ? await refreshExchangeRatesForDates({
              baseCurrency: "EUR",
              quoteCurrencies: SUPPORTED_CURRENCY_CODES.filter((currency) => currency !== "EUR"),
              requestedDates,
            })
          : await refreshSupportedCurrencyRates(requestedDate);

        return NextResponse.json({ rates });
      }

      return refreshForAuthenticatedUser(request, payload);
    } catch {
      return localizedErrorResponse(request, "common.errors.fx.refresh", 400);
    }
  });
}

export async function GET(request: Request) {
  return withApiPerformance(request, "fx_rates_refresh_cron", async () => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const bearer = getBearerToken(request);

      if (!cronSecret || bearer !== cronSecret) {
        return localizedErrorResponse(request, "common.errors.unauthorized", 401);
      }

      const requestedDate = normalizeRequestedDate(new URL(request.url).searchParams.get("requested_date"));
      const rates = await refreshSupportedCurrencyRates(requestedDate);

      return NextResponse.json({ rates });
    } catch {
      return localizedErrorResponse(request, "common.errors.fx.refresh", 400);
    }
  });
}
