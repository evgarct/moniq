import type { Transaction } from "@/types/finance";

/** The destination receives principal only; interest leaves the source as expense. */
export function getTransactionDestinationAmount(transaction: Pick<Transaction, "kind" | "amount" | "destination_amount" | "principal_amount" | "extra_principal_amount"> & Partial<Pick<Transaction, "status" | "posted_destination_amount">>) {
  return transaction.kind === "debt_payment"
    ? transaction.status === "paid" && transaction.posted_destination_amount != null
      ? transaction.posted_destination_amount
      : Math.round(((transaction.principal_amount ?? 0) + (transaction.extra_principal_amount ?? 0)) * 100) / 100
    : transaction.destination_amount ?? transaction.amount;
}

export function getNextPostedDestinationAmount(next: Transaction, previous?: Transaction) {
  if (next.kind !== "debt_payment" || next.status !== "paid") return null;
  const fields = ["amount", "destination_amount", "principal_amount", "interest_amount", "extra_principal_amount", "source_account_id", "destination_account_id"] as const;
  if (previous?.kind === "debt_payment" && previous.status === "paid" && fields.every(field => (next[field] ?? null) === (previous[field] ?? null))) return previous.posted_destination_amount ?? getTransactionDestinationAmount(next);
  return getTransactionDestinationAmount({ ...next, posted_destination_amount: null });
}
