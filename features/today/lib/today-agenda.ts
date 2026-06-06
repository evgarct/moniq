import { addDays, format } from "date-fns";

import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { Transaction } from "@/types/finance";

function sortAscending(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
}

export function selectTodayAgenda(
  transactions: Transaction[],
  today: Date,
  selectedDate: Date | null,
) {
  const visible = transactions.filter((transaction) => isVisibleTransactionStatus(transaction.status));

  if (selectedDate) {
    const date = format(selectedDate, "yyyy-MM-dd");
    return {
      planned: sortAscending(
        visible.filter((transaction) => transaction.status === "planned" && transaction.occurred_at === date),
      ),
      paid: sortAscending(
        visible.filter((transaction) => transaction.status === "paid" && transaction.occurred_at === date),
      ),
    };
  }

  const todayDate = format(today, "yyyy-MM-dd");
  const windowEnd = format(addDays(today, 3), "yyyy-MM-dd");
  return {
    planned: sortAscending(
      visible.filter(
        (transaction) =>
          transaction.status === "planned" && transaction.occurred_at <= windowEnd,
      ),
    ),
    paid: sortAscending(
      visible.filter(
        (transaction) => transaction.status === "paid" && transaction.occurred_at === todayDate,
      ),
    ),
  };
}
