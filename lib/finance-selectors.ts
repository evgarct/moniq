import { isSameDay, parseISO } from "date-fns";

import type { Account, FinanceSnapshot, Transaction } from "@/types/finance";

export function getTotalBalance(accounts: Account[]) {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
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
