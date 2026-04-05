import { getCurrencyMeta } from "@/lib/currencies";
import type { CurrencyCode } from "@/types/currency";

function getCurrencyLocale(currency: CurrencyCode) {
  return getCurrencyMeta(currency).locale;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode = "EUR",
  options?: { showMinorUnits?: boolean },
) {
  const locale = getCurrencyLocale(currency);
  const fractionDigits = getFractionDigits(currency, options?.showMinorUnits ?? true);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: fractionDigits.minimumFractionDigits,
      maximumFractionDigits: fractionDigits.maximumFractionDigits,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits.minimumFractionDigits,
      maximumFractionDigits: fractionDigits.maximumFractionDigits,
    }).format(amount);
  }
}

export function formatMoneyNumber(
  amount: number,
  currency: CurrencyCode = "EUR",
  options?: { showMinorUnits?: boolean },
) {
  const locale = getCurrencyLocale(currency);
  const fractionDigits = getFractionDigits(currency, options?.showMinorUnits ?? true);

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits.minimumFractionDigits,
    maximumFractionDigits: fractionDigits.maximumFractionDigits,
  }).format(amount);
}

export function getCurrencySymbol(currency: CurrencyCode = "EUR") {
  const locale = getCurrencyLocale(currency);

  try {
    const currencyPart = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency");

    if (currencyPart?.value) {
      return currencyPart.value;
    }
  } catch {}

  return getCurrencyMeta(currency).symbol || currency;
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getFractionDigits(currency: CurrencyCode, showMinorUnits: boolean) {
  if (!showMinorUnits) {
    return {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    };
  }

  try {
    const locale = getCurrencyLocale(currency);
    const { maximumFractionDigits } = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).resolvedOptions();

    return {
      minimumFractionDigits: maximumFractionDigits,
      maximumFractionDigits,
    };
  } catch {
    return {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
  }
}
