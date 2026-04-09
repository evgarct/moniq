import { addDays, format, isAfter, isBefore, isSameDay, isSameMonth, parseISO, startOfDay } from "date-fns";

import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { Transaction } from "@/types/finance";

export type TodayViewMode = "today" | "day" | "month";

function transactionStatusRank(status: Transaction["status"]) {
  if (status === "paid") {
    return 0;
  }

  if (status === "planned") {
    return 1;
  }

  return 2;
}

function sortTransactionsAscending(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => {
    const dateCompare = left.occurred_at.localeCompare(right.occurred_at);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    const statusCompare = transactionStatusRank(left.status) - transactionStatusRank(right.status);

    if (statusCompare !== 0) {
      return statusCompare;
    }

    return left.created_at.localeCompare(right.created_at);
  });
}

function getVisibleTransactions(transactions: Transaction[]) {
  return transactions.filter((transaction) => isVisibleTransactionStatus(transaction.status));
}

function isWithinDefaultPlannedWindow(transaction: Transaction, today: Date) {
  if (transaction.status !== "planned") {
    return false;
  }

  const transactionDate = startOfDay(parseISO(transaction.occurred_at));
  const horizonEnd = startOfDay(addDays(today, 6));

  return !isBefore(transactionDate, today) && !isAfter(transactionDate, horizonEnd);
}

export function resolveTodayViewMode(selectedDate: Date | null, today: Date): TodayViewMode {
  if (!selectedDate) {
    return "month";
  }

  return isSameDay(selectedDate, today) ? "today" : "day";
}

export function getTodayViewTransactions({
  transactions,
  month,
  selectedDate,
  today,
}: {
  transactions: Transaction[];
  month: Date;
  selectedDate: Date | null;
  today: Date;
}) {
  const visibleTransactions = getVisibleTransactions(transactions);
  const mode = resolveTodayViewMode(selectedDate, today);

  if (mode === "today") {
    return {
      mode,
      groupByDate: true,
      transactions: sortTransactionsAscending(
        visibleTransactions.filter((transaction) => {
          const transactionDate = parseISO(transaction.occurred_at);
          return (
            (transaction.status === "paid" && isSameDay(transactionDate, today)) ||
            isWithinDefaultPlannedWindow(transaction, today)
          );
        }),
      ),
    };
  }

  if (mode === "day" && selectedDate) {
    return {
      mode,
      groupByDate: false,
      transactions: sortTransactionsAscending(
        visibleTransactions.filter((transaction) =>
          isSameDay(parseISO(transaction.occurred_at), selectedDate),
        ),
      ),
    };
  }

  return {
    mode,
    groupByDate: true,
    transactions: sortTransactionsAscending(
      visibleTransactions.filter((transaction) =>
        isSameMonth(parseISO(transaction.occurred_at), month),
      ),
    ),
  };
}

export function formatDayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}
