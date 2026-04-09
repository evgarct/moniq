import { addDays, formatISO, startOfToday } from "date-fns";
import { describe, expect, it } from "vitest";

import { getTodayViewTransactions } from "@/features/today/lib/today-transactions";
import type { Transaction } from "@/types/finance";

const today = startOfToday();

function makeTransaction(values: {
  id: string;
  dayOffset: number;
  status: Transaction["status"];
  createdAtOffset?: number;
}): Transaction {
  return {
    id: values.id,
    user_id: "user",
    title: values.id,
    note: null,
    occurred_at: formatISO(addDays(today, values.dayOffset), { representation: "date" }),
    created_at: formatISO(addDays(today, values.createdAtOffset ?? values.dayOffset)),
    status: values.status,
    kind: "expense",
    amount: 100,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: null,
    source_account_id: null,
    destination_account_id: null,
    allocation_id: null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    category: null,
    source_account: null,
    destination_account: null,
    allocation: null,
    schedule: null,
  };
}

describe("getTodayViewTransactions", () => {
  it("returns today's paid plus the next week of planned transactions by default", () => {
    const transactions = [
      makeTransaction({ id: "paid-today", dayOffset: 0, status: "paid" }),
      makeTransaction({ id: "planned-today", dayOffset: 0, status: "planned" }),
      makeTransaction({ id: "planned-soon", dayOffset: 3, status: "planned" }),
      makeTransaction({ id: "planned-later", dayOffset: 10, status: "planned" }),
      makeTransaction({ id: "paid-yesterday", dayOffset: -1, status: "paid" }),
    ];

    const result = getTodayViewTransactions({
      transactions,
      month: today,
      selectedDate: today,
      today,
    });

    expect(result.mode).toBe("today");
    expect(result.groupByDate).toBe(true);
    expect(result.transactions.map((transaction) => transaction.id)).toEqual([
      "paid-today",
      "planned-today",
      "planned-soon",
    ]);
  });

  it("returns both paid and planned transactions for a selected day", () => {
    const selectedDate = addDays(today, -1);
    const transactions = [
      makeTransaction({ id: "planned-day", dayOffset: -1, status: "planned" }),
      makeTransaction({ id: "paid-day", dayOffset: -1, status: "paid" }),
      makeTransaction({ id: "other-day", dayOffset: 1, status: "paid" }),
    ];

    const result = getTodayViewTransactions({
      transactions,
      month: today,
      selectedDate,
      today,
    });

    expect(result.mode).toBe("day");
    expect(result.groupByDate).toBe(false);
    expect(result.transactions.map((transaction) => transaction.id)).toEqual([
      "paid-day",
      "planned-day",
    ]);
  });

  it("returns the whole month grouped in date order when selection is cleared", () => {
    const transactions = [
      makeTransaction({ id: "planned-first", dayOffset: -2, status: "planned" }),
      makeTransaction({ id: "paid-first", dayOffset: -2, status: "paid" }),
      makeTransaction({ id: "paid-second", dayOffset: 0, status: "paid" }),
      makeTransaction({ id: "skipped-second", dayOffset: 0, status: "skipped" }),
    ];

    const result = getTodayViewTransactions({
      transactions,
      month: today,
      selectedDate: null,
      today,
    });

    expect(result.mode).toBe("month");
    expect(result.groupByDate).toBe(true);
    expect(result.transactions.map((transaction) => transaction.id)).toEqual([
      "paid-first",
      "planned-first",
      "paid-second",
    ]);
  });
});
