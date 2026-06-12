import { addTransaction } from "@/features/finance/lib/optimistic-state";
import type { FinanceSnapshot } from "@/types/finance";
import type { TransactionInput } from "@/types/finance-schemas";
import type { TransactionImport, TransactionImportSnapshot } from "@/types/imports";

export type ImportedTransactionPatch = {
  merchant_clean?: string;
  category_id?: string | null;
  kind?: TransactionImport["kind"];
  wallet_id?: string;
  counterpart_wallet_id?: string | null;
};

function updateTransactionRelations(
  snapshot: TransactionImportSnapshot,
  transaction: TransactionImport,
  values: ImportedTransactionPatch,
) {
  const categoryId = values.category_id === undefined ? transaction.category_id : values.category_id;
  const walletId = values.wallet_id ?? transaction.wallet_id;
  const counterpartWalletId =
    values.counterpart_wallet_id === undefined
      ? transaction.counterpart_wallet_id
      : values.counterpart_wallet_id;

  return {
    ...transaction,
    ...values,
    category_id: categoryId,
    category: categoryId
      ? snapshot.categories.find((category) => category.id === categoryId) ?? null
      : null,
    wallet_id: walletId,
    wallet: snapshot.wallets.find((wallet) => wallet.id === walletId) ?? null,
    counterpart_wallet_id: counterpartWalletId,
    counterpart_wallet: counterpartWalletId
      ? snapshot.wallets.find((wallet) => wallet.id === counterpartWalletId) ?? null
      : null,
    updated_at: new Date().toISOString(),
  };
}

export function updateImportedTransaction(
  snapshot: TransactionImportSnapshot,
  transactionId: string,
  values: ImportedTransactionPatch,
) {
  const update = (transaction: TransactionImport) =>
    transaction.id === transactionId
      ? updateTransactionRelations(snapshot, transaction, values)
      : transaction;

  return {
    ...snapshot,
    draftTransactions: snapshot.draftTransactions.map(update),
    confirmedTransactions: snapshot.confirmedTransactions.map(update),
  };
}

export function deleteImportedTransaction(
  snapshot: TransactionImportSnapshot,
  transactionId: string,
) {
  return {
    ...snapshot,
    draftTransactions: snapshot.draftTransactions.filter(
      (transaction) => transaction.id !== transactionId,
    ),
    confirmedTransactions: snapshot.confirmedTransactions.filter(
      (transaction) => transaction.id !== transactionId,
    ),
  };
}

export function deleteImportBatch(snapshot: TransactionImportSnapshot, batchId: string) {
  return {
    ...snapshot,
    batches: snapshot.batches.filter((batch) => batch.id !== batchId),
    draftTransactions: snapshot.draftTransactions.filter(
      (transaction) => transaction.batch_id !== batchId,
    ),
    confirmedTransactions: snapshot.confirmedTransactions.filter(
      (transaction) => transaction.batch_id !== batchId,
    ),
  };
}

function toFinanceInput(transaction: TransactionImport): TransactionInput {
  const title =
    transaction.category?.name?.trim() ||
    transaction.merchant_clean.trim() ||
    transaction.merchant_raw.trim();
  const amount = Math.abs(transaction.amount);
  const base: TransactionInput = {
    title,
    note:
      transaction.kind === "expense" || transaction.kind === "income"
        ? transaction.merchant_clean.trim() || null
        : null,
    occurred_at: transaction.occurred_at,
    status: "paid",
    kind: transaction.kind,
    amount,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: transaction.category_id,
    source_account_id: null,
    destination_account_id: null,
    allocation_id: null,
  };

  if (transaction.kind === "expense") {
    return { ...base, source_account_id: transaction.wallet_id };
  }
  if (transaction.kind === "income") {
    return { ...base, destination_account_id: transaction.wallet_id };
  }
  if (transaction.kind === "debt_payment") {
    return {
      ...base,
      source_account_id: transaction.wallet_id,
      destination_account_id: transaction.counterpart_wallet_id,
      principal_amount: amount,
    };
  }

  const outgoing = transaction.amount < 0;
  return {
    ...base,
    source_account_id: outgoing ? transaction.wallet_id : transaction.counterpart_wallet_id,
    destination_account_id: outgoing ? transaction.counterpart_wallet_id : transaction.wallet_id,
    destination_amount: amount,
  };
}

export function addImportedTransactionsToFinance(
  finance: FinanceSnapshot,
  transactions: TransactionImport[],
) {
  return transactions.reduce((nextFinance, transaction) => {
    const optimisticId = `optimistic:import:${transaction.id}`;
    return addTransaction(nextFinance, toFinanceInput(transaction), optimisticId);
  }, finance);
}

export function confirmImportedTransactionsInBanking(
  banking: TransactionImportSnapshot,
  transactionIds: string[],
) {
  const selectedIds = new Set(transactionIds);
  const confirmed = banking.draftTransactions
    .filter((transaction) => selectedIds.has(transaction.id))
    .map((transaction) => ({
      ...transaction,
      status: "confirmed" as const,
      finance_transaction_id: `optimistic:import:${transaction.id}`,
      finance_transaction: null,
      updated_at: new Date().toISOString(),
    }));

  return {
    ...banking,
    draftTransactions: banking.draftTransactions.filter(
      (transaction) => !selectedIds.has(transaction.id),
    ),
    confirmedTransactions: [...confirmed, ...banking.confirmedTransactions],
  };
}

export function confirmImportedTransactions(
  banking: TransactionImportSnapshot,
  finance: FinanceSnapshot,
  transactionIds: string[],
) {
  const selectedIds = new Set(transactionIds);
  const selected = banking.draftTransactions.filter((transaction) =>
    selectedIds.has(transaction.id),
  );

  return {
    banking: confirmImportedTransactionsInBanking(banking, transactionIds),
    finance: addImportedTransactionsToFinance(finance, selected),
  };
}
