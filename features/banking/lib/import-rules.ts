import type { Category } from "@/types/finance";

export type ImportedProviderTransaction = {
  accountId: string;
  transactionId?: string | null;
  amount: number;
  currency: string;
  date: string;
  merchant: string;
};

export type MerchantRule = {
  merchant_pattern: string;
  category_id: string;
};

const STRIP_NUMBER_PATTERN = /\b\d+\b/g;
const STRIP_NOISE_PATTERN = /[^a-zA-Z\s&'-]+/g;
const MULTISPACE_PATTERN = /\s+/g;

export function normalizeMerchant(raw: string) {
  return raw
    .replace(STRIP_NUMBER_PATTERN, " ")
    .replace(STRIP_NOISE_PATTERN, " ")
    .replace(MULTISPACE_PATTERN, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildImportFingerprint(transaction: ImportedProviderTransaction) {
  const merchant = normalizeMerchant(transaction.merchant).toLowerCase();
  return `${transaction.accountId}:${transaction.amount.toFixed(2)}:${transaction.date}:${merchant}`;
}

export function matchImportRule(
  merchantClean: string,
  rules: MerchantRule[],
  categories: Category[],
) {
  const normalizedMerchant = merchantClean.trim().toLowerCase();
  const matchedRule = rules.find((rule) => normalizedMerchant.includes(rule.merchant_pattern.trim().toLowerCase()));

  if (!matchedRule) {
    return null;
  }

  return categories.find((category) => category.id === matchedRule.category_id) ?? null;
}
