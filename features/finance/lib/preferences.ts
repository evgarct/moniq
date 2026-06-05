import { DEFAULT_CURRENCY_CODE, SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type { CurrencyCode } from "@/types/currency";
import type { Account, DefaultCurrencySource, UserPreferences } from "@/types/finance";

export function inferDefaultCurrency(accounts: Pick<Account, "currency">[]): UserPreferences {
  if (!accounts.length) {
    return {
      default_currency: DEFAULT_CURRENCY_CODE,
      default_currency_source: "fallback",
    };
  }

  const counts = accounts.reduce<Map<CurrencyCode, number>>((accumulator, account) => {
    accumulator.set(account.currency, (accumulator.get(account.currency) ?? 0) + 1);
    return accumulator;
  }, new Map());

  let bestCurrency = DEFAULT_CURRENCY_CODE;
  let bestCount = 0;

  for (const currency of SUPPORTED_CURRENCY_CODES) {
    const count = counts.get(currency) ?? 0;
    if (count > bestCount) {
      bestCurrency = currency;
      bestCount = count;
    }
  }

  return {
    default_currency: bestCurrency,
    default_currency_source: bestCount > 0 ? "wallet_inferred" : "fallback",
  };
}

export function resolveUserPreferences(
  savedDefaultCurrency: CurrencyCode | null | undefined,
  accounts: Pick<Account, "currency">[],
): UserPreferences {
  if (savedDefaultCurrency) {
    return {
      default_currency: savedDefaultCurrency,
      default_currency_source: "saved" satisfies DefaultCurrencySource,
    };
  }

  return inferDefaultCurrency(accounts);
}
