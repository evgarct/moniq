import { describe, expect, it } from "vitest";

import type {
  FinanceSnapshot,
  Transaction,
  TransactionSchedule,
} from "@/types/finance";
import type { TransactionInput } from "@/types/finance-schemas";
import {
  applyRecurringOccurrenceChanges,
  getRecurringOccurrenceChanges,
} from "./recurring-occurrence-changes";

const schedule = {
  id: "schedule-1",
  user_id: "user-1",
  title: "Rent",
  note: null,
  start_date: "2026-08-01",
  frequency: "monthly",
  interval_weeks: 1,
  until_date: null,
  state: "active",
  kind: "expense",
  amount: 100,
  destination_amount: null,
  fx_rate: null,
  principal_amount: null,
  interest_amount: null,
  extra_principal_amount: null,
  category_id: "category-1",
  source_account_id: "account-1",
  destination_account_id: null,
  category: null,
  source_account: null,
  destination_account: null,
  allocation_id: null,
  allocation: null,
  validation_error: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
} satisfies TransactionSchedule;

function occurrence(
  date: string,
  status: Transaction["status"] = "planned",
  override = false,
): Transaction {
  return {
    id: `${status}-${date}`,
    user_id: "user-1",
    title: schedule.title,
    note: schedule.note,
    occurred_at: date,
    created_at: "2026-08-01T00:00:00Z",
    status,
    kind: schedule.kind,
    amount: schedule.amount,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: schedule.category_id,
    source_account_id: schedule.source_account_id,
    destination_account_id: null,
    schedule_id: schedule.id,
    schedule_occurrence_date: date,
    is_schedule_override: override,
    category: null,
    source_account: null,
    destination_account: null,
    schedule,
    allocation_id: null,
    allocation: null,
  };
}

const input = {
  title: "Rent",
  note: null,
  occurred_at: "2026-09-01",
  status: "planned",
  kind: "expense",
  amount: 100,
  destination_amount: null,
  fx_rate: null,
  principal_amount: null,
  interest_amount: null,
  extra_principal_amount: null,
  category_id: "category-1",
  source_account_id: "account-1",
  destination_account_id: null,
  allocation_id: null,
  investment_instrument_id: null,
  investment_units: null,
} satisfies TransactionInput;

function snapshot(): FinanceSnapshot {
  return {
    accounts: [],
    categories: [],
    schedules: [schedule],
    transactions: [
      occurrence("2026-08-01"),
      occurrence("2026-09-01"),
      occurrence("2026-10-01", "planned", true),
      occurrence("2026-11-01", "paid"),
    ],
    allocations: [],
    preferences: { default_currency: "USD", default_currency_source: "saved" },
    exchange_rates: [],
    investment_positions: [],
  };
}

describe("recurring occurrence changes", () => {
  it("returns no changes for an unchanged normalized occurrence", () => {
    expect(
      getRecurringOccurrenceChanges(occurrence("2026-09-01"), input),
    ).toEqual({});
  });

  it("ignores a submit-time inferred title when its category and accounts are unchanged", () => {
    expect(
      getRecurringOccurrenceChanges(occurrence("2026-09-01"), {
        ...input,
        title: "Category display name",
      }),
    ).toEqual({});
  });

  it("returns only fields that actually changed", () => {
    expect(
      getRecurringOccurrenceChanges(occurrence("2026-09-01"), {
        ...input,
        note: "Bring receipt",
        amount: 125,
      }),
    ).toEqual({ note: "Bring receipt", amount: 125 });
  });

  it("applies changes to the selected and following planned occurrences", () => {
    const next = applyRecurringOccurrenceChanges(
      snapshot(),
      schedule.id,
      "2026-09-01",
      {
        note: "Updated",
        amount: 125,
      },
    );

    expect(
      next.transactions.find((item) => item.occurred_at === "2026-08-01")
        ?.amount,
    ).toBe(100);
    expect(
      next.transactions.find((item) => item.occurred_at === "2026-09-01"),
    ).toMatchObject({ note: "Updated", amount: 125 });
    expect(
      next.transactions.find((item) => item.occurred_at === "2026-10-01"),
    ).toMatchObject({
      note: "Updated",
      amount: 125,
      is_schedule_override: false,
    });
    expect(
      next.transactions.find((item) => item.occurred_at === "2026-11-01"),
    ).toMatchObject({ status: "paid", amount: 100 });
  });

  it("shifts the selected and following planned dates without moving paid history", () => {
    const next = applyRecurringOccurrenceChanges(
      snapshot(),
      schedule.id,
      "2026-09-01",
      {
        occurred_at: "2026-09-03",
      },
    );

    expect(next.schedules[0]?.start_date).toBe("2026-08-03");
    expect(
      next.transactions.map((item) => [item.status, item.occurred_at]),
    ).toEqual([
      ["planned", "2026-08-01"],
      ["planned", "2026-09-03"],
      ["planned", "2026-10-03"],
      ["paid", "2026-11-01"],
    ]);
  });
});
