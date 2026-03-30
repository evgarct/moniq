import { getCurrencyMeta } from "@/lib/currencies";
import type { CurrencyCode } from "@/types/currency";

function getCurrencyLocale(currency: CurrencyCode) {
  return getCurrencyMeta(currency).locale;
}

export function formatMoney(amount: number, currency: CurrencyCode = "EUR") {
  const locale = getCurrencyLocale(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

export function formatMoneyNumber(amount: number, currency: CurrencyCode = "EUR") {
  const locale = getCurrencyLocale(currency);

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
