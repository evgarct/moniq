import { isSameDay, parseISO } from "date-fns";

import { getAccountGroup, getNetWorthTotal } from "@/features/accounts/lib/account-utils";
import { getAllocatedTotalForAccount } from "@/features/allocations/lib/allocation-utils";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import type { CurrencyCode } from "@/types/currency";
import type { Account, Allocation, FinanceSnapshot, Transaction } from "@/types/finance";

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
      if (transaction.type === "income") {
        summary.income += Math.abs(transaction.amount);
      } else {
        summary.expenses += Math.abs(transaction.amount);
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
    const currency = transaction.account.currency;
    const current = accumulator.get(currency) ?? { currency, income: 0, expenses: 0 };

    if (transaction.type === "income") {
      current.income += Math.abs(transaction.amount);
    } else {
      current.expenses += Math.abs(transaction.amount);
    }

    accumulator.set(currency, current);
    return accumulator;
  }, new Map());

  return sortByCurrencyOrder(Array.from(grouped.values()));
}

export function getRecentTransactions(snapshot: FinanceSnapshot, limit = 5) {
  return snapshot.transactions.slice(0, limit);
}

export function getTransactionsForDate(transactions: Transaction[], date: Date) {
  return transactions.filter((transaction) => isSameDay(parseISO(transaction.date), date));
}

export function getTransactionsForAccount(transactions: Transaction[], accountId: string) {
  return transactions.filter((transaction) => transaction.account.id === accountId);
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

export function getAllocationCoverage(accounts: Account[], allocations: Allocation[]) {
  return accounts
    .filter((account) => account.type === "saving")
    .map((account) => ({
      accountId: account.id,
      allocated: getAllocatedTotalForAccount(allocations, account.id),
    }));
}
