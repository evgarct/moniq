import type {
  FinanceSnapshot,
  Transaction,
  TransactionSchedule,
} from "@/types/finance";
import type {
  RecurringOccurrenceChangesInput,
  TransactionInput,
} from "@/types/finance-schemas";

export const recurringOccurrenceChangeFields = [
  "title",
  "note",
  "occurred_at",
  "kind",
  "amount",
  "destination_amount",
  "fx_rate",
  "principal_amount",
  "interest_amount",
  "extra_principal_amount",
  "category_id",
  "source_account_id",
  "destination_account_id",
  "allocation_id",
] as const;

export type RecurringOccurrenceChangeField =
  (typeof recurringOccurrenceChangeFields)[number];
export type RecurringOccurrenceChanges = RecurringOccurrenceChangesInput;

function comparableValue(value: unknown) {
  return value === undefined ? null : value;
}

export function getRecurringOccurrenceChanges(
  transaction: Transaction,
  values: TransactionInput,
): RecurringOccurrenceChanges {
  const changes =
    recurringOccurrenceChangeFields.reduce<RecurringOccurrenceChanges>(
      (result, field) => {
        if (
          comparableValue(values[field]) !== comparableValue(transaction[field])
        ) {
          Object.assign(result, { [field]: values[field] });
        }
        return result;
      },
      {},
    );

  // Expense/income/transfer titles are inferred from their related category or
  // accounts at submit time, even though title is not an editable form field.
  // Treat that inferred value as a real change only when its source changed.
  if (
    "title" in changes &&
    !("kind" in changes) &&
    !("category_id" in changes) &&
    !("source_account_id" in changes) &&
    !("destination_account_id" in changes)
  ) {
    delete changes.title;
  }

  return changes;
}

export function hasRecurringOccurrenceChanges(
  changes: RecurringOccurrenceChanges,
) {
  return Object.keys(changes).length > 0;
}

function applyScheduleChanges(
  schedule: TransactionSchedule,
  changes: RecurringOccurrenceChanges,
  nextStartDate: string,
): TransactionSchedule {
  const scheduleChanges = { ...changes };
  delete scheduleChanges.occurred_at;
  return {
    ...schedule,
    ...scheduleChanges,
    note: "note" in changes ? (changes.note ?? null) : schedule.note,
    start_date: nextStartDate,
    updated_at: new Date().toISOString(),
  };
}

function shiftDate(date: string, offsetDays: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

export function applyRecurringOccurrenceChanges(
  snapshot: FinanceSnapshot,
  scheduleId: string,
  fromOccurrenceDate: string,
  changes: RecurringOccurrenceChanges,
) {
  const schedule = snapshot.schedules.find(
    (candidate) => candidate.id === scheduleId,
  );
  const occurrence = snapshot.transactions.find(
    (transaction) =>
      transaction.schedule_id === scheduleId &&
      transaction.schedule_occurrence_date === fromOccurrenceDate &&
      transaction.status === "planned",
  );
  if (!schedule || !occurrence || !hasRecurringOccurrenceChanges(changes))
    return snapshot;

  const newOccurrenceDate = changes.occurred_at ?? occurrence.occurred_at;
  const offsetDays = Math.round(
    (Date.parse(`${newOccurrenceDate}T00:00:00Z`) -
      Date.parse(`${occurrence.occurred_at}T00:00:00Z`)) /
      86_400_000,
  );
  const nextSchedule = applyScheduleChanges(
    schedule,
    changes,
    shiftDate(schedule.start_date, offsetDays),
  );

  return {
    ...snapshot,
    schedules: snapshot.schedules.map((candidate) =>
      candidate.id === scheduleId ? nextSchedule : candidate,
    ),
    transactions: snapshot.transactions.map((transaction) => {
      if (
        transaction.schedule_id !== scheduleId ||
        transaction.status !== "planned" ||
        !transaction.schedule_occurrence_date ||
        transaction.schedule_occurrence_date < fromOccurrenceDate
      ) {
        return transaction;
      }

      const shiftedOccurrenceDate = shiftDate(
        transaction.schedule_occurrence_date,
        offsetDays,
      );
      return {
        ...transaction,
        ...changes,
        note: "note" in changes ? (changes.note ?? null) : transaction.note,
        occurred_at: shiftDate(transaction.occurred_at, offsetDays),
        schedule_occurrence_date: shiftedOccurrenceDate,
        is_schedule_override: false,
        schedule: nextSchedule,
        category:
          "category_id" in changes
            ? (snapshot.categories.find(
                (category) => category.id === changes.category_id,
              ) ?? null)
            : transaction.category,
        source_account:
          "source_account_id" in changes
            ? (snapshot.accounts.find(
                (account) => account.id === changes.source_account_id,
              ) ?? null)
            : transaction.source_account,
        destination_account:
          "destination_account_id" in changes
            ? (snapshot.accounts.find(
                (account) => account.id === changes.destination_account_id,
              ) ?? null)
            : transaction.destination_account,
        allocation:
          "allocation_id" in changes
            ? (snapshot.allocations.find(
                (allocation) => allocation.id === changes.allocation_id,
              ) ?? null)
            : transaction.allocation,
      };
    }),
  };
}
