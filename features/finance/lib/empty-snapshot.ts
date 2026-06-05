import { DEFAULT_CURRENCY_CODE } from "@/lib/currencies";
import type { FinanceSnapshot } from "@/types/finance";

export function createEmptyFinanceSnapshot(): FinanceSnapshot {
  return {
    accounts: [],
    categories: [],
    schedules: [],
    transactions: [],
    allocations: [],
    preferences: {
      default_currency: DEFAULT_CURRENCY_CODE,
      default_currency_source: "fallback",
    },
    exchange_rates: [],
  };
}
