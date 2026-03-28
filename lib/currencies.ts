import { SUPPORTED_CURRENCIES, type CurrencyCode, type SupportedCurrency } from "@/types/currency";

export const DEFAULT_CURRENCY_CODE: CurrencyCode = "EUR";
export const PRIMARY_CURRENCIES = SUPPORTED_CURRENCIES.filter((currency) => currency.primary) as SupportedCurrency[];
export const SECONDARY_CURRENCIES = SUPPORTED_CURRENCIES.filter((currency) => !currency.primary) as SupportedCurrency[];
export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

const currencyMap = new Map<CurrencyCode, SupportedCurrency>(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency]),
);

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return currencyMap.has(code as CurrencyCode);
}

export function normalizeCurrencyCode(code: string): CurrencyCode {
  const normalized = code.trim().toUpperCase();

  if (!isSupportedCurrency(normalized)) {
    throw new Error(`Unsupported currency: ${code}`);
  }

  return normalized;
}

export function getCurrencyMeta(currency: CurrencyCode): SupportedCurrency {
  return currencyMap.get(currency) ?? currencyMap.get(DEFAULT_CURRENCY_CODE)!;
}

