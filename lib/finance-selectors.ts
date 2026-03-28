import { isSameDay, parseISO } from "date-fns";

import { getAccountGroup, getNetWorthTotal } from "@/features/accounts/lib/account-utils";
import { getAllocatedTotalForAccount } from "@/features/allocations/lib/allocation-utils";
import type { Account, Allocation, FinanceSnapshot, Transaction } from "@/types/finance";

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

export function getRecentTransactions(snapshot: FinanceSnapshot, limit = 5) {
  return snapshot.transactions.slice(0, limit);
}

export function getTransactionsForDate(transactions: Transaction[], date: Date) {
  return transactions.filter((transaction) => isSameDay(parseISO(transaction.date), date));
}

export function getTransactionsForAccount(transactions: Transaction[], accountId: string) {
  return transactions.filter((transaction) => transaction.account.id === accountId);
}

export function getAvailableMoneyAccounts(accounts: Account[]) {
  return accounts.filter((account) => getAccountGroup(account.type) === "available_money");
}

export function getDebtAccounts(accounts: Account[]) {
  return accounts.filter((account) => getAccountGroup(account.type) === "debt");
}

export function getAllocationCoverage(accounts: Account[], allocations: Allocation[]) {
  return accounts
    .filter((account) => account.type === "savings")
    .map((account) => ({
      accountId: account.id,
      allocated: getAllocatedTotalForAccount(allocations, account.id),
    }));
}
