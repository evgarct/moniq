import type { Category, Transaction } from "@/types/finance";

export type BankingConnectionStatus = "pending" | "connected" | "error";
export type BankingImportStatus = "draft" | "confirmed" | "edited";

export type BankingConnection = {
  id: string;
  user_id: string;
  provider: string;
  aspsp_name: string;
  session_id: string | null;
  state: string;
  redirect_url: string;
  status: BankingConnectionStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type BankingAccount = {
  id: string;
  user_id: string;
  connection_id: string;
  wallet_id: string | null;
  provider_account_id: string;
  name: string;
  currency: string;
  iban: string | null;
  institution_name: string | null;
  last_sync_date: string | null;
  created_at: string;
  updated_at: string;
};

export type BankingRule = {
  id: string;
  user_id: string;
  merchant_pattern: string;
  category_id: string;
  category: Category | null;
  created_at: string;
  updated_at: string;
};

export type BankingTransaction = {
  id: string;
  user_id: string;
  connection_id: string;
  banking_account_id: string;
  finance_transaction_id: string | null;
  external_id: string | null;
  fingerprint: string;
  amount: number;
  currency: string;
  transaction_date: string;
  merchant_raw: string;
  merchant_clean: string;
  category_id: string | null;
  category: Category | null;
  status: BankingImportStatus;
  banking_account: BankingAccount | null;
  finance_transaction: Transaction | null;
  created_at: string;
  updated_at: string;
};

export type BankingSnapshot = {
  connection: BankingConnection | null;
  accounts: BankingAccount[];
  rules: BankingRule[];
  draftTransactions: BankingTransaction[];
  confirmedTransactions: BankingTransaction[];
  categories: Category[];
};
