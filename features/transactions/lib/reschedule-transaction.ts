import type { Transaction } from "@/types/finance";
import type { TransactionInput } from "@/types/finance-schemas";

/**
 * Builds the update payload that moves a single planned transaction (or a single
 * recurring occurrence) to a new date. Recurring occurrences keep their
 * `schedule_occurrence_date` slot; the repository/optimistic layer marks them as
 * overrides, so the rest of the series stays on its own dates.
 */
export function buildRescheduleInput(transaction: Transaction, newDate: string): TransactionInput {
  return {
    title: transaction.title,
    note: transaction.note,
    occurred_at: newDate,
    status: "planned",
    kind: transaction.kind,
    amount: transaction.amount,
    destination_amount: transaction.destination_amount,
    fx_rate: transaction.fx_rate,
    principal_amount: transaction.principal_amount,
    interest_amount: transaction.interest_amount,
    extra_principal_amount: transaction.extra_principal_amount,
    category_id: transaction.category_id,
    source_account_id: transaction.source_account_id,
    destination_account_id: transaction.destination_account_id,
    allocation_id: transaction.allocation_id,
    source_allocation_id: transaction.source_allocation_id ?? null,
    investment_instrument_id: transaction.investment_instrument_id ?? null,
    investment_units: transaction.investment_units ?? null,
  };
}
