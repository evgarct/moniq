import type { TransactionInput } from "@/types/finance-schemas";
import type { Account, Category, Transaction } from "@/types/finance";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";

export function getTransactionAnalyticsAmount(transaction: Transaction) {
  if (!isSettledTransactionStatus(transaction.status)) {
    return 0;
  }

  if (transaction.kind === "income" || transaction.kind === "expense") {
    return Math.abs(transaction.amount);
  }

  if (transaction.kind === "debt_payment") {
    return Math.abs(transaction.interest_amount ?? 0);
  }

  return 0;
}

export function getTransactionPrimaryAccount(transaction: Transaction) {
  return transaction.source_account ?? transaction.destination_account;
}

export function getTransactionDisplayCategory(transaction: Transaction) {
  if (transaction.category) {
    return transaction.category.name;
  }

  if (transaction.kind === "transfer") {
    return "Transfer";
  }

  if (transaction.kind === "debt_payment") {
    return "Debt payment";
  }

  return "Uncategorized";
}

export function validateTransactionRelationships(
  values: TransactionInput,
  options: {
    accounts: Account[];
    categories: Category[];
  },
) {
  const sourceAccount = values.source_account_id
    ? options.accounts.find((account) => account.id === values.source_account_id) ?? null
    : null;
  const destinationAccount = values.destination_account_id
    ? options.accounts.find((account) => account.id === values.destination_account_id) ?? null
    : null;
  const category = values.category_id
    ? options.categories.find((item) => item.id === values.category_id) ?? null
    : null;

  if (values.source_account_id && !sourceAccount) {
    throw new Error("Source account not found.");
  }

  if (values.destination_account_id && !destinationAccount) {
    throw new Error("Destination account not found.");
  }

  if (values.category_id && !category) {
    throw new Error("Category not found.");
  }

  if ((values.kind === "income" || values.kind === "expense") && category?.type !== values.kind) {
    throw new Error("Choose a category with the matching type.");
  }

  if (values.kind === "debt_payment" && category && category.type !== "expense") {
    throw new Error("Debt payment interest can only use an expense category.");
  }

  if (values.kind === "debt_payment" && destinationAccount?.type !== "debt") {
    throw new Error("Debt payment must target a debt account.");
  }

  if (values.kind === "transfer" && values.category_id) {
    throw new Error("Transfers do not use categories.");
  }
}

export function getTransactionSignedAmount(transaction: Transaction) {
  if (!isSettledTransactionStatus(transaction.status)) {
    return 0;
  }

  if (transaction.kind === "income") {
    return Math.abs(transaction.amount);
  }

  if (transaction.kind === "transfer") {
    return 0;
  }

  return -Math.abs(transaction.amount);
}
