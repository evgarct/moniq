import { isSameDay, parseISO } from "date-fns";

import { getAccountGroup, getNetWorthTotal } from "@/features/accounts/lib/account-utils";
import { buildCategoryTree } from "@/features/categories/lib/category-tree";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { getTransactionAnalyticsAmount, getTransactionPrimaryAccount, getTransactionSignedAmount } from "@/features/transactions/lib/transaction-utils";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type { CurrencyCode } from "@/types/currency";
import type { Account, CategoryTreeNode, FinanceSnapshot, Transaction } from "@/types/finance";

export type CurrencyTotal = {
  currency: CurrencyCode;
  amount: number;
};

export type CurrencyCashflowSummary = {
  currency: CurrencyCode;
  income: number;
  expenses: number;
};

function sortByCurrencyOrder<T extends { currency: CurrencyCode }>(items: T[]) {
  return [...items].sort(
    (left, right) => SUPPORTED_CURRENCY_CODES.indexOf(left.currency) - SUPPORTED_CURRENCY_CODES.indexOf(right.currency),
  );
}

export function getTotalBalance(accounts: Account[]) {
  return getNetWorthTotal(accounts);
}

export function getIncomeExpenseSummary(transactions: Transaction[]) {
  return transactions.reduce(
    (summary, transaction) => {
      const amount = getTransactionAnalyticsAmount(transaction);

      if (transaction.kind === "income") {
        summary.income += amount;
      } else {
        summary.expenses += amount;
      }

      return summary;
    },
    { income: 0, expenses: 0 },
  );
}

export function getTotalBalanceByCurrency(accounts: Account[]): CurrencyTotal[] {
  const grouped = accounts.reduce<Map<CurrencyCode, number>>((accumulator, account) => {
    accumulator.set(account.currency, (accumulator.get(account.currency) ?? 0) + account.balance);
    return accumulator;
  }, new Map());

  return sortByCurrencyOrder(Array.from(grouped.entries(), ([currency, amount]) => ({ currency, amount })));
}

export function getIncomeExpenseSummaryByCurrency(transactions: Transaction[]): CurrencyCashflowSummary[] {
  const grouped = transactions.reduce<Map<CurrencyCode, CurrencyCashflowSummary>>((accumulator, transaction) => {
    const account = getTransactionPrimaryAccount(transaction);

    if (!account) {
      return accumulator;
    }

    const currency = account.currency;
    const current = accumulator.get(currency) ?? { currency, income: 0, expenses: 0 };
    const amount = getTransactionAnalyticsAmount(transaction);

    if (transaction.kind === "income") {
      current.income += amount;
    } else {
      current.expenses += amount;
    }

    accumulator.set(currency, current);
    return accumulator;
  }, new Map());

  return sortByCurrencyOrder(Array.from(grouped.values()));
}

export function getRecentTransactions(snapshot: FinanceSnapshot, limit = 5) {
  return snapshot.transactions.filter((transaction) => transaction.status === "paid").slice(0, limit);
}

export function getTransactionsForDate(transactions: Transaction[], date: Date) {
  return transactions.filter(
    (transaction) => isVisibleTransactionStatus(transaction.status) && isSameDay(parseISO(transaction.occurred_at), date),
  );
}

export function getTransactionsForAccount(transactions: Transaction[], accountId: string) {
  return transactions.filter(
    (transaction) =>
      isVisibleTransactionStatus(transaction.status) &&
      (transaction.source_account_id === accountId || transaction.destination_account_id === accountId),
  );
}

export function getCashAccounts(accounts: Account[]) {
  return accounts.filter((account) => getAccountGroup(account.type) === "cash");
}

export function getSavingAccounts(accounts: Account[]) {
  return accounts.filter((account) => getAccountGroup(account.type) === "saving");
}

export function getCreditCardAccounts(accounts: Account[]) {
  return accounts.filter((account) => getAccountGroup(account.type) === "credit_card");
}

export function getDebtAccounts(accounts: Account[]) {
  return accounts.filter((account) => getAccountGroup(account.type) === "debt");
}

export function getCategoryTree(snapshot: FinanceSnapshot): CategoryTreeNode[] {
  return buildCategoryTree(snapshot.categories, snapshot.transactions);
}

export function getNetTransactionEffect(transactions: Transaction[]) {
  return transactions.reduce((sum, transaction) => sum + getTransactionSignedAmount(transaction), 0);
}

export function getEffectiveAllocations(balance: number, allocations: WalletAllocation[]): WalletAllocation[] {
  if (allocations.length === 0) return [];
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  if (totalAllocated <= balance) return allocations;

  const sorted = [...allocations].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at).getTime();
    const timeB = new Date(b.updated_at || b.created_at).getTime();
    return timeB - timeA;
  });

  let excess = totalAllocated - balance;
  const reducedAmounts = new Map<string, number>();

  for (const allocation of sorted) {
    if (excess <= 0) break;
    const reduction = Math.min(allocation.amount, excess);
    reducedAmounts.set(allocation.id, allocation.amount - reduction);
    excess -= reduction;
  }

  return allocations.map((a) => {
    if (reducedAmounts.has(a.id)) {
      return {
        ...a,
        amount: reducedAmounts.get(a.id)!,
      };
    }
    return a;
  });
}
