import type { Category, Transaction, Account, TransactionKind } from "@/types/finance";

export type TransactionImportStatus = "draft" | "confirmed" | "edited";
export type ImportColumnKey = "date" | "amount" | "debit" | "credit" | "description" | "currency" | "type" | "externalId";

export type ImportColumnOption = {
  index: number;
  key: string;
  label: string;
};

export type ImportColumnMapping = {
  date: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  description: string | null;
  currency: string | null;
  type: string | null;
  externalId: string | null;
};

export type ImportPreviewRow = {
  rowIndex: number;
  values: string[];
};

export type ImportFilePreview = {
  fileName: string;
  signature: string;
  columns: ImportColumnOption[];
  rows: ImportPreviewRow[];
  suggestedMapping: ImportColumnMapping;
  canImport: boolean;
};

export type TransactionImportBatch = {
  id: string;
  user_id: string;
  wallet_id: string;
  source: string;
  file_name: string;
  imported_rows: number;
  wallet: Account | null;
  created_at: string;
};

export type TransactionImportRule = {
  id: string;
  user_id: string;
  merchant_pattern: string;
  category_id: string;
  category: Category | null;
  created_at: string;
  updated_at: string;
};

export type TransactionImport = {
  id: string;
  user_id: string;
  batch_id: string;
  wallet_id: string;
  finance_transaction_id: string | null;
  external_id: string | null;
  row_index: number;
  fingerprint: string;
  amount: number;
  currency: string;
  occurred_at: string;
  kind: Extract<TransactionKind, "income" | "expense" | "transfer" | "debt_payment">;
  counterpart_wallet_id: string | null;
  merchant_raw: string;
  merchant_clean: string;
  category_id: string | null;
  category: Category | null;
  status: TransactionImportStatus;
  batch: TransactionImportBatch | null;
  wallet: Account | null;
  counterpart_wallet: Account | null;
  finance_transaction: Transaction | null;
  created_at: string;
  updated_at: string;
};

export type TransactionImportSnapshot = {
  batches: TransactionImportBatch[];
  rules: TransactionImportRule[];
  wallets: Account[];
  categories: Category[];
  draftTransactions: TransactionImport[];
  confirmedTransactions: TransactionImport[];
};
