import type { Transaction } from "@/types/finance";

/** The destination receives principal only; interest leaves the source as expense. */
export function getTransactionDestinationAmount(transaction: Pick<Transaction, "kind" | "amount" | "destination_amount" | "principal_amount" | "extra_principal_amount">) {
  return transaction.kind === "debt_payment"
    ? Math.round(((transaction.principal_amount ?? 0) + (transaction.extra_principal_amount ?? 0)) * 100) / 100
    : transaction.destination_amount ?? transaction.amount;
}
